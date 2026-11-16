// Supabase Edge Function: broadcast-push — إشعار "📣 جديد" للمعلمات/الأسر اللي على التطبيق
// بيتنادى من لوحة الإشراف (مشرف مفعّل) أو بسر الكرون، بعد ما الرسالة تتسجل في occasions (campaign).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendWebPush } from './webpush.js';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });

async function pushTo(subs: any[], payload: object, vapid: any, table: string) {
  return Promise.all(subs.map(async (s) => {
    try {
      const r = await sendWebPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), vapid, { ttl: 86400, urgency: 'normal' });
      if (r.status === 404 || r.status === 410) await admin.from(table).delete().eq('id', s.id);
      else if (r.ok) await admin.from(table).update({ last_ok_at: new Date().toISOString() }).eq('id', s.id);
      return r.ok;
    } catch { return false; }
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const { data: rows } = await admin.from('app_secrets').select('key,value');
    const S = Object.fromEntries((rows || []).map((r: any) => [r.key, r.value]));
    const cron = req.headers.get('x-cron-secret');
    if (!(cron && S.cron_secret && cron === S.cron_secret)) {
      const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      const { data: { user } } = await admin.auth.getUser(token);
      if (!user) return json({ error: 'لازم تسجل دخول' }, 401);
      const { data: sup } = await admin.from('supervisors').select('active').eq('id', user.id).maybeSingle();
      if (!sup?.active) return json({ error: 'الحساب ده مش مشرف مفعّل' }, 403);
    }
    const body = await req.json().catch(() => ({}));
    const campaign = String(body.campaign || ''); if (!campaign) return json({ error: 'campaign مطلوب' }, 400);
    const { data: occ } = await admin.from('occasions').select('id,target,tutor_id,family_id,emoji,title,message').eq('campaign', campaign).is('seen_at', null);
    const vapid = { publicKey: S.vapid_public, privateKey: S.vapid_private, subject: S.vapid_subject };
    let sent = 0, people = 0;
    const tIds = (occ || []).filter((o: any) => o.target === 'tutor').map((o: any) => o.tutor_id);
    const fIds = (occ || []).filter((o: any) => o.target === 'family').map((o: any) => o.family_id);
    if (tIds.length) {
      const { data: tus } = await admin.from('tutors').select('id,user_id').in('id', tIds).not('user_id', 'is', null);
      for (const t of tus || []) {
        const o: any = occ!.find((x: any) => x.tutor_id === t.id);
        const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', t.user_id);
        if (!subs?.length) continue; people++;
        sent += (await pushTo(subs, { title: `${o.emoji || '📣'} ${o.title}`, body: o.message, tag: 'occ-' + o.id, url: './' }, vapid, 'push_subscriptions')).filter(Boolean).length;
      }
    }
    if (fIds.length) {
      const { data: links } = await admin.from('parent_links').select('id,family_id,token').in('family_id', fIds).eq('revoked', false);
      for (const l of links || []) {
        const o: any = occ!.find((x: any) => x.family_id === l.family_id);
        const { data: subs } = await admin.from('parent_push').select('*').eq('link_id', l.id);
        if (!subs?.length) continue; people++;
        sent += (await pushTo(subs, { title: `${o.emoji || '📣'} ${o.title}`, body: o.message, tag: 'occ-' + o.id, url: `./?p=${l.token}` }, vapid, 'parent_push')).filter(Boolean).length;
      }
    }
    return json({ ok: true, recipients: (occ || []).length, people_with_push: people, devices: sent });
  } catch (e) { return json({ error: String((e as any)?.message || e).slice(0, 300) }, 500); }
});
