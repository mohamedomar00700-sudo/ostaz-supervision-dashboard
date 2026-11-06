// Supabase Edge Function: saqqour-ai — صقّور الذكي
// المشرفة بتكتب بالعامية ("بكرة حمدة علوم مع سمر 4"، "كله تمام ما عدا خولة اتلغت")
// → Gemini بيحوّل الكلام لعمليات مقترحة على الحصص → التطبيق بيعرضها كارت تأكيد → المشرفة تأكد → التطبيق ينفّذ.
// الفانكشن دي ما بتكتبش أي حاجة في الحصص — بتقترح بس. التنفيذ من التطبيق بصلاحيات المشرفة نفسها.
import { createClient } from 'npm:@supabase/supabase-js@2';

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
const TZ = 'Africa/Cairo';

// ---------- وقت القاهرة ----------
function cairoParts(d: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'long' })
    .formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}`, weekday: p.weekday };
}
function cairoOffset(date: string) { // "+02:00" أو "+03:00" (التوقيت الصيفي)
  const probe = new Date(`${date}T12:00:00Z`);
  const s = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' }).formatToParts(probe).find(x => x.type === 'timeZoneName')?.value || 'GMT+2';
  const m = s.match(/GMT([+-])(\d+)(?::(\d+))?/); if (!m) return '+02:00';
  return `${m[1]}${m[2].padStart(2, '0')}:${(m[3] || '00').padStart(2, '0')}`;
}
const toIso = (date: string, time: string) => new Date(`${date}T${time.length === 5 ? time : time.padStart(5, '0')}:00${cairoOffset(date)}`).toISOString();
const AR_DAYS: Record<string, string> = { Saturday: 'السبت', Sunday: 'الأحد', Monday: 'الاتنين', Tuesday: 'التلات', Wednesday: 'الأربع', Thursday: 'الخميس', Friday: 'الجمعة' };

const CANCEL_REASONS = ['إلغاء من الأسرة', 'إلغاء من المعلمة', 'امتحانات', 'مرض', 'إجازة', 'ظرف طارئ', 'مشكلة إنترنت / تقنية', 'لم يحضر', 'اتأجلت لميعاد تاني', 'اتسجلت بالغلط', 'أخرى'];

const SESSION_REF = { type: 'STRING', description: 'كود الحصة الموجودة من "حصص الفترة" (زي X12)' };
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING', description: 'رد قصير بالعامية المصرية: فهمت إيه وهتعمل إيه' },
    questions: { type: 'ARRAY', items: { type: 'STRING' }, description: 'أسئلة لو فيه حاجة مش واضحة (اسم مش معروف، وقت ناقص…)' },
    add_sessions: {
      type: 'ARRAY', description: 'حصص جديدة مش موجودة في حصص الفترة — حصة لكل سطر في الجدول',
      items: { type: 'OBJECT', properties: {
        student: { type: 'STRING', description: 'كود الطالب (S3)' },
        tutor: { type: 'STRING', description: 'كود المعلم (T5)' },
        date: { type: 'STRING', description: 'YYYY-MM-DD' },
        time: { type: 'STRING', description: 'HH:MM بتوقيت مصر 24 ساعة' },
        subject: { type: 'STRING' },
        duration_minutes: { type: 'INTEGER' },
        kind: { type: 'STRING', enum: ['regular', 'trial', 'revision'] },
        family_block: { type: 'BOOLEAN', description: 'حصة للإخوات مع بعض (بتتحسب مرة واحدة بالمدة)' },
        status: { type: 'STRING', enum: ['scheduled', 'done'], description: 'done لو الحصة اتعملت خلاص' },
        actual_minutes: { type: 'INTEGER', nullable: true },
        tutor_rate_egp: { type: 'NUMBER', nullable: true, description: 'بس لو اتقال سعر المعلم صراحة' },
        student_price: { type: 'NUMBER', nullable: true, description: 'بس لو اتقال سعر الأسرة صراحة' },
        note: { type: 'STRING', nullable: true },
      }, required: ['student', 'tutor', 'date', 'time', 'subject', 'duration_minutes', 'kind', 'family_block', 'status'],
      propertyOrdering: ['student', 'tutor', 'subject', 'date', 'time', 'duration_minutes', 'kind', 'family_block', 'status', 'actual_minutes', 'tutor_rate_egp', 'student_price', 'note'] },
    },
    status_changes: {
      type: 'ARRAY', description: 'تغيير حالة حصة موجودة: تمت أو اتلغت',
      items: { type: 'OBJECT', properties: {
        session: SESSION_REF,
        status: { type: 'STRING', enum: ['done', 'cancelled_by_student', 'cancelled_by_tutor', 'cancelled_by_academy'] },
        actual_minutes: { type: 'INTEGER', nullable: true, description: 'المدة الفعلية لو اختلفت' },
        cancel_reason: { type: 'STRING', enum: CANCEL_REASONS, nullable: true },
        note: { type: 'STRING', nullable: true },
      }, required: ['session', 'status'], propertyOrdering: ['session', 'status', 'actual_minutes', 'cancel_reason', 'note'] },
    },
    updates: {
      type: 'ARRAY', description: 'تعديل حصة موجودة: ميعاد/مدة/معلم/مادة',
      items: { type: 'OBJECT', properties: {
        session: SESSION_REF,
        date: { type: 'STRING', nullable: true }, time: { type: 'STRING', nullable: true },
        duration_minutes: { type: 'INTEGER', nullable: true }, tutor: { type: 'STRING', nullable: true },
        subject: { type: 'STRING', nullable: true }, tutor_rate_egp: { type: 'NUMBER', nullable: true }, note: { type: 'STRING', nullable: true },
      }, required: ['session'], propertyOrdering: ['session', 'date', 'time', 'duration_minutes', 'tutor', 'subject', 'tutor_rate_egp', 'note'] },
    },
  },
  required: ['reply', 'questions', 'add_sessions', 'status_changes', 'updates'],
  propertyOrdering: ['questions', 'add_sessions', 'status_changes', 'updates', 'reply'],
};

// موديلات Flash المتاحة على المفتاح ده (الأحدث الأول) — عشان لو جوجل وقفت موديل ما نقعش
let _models: string[] | null = null;
async function flashModels(key: string) {
  if (_models) return _models;
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
    const j = await r.json();
    const ver = (n: string) => Number((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
    _models = (j.models || []).filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m: any) => String(m.name).replace(/^models\//, ''))
      .filter((n: string) => /^gemini-[\d.]+-flash(-\d+)?$/.test(n))
      .sort((a: string, b: string) => ver(b) - ver(a));
  } catch { _models = []; }
  return _models!;
}

function systemPrompt(now: { date: string; time: string; weekday: string }, extra = '') {
  return `إنت "صقّور"، مساعد الإشراف في أكاديمية "أستاذ أونلاين" (دروس أونلاين 1:1، طلاب في الإمارات والسعودية ومصر، معلمين في مصر).
