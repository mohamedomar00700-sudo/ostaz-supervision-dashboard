// Supabase Edge Function: fx-update
// Pulls live market rates (USD base) and stores SAR→EGP and AED→EGP in fx_rates
// for every currency whose "auto" flag is on. Called by pg_cron every 6 hours.
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const { data: sec } = await admin.from('app_secrets').select('value').eq('key', 'cron_secret').single();
  if (req.headers.get('x-cron-secret') !== sec?.value) return json({ error: 'forbidden' }, 403);

  const res = await fetch('https://open.er-api.com/v6/latest/USD');
  if (!res.ok) return json({ error: 'provider http ' + res.status }, 502);
  const data = await res.json();
  if (data.result !== 'success') return json({ error: 'provider error', data }, 502);
  const egp = Number(data.rates.EGP);
  if (!(egp > 0)) return json({ error: 'no EGP rate' }, 502);

  const { data: rows } = await admin.from('fx_rates').select('*');
  const updates: Record<string, number> = {};
  for (const r of rows || []) {
    if (r.currency === 'EGP' || !r.auto) continue;
    const per = Number(data.rates[r.currency]);
    if (!(per > 0)) continue;
    const rate = Math.round((egp / per) * 10000) / 10000;
    // sanity guard: ignore wild jumps (> 25%) from a bad feed
    if (Number(r.rate_to_egp) > 0 && Math.abs(rate / Number(r.rate_to_egp) - 1) > 0.25 && r.source?.startsWith('market')) continue;
    await admin.from('fx_rates').update({
      rate_to_egp: rate, updated_at: new Date().toISOString(),
      source: `market · ${data.time_last_update_utc}`,
    }).eq('currency', r.currency);
    updates[r.currency] = rate;
  }
  return json({ ok: true, updates, provider_time: data.time_last_update_utc });
});
