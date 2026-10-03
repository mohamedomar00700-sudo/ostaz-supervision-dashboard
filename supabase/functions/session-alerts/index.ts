// Supabase Edge Function: session-alerts
// - Called every minute by pg_cron (header x-cron-secret) → sends Web Push to every active
//   supervisor 15 minutes before each scheduled session, at start time, and at planned end.
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

// Loud alarm channel: ntfy app (free). Max priority + the Android setting
// "Keep alerting for highest priority" loops the alarm sound until dismissed.
const APP_URL = 'https://mohamedomar00700-sudo.github.io/ostaz-supervision-dashboard/';
type Alarm = { user_id: string; ntfy_topic: string };
async function ntfySend(chans: Alarm[], msg: { title: string; message: string; priority: number; tags?: string[]; click?: string }) {
  return Promise.all(chans.map(async (c) => {
    try {
      const r = await fetch('https://ntfy.sh/', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: c.ntfy_topic, ...msg }) });
      if (r.ok) await admin.from('alarm_channels').update({ last_ok_at: new Date().toISOString() }).eq('user_id', c.user_id);
      return { user: c.user_id, status: r.status };
    } catch (e) { return { user: c.user_id, status: 0, err: String(e).slice(0, 120) }; }
  }));
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
    const { data: tut } = await admin.from('tutors').select('id').eq('user_id', user.id).maybeSingle();
    if (!sup?.active && !tut) return json({ error: 'not an active supervisor or tutor' }, 403);
    const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', user.id);
    if (!subs?.length) return json({ sent: 0, results: [], note: 'no subscriptions for this user' });
    const results = await pushToSubs(subs as Sub[], {
      title: '✅ الإشعارات شغالة', body: 'ده إشعار تجريبي من أستاذ أونلاين. هتوصلك تنبيهات الحصص حتى والتطبيق مقفول.',
      tag: 'test-' + Date.now(), url: './',
    }, vapid);
    return json({ sent: results.filter(r => r.status >= 200 && r.status < 300).length, results });
  }

  // ---------- test of the loud alarm (ntfy) for the calling supervisor ----------
  if (body.action === 'alarm_test') {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: 'unauthorized' }, 401);
    const { data: ch } = await admin.from('alarm_channels').select('user_id,ntfy_topic').eq('user_id', user.id).maybeSingle();
    if (!ch) return json({ error: 'no alarm channel' }, 404);
    const delay = Math.min(Math.max(Number(body.delay) || 0, 0), 25);
    if (delay) await new Promise((r) => setTimeout(r, delay * 1000));
    const r = await ntfySend([ch as Alarm], { title: '⏰ تجربة منبه أستاذ أونلاين', message: 'لو سامع/ة الصوت ده والموبايل مقفول يبقى المنبه شغال ✅', priority: 5, tags: ['alarm_clock'], click: APP_URL });
    return json({ sent: r });
  }

  // ---------- scheduled run (pg_cron) ----------
  if (req.headers.get('x-cron-secret') !== S.cron_secret) return json({ error: 'forbidden' }, 403);

  // delayed test pushes requested from the dashboard ("اقفل الموبايل واستنى")
  const testReport: any[] = [];
  const { data: tests } = await admin.from('push_test_requests').select('*').is('sent_at', null).lte('due_at', new Date().toISOString()).limit(20);
  for (const t of tests || []) {
    const { data: claimedTest } = await admin.from('push_test_requests').update({ sent_at: new Date().toISOString() }).eq('id', t.id).is('sent_at', null).select();
    if (!claimedTest?.length) continue;
    const { data: tsubs } = await admin.from('push_subscriptions').select('*').eq('user_id', t.user_id);
    const r = await pushToSubs((tsubs || []) as Sub[], {
      title: '✅ وصلك الإشعار والتطبيق مقفول', body: 'تنبيهات الحصص شغالة على الجهاز ده. هيوصلك تنبيه قبل كل حصة بـ 15 دقيقة وعند موعدها.',
      tag: 'test-delayed-' + t.id, url: './',
    }, vapid);
    await admin.from('push_test_requests').update({ result: JSON.stringify(r).slice(0, 500) }).eq('id', t.id);
    testReport.push({ test: t.id, r });
  }

  const now = Date.now();
  const { data: sessions, error } = await admin.from('sessions')
    .select('id, scheduled_at, duration_minutes, status, kind, subject, student_id, tutor_id, meeting_link, group_key, group_name')
    .in('status', ['scheduled', 'in_progress'])
    .gte('scheduled_at', new Date(now - 13 * 3600e3).toISOString())
    .lte('scheduled_at', new Date(now + 15 * 60e3 + 30e3).toISOString());
  if (error) return json({ error: error.message }, 500);

  // the dedupe key includes the scheduled time, so a rescheduled session is announced again
  // a group occurrence has one row per student → announce it once, via its first row
  const members: Record<string, any[]> = {};
  for (const s of sessions || []) if (s.group_key) (members[s.group_key] ||= []).push(s);
  const reps = (sessions || []).filter((s: any) => !s.group_key || members[s.group_key].map((x: any) => x.id).sort()[0] === s.id);
  const due: { session_id: string; kind: string }[] = [];
  for (const s of reps) {
    const t = new Date(s.scheduled_at).getTime();
    const end = t + (s.duration_minutes || 60) * 60e3;
    if (s.status === 'scheduled' && now >= t - 15 * 60e3 - 30e3 && now < t - 60e3) due.push({ session_id: s.id, kind: `before15@${t}` });
    if (s.status === 'scheduled' && now >= t - 30e3 && now < t + 10 * 60e3) due.push({ session_id: s.id, kind: `start@${t}` });
    if (now >= end - 30e3 && now < end + 10 * 60e3) due.push({ session_id: s.id, kind: `end@${t}@${s.duration_minutes}` });
  }
  if (!due.length) return json({ checked: sessions?.length || 0, sent: 0, tests: testReport.length });

  // claim alerts atomically so a session is never announced twice
  const { data: claimed, error: claimErr } = await admin.from('session_alert_log')
    .upsert(due, { onConflict: 'session_id,kind', ignoreDuplicates: true }).select();
  if (claimErr) return json({ error: claimErr.message }, 500);
  if (!claimed?.length) return json({ checked: sessions!.length, sent: 0, note: 'already sent' });

  const byId = Object.fromEntries(sessions!.map((s: any) => [s.id, s]));
  const stuIds = [...new Set(claimed.flatMap((c: any) => { const s = byId[c.session_id]; return s.group_key ? members[s.group_key].map((x: any) => x.student_id) : [s.student_id]; }))];
  const tutIds = [...new Set(claimed.map((c: any) => byId[c.session_id].tutor_id))];
  const [{ data: students }, { data: tutors }, { data: supervisors }] = await Promise.all([
    admin.from('students').select('id,name,family_id,families(name)').in('id', stuIds),
    admin.from('tutors').select('id,name,user_id').in('id', tutIds),
    admin.from('supervisors').select('id').eq('active', true),
  ]);
  const activeIds = (supervisors || []).map((s: any) => s.id);
  const { data: subs } = activeIds.length
    ? await admin.from('push_subscriptions').select('*').in('user_id', activeIds)
    : { data: [] as Sub[] };
  const { data: alarms } = activeIds.length
    ? await admin.from('alarm_channels').select('user_id,ntfy_topic').eq('enabled', true).in('user_id', activeIds)
    : { data: [] as Alarm[] };

  const report: any[] = [];
  for (const c of claimed as any[]) {
    const s = byId[c.session_id];
    const st: any = students?.find((x: any) => x.id === s.student_id);
    const tu: any = tutors?.find((x: any) => x.id === s.tutor_id);
    const mins = Math.max(1, Math.round((new Date(s.scheduled_at).getTime() - now) / 60e3));
    const who = s.group_key
      ? `👥 ${s.group_name || 'مجموعة'}: ${members[s.group_key].map((m: any) => students?.find((x: any) => x.id === m.student_id)?.name || '').filter(Boolean).join('، ')}`
      : `${st?.name || 'طالب'}${st?.families?.name ? ' (' + st.families.name + ')' : ''}`;
    const what = `${s.subject ? s.subject + ' مع ' : 'مع '}${tu?.name || 'المعلم'}`;
    const rev = s.kind === 'revision' ? ' (مراجعة)' : s.kind === 'group' ? ' (مجموعة)' : '';
    const endIso = new Date(new Date(s.scheduled_at).getTime() + (s.duration_minutes || 60) * 60e3).toISOString();
    const payload = c.kind.startsWith('before15')
      ? { title: `⏰ حصة${rev} بعد ${mins} دقيقة — ${cairoTime(s.scheduled_at)}`, body: `${who}\n${what}\nابعت التذكير للأسرة والمعلم.` }
      : c.kind.startsWith('start')
      ? { title: `🔔 الحصة${rev} بدأت دلوقتي — ${cairoTime(s.scheduled_at)}`, body: `${who}\n${what}\nاتأكد إن الطرفين دخلوا.` }
      : { title: `⏱ الحصة المفروض خلصت — ${cairoTime(endIso)}`, body: `${who}\n${what}\nسجّلها "تمت"، ولو اتمدت اكتب المدة الفعلية.` };
    const day = new Date(new Date(s.scheduled_at).toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
    const dayStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const results = await pushToSubs((subs || []) as Sub[], {
      ...payload, tag: `${s.id}:${c.kind}`, url: `./?day=${dayStr}`, requireInteraction: true,
    }, vapid);
    const alarm = alarms?.length ? await ntfySend(alarms as Alarm[], {
      title: payload.title, message: payload.body, priority: c.kind.startsWith('end') ? 4 : 5,
      tags: [c.kind.startsWith('end') ? 'hourglass' : 'alarm_clock'], click: `${APP_URL}?day=${dayStr}`,
    }) : [];
    // تذكير المعلمة نفسها (قبل الحصة بـ 15 دقيقة وعند بدايتها) — من غير أي بيانات للأسرة
    let tutorPush: any[] = [];
    if (tu?.user_id && !c.kind.startsWith('end')) {
      const { data: tsubs } = await admin.from('push_subscriptions').select('*').eq('user_id', tu.user_id);
      if (tsubs?.length) {
        const names = s.group_key ? `👥 ${s.group_name || 'مجموعة'}: ${members[s.group_key].map((m: any) => students?.find((x: any) => x.id === m.student_id)?.name || '').filter(Boolean).join('، ')}` : (st?.name || 'الطالب');
        let link = s.meeting_link;
        if (!link) { const { data: pl } = await admin.from('student_subjects').select('meeting_link').eq('student_id', s.student_id).eq('tutor_id', s.tutor_id).not('meeting_link', 'is', null).limit(1); link = pl?.[0]?.meeting_link; }
        tutorPush = await pushToSubs(tsubs as Sub[], {
          title: c.kind.startsWith('before15') ? `⏰ حصتك بعد ${mins} دقيقة — ${cairoTime(s.scheduled_at)}` : `🔔 حصتك بدأت — ${cairoTime(s.scheduled_at)}`,
          body: `${names}${s.subject ? ' — ' + s.subject : ''}${s.kind === 'trial' ? '\n🧪 حصة تجريبية لطالب جديد' : ''}\n${link ? 'دوسي هنا وادخلي الحصة 🎥' : 'افتحي البوابة'}`,
          tag: `t:${s.id}:${c.kind}`, url: link ? (link.startsWith('http') ? link : 'https://' + link) : './', requireInteraction: true,
        }, vapid);
      }
    }
    report.push({ session: s.id, kind: c.kind, results, alarm, tutorPush });
  }
  return json({ checked: sessions!.length, sent: report.length, report, tests: testReport.length });
});
