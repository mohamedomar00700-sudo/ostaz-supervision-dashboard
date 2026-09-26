// Supabase Edge Function: session-alerts
// - Called every minute by pg_cron (header x-cron-secret) → sends Web Push to every active
//   supervisor 15 minutes before each scheduled session and again at start time.
// - Called from the dashboard with the user's JWT and {action:"test"} → sends a test push
//   to that user's own devices.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendWebPush } from './webpush.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cairoTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ar-EG-u-nu-latn', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Cairo' });

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

async function pushToSubs(subs: Sub[], payload: object, vapid: any) {
  const results = await Promise.all(subs.map(async (s) => {
    try {
      const r = await sendWebPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload), vapid, { ttl: 900, urgency: 'high' });
      if (r.status === 404 || r.status === 410) await admin.from('push_subscriptions').delete().eq('id', s.id);
      else if (r.ok) await admin.from('push_subscriptions').update({ last_ok_at: new Date().toISOString() }).eq('id', s.id);
      return { id: s.id, status: r.status, err: r.ok ? undefined : r.text?.slice(0, 200) };
    } catch (e) {
      return { id: s.id, status: 0, err: String(e).slice(0, 200) };
    }
  }));
  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const { data: secretRows, error: secErr } = await admin.from('app_secrets').select('key,value');
  if (secErr) return json({ error: 'secrets: ' + secErr.message }, 500);
  const S = Object.fromEntries(secretRows!.map((r: any) => [r.key, r.value]));
  const vapid = { publicKey: S.vapid_public, privateKey: S.vapid_private, subject: S.vapid_subject };

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  // ---------- test push for the calling supervisor ----------
  if (body.action === 'test') {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: 'unauthorized' }, 401);
    const { data: sup } = await admin.from('supervisors').select('active').eq('id', user.id).maybeSingle();
    if (!sup?.active) return json({ error: 'not an active supervisor' }, 403);
    const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', user.id);
    if (!subs?.length) return json({ sent: 0, results: [], note: 'no subscriptions for this user' });
    const results = await pushToSubs(subs as Sub[], {
      title: '✅ الإشعارات شغالة', body: 'ده إشعار تجريبي من لوحة إشراف أستاذ أونلاين. هتوصلك تنبيهات الحصص حتى والتطبيق مقفول.',
      tag: 'test-' + Date.now(), url: './',
    }, vapid);
    return json({ sent: results.filter(r => r.status >= 200 && r.status < 300).length, results });
  }

  // ---------- scheduled run (pg_cron) ----------
  if (req.headers.get('x-cron-secret') !== S.cron_secret) return json({ error: 'forbidden' }, 403);

  const now = Date.now();
  const { data: sessions, error } = await admin.from('sessions')
    .select('id, scheduled_at, subject, student_id, tutor_id, meeting_link')
    .eq('status', 'scheduled')
    .gte('scheduled_at', new Date(now - 10 * 60e3).toISOString())
    .lte('scheduled_at', new Date(now + 15 * 60e3 + 30e3).toISOString());
  if (error) return json({ error: error.message }, 500);

  const due: { session_id: string; kind: string }[] = [];
  for (const s of sessions || []) {
    const t = new Date(s.scheduled_at).getTime();
    if (now >= t - 15 * 60e3 - 30e3 && now < t - 60e3) due.push({ session_id: s.id, kind: 'before15' });
    if (now >= t - 30e3 && now < t + 10 * 60e3) due.push({ session_id: s.id, kind: 'start' });
  }
  if (!due.length) return json({ checked: sessions?.length || 0, sent: 0 });

  // claim alerts atomically so a session is never announced twice
  const { data: claimed, error: claimErr } = await admin.from('session_alert_log')
    .upsert(due, { onConflict: 'session_id,kind', ignoreDuplicates: true }).select();
  if (claimErr) return json({ error: claimErr.message }, 500);
  if (!claimed?.length) return json({ checked: sessions!.length, sent: 0, note: 'already sent' });

  const byId = Object.fromEntries(sessions!.map((s: any) => [s.id, s]));
  const stuIds = [...new Set(claimed.map((c: any) => byId[c.session_id].student_id))];
  const tutIds = [...new Set(claimed.map((c: any) => byId[c.session_id].tutor_id))];
  const [{ data: students }, { data: tutors }, { data: supervisors }] = await Promise.all([
    admin.from('students').select('id,name,family_id,families(name)').in('id', stuIds),
    admin.from('tutors').select('id,name').in('id', tutIds),
    admin.from('supervisors').select('id').eq('active', true),
  ]);
  const activeIds = (supervisors || []).map((s: any) => s.id);
  const { data: subs } = activeIds.length
    ? await admin.from('push_subscriptions').select('*').in('user_id', activeIds)
    : { data: [] as Sub[] };

  const report: any[] = [];
  for (const c of claimed as any[]) {
    const s = byId[c.session_id];
    const st: any = students?.find((x: any) => x.id === s.student_id);
    const tu: any = tutors?.find((x: any) => x.id === s.tutor_id);
    const mins = Math.max(1, Math.round((new Date(s.scheduled_at).getTime() - now) / 60e3));
    const who = `${st?.name || 'طالب'}${st?.families?.name ? ' (' + st.families.name + ')' : ''}`;
    const what = `${s.subject ? s.subject + ' مع ' : 'مع '}${tu?.name || 'المعلم'}`;
    const payload = c.kind === 'before15'
      ? { title: `⏰ حصة بعد ${mins} دقيقة — ${cairoTime(s.scheduled_at)}`, body: `${who}\n${what}\nابعت التذكير للأسرة والمعلم.` }
      : { title: `🔔 الحصة بدأت دلوقتي — ${cairoTime(s.scheduled_at)}`, body: `${who}\n${what}\nاتأكد إن الطرفين دخلوا.` };
    const day = new Date(new Date(s.scheduled_at).toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
    const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const results = await pushToSubs((subs || []) as Sub[], {
      ...payload, tag: `${s.id}:${c.kind}`, url: `./?day=${dayStr}`, requireInteraction: true,
    }, vapid);
    report.push({ session: s.id, kind: c.kind, results });
  }
  return json({ checked: sessions!.length, sent: report.length, report });
});
