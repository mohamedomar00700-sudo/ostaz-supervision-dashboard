// Supabase Edge Function: parent-notify
// بوابة ولي الأمر بتنادي عليها بعد ما الأسرة تبعت طلب (تأجيل / رسالة للمعلم / استفسار)
// → إشعار للمشرفين النشطين + منبه ntfy. التحقق بالتوكن بتاع الأسرة، والطلب لازم يكون جديد (أقل من دقيقتين).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendWebPush } from './webpush.js';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const APP_URL = 'https://mohamedomar00700-sudo.github.io/ostaz-supervision-dashboard/';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let body: any = {}; try { body = await req.json(); } catch { /* empty */ }
  const { data: link } = await admin.from('parent_links').select('id,family_id').eq('token', String(body.token || '')).eq('revoked', false).maybeSingle();
  if (!link) return json({ error: 'not found' }, 404);
  const { data: r } = await admin.from('relay_tasks').select('id,description,created_at,requested_by,students(name,family_id,families(name))').eq('id', body.id).maybeSingle();
  const st: any = r?.students;
  if (!r || r.requested_by !== 'parent' || st?.family_id !== link.family_id || Date.now() - new Date(r.created_at).getTime() > 120e3) return json({ sent: 0 });
  const { data: secretRows } = await admin.from('app_secrets').select('key,value');
  const S = Object.fromEntries((secretRows || []).map((x: any) => [x.key, x.value]));
  const vapid = { publicKey: S.vapid_public, privateKey: S.vapid_private, subject: S.vapid_subject };
  const { data: sups } = await admin.from('supervisors').select('id').eq('active', true);
  const ids = (sups || []).map((x: any) => x.id);
  const { data: subs } = ids.length ? await admin.from('push_subscriptions').select('*').in('user_id', ids) : { data: [] as any[] };
  const payload = { title: `✉️ طلب من ${st?.families?.name || 'ولي الأمر'}${st?.name ? ' — ' + st.name : ''}`, body: String(r.description).slice(0, 220) + '\nافتح الترحيل ورد عليهم.', tag: 'prq-' + r.id, url: './?relay=1', requireInteraction: true };
  const res = await Promise.all((subs || []).map(async (s: any) => {
    try {
      const x = await sendWebPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), vapid, { ttl: 900, urgency: 'high' });
      if (x.status === 404 || x.status === 410) await admin.from('push_subscriptions').delete().eq('id', s.id);
      return x.status;
    } catch (_) { return 0; }
  }));
  const { data: alarms } = ids.length ? await admin.from('alarm_channels').select('user_id,ntfy_topic').eq('enabled', true).in('user_id', ids) : { data: [] as any[] };
  await Promise.all((alarms || []).map((c: any) => fetch('https://ntfy.sh/', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: c.ntfy_topic, title: payload.title, message: payload.body, priority: 4, tags: ['envelope'], click: APP_URL + '?relay=1' }) }).catch(() => null)));
  return json({ sent: res });
});
