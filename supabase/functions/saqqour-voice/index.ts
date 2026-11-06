// Supabase Edge Function: saqqour-voice — بيحوّل فويس المشرفة لكلام مكتوب (Gemini)
// بيتستخدم لما الموبايل ما يدعمش التعرّف على الصوت جوه المتصفح. النص بيرجع لخانة الكتابة والمشرفة تراجعه قبل ما تبعته.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: 'لازم تسجل دخول' }, 401);
    const { data: sup } = await admin.from('supervisors').select('active').eq('id', user.id).maybeSingle();
    if (!sup?.active) return json({ error: 'الحساب ده مش مشرف مفعّل' }, 403);

    const { audio, mime } = await req.json().catch(() => ({}));
    if (!audio || typeof audio !== 'string') return json({ error: 'مفيش صوت' }, 400);
    if (audio.length > 14_000_000) return json({ error: 'الفويس طويل قوي — قسّمه على أكتر من رسالة' }, 413);
    const key = Deno.env.get('GEMINI_API_KEY');
    if (!key) return json({ error: 'مفتاح Gemini مش متحط' }, 500);

    const { data: students } = await admin.from('students').select('name');
    const { data: tutors } = await admin.from('tutors').select('name');
    const names = [...new Set([...(students || []).map(s => s.name), ...(tutors || []).map(t => String(t.name).replace(/^أ\.\s*|^د\.\s*/, '').replace(/\s*\(.*?\)/g, ''))])].join('، ');
    const prompt = `ده فويس من مشرفة في أكاديمية دروس أونلاين بتتكلم بالعامية المصرية (جدول حصص، تقرير آخر اليوم، إلغاء، سؤال).
اكتب الكلام اللي اتقال بالظبط بالعربي، من غير أي تعليق أو إضافة. الأرقام والمواعيد اكتبها أرقام (4، 6:30، ساعة ونص).
لو حصة في سطر لوحدها اكتبها في سطر لوحده.
الأسماء دي ممكن تيجي في الكلام فاكتبها بنفس الإملاء: ${names}`;

    const m0 = String(mime || 'audio/webm').split(';')[0];
    const models = [Deno.env.get('GEMINI_MODEL'), 'gemini-flash-latest', 'gemini-2.5-flash'].filter(Boolean) as string[];
    let lastErr = '';
    for (const m of models) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: m0, data: audio } }] }], generationConfig: { temperature: 0 } }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { lastErr = j?.error?.message || `HTTP ${r.status}`; if (r.status === 404 || /model|not (found|available)/i.test(lastErr)) continue; break; }
      const text = (j?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('').trim();
      return json({ text });
    }
    return json({ error: /quota|rate|exhaust/i.test(lastErr) ? 'وصلنا للحد المجاني بتاع Gemini دلوقتي — جرّب كمان شوية' : 'Gemini: ' + lastErr }, 502);
  } catch (e) {
    return json({ error: String((e as any)?.message || e).slice(0, 300) }, 500);
  }
});