المشرفة بتكتبلك بالعامية المصرية جدول بكرة أو تقرير آخر اليوم أو تعديل، وإنت بتحوّل كلامها لعمليات على الحصص. إنت بتقترح بس؛ المشرفة هتأكد قبل التنفيذ.

النهارده: ${AR_DAYS[now.weekday] || now.weekday} ${now.date}، الساعة دلوقتي ${now.time} بتوقيت مصر.

القواعد:
- كل سطر في الجدول = عنصر في add_sessions (ما تنساش ولا سطر).
- استخدم الأكواد اللي في البيانات بس (S للطالب، T للمعلم، X للحصة). عمرك ما تخترع كود. لو اسم مش لاقيه أو فيه احتمالين، اسأل في questions وما تعملش العملية دي.
- الأوقات كلها بتوقيت مصر بصيغة 24 ساعة. لو قالت "توقيت الإمارات" اطرح ساعتين، "توقيت السعودية" اطرح ساعة.
- ساعة من 1 لـ 8 من غير "الصبح" = بعد الضهر (4 = 16:00). 9 و10 و11 = الصبح إلا لو قالت بليل/مساءً. 12 = الضهر.
- "بكرة" = اليوم اللي بعد النهارده. أيام الأسبوع = أقرب يوم جاي بالاسم ده (أو النهارده لو قالت النهارده).
- المدة الافتراضية ساعة (60). "نص ساعة"=30، "ساعة ونص"=90، "ساعتين"=120، "ساعتين ونص"=150. الحصة التجريبية الافتراضي 30.
- "تجربة/تجريبية/حصة تجريبية" → kind=trial (مجانية للأسرة والمعلم إلا لو قالت المعلم هيتحاسب — ساعتها حط tutor_rate_egp).
- "مراجعة" → kind=revision.
- لو الإخوات واخدين مع بعض في نفس الوقت مع نفس المعلم ("رسمية وحمدان مع فاتن"، "ولاد أم حمدان") → حصة واحدة family_block=true على واحد منهم، والمدة = مدة البلوك كله. ما تعملش حصة لكل واحد.
- لو الحصة موجودة فعلاً في "حصص الفترة" (نفس الطالب ونفس اليوم وقريب من نفس الوقت) ما تضيفهاش تاني — استخدم updates لو فيه تغيير.
- تقرير آخر اليوم: "كله تمام" / "الباقي تمام" → status_changes بـ done لكل حصة "مجدولة" في اليوم ده ما اتذكرتش كملغية. "اتلغت" → cancelled_by_student لو من الطالب/الأسرة (امتحانات، مرض، تعبانة، سفر، مدخلش)، cancelled_by_tutor لو من المعلم، مع cancel_reason مناسب وnote بالتفاصيل.
- "دخل ساعة ونص بدل ساعة" لحصة موجودة → status_changes بـ done مع actual_minutes. لو حصة مش موجودة واتعملت → add_sessions بـ status=done.
- اتأجلت لميعاد تاني → updates بالتاريخ/الوقت الجديد (لو الميعاد معروف)، وإلا status_changes بـ cancelled_by_student وcancel_reason "اتأجلت لميعاد تاني".
- ما تحطش student_price أو tutor_rate_egp إلا لو اتقالوا صراحة؛ السيستم بيحط السعر المعتاد لوحده.
- المادة: اكتبها بالعربي زي ما بنستخدمها (رياضيات، علوم، إنجليزي، عربي، فيزياء، كيمياء، أحياء، قرآن، تربية إسلامية، سوشيال…). لو ما اتقالتش خد مادة الطالب المعتادة مع المعلم ده من "مين بيدرّس مين".
- reply: جملة أو اتنين بالعامية، من غير تكرار كل العمليات (الكارت هيعرضها).
- لو الرسالة سؤال مش أمر (مثلاً "مين مدرّسة الإنجليزي بتاعت حمدة؟" أو "عندنا كام حصة بكرة؟") جاوب في reply من البيانات وخلي القوايم فاضية.
- لو المشرفة ذكرت يوم (امبارح/النهارده/يوم معين) والحصة اللي تقصدها مش موجودة في اليوم ده، ما تختارش حصة من يوم تاني — اسأل في questions.
- reply بصيغة اقتراح ("هسجّل…"، "هعدّل…") مش "سجّلت"، لأن مفيش حاجة بتتنفذ قبل ما المشرفة تأكد.
- في الأسئلة عن "مين بيدرّس" رد بالمعلم الحالي (آخر حصص)، ولو فيه أكتر من واحد قول مين آخر واحد.
- أسماء الطلاب ممكن تشبه أسماء المعلمات (فطوم/فاطمة، شيماء، مريم…). الاسم اللي بعد "مع/مس/مستر/أ." هو المعلم، واللي في أول السطر هو الطالب. ولو المعلم مش واضح، اختار المعلم اللي بيدرّس الطالب ده المادة دي في "مين بيدرّس مين".
- ممنوع تقول أي حاجة عن إيراد الأكاديمية أو هامش الربح.${extra ? '\n' + extra : ''}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const { data: secretRows } = await admin.from('app_secrets').select('key,value');
    const S = Object.fromEntries((secretRows || []).map((r: any) => [r.key, r.value]));
    const cron = req.headers.get('x-cron-secret');
    if (!(cron && S.cron_secret && cron === S.cron_secret)) { // تجربة من السيرفر بالسر بتاع الكرون — غير كده لازم مشرف مفعّل
      const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      const { data: { user } } = await admin.auth.getUser(token);
      if (!user) return json({ error: 'لازم تسجل دخول' }, 401);
      const { data: sup } = await admin.from('supervisors').select('active, role, name').eq('id', user.id).maybeSingle();
      if (!sup?.active) return json({ error: 'الحساب ده مش مشرف مفعّل' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const text = String(body.text || '').trim().slice(0, 6000);
    if (!text) return json({ error: 'اكتب حاجة الأول' }, 400);
    const history: { role: string; text: string }[] = Array.isArray(body.history) ? body.history.slice(-6) : [];

    let key = Deno.env.get('GEMINI_API_KEY');
    if (!key) key = S.gemini_api_key;
    if (!key) return json({ error: 'مفتاح Gemini لسه مش متحط (GEMINI_API_KEY في Supabase Secrets)' }, 500);

    // ---------- البيانات اللي صقّور بيشتغل عليها ----------
    const now = new Date(), nowC = cairoParts(now);
    const from = new Date(now.getTime() - 4 * 864e5), to = new Date(now.getTime() + 9 * 864e5);
    const [{ data: families }, { data: students }, { data: tutors }, { data: plans }, { data: recent }, { data: win }] = await Promise.all([
      admin.from('families').select('id,name,currency,country'),
      admin.from('students').select('id,name,family_id,grade_level,default_price'),
      admin.from('tutors').select('id,name,default_rate_egp'),
      admin.from('student_subjects').select('student_id,tutor_id,subject,tutor_rate_egp'),
      admin.from('sessions').select('student_id,tutor_id,subject,tutor_cost_egp,student_price,kind,scheduled_at,status')
        .in('status', ['done', 'scheduled']).gte('scheduled_at', new Date(now.getTime() - 45 * 864e5).toISOString()).order('scheduled_at', { ascending: false }).limit(3000),
      admin.from('sessions').select('id,student_id,tutor_id,subject,scheduled_at,duration_minutes,actual_minutes,status,kind,family_block,created_by,notes')
        .gte('scheduled_at', from.toISOString()).lt('scheduled_at', to.toISOString()).neq('status', 'cancelled_by_academy').order('scheduled_at'),
    ]);
    const famBy = new Map((families || []).map(f => [f.id, f]));
    const { data: sups } = await admin.from('supervisors').select('id,name');
    const supName = (id: string | null, notes?: string | null) => (id && (sups || []).find((x: any) => x.id === id)?.name) || (/صقّور/.test(notes || '') ? 'صقّور' : 'محمد عمر (الإدارة)');
    const activeStu = new Set((recent || []).map(r => r.student_id)), activeTut = new Set((recent || []).map(r => r.tutor_id));
    (win || []).forEach(s => { activeStu.add(s.student_id); activeTut.add(s.tutor_id); });
    (plans || []).forEach(p => { activeStu.add(p.student_id); if (p.tutor_id) activeTut.add(p.tutor_id); });

    // أكواد قصيرة بدل الـ UUID (أوفر وما يخترعش)
    const sCode = new Map<string, string>(), sId = new Map<string, string>(), tCode = new Map<string, string>(), tId = new Map<string, string>(), xCode = new Map<string, string>(), xId = new Map<string, string>();
    const stuList = (students || []).filter(s => activeStu.has(s.id));
    stuList.forEach((s, i) => { sCode.set(s.id, 'S' + (i + 1)); sId.set('S' + (i + 1), s.id); });
    const tutList = (tutors || []).filter(t => activeTut.has(t.id));
    tutList.forEach((t, i) => { tCode.set(t.id, 'T' + (i + 1)); tId.set('T' + (i + 1), t.id); });
    (win || []).forEach((s, i) => { xCode.set(s.id, 'X' + (i + 1)); xId.set('X' + (i + 1), s.id); });
    const stuBy = new Map((students || []).map(s => [s.id, s])), tutBy = new Map((tutors || []).map(t => [t.id, t]));

    // مين بيدرّس مين + آخر سعر لكل طالب×معلم
    const pair = new Map<string, { subj: Set<string>; rate?: number; price?: number }>();
    (recent || []).forEach(r => { if (!r.student_id || !r.tutor_id) return; const k = r.student_id + '|' + r.tutor_id; const x = pair.get(k) || { subj: new Set() };
      if (r.subject) x.subj.add(r.subject); if (x.rate == null && r.kind !== 'trial' && Number(r.tutor_cost_egp) > 0) x.rate = Number(r.tutor_cost_egp);
      if (x.price == null && r.kind !== 'trial' && Number(r.student_price) > 0) x.price = Number(r.student_price); pair.set(k, x); });
    (plans || []).forEach(p => { if (!p.tutor_id) return; const k = p.student_id + '|' + p.tutor_id; const x = pair.get(k) || { subj: new Set() };
      if (p.subject) x.subj.add(p.subject); if (x.rate == null && p.tutor_rate_egp != null) x.rate = Number(p.tutor_rate_egp); pair.set(k, x); });

    const stuLines = stuList.map(s => `${sCode.get(s.id)}: ${s.name} — ${famBy.get(s.family_id)?.name || ''}${s.grade_level ? ' — ' + s.grade_level : ''}`).join('\n');
    const tutLines = tutList.map(t => `${tCode.get(t.id)}: ${t.name}`).join('\n');
    const pairLines = [...pair.entries()].filter(([k]) => { const [a, b] = k.split('|'); return sCode.has(a) && tCode.has(b); })
      .map(([k, x]) => { const [a, b] = k.split('|'); return `${sCode.get(a)} ${stuBy.get(a)?.name} ← ${tCode.get(b)} ${tutBy.get(b)?.name}: ${[...x.subj].join('، ') || '؟'}`; }).join('\n');
    const STAT: Record<string, string> = { scheduled: 'مجدولة', done: 'تمت', cancelled_by_student: 'ملغية (طالب)', cancelled_by_tutor: 'ملغية (معلم)', in_progress: 'جارية' };
    const winLines = (win || []).map(s => { const c = cairoParts(new Date(s.scheduled_at));
      return `${xCode.get(s.id)}: ${c.date} (${AR_DAYS[c.weekday] || ''}) ${c.time} — ${sCode.get(s.student_id) || '?'} ${stuBy.get(s.student_id)?.name || ''} مع ${tCode.get(s.tutor_id) || '?'} ${tutBy.get(s.tutor_id)?.name || ''} — ${s.subject || ''} — ${s.actual_minutes || s.duration_minutes} د — ${STAT[s.status] || s.status}${s.kind === 'trial' ? ' — تجريبية' : ''}${s.family_block ? ' — حصة أسرة' : ''}`; }).join('\n');

    const dataBlock = `# الطلاب\n${stuLines}\n\n# المعلمين\n${tutLines}\n\n# مين بيدرّس مين (آخر 45 يوم + الخطط)\n${pairLines}\n\n# حصص الفترة (من 4 أيام لـ 9 أيام جاية)\n${winLines || '—'}`;

    const contents = [
      { role: 'user', parts: [{ text: dataBlock }] },
      { role: 'model', parts: [{ text: '{"questions":[],"add_sessions":[],"status_changes":[],"updates":[],"reply":"تمام، البيانات قدامي."}' }] },
      ...history.map(h => ({ role: h.role === 'model' ? 'model' : 'user', parts: [{ text: String(h.text || '').slice(0, 3000) }] })),
      { role: 'user', parts: [{ text }] },
    ];
    const models = [Deno.env.get('GEMINI_MODEL'), 'gemini-flash-latest', ...(await flashModels(key))].filter((m, i, a) => m && a.indexOf(m) === i) as string[];
    if (body.list_models) return json({ models });
    let out: any = null, lastErr = '';
    for (const m of models.slice(0, 4)) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt(nowC, S.saqqour_rules || '') }] }, contents,
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: SCHEMA } }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { lastErr = j?.error?.message || `HTTP ${r.status}`; if (r.status === 404 || r.status === 429 || r.status >= 500 || /model|not (found|available|supported)/i.test(lastErr)) continue; break; }
      const t = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
      try { out = JSON.parse(t); } catch { lastErr = 'رد مش مفهوم من Gemini'; }
      break;
    }
    if (!out) return json({ error: /quota|rate|exhaust/i.test(lastErr) ? 'وصلنا للحد المجاني بتاع Gemini دلوقتي — جرّب كمان شوية' : 'Gemini: ' + lastErr }, 502);

    // ---------- تحقق + تكملة الأسعار والقيم ----------
    const warnings: string[] = []; const already: any[] = [];
    const winBy = new Map((win || []).map(s => [s.id, s]));
    const raw = [...(out.add_sessions || []).map((a: any) => ({ ...a, op: 'add_session' })), ...(out.status_changes || []).map((a: any) => ({ ...a, op: 'set_status' })), ...(out.updates || []).map((a: any) => ({ ...a, op: 'update_session' }))];
    const actions = raw.map((a: any) => {
      const r: any = { op: a.op, note: a.note || null };
      if (a.op === 'add_session') {
        const st = stuBy.get(sId.get(a.student) || ''), tu = tutBy.get(tId.get(a.tutor) || '');
        if (!st || !tu || !a.date || !a.time) { warnings.push(`حصة ناقصة بيانات اتشالت (${a.student || '?'} / ${a.tutor || '?'} / ${a.date || '?'} ${a.time || '?'})`); return null; }
        let tu2 = tu;
        // أولوية المعلم اللي متسجل مع الطالب قبل كده: لو المعلم ده عمره ما درّس الطالب وفيه معلم تاني بيدرّسه نفس المادة → نختار المعلم المعتاد
        if (!pair.has(st.id + '|' + tu.id)) {
          const sn = (x: string) => String(x || '').replace(/\s/g, '');
          const regular = [...pair.entries()].filter(([k, v]) => k.startsWith(st.id + '|') && (!a.subject || [...v.subj].some(x => sn(x) === sn(a.subject))));
          if (regular.length === 1) { const alt = tutBy.get(regular[0][0].split('|')[1]); if (alt) { warnings.push(`${st.name}: ${tu.name} عمرها ما درّستله — حطيت ${alt.name} لأنها المعلمة المعتادة. لو فعلاً معلمة جديدة شيل علامة ✓ واكتبها تاني وقول "معلمة جديدة".`); tu2 = alt; } }
        }
        const tuF = tu2;
        const fam = famBy.get(st.family_id); const p = pair.get(st.id + '|' + tuF.id);
        const kind = a.kind === 'trial' || a.kind === 'revision' ? a.kind : 'regular';
        const dur = Number(a.duration_minutes) || (kind === 'trial' ? 30 : 60);
        const subject = a.subject || (p ? [...p.subj][0] : null) || null;
        const status = a.status === 'done' ? 'done' : 'scheduled';
        Object.assign(r, {
          student_id: st.id, tutor_id: tuF.id, student_name: st.name, tutor_name: tuF.name, family_name: fam?.name || '',
          subject, kind, family_block: !!a.family_block, scheduled_at: toIso(a.date, a.time), date: a.date, time: a.time,
          duration_minutes: dur, actual_minutes: status === 'done' ? (Number(a.actual_minutes) || dur) : null, status,
          student_currency: fam?.currency || 'AED',
          student_price: kind === 'trial' ? 0 : (a.student_price != null ? Number(a.student_price) : Number(st.default_price ?? p?.price ?? 0)),
          tutor_cost_egp: a.tutor_rate_egp != null ? Number(a.tutor_rate_egp) : kind === 'trial' ? 0 : Number(p?.rate ?? tuF.default_rate_egp ?? 0),
        });
        // متسجلة بالفعل؟ (نفس الطالب أو حصة أسرة لأخ مع نفس المعلم، في حدود ساعة، ومش ملغية) → ما نقترحهاش تاني
        const near = (win || []).filter(s => (s.student_id === st.id || ((s.family_block || a.family_block) && s.tutor_id === tuF.id && stuBy.get(s.student_id)?.family_id === st.family_id)) && !String(s.status).startsWith('cancelled') && Math.abs(new Date(s.scheduled_at).getTime() - new Date(r.scheduled_at).getTime()) <= 60 * 60e3);
        const same = near.find(s => s.tutor_id === tuF.id) || near[0];
        if (same) { const c2 = cairoParts(new Date(same.scheduled_at)); already.push({ student_name: st.name, tutor_name: tutBy.get(same.tutor_id)?.name || '', subject: same.subject, date: c2.date, time: c2.time, minutes: same.actual_minutes || same.duration_minutes, by: supName(same.created_by, same.notes), differs: same.tutor_id !== tuF.id || c2.time !== a.time || (same.duration_minutes !== dur) }); return null; }
        return r;
      }
      const sid = xId.get(a.session || ''); const s = sid && winBy.get(sid);
      if (!s) { warnings.push(`حصة مش معروفة (${a.session || '?'}) اتشالت`); return null; }
      const c = cairoParts(new Date(s.scheduled_at));
      Object.assign(r, { session_id: s.id, student_name: stuBy.get(s.student_id)?.name || '', tutor_name: tutBy.get(s.tutor_id)?.name || '', subject: s.subject,
        date: c.date, time: c.time, old: { status: s.status, scheduled_at: s.scheduled_at, duration_minutes: s.duration_minutes, actual_minutes: s.actual_minutes, tutor_id: s.tutor_id, subject: s.subject } });
      if (a.op === 'set_status') {
        if (!a.status) return null;
        r.status = a.status;
        if (a.status === 'done') r.actual_minutes = Number(a.actual_minutes) || s.actual_minutes || s.duration_minutes;
        if (a.status.startsWith('cancelled')) { r.cancel_reason = CANCEL_REASONS.includes(a.cancel_reason) ? a.cancel_reason : 'أخرى'; }
        if (r.status === s.status && !(a.status === 'done' && a.actual_minutes && a.actual_minutes !== (s.actual_minutes || s.duration_minutes))) return null; // مفيش تغيير
        return r;
      }
      if (a.op === 'update_session') {
        const patch: any = {};
        if (a.date || a.time) patch.scheduled_at = toIso(a.date || c.date, a.time || c.time);
        if (a.duration_minutes) patch.duration_minutes = Number(a.duration_minutes);
        if (a.actual_minutes) patch.actual_minutes = Number(a.actual_minutes);
        if (a.tutor && tId.get(a.tutor)) { patch.tutor_id = tId.get(a.tutor); r.new_tutor_name = tutBy.get(patch.tutor_id)?.name; const p = pair.get(s.student_id + '|' + patch.tutor_id); patch.tutor_cost_egp = s.kind === 'trial' ? 0 : Number(p?.rate ?? tutBy.get(patch.tutor_id)?.default_rate_egp ?? 0); }
        if (a.subject) patch.subject = a.subject;
        if (a.tutor_rate_egp != null) patch.tutor_cost_egp = Number(a.tutor_rate_egp);
        if (!Object.keys(patch).length) return null;
        r.patch = patch; if (patch.scheduled_at) { const n = cairoParts(new Date(patch.scheduled_at)); r.new_date = n.date; r.new_time = n.time; }
        return r;
      }
      return null;
    }).filter(Boolean);

    return json({ reply: out.reply || '', questions: out.questions || [], actions, warnings, already, ...(body.debug ? { raw: out } : {}) });
  } catch (e) {
    return json({ error: String(e?.message || e).slice(0, 300) }, 500);
  }
});
