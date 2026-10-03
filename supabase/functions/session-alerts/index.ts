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

// ---------- تحديثات جدول المعلمة اللي الإشراف عملها من عنده ----------
const durL = (min: number) => {
  min = Math.round(Number(min) || 0); const h = Math.floor(min / 60), m = min % 60;
  const hl = h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : h >= 3 && h <= 10 ? `${h} ساعات` : h ? `${h} ساعة` : '';
  if (!h) return m === 30 ? 'نص ساعة' : m === 15 ? 'ربع ساعة' : m === 20 ? 'تلت ساعة' : `${m} دقيقة`;
  if (!m) return hl;
  return `${hl} ${m === 30 ? 'ونص' : m === 15 ? 'وربع' : m === 20 ? 'وتلت' : `و${m} دقيقة`}`;
};
const units = (min: number) => String(Math.round(min / 60 * 100) / 100);
const egp = (n: number) => String(Math.round(n * 100) / 100);
const dayTime = (iso: string) => `${new Date(iso).toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: 'Africa/Cairo' })} ${cairoTime(iso)}`;
type Line = { title: string; body: string; short: string };
function tutorChangeLines(evs: any[], ss: any[], sts: any[]): Line[] {
  const S = (id: string) => ss.find((x: any) => x.id === id);
  const who = (s: any) => s.group_key ? `👥 ${s.group_name || 'المجموعة'}` : (sts.find((x: any) => x.id === s.student_id)?.name || 'الطالب');
  const mins = (s: any) => Number(s.actual_minutes || s.duration_minutes || 60);
  const buckets = new Map<string, { ev: any; rows: any[] }>();
  for (const e of evs) {
    const s = S(e.session_id); if (!s) continue;
    if (e.kind === 'added' && s.status !== 'scheduled') continue;
    if ((e.kind === 'done' || e.kind === 'duration') && s.status !== 'done') continue;
    const k = e.kind === 'added' ? `added|${s.group_key || s.student_id}|${s.subject || ''}` : `${e.kind}|${s.group_key || s.id}|${e.kind === 'removed' ? e.old_at : s.scheduled_at}`;
    const b = buckets.get(k) || { ev: e, rows: [] };
    if (!b.rows.some((r: any) => r.id === s.id)) b.rows.push(s);
    if (e.kind === 'added' && s.group_key) { // صف واحد لكل طالب في المجموعة → عدّ المواعيد مش الصفوف
      b.rows = b.rows.filter((r: any, i: number, a: any[]) => a.findIndex((x: any) => x.scheduled_at === r.scheduled_at) === i);
    }
    buckets.set(k, b);
  }
  const out: Line[] = [];
  for (const { ev, rows } of buckets.values()) {
    rows.sort((a: any, b: any) => a.scheduled_at < b.scheduled_at ? -1 : 1);
    const s = rows[0], w = who(s), subj = s.subject ? `${s.subject} — ` : '';
    if (ev.kind === 'done' || ev.kind === 'duration') {
      const m = mins(s), amt = rows.reduce((a: number, r: any) => a + Number(r.tutor_charge_egp || 0), 0);
      const tail = `${durL(m)} = ${units(m)} حصة · ${egp(amt)} ج`;
      out.push(ev.kind === 'done'
        ? { title: `✅ اتسجلت حصة ${w}`, body: `${subj}${dayTime(s.scheduled_at)}\n⏱ ${tail}`, short: `✅ اتسجلت ${w}: ${tail}` }
        : { title: `✏️ اتعدلت مدة حصة ${w}`, body: `${subj}${dayTime(s.scheduled_at)}\n${durL(ev.old_minutes)} ← ${tail}`, short: `✏️ ${w}: بقت ${tail}` });
    } else if (ev.kind === 'cancelled') {
      out.push({ title: `✖ اتلغت حصة ${w}`, body: `${subj}${dayTime(s.scheduled_at)}`, short: `✖ اتلغت ${w} — ${dayTime(s.scheduled_at)}` });
    } else if (ev.kind === 'moved') {
      const d = ev.old_minutes && ev.old_minutes !== s.duration_minutes ? ` (${durL(s.duration_minutes)})` : '';
      const from = ev.old_at && ev.old_at !== s.scheduled_at ? `${dayTime(ev.old_at)} ← ` : 'المدة: ';
      out.push({ title: `🔁 اتغير معاد حصة ${w}`, body: `${subj}${from}${ev.old_at !== s.scheduled_at ? dayTime(s.scheduled_at) : ''}${d}`, short: `🔁 ${w}: ${from}${ev.old_at !== s.scheduled_at ? dayTime(s.scheduled_at) : ''}${d}` });
    } else if (ev.kind === 'removed') {
      out.push({ title: `↪️ حصة ${w} اتنقلت لمعلمة تانية`, body: `${subj}${dayTime(ev.old_at)}`, short: `↪️ ${w} (${dayTime(ev.old_at)}) اتنقلت` });
    } else if (ev.kind === 'added') {
      const n = rows.length;
      out.push(n === 1
        ? { title: `➕ حصة جديدة مع ${w}`, body: `${subj}${dayTime(s.scheduled_at)} (${durL(s.duration_minutes)})`, short: `➕ ${w}: ${dayTime(s.scheduled_at)}` }
        : { title: `➕ ${n} حصص جديدة مع ${w}`, body: `${subj}أولها ${dayTime(s.scheduled_at)} (${durL(s.duration_minutes)})`, short: `➕ ${n} حصص مع ${w} من ${dayTime(s.scheduled_at)}` });
    }
  }
  return out;
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

  // ---------- طلب جديد من معلمة / قرار على طلب ----------
  if (body.action === 'tutor_request' || body.action === 'tutor_request_decided') {
    const { data: r } = await admin.from('tutor_requests').select('*, tutors(name,user_id), students(name), sessions(scheduled_at,subject,duration_minutes)').eq('id', body.id).maybeSingle();
    if (!r) return json({ error: 'not found' }, 404);
    const KIND: Record<string, string> = { reschedule: 'تأجيل / تغيير معاد', cancel: 'إلغاء حصة', absent: 'الطالب ماحضرش', extend: 'الحصة اتمدت', remove_student: 'إيقاف طالب', other: 'طلب', payment_info: '💳 تغيير رقم التحويل', add_session: '➕ حصة إضافية' };
    const when = r.sessions?.scheduled_at ? ` (${new Date(r.sessions.scheduled_at).toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: 'Africa/Cairo' })} ${cairoTime(r.sessions.scheduled_at)})` : '';
    const to = r.proposed_at ? `\n➡️ المعاد المقترح: ${new Date(r.proposed_at).toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: 'Africa/Cairo' })} ${cairoTime(r.proposed_at)}` : r.proposed_minutes ? `\n⏱ المدة: ${r.proposed_minutes} دقيقة` : '';
    if (body.action === 'tutor_request') {
      const { data: sups } = await admin.from('supervisors').select('id').eq('active', true);
      const ids = (sups || []).map((x: any) => x.id);
      const { data: subs } = ids.length ? await admin.from('push_subscriptions').select('*').in('user_id', ids) : { data: [] };
      const payload = { title: `📨 ${r.tutors?.name || 'معلمة'}: ${KIND[r.kind]}`, body: r.kind === 'payment_info' ? `الجديد: ${r.new_value}\nالقديم: ${r.old_value || '—'}\n⚠️ اتأكد منها قبل الموافقة.` : `${r.students?.name || ''}${r.sessions?.subject ? ' — ' + r.sessions.subject : r.kind === 'add_session' && r.new_value ? ' — ' + r.new_value : ''}${r.kind === 'add_session' && r.scope === 'permanent' ? ' (ميعاد ثابت كل أسبوع)' : ''}${when}${to}${r.reason ? '\n📝 ' + r.reason : ''}\nافتح الطلب ووافق أو ارفض.`, tag: 'req-' + r.id, url: './?req=1', requireInteraction: true };
      const res = await pushToSubs((subs || []) as Sub[], payload, vapid);
      const { data: alarms } = ids.length ? await admin.from('alarm_channels').select('user_id,ntfy_topic').eq('enabled', true).in('user_id', ids) : { data: [] };
      const al = alarms?.length ? await ntfySend(alarms as Alarm[], { title: payload.title, message: payload.body, priority: 4, tags: ['incoming_envelope'], click: APP_URL + '?req=1' }) : [];
      return json({ sent: res.length, al });
    }
    if (!r.tutors?.user_id || r.status === 'pending') return json({ sent: 0 });
    const { data: tsubs } = await admin.from('push_subscriptions').select('*').eq('user_id', r.tutors.user_id);
    const res = await pushToSubs((tsubs || []) as Sub[], {
      title: r.status === 'approved' ? `✅ الإشراف وافق على طلبك` : `❌ الإشراف مش هيقدر ينفذ طلبك`,
      body: `${KIND[r.kind]} — ${r.kind === 'payment_info' ? r.new_value : r.students?.name || ''}${when}${r.decision_note ? '\n📝 ' + r.decision_note : ''}`, tag: 'req-d-' + r.id, url: './', requireInteraction: false,
    }, vapid);
    return json({ sent: res.length });
  }

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


  // تحديثات الجدول للمعلمات (متجمعة: إشعار واحد لكل معلمة كل دقيقة)
  const tnReport: any[] = [];
  {
    const { data: pend } = await admin.from('tutor_notify_queue').select('id').is('sent_at', null).lte('created_at', new Date(Date.now() - 20e3).toISOString()).order('id').limit(300);
    const { data: cl } = pend?.length ? await admin.from('tutor_notify_queue').update({ sent_at: new Date().toISOString() }).in('id', pend.map((x: any) => x.id)).is('sent_at', null).select('*') : { data: [] as any[] };
    if (cl?.length) {
      const sIds = [...new Set(cl.map((c: any) => c.session_id).filter(Boolean))];
      const { data: ss } = sIds.length ? await admin.from('sessions').select('id,scheduled_at,duration_minutes,actual_minutes,status,subject,student_id,group_key,group_name,tutor_charge_egp').in('id', sIds) : { data: [] as any[] };
      const stIds = [...new Set((ss || []).map((s: any) => s.student_id))];
      const { data: sts } = stIds.length ? await admin.from('students').select('id,name').in('id', stIds) : { data: [] as any[] };
      const tIds = [...new Set(cl.map((c: any) => c.tutor_id))];
      const { data: tus } = await admin.from('tutors').select('id,user_id').in('id', tIds);
      for (const tid of tIds) {
        const tu: any = tus?.find((x: any) => x.id === tid); if (!tu?.user_id) continue;
        const lines = tutorChangeLines(cl.filter((c: any) => c.tutor_id === tid), ss || [], sts || []);
        if (!lines.length) continue;
        const { data: tsubs } = await admin.from('push_subscriptions').select('*').eq('user_id', tu.user_id);
        if (!tsubs?.length) continue;
        const one = lines.length === 1;
        tnReport.push(await pushToSubs(tsubs as Sub[], {
          title: one ? lines[0].title : `📅 ${lines.length} تحديثات في جدولك`,
          body: one ? lines[0].body : lines.slice(0, 6).map((l) => l.short).join('\n') + (lines.length > 6 ? `\n… و${lines.length - 6} كمان` : ''),
          tag: 'tn-' + tid + '-' + Date.now(), url: './', requireInteraction: false,
        }, vapid));
      }
    }
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
  if (!due.length) return json({ checked: sessions?.length || 0, sent: 0, tests: testReport.length, tutorUpdates: tnReport.length });

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
