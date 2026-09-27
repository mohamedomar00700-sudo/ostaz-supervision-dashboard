/* ============================================================
   لوحة إشراف أكاديمية أستاذ أونلاين — متصلة بـ Supabase
   ============================================================ */
const SUPABASE_URL = "https://jdddypykpsrxezfepacf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkZGR5cHlrcHNyeGV6ZmVwYWNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MTY1MDMsImV4cCI6MjEwNTk5MjUwM30.7MNFEMjXIHP5z29DBpO_KNlM6sPCijSwaihsFqvxhs4";

if (!window.supabase) {
  document.body.innerHTML = '<div style="padding:40px;text-align:center;font-family:sans-serif;direction:rtl">'
    + '<h2>تعذر تحميل مكتبة الاتصال بقاعدة البيانات</h2>'
    + '<p style="color:#888">تأكد من اتصالك بالإنترنت وحدّث الصفحة.</p></div>';
  throw new Error('Supabase JS failed to load');
}
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------------- ثوابت ---------------- */
const COUNTRIES = {
  'السعودية': { cur: 'SAR', tz: 'Asia/Riyadh', code: '966', flag: '🇸🇦', tzName: 'السعودية' },
  'الإمارات': { cur: 'AED', tz: 'Asia/Dubai', code: '971', flag: '🇦🇪', tzName: 'الإمارات' },
  'مصر':      { cur: 'EGP', tz: 'Africa/Cairo', code: '20', flag: '🇪🇬', tzName: 'مصر' },
};
const CURRENCIES = ['SAR', 'AED', 'EGP'];
const CURRICULA = { arabic: 'حكومي / عربي', languages: 'لغات', international: 'دولي / أمريكي' };
const GRADES = ['KG1', 'KG2', 'الصف الأول الابتدائي', 'الصف الثاني الابتدائي', 'الصف الثالث الابتدائي',
  'الصف الرابع الابتدائي', 'الصف الخامس الابتدائي', 'الصف السادس الابتدائي', 'الصف الأول المتوسط/الإعدادي',
  'الصف الثاني المتوسط/الإعدادي', 'الصف الثالث المتوسط/الإعدادي', 'الصف الأول الثانوي', 'الصف الثاني الثانوي',
  'الصف الثالث الثانوي', 'IGCSE', 'American Diploma', 'IB', 'جامعي'];
const STATUS = {
  scheduled: { label: 'مجدولة', cls: 'b-scheduled' },
  in_progress: { label: 'جارية', cls: 'b-in_progress' },
  done: { label: 'تمت', cls: 'b-done' },
  cancelled_by_student: { label: 'ألغاها الطالب', cls: 'b-cancel' },
  cancelled_by_tutor: { label: 'ألغاها المعلم', cls: 'b-cancel' },
};
const REQUESTERS = { parent: 'ولي الأمر', tutor: 'المعلم', supervisor: 'المشرف' };
const CAIRO_TZ = 'Africa/Cairo';

/* ---------------- الحالة العامة ---------------- */
let currentUser = null, currentSupervisor = null, isSignUpMode = false;
let isAdmin = false;
let currentTab = 'daily';
const state = {
  families: [], students: [], tutors: [], subjects: [], plans: [], fx: {}, famBal: {}, tutBal: {},
  daySessions: [], weekSessions: [], dayMode: 'day', relay: [], relayFilter: 'pending', dayFilter: 'all',
  day: todayStr(), fin: null,
};
const byId = (arr, id) => arr.find(x => x.id === id);

/* ---------------- أدوات مساعدة ---------------- */
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function jsq(v) { return esc(JSON.stringify(v)); } // آمن داخل onclick="..."
function fmt(n, d = 0) {
  const x = Number(n || 0);
  return x.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d || (Number.isInteger(x) ? 0 : 2) });
}
function money(n, cur) { return `${fmt(n, 2)} ${cur || ''}`.trim(); }
function pad(n) { return String(n).padStart(2, '0'); }
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function dateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function timeStr(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function parseDay(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function fmtTime(iso, tz) {
  return new Date(iso).toLocaleTimeString('ar-EG-u-nu-latn', { hour: 'numeric', minute: '2-digit', timeZone: tz || undefined });
}
function fmtDate(iso, tz) {
  return new Date(iso).toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz || undefined });
}
function fmtShortDate(iso) {
  return new Date(iso).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' });
}
function relDayLabel(iso, tz) {
  const opt = { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit' };
  const f = d => new Intl.DateTimeFormat('en-CA', opt).format(d);
  const target = f(new Date(iso));
  const now = new Date();
  if (target === f(now)) return 'اليوم';
  if (target === f(new Date(now.getTime() + 864e5))) return 'غدًا';
  return fmtDate(iso, tz);
}
function ago(iso) {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  return fmtShortDate(iso);
}
function waNumber(raw, country) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  const c = COUNTRIES[country];
  if (d.startsWith('0') && c) d = c.code + d.slice(1);
  return d;
}
function cleanGroup(v) {
  if (!v) return null;
  const m = String(v).match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
  return m ? 'https://chat.whatsapp.com/' + m[1] : v.trim();
}
async function copyAndOpen(text, url) {
  await copyText(text, 'تم نسخ الرسالة ✓ الصقها في الجروب');
  window.open(url, '_blank', 'noopener');
}
const SUBJECT_LIST = ['رياضيات', 'علوم', 'إنجليزي', 'عربي', 'فيزياء', 'كيمياء', 'أحياء', 'تأسيس إنجليزي', 'تأسيس عربي', 'دراسات اجتماعية', 'تربية إسلامية', 'فرنساوي'];
function plansOf(studentId) { return state.plans.filter(p => p.student_id === studentId); }
function planLabel(p, withTutor = true) {
  const t = p.tutor_id ? byId(state.tutors, p.tutor_id) : null;
  return `${p.subject}${p.weekly_sessions ? ` ×${p.weekly_sessions}` : ''}${withTutor ? ` — ${t ? t.name : 'بدون معلم'}` : ''}`;
}
function fxRate(cur) { return Number(state.fx[cur] ?? (cur === 'EGP' ? 1 : 0)); }
function toEGP(amount, cur) { return Number(amount || 0) * fxRate(cur); }

function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.toggle('error', !!isError);
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), isError ? 4000 : 2000);
}
function dbError(err) {
  console.error(err);
  const m = err?.message || String(err);
  if (err?.code === '23503' || /foreign key/i.test(m)) return 'لا يمكن الحذف لوجود بيانات مرتبطة (حصص أو مدفوعات). احذفها أولاً أو اتركه كما هو.';
  if (err?.code === '42501' || /row-level security|permission/i.test(m)) return 'ليس لديك صلاحية لهذا الإجراء.';
  return 'حصل خطأ: ' + m;
}
function setLoading(on) { document.getElementById('loading').classList.toggle('hidden', !on); }
async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); showToast(okMsg || 'تم النسخ ✓'); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); ta.remove(); showToast(okMsg || 'تم النسخ ✓');
  }
}

/* ============================================================
   النافذة المنبثقة + نماذج الإدخال
   ============================================================ */
function openModal(title, html) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function fieldHtml(f) {
  const id = 'f_' + f.name;
  const req = f.required ? ' required' : '';
  const val = f.value ?? '';
  let input;
  if (f.type === 'select') {
    const opts = (f.options || []).map(o => {
      if (o.group) return `<optgroup label="${esc(o.group)}">` + o.items.map(i =>
        `<option value="${esc(i.v)}" ${String(i.v) === String(val) ? 'selected' : ''}>${esc(i.l)}</option>`).join('') + '</optgroup>';
      return `<option value="${esc(o.v)}" ${String(o.v) === String(val) ? 'selected' : ''}>${esc(o.l)}</option>`;
    }).join('');
    input = `<select id="${id}" name="${f.name}" class="input"${req}>${f.placeholder ? `<option value="">${esc(f.placeholder)}</option>` : ''}${opts}</select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea id="${id}" name="${f.name}" class="input" placeholder="${esc(f.placeholder || '')}"${req}>${esc(val)}</textarea>`;
  } else {
    const extra = f.type === 'number' ? ` step="${f.step || 'any'}" min="${f.min ?? 0}" inputmode="decimal"` : '';
    const list = f.list ? ` list="${id}_list"` : '';
    input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" class="input" value="${esc(val)}" placeholder="${esc(f.placeholder || '')}"${extra}${list}${req}${f.readonly ? ' readonly' : ''}>`;
    if (f.list) input += `<datalist id="${id}_list">${f.list.map(x => `<option value="${esc(x)}">`).join('')}</datalist>`;
  }
  return `<div class="field" id="wrap_${f.name}"><label for="${id}">${esc(f.label)}${f.required ? ' *' : ''}</label>${input}${f.hint ? `<div class="hint" id="hint_${f.name}">${f.hint}</div>` : ''}</div>`;
}
function formHtml(fields, submitLabel, extraBottom = '') {
  const rows = fields.map(f => Array.isArray(f) ? `<div class="field-row">${f.map(fieldHtml).join('')}</div>` : fieldHtml(f)).join('');
  return `<form id="modal-form" onsubmit="event.preventDefault(); window._formSubmit && window._formSubmit()">
    ${rows}${extraBottom}
    <div id="form-error" class="err hidden"></div>
    <div class="modal-foot">
      <button type="submit" class="btn btn-brand" id="form-submit">${esc(submitLabel || 'حفظ')}</button>
      <button type="button" class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
    </div></form>`;
}
function fv(name) { const el = document.getElementById('f_' + name); return el ? el.value.trim() : ''; }
function fnum(name) { const v = fv(name); return v === '' ? null : Number(v); }
function formError(msg) { const e = document.getElementById('form-error'); e.textContent = msg; e.classList.remove('hidden'); }
async function runSubmit(fn) {
  const btn = document.getElementById('form-submit');
  btn.disabled = true;
  try { await fn(); }
  catch (e) { formError(dbError(e)); }
  finally { if (btn) btn.disabled = false; }
}
async function confirmDelete(what, fn) {
  if (!confirm(`متأكد إنك عايز تحذف ${what}؟ لا يمكن التراجع.`)) return;
  try { await fn(); showToast('تم الحذف'); await refreshAll(); }
  catch (e) { showToast(dbError(e), true); }
}

/* ============================================================
   تحميل البيانات
   ============================================================ */
async function q(p) { const { data, error } = await p; if (error) throw error; return data; }

async function loadMasters() {
  const [families, students, tutors, subjects, fx, fb, tb, plans] = await Promise.all([
    q(sb.from('families').select('*').order('name')),
    q(sb.from('students').select('*').order('name')),
    q(sb.from('tutors').select('*').order('name')),
    q(sb.from('tutor_subjects').select('*')),
    q(sb.from('fx_rates').select('*')),
    q(sb.from('family_balances').select('*')),
    q(sb.from('tutor_balances').select('*')),
    q(sb.from('student_subjects').select('*').order('created_at')),
  ]);
  state.plans = plans;
  state.families = families; state.students = students; state.tutors = tutors; state.subjects = subjects;
  state.fx = Object.fromEntries(fx.map(r => [r.currency, Number(r.rate_to_egp)]));
  state.fxRows = fx;
  state.famBal = Object.fromEntries(fb.map(r => [r.family_id, r]));
  state.tutBal = Object.fromEntries(tb.map(r => [r.tutor_id, r]));
}
async function loadDay() {
  const start = parseDay(state.day), end = new Date(start.getTime() + 864e5);
  state.daySessions = await q(sb.from('sessions').select('*')
    .gte('scheduled_at', start.toISOString()).lt('scheduled_at', end.toISOString())
    .order('scheduled_at'));
}
async function loadRelay() {
  state.relay = await q(sb.from('relay_tasks').select('*').order('created_at', { ascending: false }).limit(300));
}
async function loadUpcomingForAlerts() {
  const now = new Date();
  state.alertSessions = await q(sb.from('sessions').select('*').eq('status', 'scheduled')
    .gte('scheduled_at', new Date(now.getTime() - 3600e3).toISOString())
    .lte('scheduled_at', new Date(now.getTime() + 6 * 3600e3).toISOString()));
}

async function refreshAll() {
  setLoading(true);
  try {
    await Promise.all([loadMasters(), loadDay(), loadRelay(), loadAttention(), state.dayMode === 'week' ? loadWeek() : null]);
    if (currentTab === 'fin') await loadFinance(true);
    if (currentTab === 'admin') await loadSupervisorsList();
    renderAll();
    if (alertsOn) loadUpcomingForAlerts().catch(() => {});
  } catch (e) { showToast(dbError(e), true); }
  finally { setLoading(false); }
}
let _refreshTimer = null;
function scheduleRefresh() {
  clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(() => {
    if (!document.getElementById('modal').classList.contains('hidden')) { scheduleRefresh(); return; }
    refreshAll();
  }, 700);
}
let realtimeChannel = null;
function subscribeRealtime() {
  if (realtimeChannel) return;
  realtimeChannel = sb.channel('ostaz-db')
    .on('postgres_changes', { event: '*', schema: 'public' }, () => scheduleRefresh())
    .subscribe();
}

function renderAll() {
  renderAttention(); renderDaily(); if (state.dayMode === 'week') renderWeek(); renderRelay(); renderFamilies(); renderTutors();
  if (currentTab === 'fin' && state.fin) renderFinance();
}

function switchTab(t) {
  currentTab = t;
  document.querySelectorAll('#tabs .tab').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  ['daily', 'relay', 'families', 'tutors', 'fin', 'admin'].forEach(k =>
    document.getElementById('view-' + k).classList.toggle('hidden', k !== t));
  if (t === 'fin') loadFinance();
  if (t === 'admin') loadSupervisorsList();
  window.scrollTo(0, 0);
}

/* ============================================================
   الجدول (يوم / أسبوع)
   ============================================================ */
function sessionView(s) {
  const st = byId(state.students, s.student_id);
  const fam = st ? byId(state.families, st.family_id) : null;
  const tu = byId(state.tutors, s.tutor_id);
  return { st, fam, tu };
}
const sMins = s => Number(s.actual_minutes || s.duration_minutes || 60);
const sStart = s => new Date(s.scheduled_at).getTime();
const sEnd = s => sStart(s) + sMins(s) * 60e3;
function durLabel(min) {
  min = Math.round(Number(min) || 0);
  const h = Math.floor(min / 60), m = min % 60;
  const hl = h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : h >= 3 && h <= 10 ? `${h} ساعات` : h ? `${h} ساعة` : '';
  if (!h) return m === 30 ? 'نص ساعة' : m === 20 ? 'تلت ساعة' : m === 15 ? 'ربع ساعة' : `${m} دقيقة`;
  if (!m) return hl;
  const ml = m === 30 ? 'ونص' : m === 15 ? 'وربع' : m === 20 ? 'وتلت' : `و${m} دقيقة`;
  return `${hl} ${ml}`;
}
// إجمالي الحصة = سعر الساعة × المدة الفعلية
function charges(s) {
  const mins = sMins(s);
  const fam = s.student_charge != null ? Number(s.student_charge) : Number(s.student_price || 0) * mins / 60;
  const tut = s.tutor_charge_egp != null ? Number(s.tutor_charge_egp) : Number(s.tutor_cost_egp || 0) * mins / 60;
  const rev = s.status === 'done' && s.revenue_egp != null ? Number(s.revenue_egp) : toEGP(fam, s.student_currency);
  return { mins, fam, tut, rev, margin: rev - tut };
}
function isNow(s) {
  if (s.status === 'in_progress') return true;
  if (s.status !== 'scheduled') return false;
  const now = Date.now();
  return now >= sStart(s) - 15 * 60e3 && now <= sEnd(s);
}
function needsReminder(s) {
  if (s.status !== 'scheduled') return false;
  const diff = sStart(s) - Date.now();
  return diff > -5 * 60e3 && diff <= 3 * 3600e3;
}
function needsConfirm(s) {
  return (s.status === 'scheduled' || s.status === 'in_progress') && sEnd(s) < Date.now();
}
const DAY_FILTERS = [
  { k: 'all', l: 'الكل', f: () => true },
  { k: 'now', l: 'دلوقتي', f: isNow },
  { k: 'remind', l: 'تحتاج تذكير', f: needsReminder },
  { k: 'confirm', l: 'محتاجة تسجيل', f: needsConfirm },
  { k: 'done', l: 'تمت', f: s => s.status === 'done' },
  { k: 'cancel', l: 'ملغاة', f: s => s.status.startsWith('cancelled') },
];
function allLoadedSessions() { return [...state.daySessions, ...(state.weekSessions || []), ...(state.unrecorded || []), ...(state.nextSession ? [state.nextSession] : [])]; }
function findSession(id) { return allLoadedSessions().find(x => x.id === id) || (state.alertSessions || []).find(x => x.id === id); }

function setDay(v) {
  if (!v) return;
  state.day = v; document.getElementById('day-input').value = v;
  (state.dayMode === 'week' ? loadWeek().then(renderWeek) : loadDay().then(renderDaily)).catch(e => showToast(dbError(e), true));
}
function shiftDay(n) { const d = parseDay(state.day); d.setDate(d.getDate() + n * (state.dayMode === 'week' ? 7 : 1)); setDay(dateStr(d)); }
function setDayFilter(k) { state.dayFilter = k; renderDaily(); }
function setDayMode(m) {
  state.dayMode = m;
  document.querySelectorAll('#mode-chips .chip').forEach(c => c.classList.toggle('active', c.dataset.mode === m));
  document.getElementById('day-panel').classList.toggle('hidden', m !== 'day');
  document.getElementById('week-panel').classList.toggle('hidden', m !== 'week');
  document.getElementById('btn-prev').title = m === 'week' ? 'الأسبوع السابق' : 'اليوم السابق';
  document.getElementById('btn-next').title = m === 'week' ? 'الأسبوع التالي' : 'اليوم التالي';
  setDay(state.day);
}

function renderDaily() {
  document.getElementById('day-input').value = state.day;
  const all = state.daySessions;
  document.getElementById('filters').innerHTML = DAY_FILTERS.map(f => {
    const n = all.filter(f.f).length;
    if (!n && !['all', 'done'].includes(f.k) && state.dayFilter !== f.k) return '';
    return `<button class="chip ${state.dayFilter === f.k ? 'active' : ''} ${f.k === 'confirm' && n ? 'warn' : ''}" onclick="setDayFilter('${f.k}')">${f.l} (${n})</button>`;
  }).join('');

  const active = all.filter(s => !s.status.startsWith('cancelled'));
  const hours = active.reduce((a, s) => a + sMins(s), 0) / 60;
  const margin = active.reduce((a, s) => a + charges(s).margin, 0);
  document.getElementById('day-stats').innerHTML = `
    <div class="card stat"><div class="v">${all.length}</div><div class="l">حصص اليوم</div></div>
    <div class="card stat"><div class="v">${all.filter(s => s.status === 'done').length}</div><div class="l">تمت</div></div>
    <div class="card stat"><div class="v num">${fmt(hours, 1)}</div><div class="l">ساعة تدريس</div></div>
    <div class="card stat"><div class="v num">${fmt(margin)}</div><div class="l">هامش متوقع (EGP)</div></div>`;

  const flt = DAY_FILTERS.find(f => f.k === state.dayFilter) || DAY_FILTERS[0];
  const list = all.filter(flt.f);
  const el = document.getElementById('daily-list');
  if (!all.length) {
    el.innerHTML = `<div class="card empty">مفيش حصص في اليوم ده.<br>
      ${state.students.length && state.tutors.length
        ? `<button class="btn btn-brand" onclick="openSessionForm()">+ أضف حصة</button>`
        : `<div class="small mt">ابدأ بإضافة <a href="javascript:void(0)" onclick="switchTab('families')">أسرة وطالب</a> و<a href="javascript:void(0)" onclick="switchTab('tutors')">معلم</a> الأول.</div>`}
    </div>`;
    return;
  }
  if (!list.length) { el.innerHTML = `<div class="card empty">لا توجد حصص مطابقة للفلتر.</div>`; return; }
  el.innerHTML = list.map(sessionCard).join('');
}

function sessionCard(s) {
  const { st, fam, tu } = sessionView(s);
  const now = isNow(s), confirmNeeded = needsConfirm(s);
  const badge = confirmNeeded ? { label: 'محتاجة تسجيل', cls: 'b-pending' }
    : now && s.status === 'scheduled' ? { label: 'دلوقتي', cls: 'b-now' } : STATUS[s.status];
  const c = charges(s);
  const cancelled = s.status.startsWith('cancelled');
  const extended = s.actual_minutes && s.actual_minutes !== s.duration_minutes;
  const famTz = fam && COUNTRIES[fam.country] && fam.country !== 'مصر' ? COUNTRIES[fam.country] : null;
  const id = jsq(s.id);
  const open = s.status === 'scheduled' || s.status === 'in_progress';
  return `<div class="card item session ${now ? 's-now' : ''} ${confirmNeeded ? 's-confirm' : ''}">
    <div class="left">
      <div class="time">${esc(timeStr(new Date(s.scheduled_at)))}</div>
      <div class="sub small">حتى ${esc(timeStr(new Date(sEnd(s))))}</div>
      ${famTz ? `<div class="sub small" title="بتوقيت ${famTz.tzName}">${famTz.flag} ${esc(fmtTime(s.scheduled_at, famTz.tz))}</div>` : ''}
    </div>
    <div>
      <div class="item-head">
        <div>
          <div class="item-title">${esc(st?.name || 'طالب محذوف')} ${s.kind === 'revision' ? '<span class="badge b-rev">مراجعة</span>' : ''}</div>
          <div class="sub small">${esc(fam?.name || '')}${st ? ` · ${esc(st.grade_level)}` : ''}</div>
        </div>
        <span class="badge ${badge.cls}">${badge.label}</span>
      </div>
      <div class="meta">
        <span>المعلم: <b>${esc(tu?.name || '—')}</b></span>
        ${s.subject ? `<span>المادة: <b>${esc(s.subject)}</b></span>` : ''}
        <span>المدة: <b>${durLabel(c.mins)}</b>${extended ? ` <span class="${s.actual_minutes > s.duration_minutes ? 'pos' : 'neg'}">(${s.actual_minutes > s.duration_minutes ? 'اتمدت' : 'اتقصرت'} — المخطط ${durLabel(s.duration_minutes)})</span>` : ''}</span>
        ${s.meeting_link ? `<span><a href="${esc(linkHref(s.meeting_link))}" target="_blank" rel="noopener">رابط الحصة ↗</a></span>` : (open ? '<span class="neg">لا يوجد رابط</span>' : '')}
      </div>
      ${s.notes ? `<div class="sub small mt">📝 ${esc(s.notes)}</div>` : ''}
      ${cancelled ? '' : `<div class="money">
        <span class="pill" title="${fmt(s.student_price, 2)} ${s.student_currency} في الساعة">الأسرة: ${money(c.fam, s.student_currency)}</span>
        <span class="pill" title="${fmt(s.tutor_cost_egp)} EGP في الساعة">المعلم: ${money(c.tut, 'EGP')}</span>
        <span class="pill ${c.margin >= 0 ? 'ok' : 'bad'}">الهامش: ${fmt(c.margin)} EGP${s.status === 'done' ? '' : ' (تقديري)'}</span>
      </div>`}
      <div class="actions">
        ${open && !confirmNeeded ? `
          <button class="btn btn-wa sm" onclick="openReminder(${id},'parent')">📲 ولي الأمر</button>
          <button class="btn btn-wa sm" onclick="openReminder(${id},'tutor')">📲 المعلم</button>` : ''}
        ${s.status === 'scheduled' && !confirmNeeded ? `<button class="btn btn-ghost sm" onclick="setStatus(${id},'in_progress')">▶ بدأت</button>` : ''}
        ${open ? `<button class="btn btn-ok sm" onclick="openDone(${id})">✓ تمت…</button>` : ''}
        ${s.status === 'done' ? `<button class="btn btn-ghost sm" onclick="openDone(${id})">⏱ تعديل المدة</button>` : ''}
        ${open ? `<button class="btn btn-ghost sm" onclick="openPostpone(${id})">🔁 تأجيل</button>` : ''}
        ${open ? `<button class="btn btn-ghost sm" onclick="openCancel(${id})">إلغاء…</button>` : ''}
        ${s.status === 'done' || cancelled ? `<button class="btn btn-ghost sm" onclick="setStatus(${id},'scheduled')">↺ إرجاع</button>` : ''}
        <button class="btn btn-ghost sm" onclick="openSessionForm(${id})">تعديل</button>
        <button class="btn btn-ghost sm" onclick="openRelayForm({student_id:${jsq(s.student_id)}, session_id:${id}})">+ ترحيل</button>
        ${isAdmin ? `<button class="btn btn-danger sm" onclick="deleteSession(${id})">حذف</button>` : ''}
      </div>
    </div>
  </div>`;
}
function linkHref(l) { return /^https?:\/\//i.test(l) ? l : 'https://' + l; }

async function setStatus(id, status, extra = {}) {
  try {
    await q(sb.from('sessions').update({ status, ...extra }).eq('id', id));
    showToast(status === 'done' ? 'تم تسجيل الحصة ✓' : 'تم تحديث الحالة');
    await refreshAll();
  } catch (e) { showToast(dbError(e), true); }
}

/* ----- تسجيل "تمت" مع المدة الفعلية (لو الطالب طلب وقت زيادة) ----- */
function openDone(id) {
  const s = findSession(id); if (!s) return;
  const planned = s.duration_minutes || 60;
  const current = s.actual_minutes || planned;
  const opts = [...new Set([planned, planned + 15, planned + 20, planned + 30, planned + 45, planned + 60, planned + 90, Math.max(15, planned - 15), Math.max(15, planned - 30)])].sort((a, b) => a - b);
  openModal(s.status === 'done' ? 'تعديل مدة الحصة' : 'تسجيل الحصة: تمت ✓', `
    <p class="sub">المدة المخططة: <b>${durLabel(planned)}</b>. لو الحصة اتمدت أو اتقصرت اختار المدة الفعلية، والحساب هيتعدل للأسرة وللمعلم تلقائياً.</p>
    <div class="chips" id="dur-chips">${opts.map(m => `<button type="button" class="chip ${m === current ? 'active' : ''}" data-m="${m}" onclick="_pickDur(${m})">${durLabel(m)}${m === planned ? ' (المخطط)' : m > planned ? ` (+${m - planned}د)` : ''}</button>`).join('')}</div>
    <div class="field"><label>أو اكتب المدة بالدقائق</label><input id="f_actual" class="input" type="number" min="5" max="720" step="5" inputmode="numeric" value="${current}"></div>
    <div id="done-preview" class="card item" style="background:var(--bg)"></div>
    <div id="form-error" class="err hidden"></div>
    <div class="modal-foot"><button class="btn btn-ok" id="form-submit" onclick="_saveDone()">حفظ</button><button class="btn btn-ghost" onclick="closeModal()">إلغاء</button></div>`);
  const inp = document.getElementById('f_actual');
  const preview = () => {
    const m = Number(inp.value) || planned;
    document.querySelectorAll('#dur-chips .chip').forEach(c => c.classList.toggle('active', Number(c.dataset.m) === m));
    const fam = Number(s.student_price) * m / 60, tut = Number(s.tutor_cost_egp) * m / 60;
    document.getElementById('done-preview').innerHTML = `<div class="meta" style="margin:0">
      <span>المدة: <b>${durLabel(m)}</b></span>
      <span>على الأسرة: <b>${money(fam, s.student_currency)}</b></span>
      <span>للمعلم: <b>${money(tut, 'EGP')}</b></span>
      <span>الهامش: <b>${fmt(toEGP(fam, s.student_currency) - tut)} EGP</b></span></div>
      <div class="sub small mt">محسوبة على سعر ساعة ${fmt(s.student_price, 2)} ${s.student_currency} للأسرة و${fmt(s.tutor_cost_egp)} جنيه للمعلم.</div>`;
  };
  window._pickDur = m => { inp.value = m; preview(); };
  inp.addEventListener('input', preview); preview();
  window._saveDone = async () => {
    const m = Math.round(Number(inp.value));
    if (!(m >= 5 && m <= 720)) return formError('المدة لازم تكون بين 5 دقايق و12 ساعة');
    closeModal();
    await setStatus(s.id, 'done', { actual_minutes: m });
  };
}
function openCancel(id) {
  openModal('إلغاء الحصة', `<p class="sub">مين اللي ألغى الحصة؟ (الحصة الملغاة لا تُحسب على الأسرة ولا تُستحق للمعلم)</p>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal(); setStatus(${jsq(id)},'cancelled_by_student')">ألغاها الطالب / الأسرة</button>
      <button class="btn btn-ghost" onclick="closeModal(); setStatus(${jsq(id)},'cancelled_by_tutor')">ألغاها المعلم</button>
    </div>`);
}
function deleteSession(id) {
  confirmDelete('هذه الحصة', () => q(sb.from('sessions').delete().eq('id', id)));
}

/* ----- رسائل التذكير (بدون كشف أرقام أي طرف للآخر) ----- */
function buildReminder(s, who) {
  const { st, fam, tu } = sessionView(s);
  const link = s.meeting_link ? linkHref(s.meeting_link) : '(سيتم إرسال الرابط قبل الحصة)';
  const kindLine = s.kind === 'revision' ? '\n📝 حصة مراجعة' : '';
  const durLine = (s.duration_minutes || 60) !== 60 || s.kind === 'revision' ? `\n⏳ المدة: ${durLabel(s.duration_minutes || 60)}` : '';
  if (who === 'parent') {
    const c = COUNTRIES[fam?.country] || COUNTRIES['مصر'];
    return `السلام عليكم ورحمة الله 🌷
تذكير بحصة ${st?.name || ''} ${relDayLabel(s.scheduled_at, c.tz)}${kindLine}
⏰ الساعة ${fmtTime(s.scheduled_at, c.tz)} بتوقيت ${c.tzName}${durLine}${s.subject ? `\n📚 المادة: ${s.subject}` : ''}
🔗 رابط الحصة: ${link}

برجاء الدخول قبل الموعد بدقيقتين. لأي تعديل في الموعد أو ملاحظات تواصلوا معنا هنا مباشرة.
فريق الإشراف – أكاديمية أستاذ أونلاين`;
  }
  const tn = tu?.name || '';
  return `أهلاً ${/^(أ\.|أ\/|أستاذ|م\.|د\.)/.test(tn) ? tn : 'أ/ ' + tn} 👋
تذكير بحصة ${relDayLabel(s.scheduled_at, CAIRO_TZ)} مع الطالب/ة ${st?.name || ''} (${st?.grade_level || ''})${kindLine}
⏰ الساعة ${fmtTime(s.scheduled_at, CAIRO_TZ)} بتوقيت القاهرة${durLine}${s.subject ? `\n📚 المادة: ${s.subject}` : ''}
🔗 رابط الحصة: ${link}

برجاء الالتزام بالموعد، ولو الطالب طلب وقت زيادة بلّغينا بعد الحصة بالمدة الفعلية. أي مواد أو ملاحظات للطالب ابعتيها لنا هنا وإحنا نوصّلها.
فريق الإشراف – أستاذ أونلاين`;
}
function openReminder(id, who) {
  const s = findSession(id);
  if (!s) return;
  const { fam, tu } = sessionView(s);
  const text = buildReminder(s, who);
  const num = who === 'parent' ? waNumber(fam?.whatsapp, fam?.country) : waNumber(tu?.phone, 'مصر');
  const group = who === 'parent' ? fam?.whatsapp_group : tu?.whatsapp_group;
  window._reminderText = text;
  openModal(who === 'parent' ? 'تذكير ولي الأمر' : 'تذكير المعلم', `
    <div class="msg-preview">${esc(text)}</div>
    <div class="modal-foot" style="flex-wrap:wrap">
      ${group ? `<button class="btn btn-wa" onclick="copyAndOpen(window._reminderText, ${jsq(group)}); closeModal()">نسخ وفتح ${who === 'parent' ? 'جروب الأسرة' : 'جروب المعلم'}</button>` : ''}
      ${num ? `<a class="btn ${group ? 'btn-ghost' : 'btn-wa'}" href="https://wa.me/${num}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener" onclick="closeModal()">إرسال على الرقم الخاص</a>` : ''}
      <button class="btn btn-ghost" onclick="copyText(window._reminderText,'تم نسخ الرسالة ✓')">نسخ النص</button>
      ${!group && !num ? `<span class="sub small">مفيش جروب ولا رقم مسجّل — <a href="javascript:void(0)" onclick="closeModal(); ${who === 'parent' ? `openFamilyForm(${jsq(fam?.id)})` : `openTutorForm(${jsq(tu?.id)})`}">أضفهم</a></span>` : ''}
    </div>`);
}

/* ----- نموذج الحصة ----- */
function studentOptions() {
  return state.families.map(f => ({
    group: `${f.name} (${f.currency})`,
    items: state.students.filter(s => s.family_id === f.id).map(s => ({ v: s.id, l: `${s.name} — ${s.grade_level}` })),
  })).filter(g => g.items.length);
}
const DUR_CHOICES = [30, 45, 60, 90, 120, 180, 240, 300];
async function findConflicts(rows, excludeId) {
  const starts = rows.map(r => new Date(r.scheduled_at).getTime());
  const from = new Date(Math.min(...starts) - 12 * 3600e3).toISOString();
  const to = new Date(Math.max(...starts) + 12 * 3600e3).toISOString();
  const tutorId = rows[0].tutor_id, studentId = rows[0].student_id;
  const others = await q(sb.from('sessions').select('*').or(`tutor_id.eq.${tutorId},student_id.eq.${studentId}`)
    .gte('scheduled_at', from).lte('scheduled_at', to).not('status', 'in', '(cancelled_by_student,cancelled_by_tutor)'));
  const out = [];
  for (const r of rows) {
    const a = new Date(r.scheduled_at).getTime(), b = a + r.duration_minutes * 60e3;
    for (const o of others) {
      if (o.id === excludeId) continue;
      if (a < sEnd(o) && sStart(o) < b) out.push({ r, o });
    }
  }
  return out;
}
async function openSessionForm(id, prefill = {}) {
  if (!state.students.length || !state.tutors.length) {
    showToast('لازم تضيف طالب ومعلم الأول', true);
    switchTab(!state.students.length ? 'families' : 'tutors');
    return;
  }
  const s = id ? findSession(id) : null;
  const when = s ? new Date(s.scheduled_at) : (() => {
    const d = parseDay(prefill.day || state.day); const n = new Date(); d.setHours(Math.min(n.getHours() + 1, 22), 0, 0, 0); return d; })();
  const kind = s?.kind || prefill.kind || 'regular';
  const fields = [
    { name: 'kind', label: 'نوع الحصة', type: 'select', value: kind, options: [{ v: 'regular', l: 'حصة عادية' }, { v: 'revision', l: 'مراجعة (وقت ومدة مرنين)' }] },
    { name: 'student_id', label: 'الطالب', type: 'select', required: true, placeholder: 'اختر الطالب…', options: studentOptions(), value: s?.student_id || prefill.student_id },
    { name: 'tutor_id', label: 'المعلم', type: 'select', required: true, placeholder: 'اختر المعلم…', options: state.tutors.map(t => ({ v: t.id, l: t.name })), value: s?.tutor_id },
    { name: 'subject', label: 'المادة', value: s?.subject, placeholder: 'مثال: رياضيات', list: [...new Set([...SUBJECT_LIST, ...state.subjects.map(x => x.subject)])] },
    [{ name: 'date', label: 'التاريخ', type: 'date', required: true, value: dateStr(when) },
     { name: 'time', label: 'الوقت (بتوقيتك)', type: 'time', required: true, value: timeStr(when) }],
    { name: 'duration_minutes', label: 'المدة (دقيقة)', type: 'number', required: true, value: s?.duration_minutes ?? 60, step: 5, min: 5 },
    [{ name: 'student_price', label: 'سعر الساعة للأسرة', type: 'number', required: true, value: s?.student_price, hint: 'بعملة الأسرة' },
     { name: 'tutor_cost_egp', label: 'أجر الساعة للمعلم (EGP)', type: 'number', required: true, value: s?.tutor_cost_egp }],
    { name: 'meeting_link', label: 'رابط الحصة', value: s?.meeting_link, placeholder: 'meet.google.com/…' },
    { name: 'notes', label: 'ملاحظات', type: 'textarea', value: s?.notes },
  ];
  if (!s) fields.push({ name: 'repeat', label: 'تكرار أسبوعي', type: 'select', value: '1',
    options: [1, 2, 4, 8, 12, 16].map(n => ({ v: n, l: n === 1 ? 'بدون تكرار (حصة واحدة)' : `نفس الموعد لمدة ${n} أسابيع` })) });
  openModal(s ? 'تعديل حصة' : 'حصة جديدة', formHtml(fields, s ? 'حفظ التعديل' : 'إضافة الحصة'));

  const $ = n => document.getElementById('f_' + n);
  const stSel = $('student_id'), tuSel = $('tutor_id'), durIn = $('duration_minutes');
  document.getElementById('wrap_student_id').insertAdjacentHTML('beforeend', '<div id="plan-picks" class="students"></div>');
  document.getElementById('wrap_duration_minutes').insertAdjacentHTML('beforeend',
    `<div class="chips" id="dur-chips" style="margin:6px 0 0">${DUR_CHOICES.map(m => `<button type="button" class="chip" data-m="${m}" onclick="_setDur(${m})">${durLabel(m)}</button>`).join('')}</div>`);
  document.getElementById('wrap_tutor_cost_egp').parentElement.insertAdjacentHTML('afterend', '<div id="sess-total" class="card item" style="background:var(--bg);margin-bottom:12px"></div>');
  const totals = () => {
    const st = byId(state.students, stSel.value); const fam = st ? byId(state.families, st.family_id) : null;
    const m = Number(durIn.value) || 60, p = Number($('student_price').value) || 0, c = Number($('tutor_cost_egp').value) || 0;
    document.querySelectorAll('#dur-chips .chip').forEach(x => x.classList.toggle('active', Number(x.dataset.m) === m));
    const cur = fam?.currency || '';
    document.getElementById('sess-total').innerHTML = `<div class="meta" style="margin:0">
      <span>إجمالي الحصة (${durLabel(m)}):</span>
      <span>الأسرة <b>${money(p * m / 60, cur)}</b></span><span>المعلم <b>${money(c * m / 60, 'EGP')}</b></span>
      ${cur ? `<span>الهامش <b>${fmt(toEGP(p * m / 60, cur) - c * m / 60)} EGP</b></span>` : ''}</div>`;
  };
  window._setDur = m => { durIn.value = m; totals(); };
  const kindChanged = () => {
    const rev = $('kind').value === 'revision';
    const rep = document.getElementById('wrap_repeat'); if (rep) rep.classList.toggle('hidden', rev);
    if (rev && !s && Number(durIn.value) === 60) { durIn.value = 120; }
    totals();
  };
  $('kind').addEventListener('change', kindChanged);
  ['input', 'change'].forEach(ev => [durIn, $('student_price'), $('tutor_cost_egp')].forEach(el => el.addEventListener(ev, totals)));

  const applyPlan = (p) => {
    $('subject').value = p.subject;
    if (p.tutor_id) {
      tuSel.value = p.tutor_id;
      const t = byId(state.tutors, p.tutor_id);
      if (t && t.default_rate_egp != null) $('tutor_cost_egp').value = t.default_rate_egp;
    }
    document.querySelectorAll('#plan-picks .stu').forEach(b => b.classList.toggle('picked', b.dataset.pid === p.id));
    totals();
  };
  window._applyPlan = (pid) => applyPlan(state.plans.find(x => x.id === pid));
  const renderPicks = (auto) => {
    const ps = plansOf(stSel.value);
    document.getElementById('plan-picks').innerHTML = ps.length
      ? '<span class="sub small" style="align-self:center">اختار المادة:</span>' + ps.map(p => `<button type="button" class="stu" data-pid="${esc(p.id)}" onclick="_applyPlan(${jsq(p.id)})">${esc(planLabel(p))}</button>`).join('')
      : '';
    if (auto && ps.length === 1) applyPlan(ps[0]);
  };
  const updateHints = (fill) => {
    const st = byId(state.students, stSel.value);
    const fam = st ? byId(state.families, st.family_id) : null;
    document.getElementById('hint_student_price').textContent = fam ? `${fam.currency} في الساعة` : 'بعملة الأسرة';
    if (fill && st && st.default_price != null) $('student_price').value = st.default_price;
    totals();
  };
  stSel.addEventListener('change', () => { updateHints(true); renderPicks(true); });
  tuSel.addEventListener('change', () => {
    const t = byId(state.tutors, tuSel.value);
    if (t && t.default_rate_egp != null) $('tutor_cost_egp').value = t.default_rate_egp;
    totals();
  });
  updateHints(!s && !!prefill.student_id);
  renderPicks(false);
  if (prefill.plan_id) window._applyPlan(prefill.plan_id);
  kindChanged();

  window._formSubmit = () => runSubmit(async () => {
    const st = byId(state.students, fv('student_id'));
    const fam = byId(state.families, st.family_id);
    const start = new Date(`${fv('date')}T${fv('time')}`);
    if (isNaN(start)) return formError('التاريخ أو الوقت غير صحيح');
    const dur = fnum('duration_minutes');
    if (!(dur >= 5 && dur <= 720)) return formError('المدة لازم تكون بين 5 دقايق و12 ساعة');
    const row = {
      kind: fv('kind'), student_id: st.id, tutor_id: fv('tutor_id'), subject: fv('subject') || null,
      scheduled_at: start.toISOString(), duration_minutes: dur,
      meeting_link: fv('meeting_link') || null, student_price: fnum('student_price'),
      student_currency: fam.currency, tutor_cost_egp: fnum('tutor_cost_egp'), notes: fv('notes') || null,
    };
    const n = s || row.kind === 'revision' ? 1 : Number(fv('repeat') || 1);
    const rows = Array.from({ length: n }, (_, i) => ({ ...row, scheduled_at: new Date(start.getTime() + i * 7 * 864e5).toISOString() }));
    const conflicts = await findConflicts(rows, s?.id);
    if (conflicts.length) {
      const lines = conflicts.slice(0, 5).map(({ o }) => {
        const v = sessionView(o);
        return `• ${fmtShortDate(o.scheduled_at)} ${timeStr(new Date(o.scheduled_at))}–${timeStr(new Date(sEnd(o)))}: ${v.st?.name || ''} مع ${v.tu?.name || ''}`;
      }).join('\n');
      if (!confirm(`⚠️ فيه تعارض في المواعيد (نفس المعلم أو نفس الطالب):\n${lines}${conflicts.length > 5 ? `\n… و${conflicts.length - 5} كمان` : ''}\n\nتكمل الحفظ برضه؟`)) return;
    }
    if (s) {
      await q(sb.from('sessions').update(row).eq('id', s.id));
      showToast('تم حفظ التعديل ✓');
    } else {
      await q(sb.from('sessions').insert(rows));
      if (st.default_price == null) await sb.from('students').update({ default_price: row.student_price }).eq('id', st.id);
      showToast(n > 1 ? `تمت إضافة ${n} حصص ✓` : 'تمت إضافة الحصة ✓');
      state.day = fv('date');
    }
    closeModal();
    await refreshAll();
  });
}

/* ----- عرض الأسبوع + متابعة خطة كل طالب ----- */
function weekStart(dayStr) { // الأسبوع يبدأ السبت
  const d = parseDay(dayStr); const back = (d.getDay() + 1) % 7; d.setDate(d.getDate() - back); return d;
}
async function loadWeek() {
  const from = weekStart(state.day), to = new Date(from.getTime() + 7 * 864e5);
  state.weekSessions = await q(sb.from('sessions').select('*')
    .gte('scheduled_at', from.toISOString()).lt('scheduled_at', to.toISOString()).order('scheduled_at'));
}
const norm = s => String(s || '').trim().replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase();
function weekCoverage() {
  const ws = (state.weekSessions || []).filter(s => !s.status.startsWith('cancelled'));
  const rows = [];
  for (const p of state.plans) {
    if (!p.weekly_sessions) continue;
    const st = byId(state.students, p.student_id); if (!st) continue;
    const booked = ws.filter(s => s.student_id === p.student_id && norm(s.subject) === norm(p.subject)).length;
    rows.push({ p, st, fam: byId(state.families, st.family_id), booked, need: p.weekly_sessions });
  }
  return rows;
}
function renderWeek() {
  document.getElementById('day-input').value = state.day;
  const from = weekStart(state.day);
  const ws = state.weekSessions || [];
  const cov = weekCoverage();
  const missing = cov.filter(r => r.booked < r.need).sort((a, b) => (a.booked / a.need) - (b.booked / b.need));
  const totalNeed = cov.reduce((a, r) => a + r.need, 0), totalBooked = cov.reduce((a, r) => a + Math.min(r.booked, r.need), 0);
  const active = ws.filter(s => !s.status.startsWith('cancelled'));
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(from); d.setDate(d.getDate() + i); return d; });
  const showAll = state.covShowAll;
  document.getElementById('week-panel').innerHTML = `
    <div class="row-gap mb"><button class="btn btn-ghost sm" onclick="openFamilySchedules()">📋 جداول الأسر للأسبوع (رسائل جاهزة)</button></div>
    <div class="stats">
      <div class="card stat"><div class="v">${active.length}</div><div class="l">حصص الأسبوع</div></div>
      <div class="card stat"><div class="v num">${fmt(active.reduce((a, s) => a + sMins(s), 0) / 60, 1)}</div><div class="l">ساعة</div></div>
      <div class="card stat"><div class="v num">${totalNeed ? Math.round(totalBooked / totalNeed * 100) : 0}%</div><div class="l">من خطط الطلاب محجوزة</div></div>
      <div class="card stat"><div class="v">${ws.filter(needsConfirm).length}</div><div class="l">محتاجة تسجيل</div></div>
    </div>
    <div class="card item mb">
      <div class="item-head"><h3 style="margin:0">حصص ناقصة الأسبوع ده حسب خطة الطلاب (${missing.length})</h3></div>
      ${missing.length ? `<div class="cov-list">${(showAll ? missing : missing.slice(0, 8)).map(r => `
        <div class="cov-row">
          <div><b>${esc(r.st.name)}</b> <span class="sub small">${esc(r.fam?.name || '')}</span><div class="small">${esc(r.p.subject)}${r.p.tutor_id ? ' — ' + esc(byId(state.tutors, r.p.tutor_id)?.name || '') : ''}</div></div>
          <span class="num ${r.booked ? 'warn-txt' : 'neg'}">${r.booked} / ${r.need}</span>
          <button class="btn btn-ghost sm" onclick="openSessionForm(null, {student_id:${jsq(r.st.id)}, plan_id:${jsq(r.p.id)}, day:${jsq(dateStr(from) < todayStr() && todayStr() < dateStr(new Date(from.getTime() + 7 * 864e5)) ? todayStr() : dateStr(from))}})">+ احجز</button>
        </div>`).join('')}</div>
        ${missing.length > 8 ? `<button class="btn btn-ghost sm mt" onclick="state.covShowAll=!state.covShowAll; renderWeek()">${showAll ? 'عرض أقل' : `عرض الكل (${missing.length})`}</button>` : ''}`
        : `<p class="pos" style="margin:6px 0 0">✓ كل الحصص الأسبوعية المطلوبة في خطط الطلاب محجوزة.</p>`}
      <p class="sub small" style="margin:8px 0 0">بتتحسب من "المواد وعدد الحصص في الأسبوع" في ملف كل طالب، وبتتطابق باسم المادة.</p>
    </div>
    ${days.map(d => {
      const ds = dateStr(d);
      const list = ws.filter(s => dateStr(new Date(s.scheduled_at)) === ds);
      const label = d.toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' });
      return `<div class="card item week-day ${ds === todayStr() ? 'is-today' : ''}">
        <div class="item-head">
          <a href="javascript:void(0)" class="item-title" onclick="setDayMode('day'); setDay(${jsq(ds)})">${label}${ds === todayStr() ? ' · النهارده' : ''}</a>
          <span class="row-gap" style="align-items:center"><span class="sub small">${list.length ? `${list.length} حصة · ${fmt(list.filter(s => !s.status.startsWith('cancelled')).reduce((a, s) => a + sMins(s), 0) / 60, 1)} ساعة` : 'فاضي'}</span>
          <button class="btn btn-ghost sm icon" title="حصة في اليوم ده" onclick="openSessionForm(null, {day:${jsq(ds)}})">+</button></span>
        </div>
        ${list.map(s => { const v = sessionView(s); const b = needsConfirm(s) ? { label: 'محتاجة تسجيل', cls: 'b-pending' } : STATUS[s.status];
          return `<button class="wk-row" onclick="openSessionForm(${jsq(s.id)})">
            <span class="num"><b>${timeStr(new Date(s.scheduled_at))}</b> <span class="sub small">${durLabel(sMins(s))}</span></span>
            <span>${esc(v.st?.name || '')}${s.kind === 'revision' ? ' <span class="badge b-rev">مراجعة</span>' : ''} <span class="sub small">${esc(s.subject || '')} · ${esc(v.tu?.name || '')}</span></span>
            <span class="badge ${b.cls}">${b.label}</span></button>`; }).join('')}
      </div>`;
    }).join('')}`;
}

/* ============================================================
   مركز الترحيل
   ============================================================ */
function setRelayFilter(k) { state.relayFilter = k; renderRelay(); }
function renderRelay() {
  const pending = state.relay.filter(r => r.status !== 'done');
  const cnt = document.getElementById('relay-count');
  cnt.textContent = pending.length; cnt.classList.toggle('hidden', !pending.length);
  document.getElementById('relay-filters').innerHTML = [['pending', `مفتوحة (${pending.length})`], ['done', 'منتهية'], ['all', 'الكل']]
    .map(([k, l]) => `<button class="chip ${state.relayFilter === k ? 'active' : ''}" onclick="setRelayFilter('${k}')">${l}</button>`).join('');
  const list = state.relay.filter(r => state.relayFilter === 'all' || (state.relayFilter === 'done' ? r.status === 'done' : r.status !== 'done'));
  const el = document.getElementById('relay-list');
  if (!list.length) {
    el.innerHTML = `<div class="card empty">${state.relayFilter === 'pending' ? 'مفيش مهام مفتوحة 👌' : 'لا توجد مهام.'}<br>
      <span class="small">سجّل هنا أي طلب بين ولي الأمر والمعلم (مواد، تأجيل، ملاحظات) عشان محدش من المشرفين ينساه.</span></div>`;
    return;
  }
  el.innerHTML = list.map(r => {
    const st = byId(state.students, r.student_id);
    const fam = st ? byId(state.families, st.family_id) : null;
    const done = r.status === 'done';
    return `<div class="card item">
      <div class="item-head">
        <div>
          <div class="item-title">${esc(REQUESTERS[r.requested_by] || r.requested_by)} ${st ? `← ${esc(st.name)}` : ''}</div>
          <div class="sub small">${esc(fam?.name || '')} · ${ago(r.created_at)}</div>
        </div>
        <span class="badge ${done ? 'b-done' : 'b-pending'}">${done ? 'تم' : 'مفتوحة'}</span>
      </div>
      <div class="mt" style="white-space:pre-wrap">${esc(r.description)}</div>
      <div class="actions">
        ${done ? `<button class="btn btn-ghost sm" onclick="setRelay(${jsq(r.id)},'pending')">إعادة فتح</button>`
               : `<button class="btn btn-ok sm" onclick="setRelay(${jsq(r.id)},'done')">✓ تم التوصيل</button>`}
        <button class="btn btn-ghost sm" onclick="openRelayForm(null, ${jsq(r.id)})">تعديل</button>
        ${isAdmin ? `<button class="btn btn-danger sm" onclick="confirmDelete('هذه المهمة', () => q(sb.from('relay_tasks').delete().eq('id', ${jsq(r.id)})))">حذف</button>` : ''}
      </div>
    </div>`;
  }).join('');
}
async function setRelay(id, status) {
  try {
    await q(sb.from('relay_tasks').update({ status, resolved_at: status === 'done' ? new Date().toISOString() : null }).eq('id', id));
    showToast(status === 'done' ? 'تم ✓' : 'أُعيد فتحها');
    await refreshAll();
  } catch (e) { showToast(dbError(e), true); }
}
function openRelayForm(prefill, id) {
  const r = id ? state.relay.find(x => x.id === id) : null;
  const v = r || prefill || {};
  const fields = [
    { name: 'requested_by', label: 'الطلب جاي من', type: 'select', required: true, value: v.requested_by || 'parent',
      options: Object.entries(REQUESTERS).map(([k, l]) => ({ v: k, l })) },
    { name: 'student_id', label: 'الطالب', type: 'select', placeholder: '— بدون —', options: studentOptions(), value: v.student_id },
    { name: 'description', label: 'المطلوب', type: 'textarea', required: true, value: v.description,
      placeholder: 'مثال: المعلم أرسل شيت مراجعة يحتاج إرساله للأب / الأم تطلب تأجيل حصة الغد لـ 7 مساءً' },
  ];
  openModal(r ? 'تعديل مهمة ترحيل' : 'مهمة ترحيل جديدة', formHtml(fields, 'حفظ'));
  window._formSubmit = () => runSubmit(async () => {
    const row = { requested_by: fv('requested_by'), student_id: fv('student_id') || null, description: fv('description') };
    if (r) await q(sb.from('relay_tasks').update(row).eq('id', r.id));
    else await q(sb.from('relay_tasks').insert({ ...row, session_id: v.session_id || null }));
    closeModal(); showToast('تم الحفظ ✓'); await refreshAll();
  });
}

/* ============================================================
   الأسر والطلاب
   ============================================================ */
function famBalance(f) {
  const b = state.famBal[f.id] || { paid: 0, consumed: 0, done_count: 0 };
  return { paid: Number(b.paid), consumed: Number(b.consumed), balance: Number(b.paid) - Number(b.consumed), count: Number(b.done_count) };
}
function renderFamilies() {
  const term = (document.getElementById('family-search').value || '').trim().toLowerCase();
  const el = document.getElementById('families-list');
  if (!state.families.length) {
    el.innerHTML = `<div class="card empty">لسه مفيش أسر مسجّلة.<br><button class="btn btn-brand" onclick="openFamilyForm()">+ أضف أول أسرة</button></div>`;
    return;
  }
  const list = state.families.filter(f => {
    if (!term) return true;
    const studs = state.students.filter(s => s.family_id === f.id).map(s => `${s.name} ${s.notes || ''} ${plansOf(s.id).map(p => planLabel(p)).join(' ')}`).join(' ');
    return `${f.name} ${f.parent_name || ''} ${f.whatsapp || ''} ${studs}`.toLowerCase().includes(term);
  });
  el.innerHTML = list.map(f => {
    const c = COUNTRIES[f.country] || {};
    const b = famBalance(f);
    const studs = state.students.filter(s => s.family_id === f.id);
    const fid = jsq(f.id);
    return `<div class="card item">
      <div class="item-head">
        <div>
          <div class="item-title">${c.flag || ''} ${esc(f.name)}</div>
          <div class="sub small">${esc(f.parent_name || '')}${f.parent_name ? ' · ' : ''}${esc(f.country)} · ${esc(f.currency)}</div>
        </div>
        <div style="text-align:left">
          <div class="num ${b.balance < 0 ? 'neg' : 'pos'}" style="font-weight:800">${money(b.balance, f.currency)}</div>
          <div class="sub small">${b.balance < 0 ? 'مستحق على الأسرة' : 'رصيد'}</div>
        </div>
      </div>
      ${f.whatsapp_group ? `<div class="actions" style="margin-top:8px"><a class="btn btn-wa sm" href="${esc(f.whatsapp_group)}" target="_blank" rel="noopener">💬 جروب الأسرة</a></div>` : ''}
      <div class="meta"><span>واتساب: ${f.whatsapp ? `<b dir="ltr">${esc(f.whatsapp)}</b>` : `<a href="javascript:void(0)" onclick="openFamilyForm(${fid})">أضف الرقم</a>`}</span><span>حصص تمت: <b>${b.count}</b></span></div>
      ${f.notes ? `<div class="sub small mt">📝 ${esc(f.notes)}</div>` : ''}
      <div class="stu-list">
        ${studs.map(s => `<button class="stu-row" onclick="openStudentForm(${jsq(f.id)}, ${jsq(s.id)})">
          <div class="stu-top"><b>${esc(s.name)}</b><span class="num">${s.default_price != null ? `${fmt(s.default_price)} ${esc(f.currency)}<span class="sub small">/ساعة</span>` : '<span class="neg">بدون سعر</span>'}</span></div>
          <div class="sub small">${esc(s.grade_level)} · ${esc(CURRICULA[s.curriculum])}</div>
          ${plansOf(s.id).length ? `<div class="plan-lines">${plansOf(s.id).map(p => `<span class="plan ${p.tutor_id ? '' : 'no-tutor'}">${esc(planLabel(p))}</span>`).join('')}</div>` : ''}
          ${s.notes ? `<div class="small warn-note">⚠️ ${esc(s.notes)}</div>` : ''}
        </button>`).join('')}
        <button class="stu" style="background:transparent;border:1px dashed var(--brand)" onclick="openStudentForm(${fid})">+ طالب</button>
      </div>
      <div class="actions">
        <button class="btn btn-brand sm" onclick="openPaymentForm(${fid})">+ دفعة</button>
        ${b.balance < 0 ? `<button class="btn btn-wa sm" onclick="openPaymentReminder(${fid})">📲 مطالبة</button>` : ''}
        <button class="btn btn-ghost sm" onclick="openFamilyStatement(${fid})">كشف حساب</button>
        <button class="btn btn-ghost sm" onclick="openFamilyForm(${fid})">تعديل</button>
        ${isAdmin ? `<button class="btn btn-danger sm" onclick="confirmDelete(${jsq('أسرة ' + f.name + ' وكل طلابها')}, () => q(sb.from('families').delete().eq('id', ${fid})))">حذف</button>` : ''}
      </div>
    </div>`;
  }).join('') || `<div class="card empty">لا توجد نتائج.</div>`;
}
function openFamilyForm(id) {
  const f = id ? byId(state.families, id) : null;
  const fields = [
    { name: 'name', label: 'اسم الأسرة', required: true, value: f?.name, placeholder: 'مثال: أسرة أحمد الشهري' },
    { name: 'parent_name', label: 'اسم ولي الأمر', value: f?.parent_name },
    [{ name: 'country', label: 'الدولة', type: 'select', required: true, value: f?.country || 'السعودية',
       options: Object.keys(COUNTRIES).map(k => ({ v: k, l: `${COUNTRIES[k].flag} ${k}` })) },
     { name: 'currency', label: 'عملة الدفع', type: 'select', required: true, value: f?.currency || 'SAR',
       options: CURRENCIES.map(c => ({ v: c, l: c })) }],
    { name: 'whatsapp_group', label: 'لينك جروب واتساب الأسرة', type: 'url', value: f?.whatsapp_group, placeholder: 'https://chat.whatsapp.com/…' },
    { name: 'whatsapp', label: 'رقم واتساب ولي الأمر', type: 'tel', value: f?.whatsapp, placeholder: '9665xxxxxxxx', hint: 'بكود الدولة — للاستخدام الداخلي فقط ولا يظهر للمعلم' },
    { name: 'notes', label: 'ملاحظات', type: 'textarea', value: f?.notes },
  ];
  let extra = '';
  if (!f) extra = `<h3 class="mt">أول طالب (اختياري)</h3>` + [
    { name: 'st_name', label: 'اسم الطالب' },
    [{ name: 'st_grade', label: 'الصف', list: GRADES }, { name: 'st_curr', label: 'المنهج', type: 'select', value: 'arabic', options: Object.entries(CURRICULA).map(([v, l]) => ({ v, l })) }],
    { name: 'st_price', label: 'سعر الساعة (بعملة الأسرة)', type: 'number' },
  ].map(x => Array.isArray(x) ? `<div class="field-row">${x.map(fieldHtml).join('')}</div>` : fieldHtml(x)).join('');
  openModal(f ? 'تعديل الأسرة' : 'أسرة جديدة', formHtml(fields, 'حفظ', extra));
  document.getElementById('f_country').addEventListener('change', e => {
    document.getElementById('f_currency').value = COUNTRIES[e.target.value].cur;
  });
  window._formSubmit = () => runSubmit(async () => {
    const row = { name: fv('name'), parent_name: fv('parent_name') || null, country: fv('country'), currency: fv('currency'), whatsapp: fv('whatsapp') || null, whatsapp_group: cleanGroup(fv('whatsapp_group')), notes: fv('notes') || null };
    if (!f && fv('st_name') && !fv('st_grade')) return formError('اكتب صف الطالب أو امسح اسمه');
    if (f) {
      await q(sb.from('families').update(row).eq('id', f.id));
    } else {
      const [nf] = await q(sb.from('families').insert(row).select());
      if (fv('st_name')) {
        await q(sb.from('students').insert({ family_id: nf.id, name: fv('st_name'), grade_level: fv('st_grade'), curriculum: fv('st_curr'), default_price: fnum('st_price') }));
      }
    }
    closeModal(); showToast('تم الحفظ ✓'); await refreshAll();
  });
}
function openStudentForm(familyId, id) {
  const s = id ? byId(state.students, id) : null;
  const fam = byId(state.families, familyId);
  const fields = [
    { name: 'name', label: 'اسم الطالب', required: true, value: s?.name },
    [{ name: 'grade_level', label: 'الصف الدراسي', required: true, value: s?.grade_level, list: GRADES },
     { name: 'curriculum', label: 'المنهج', type: 'select', required: true, value: s?.curriculum || 'arabic', options: Object.entries(CURRICULA).map(([v, l]) => ({ v, l })) }],
    { name: 'default_price', label: `سعر الساعة (${fam.currency})`, type: 'number', value: s?.default_price, hint: 'الحصة بتتحسب بالساعة: لو الحصة ساعة ونص بتتحسب 1.5 × السعر. بيتملى تلقائي في الحصص وتقدر تغيّره.' },
    { name: 'notes', label: 'ملاحظات', type: 'textarea', value: s?.notes },
  ];
  const plans = s ? plansOf(s.id) : [];
  const planBlock = `<div class="field"><label>المواد والمعلمين</label>
    <datalist id="subj-list2">${SUBJECT_LIST.map(x => `<option value="${x}">`).join('')}</datalist>
    <div class="plan-head small sub"><span>المادة</span><span>بالأسبوع</span><span>المعلم</span><span></span></div>
    <div id="plan-rows">${(plans.length ? plans : [{}]).map(planRowHtml).join('')}</div>
    <button type="button" class="btn btn-ghost sm" onclick="document.getElementById('plan-rows').insertAdjacentHTML('beforeend', planRowHtml())">+ مادة</button></div>`;
  const del = s && isAdmin ? `<button type="button" class="btn btn-danger" style="margin-top:6px" onclick="closeModal(); confirmDelete(${jsq('الطالب ' + s.name)}, () => q(sb.from('students').delete().eq('id', ${jsq(s.id)})))">حذف الطالب</button>` : '';
  openModal(`${s ? 'تعديل طالب' : 'طالب جديد'} — ${fam.name}`, formHtml(fields, 'حفظ', planBlock + del));
  window._formSubmit = () => runSubmit(async () => {
    const row = { family_id: familyId, name: fv('name'), grade_level: fv('grade_level'), curriculum: fv('curriculum'), default_price: fnum('default_price'), notes: fv('notes') || null };
    let sid = s?.id;
    if (s) await q(sb.from('students').update(row).eq('id', s.id));
    else { const [ns] = await q(sb.from('students').insert(row).select()); sid = ns.id; }
    const rows = [...document.querySelectorAll('#plan-rows .plan-row')].map(r => ({
      student_id: sid, subject: r.querySelector('.pl-subject').value.trim(),
      weekly_sessions: r.querySelector('.pl-weekly').value ? Number(r.querySelector('.pl-weekly').value) : null,
      tutor_id: r.querySelector('.pl-tutor').value || null,
    })).filter(x => x.subject);
    if (s) await q(sb.from('student_subjects').delete().eq('student_id', sid));
    if (rows.length) await q(sb.from('student_subjects').insert(rows));
    closeModal(); showToast('تم الحفظ ✓'); await refreshAll();
  });
}
function planRowHtml(p = {}) {
  return `<div class="plan-row">
    <input class="input pl-subject" placeholder="المادة" value="${esc(p.subject || '')}" list="subj-list2">
    <input class="input pl-weekly" type="number" min="1" max="14" inputmode="numeric" placeholder="—" value="${esc(p.weekly_sessions ?? '')}">
    <select class="input pl-tutor"><option value="">— بدون —</option>${state.tutors.map(t => `<option value="${esc(t.id)}" ${t.id === p.tutor_id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
    <button type="button" class="btn btn-ghost icon" onclick="this.parentElement.remove()">✕</button>
  </div>`;
}
async function openFamilyStatement(familyId) {
  const f = byId(state.families, familyId);
  const studIds = state.students.filter(s => s.family_id === familyId).map(s => s.id);
  try {
    const [tx, ss] = await Promise.all([
      q(sb.from('family_transactions').select('*').eq('family_id', familyId)),
      studIds.length ? q(sb.from('sessions').select('*').in('student_id', studIds).eq('status', 'done')) : [],
    ]);
    const rows = [
      ...tx.map(t => ({ at: t.created_at, desc: (t.type === 'refund' ? 'استرداد' : 'دفعة') + (t.note ? ` — ${t.note}` : ''), amt: t.type === 'refund' ? -Number(t.amount) : Number(t.amount), id: t.id, kind: 'tx' })),
      ...ss.map(s => ({ at: s.scheduled_at, desc: `${s.kind === 'revision' ? 'مراجعة' : 'حصة'} ${byId(state.students, s.student_id)?.name || ''}${s.subject ? ' — ' + s.subject : ''} (${durLabel(sMins(s))})`, amt: -charges(s).fam, kind: 'session' })),
    ].sort((a, b) => new Date(a.at) - new Date(b.at));
    let run = 0;
    const body = rows.map(r => { run += r.amt; return `<tr>
      <td class="num">${fmtShortDate(r.at)}</td><td>${esc(r.desc)}</td>
      <td class="num ${r.amt < 0 ? 'neg' : 'pos'}">${fmt(r.amt, 2)}</td><td class="num">${fmt(run, 2)}</td>
      <td>${r.kind === 'tx' && isAdmin ? `<button class="btn btn-danger sm" onclick="closeModal(); confirmDelete('هذه الدفعة', () => q(sb.from('family_transactions').delete().eq('id', ${jsq(r.id)})))">حذف</button>` : ''}</td></tr>`; }).reverse().join('');
    openModal(`كشف حساب — ${f.name}`, `
      <div class="kpis mb">
        <div class="card kpi"><div class="l">الرصيد الحالي</div><div class="v num ${run < 0 ? 'neg' : 'pos'}">${money(run, f.currency)}</div></div>
      </div>
      <div class="scrollx"><table><thead><tr><th>التاريخ</th><th>البيان</th><th>المبلغ</th><th>الرصيد</th><th></th></tr></thead>
      <tbody>${body || '<tr><td colspan="5" class="empty">لا توجد حركات بعد</td></tr>'}</tbody></table></div>
      <p class="sub small">الرصيد = المدفوعات − أسعار الحصص اللي تمت. الحصص الملغاة لا تُخصم.</p>
      <div class="modal-foot"><button class="btn btn-brand" onclick="openPaymentForm(${jsq(familyId)})">+ تسجيل دفعة</button></div>`);
  } catch (e) { showToast(dbError(e), true); }
}
function openPaymentForm(familyId) {
  if (!state.families.length) { showToast('أضف أسرة الأول', true); switchTab('families'); return; }
  const fields = [
    { name: 'family_id', label: 'الأسرة', type: 'select', required: true, placeholder: 'اختر الأسرة…', value: familyId,
      options: state.families.map(f => ({ v: f.id, l: `${f.name} (${f.currency})` })) },
    [{ name: 'type', label: 'النوع', type: 'select', value: 'payment', options: [{ v: 'payment', l: 'دفعة مستلمة' }, { v: 'refund', l: 'استرداد للأسرة' }] },
     { name: 'amount', label: 'المبلغ', type: 'number', required: true, hint: 'بعملة الأسرة' }],
    { name: 'date', label: 'تاريخ الاستلام', type: 'date', value: todayStr() },
    { name: 'note', label: 'ملاحظة', placeholder: 'مثال: باقة 8 حصص — تحويل بنكي' },
  ];
  openModal('تسجيل دفعة', formHtml(fields, 'تسجيل'));
  const sel = document.getElementById('f_family_id');
  const upd = () => { const f = byId(state.families, sel.value); document.getElementById('hint_amount').textContent = f ? `بـ ${f.currency}` : 'بعملة الأسرة'; };
  sel.addEventListener('change', upd); upd();
  window._formSubmit = () => runSubmit(async () => {
    const f = byId(state.families, fv('family_id'));
    const amount = fnum('amount');
    if (!(amount > 0)) return formError('اكتب مبلغ صحيح');
    const d = fv('date') ? new Date(`${fv('date')}T12:00:00`) : new Date();
    await q(sb.from('family_transactions').insert({ family_id: f.id, amount, currency: f.currency, type: fv('type'), note: fv('note') || null, created_at: d.toISOString() }));
    closeModal(); showToast('تم تسجيل الدفعة ✓'); await refreshAll();
  });
}

/* ============================================================
   المعلمون
   ============================================================ */
function tutBalance(t) {
  const b = state.tutBal[t.id] || { earned_egp: 0, paid_egp: 0, done_count: 0 };
  return { earned: Number(b.earned_egp), paid: Number(b.paid_egp), due: Number(b.earned_egp) - Number(b.paid_egp), count: Number(b.done_count) };
}
function renderTutors() {
  const term = (document.getElementById('tutor-search').value || '').trim().toLowerCase();
  const el = document.getElementById('tutors-list');
  if (!state.tutors.length) {
    el.innerHTML = `<div class="card empty">لسه مفيش معلمين مسجّلين.<br><button class="btn btn-brand" onclick="openTutorForm()">+ أضف أول معلم</button></div>`;
    return;
  }
  const list = state.tutors.filter(t => {
    if (!term) return true;
    const subs = state.subjects.filter(s => s.tutor_id === t.id).map(s => s.subject).join(' ');
    const studs = state.plans.filter(p => p.tutor_id === t.id).map(p => byId(state.students, p.student_id)?.name || '').join(' ');
    return `${t.name} ${t.phone || ''} ${subs} ${studs}`.toLowerCase().includes(term);
  });
  el.innerHTML = list.map(t => {
    const subs = state.subjects.filter(s => s.tutor_id === t.id);
    const b = tutBalance(t);
    const tid = jsq(t.id);
    return `<div class="card item">
      <div class="item-head">
        <div>
          <div class="item-title">${esc(t.name)}</div>
          <div class="sub small" dir="ltr" style="text-align:right">${esc(t.phone || '')}</div>
        </div>
        <div style="text-align:left">
          <div class="num ${b.due > 0 ? 'neg' : ''}" style="font-weight:800">${money(b.due, 'EGP')}</div>
          <div class="sub small">مستحقات لم تُصرف</div>
        </div>
      </div>
      ${t.whatsapp_group || t.phone ? `<div class="actions" style="margin-top:8px">
        ${t.whatsapp_group ? `<a class="btn btn-wa sm" href="${esc(t.whatsapp_group)}" target="_blank" rel="noopener">💬 جروب المعلم</a>` : ''}
        ${t.phone ? `<a class="btn btn-ghost sm" href="https://wa.me/${waNumber(t.phone, 'مصر')}" target="_blank" rel="noopener">واتساب خاص</a>` : ''}
      </div>` : ''}
      <div class="meta">
        ${t.default_rate_egp != null ? `<span>أجر الساعة: <b>${fmt(t.default_rate_egp)} EGP</b></span>` : `<span><a href="javascript:void(0)" onclick="openTutorForm(${tid})">حدد أجر الساعة</a></span>`}
        <span>حصص تمت: <b>${b.count}</b></span>
        ${t.vodafone_cash ? `<span>فودافون كاش: <b dir="ltr">${esc(t.vodafone_cash)}</b></span>` : ''}
        ${t.bank_account ? `<span>بنك: <b>${esc(t.bank_account)}</b></span>` : ''}
      </div>
      ${subs.length ? `<div class="meta"><span>المواد: <b>${subs.map(s => esc(s.subject) + (s.grade_level ? ` (${esc(s.grade_level)})` : '')).join('، ')}</b></span></div>` : ''}
      ${(() => { const ps = state.plans.filter(p => p.tutor_id === t.id); if (!ps.length) return '';
        const weekly = ps.reduce((a, p) => a + (p.weekly_sessions || 0), 0);
        return `<div class="sub small mt">الطلاب (${ps.length})${weekly ? ` · ${weekly} حصة/أسبوع على الأقل` : ''}</div>
        <div class="students">${ps.map(p => { const st = byId(state.students, p.student_id); const fam = st && byId(state.families, st.family_id);
          return `<button class="stu" onclick="openStudentForm(${jsq(st?.family_id)}, ${jsq(p.student_id)})" title="${esc(fam?.name || '')}">${esc(st?.name || '')} · ${esc(p.subject)}${p.weekly_sessions ? ' ×' + p.weekly_sessions : ''}</button>`; }).join('')}</div>`; })()}
      ${t.notes ? `<div class="sub small mt">📝 ${esc(t.notes)}</div>` : ''}
      <div class="actions">
        ${b.due > 0 ? `<button class="btn btn-brand sm" onclick="openPayoutForm(${tid})">صرف مستحقات</button>
        <button class="btn btn-wa sm" onclick="openTutorStatementMessage(${tid})">📲 كشف للمعلمة</button>` : ''}
        <button class="btn btn-ghost sm" onclick="openTutorStatement(${tid})">كشف حساب</button>
        <button class="btn btn-ghost sm" onclick="openTutorForm(${tid})">تعديل</button>
        ${isAdmin ? `<button class="btn btn-danger sm" onclick="confirmDelete(${jsq('المعلم ' + t.name)}, () => q(sb.from('tutors').delete().eq('id', ${tid})))">حذف</button>` : ''}
      </div>
    </div>`;
  }).join('') || `<div class="card empty">لا توجد نتائج.</div>`;
}
function subjRowHtml(s = {}) {
  return `<div class="subj-row">
    <input class="input sj-subject" placeholder="المادة" value="${esc(s.subject || '')}" list="subj-list">
    <select class="input sj-curr">${Object.entries(CURRICULA).map(([v, l]) => `<option value="${v}" ${s.curriculum === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <input class="input sj-grade" placeholder="المرحلة (اختياري)" value="${esc(s.grade_level || '')}">
    <button type="button" class="btn btn-ghost icon" onclick="this.parentElement.remove()">✕</button>
  </div>`;
}
function openTutorForm(id) {
  const t = id ? byId(state.tutors, id) : null;
  const subs = t ? state.subjects.filter(s => s.tutor_id === t.id) : [];
  const fields = [
    { name: 'name', label: 'اسم المعلم', required: true, value: t?.name, placeholder: 'أ. …' },
    { name: 'whatsapp_group', label: 'لينك جروب واتساب المعلم', type: 'url', value: t?.whatsapp_group, placeholder: 'https://chat.whatsapp.com/…' },
    [{ name: 'phone', label: 'رقم الموبايل / واتساب', type: 'tel', value: t?.phone, placeholder: '01xxxxxxxxx', hint: 'داخلي فقط — لا يظهر لولي الأمر' },
     { name: 'default_rate_egp', label: 'أجر الساعة (EGP)', type: 'number', value: t?.default_rate_egp, hint: 'بيتضرب في مدة الحصة الفعلية' }],
    [{ name: 'vodafone_cash', label: 'رقم فودافون كاش', type: 'tel', value: t?.vodafone_cash },
     { name: 'bank_account', label: 'الحساب البنكي / InstaPay', value: t?.bank_account }],
    { name: 'notes', label: 'ملاحظات', type: 'textarea', value: t?.notes },
  ];
  const subjBlock = `<div class="field"><label>المواد اللي بيدرّسها</label>
    <datalist id="subj-list">${['رياضيات', 'لغة عربية', 'English', 'علوم', 'فيزياء', 'كيمياء', 'أحياء', 'Math', 'Science', 'French', 'دراسات اجتماعية', 'قرآن'].map(x => `<option value="${x}">`).join('')}</datalist>
    <div id="subj-rows">${(subs.length ? subs : [{}]).map(subjRowHtml).join('')}</div>
    <button type="button" class="btn btn-ghost sm" onclick="document.getElementById('subj-rows').insertAdjacentHTML('beforeend', subjRowHtml())">+ مادة</button></div>`;
  openModal(t ? 'تعديل معلم' : 'معلم جديد', formHtml(fields, 'حفظ', subjBlock));
  window._formSubmit = () => runSubmit(async () => {
    const row = { name: fv('name'), phone: fv('phone') || null, whatsapp_group: cleanGroup(fv('whatsapp_group')), default_rate_egp: fnum('default_rate_egp'),
      vodafone_cash: fv('vodafone_cash') || null, bank_account: fv('bank_account') || null, notes: fv('notes') || null };
    let tutorId = t?.id;
    if (t) await q(sb.from('tutors').update(row).eq('id', t.id));
    else { const [nt] = await q(sb.from('tutors').insert(row).select()); tutorId = nt.id; }
    const seen = new Set();
    const subjRows = [...document.querySelectorAll('#subj-rows .subj-row')].map(r => ({
      tutor_id: tutorId, subject: r.querySelector('.sj-subject').value.trim(),
      curriculum: r.querySelector('.sj-curr').value, grade_level: r.querySelector('.sj-grade').value.trim() || null,
    })).filter(x => x.subject && !seen.has(x.subject + x.curriculum + x.grade_level) && seen.add(x.subject + x.curriculum + x.grade_level));
    if (t) await q(sb.from('tutor_subjects').delete().eq('tutor_id', tutorId));
    if (subjRows.length) await q(sb.from('tutor_subjects').insert(subjRows));
    closeModal(); showToast('تم الحفظ ✓'); await refreshAll();
  });
}
async function openTutorStatement(tutorId) {
  const t = byId(state.tutors, tutorId);
  try {
    const [ss, po] = await Promise.all([
      q(sb.from('sessions').select('*').eq('tutor_id', tutorId).eq('status', 'done')),
      q(sb.from('tutor_payouts').select('*').eq('tutor_id', tutorId)),
    ]);
    const rows = [
      ...ss.map(s => ({ at: s.scheduled_at, desc: `${s.kind === 'revision' ? 'مراجعة' : 'حصة'} ${byId(state.students, s.student_id)?.name || ''}${s.subject ? ' — ' + s.subject : ''} (${durLabel(sMins(s))})`, amt: charges(s).tut })),
      ...po.filter(p => p.paid).map(p => ({ at: p.paid_at || p.created_at, desc: `صرف${p.method ? ' (' + p.method + ')' : ''}${p.note ? ' — ' + p.note : ''}`, amt: -Number(p.total_egp), id: p.id })),
    ].sort((a, b) => new Date(a.at) - new Date(b.at));
    let run = 0;
    const body = rows.map(r => { run += r.amt; return `<tr><td class="num">${fmtShortDate(r.at)}</td><td>${esc(r.desc)}</td>
      <td class="num ${r.amt < 0 ? 'neg' : ''}">${fmt(r.amt, 2)}</td><td class="num">${fmt(run, 2)}</td>
      <td>${r.id && isAdmin ? `<button class="btn btn-danger sm" onclick="closeModal(); confirmDelete('عملية الصرف دي', () => q(sb.from('tutor_payouts').delete().eq('id', ${jsq(r.id)})))">حذف</button>` : ''}</td></tr>`; }).reverse().join('');
    openModal(`كشف حساب — ${t.name}`, `
      <div class="kpis mb"><div class="card kpi"><div class="l">المستحق الآن</div><div class="v num">${money(run, 'EGP')}</div></div></div>
      <div class="scrollx"><table><thead><tr><th>التاريخ</th><th>البيان</th><th>EGP</th><th>الرصيد</th><th></th></tr></thead>
      <tbody>${body || '<tr><td colspan="5" class="empty">لا توجد حركات بعد</td></tr>'}</tbody></table></div>
      ${run > 0 ? `<div class="modal-foot"><button class="btn btn-brand" onclick="openPayoutForm(${jsq(tutorId)})">صرف المستحقات</button>
        <button class="btn btn-wa" onclick="openTutorStatementMessage(${jsq(tutorId)})">📲 إرسال الكشف للمعلمة</button></div>` : ''}`);
  } catch (e) { showToast(dbError(e), true); }
}
function openPayoutForm(tutorId) {
  const t = byId(state.tutors, tutorId);
  const b = tutBalance(t);
  const range = finRange();
  const fields = [
    { name: 'total_egp', label: 'المبلغ المصروف (EGP)', type: 'number', required: true, value: b.due.toFixed(2), hint: `إجمالي المستحق حالياً: ${money(b.due, 'EGP')}` },
    { name: 'method', label: 'طريقة الصرف', type: 'select', value: t.vodafone_cash ? 'فودافون كاش' : 'تحويل بنكي',
      options: ['فودافون كاش', 'InstaPay', 'تحويل بنكي', 'كاش'].map(x => ({ v: x, l: x })) },
    [{ name: 'period_start', label: 'عن الفترة من', type: 'date', value: range.from }, { name: 'period_end', label: 'إلى', type: 'date', value: range.toIncl }],
    { name: 'note', label: 'ملاحظة', placeholder: 'رقم العملية مثلاً' },
  ];
  openModal(`صرف مستحقات — ${t.name}`, formHtml(fields, 'تأكيد الصرف'));
  window._formSubmit = () => runSubmit(async () => {
    const amt = fnum('total_egp');
    if (!(amt > 0)) return formError('اكتب مبلغ صحيح');
    await q(sb.from('tutor_payouts').insert({ tutor_id: t.id, total_egp: amt, method: fv('method'), note: fv('note') || null,
      period_start: fv('period_start'), period_end: fv('period_end'), paid: true, paid_at: new Date().toISOString() }));
    closeModal(); showToast('تم تسجيل الصرف ✓'); await refreshAll();
  });
}

/* ============================================================
   المالية
   ============================================================ */
function finRange() {
  const sel = document.getElementById('fin-period').value;
  const now = new Date();
  let from, to;
  if (sel === 'last') { from = new Date(now.getFullYear(), now.getMonth() - 1, 1); to = new Date(now.getFullYear(), now.getMonth(), 1); }
  else if (sel === 'custom') {
    const a = document.getElementById('fin-from').value, b = document.getElementById('fin-to').value;
    from = a ? parseDay(a) : new Date(now.getFullYear(), now.getMonth(), 1);
    to = b ? new Date(parseDay(b).getTime() + 864e5) : new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else { from = new Date(now.getFullYear(), now.getMonth(), 1); to = new Date(now.getFullYear(), now.getMonth() + 1, 1); }
  return { fromD: from, toD: to, from: dateStr(from), toIncl: dateStr(new Date(to.getTime() - 864e5)) };
}
function onFinPeriod() {
  const custom = document.getElementById('fin-period').value === 'custom';
  ['fin-from', 'fin-to'].forEach(i => document.getElementById(i).classList.toggle('hidden', !custom));
  if (custom && !document.getElementById('fin-from').value) {
    const r = finRange(); document.getElementById('fin-from').value = r.from; document.getElementById('fin-to').value = r.toIncl;
  }
  loadFinance();
}
async function loadFinance(silent) {
  const r = finRange();
  if (!silent) setLoading(true);
  try {
    const [sessions, tx, payouts] = await Promise.all([
      q(sb.from('sessions').select('*').gte('scheduled_at', r.fromD.toISOString()).lt('scheduled_at', r.toD.toISOString())),
      q(sb.from('family_transactions').select('*').gte('created_at', r.fromD.toISOString()).lt('created_at', r.toD.toISOString()).order('created_at', { ascending: false })),
      q(sb.from('tutor_payouts').select('*').gte('created_at', r.fromD.toISOString()).lt('created_at', r.toD.toISOString()).order('created_at', { ascending: false })),
    ]);
    state.fin = { sessions, tx, payouts, range: r };
    renderFinance();
  } catch (e) { showToast(dbError(e), true); }
  finally { if (!silent) setLoading(false); }
}
function renderFinance() {
  const { sessions, tx, payouts } = state.fin;
  const done = sessions.filter(s => s.status === 'done');
  const cancelled = sessions.filter(s => s.status.startsWith('cancelled'));
  const rev = done.reduce((a, s) => a + Number(s.revenue_egp || 0), 0);
  const cost = done.reduce((a, s) => a + charges(s).tut, 0);
  const hoursDone = done.reduce((a, s) => a + sMins(s), 0) / 60;
  const margin = rev - cost;
  const byCur = {};
  done.forEach(s => { const c = byCur[s.student_currency] ||= { amt: 0, egp: 0, n: 0 }; c.amt += charges(s).fam; c.egp += Number(s.revenue_egp || 0); c.n++; });
  const collected = {};
  tx.forEach(t => { collected[t.currency] = (collected[t.currency] || 0) + (t.type === 'refund' ? -1 : 1) * Number(t.amount); });
  const collectedEgp = Object.entries(collected).reduce((a, [c, v]) => a + toEGP(v, c), 0);
  const paidOut = payouts.filter(p => p.paid).reduce((a, p) => a + Number(p.total_egp), 0);

  // مستحقات المعلمين في الفترة
  const perTutor = {};
  done.forEach(s => { const x = perTutor[s.tutor_id] ||= { n: 0, egp: 0, h: 0 }; x.n++; x.h += sMins(s) / 60; x.egp += charges(s).tut; });
  const tutorRows = state.tutors.map(t => ({ t, p: perTutor[t.id] || { n: 0, egp: 0, h: 0 }, b: tutBalance(t) }))
    .filter(x => x.p.n || x.b.due > 0).sort((a, b) => b.b.due - a.b.due);

  const owing = state.families.map(f => ({ f, b: famBalance(f) })).filter(x => x.b.balance < 0).sort((a, b) => a.b.balance - b.b.balance);

  document.getElementById('fin-content').innerHTML = `
    <div class="kpis">
      <div class="card kpi"><div class="l">إيراد الحصص اللي تمت</div><div class="v num">${fmt(rev)}</div><div class="s">EGP · ${done.length} حصة · ${fmt(hoursDone, 1)} ساعة</div></div>
      <div class="card kpi"><div class="l">تكلفة المعلمين</div><div class="v num">${fmt(cost)}</div><div class="s">EGP</div></div>
      <div class="card kpi"><div class="l">صافي هامش الأكاديمية</div><div class="v num ${margin >= 0 ? 'pos' : 'neg'}">${fmt(margin)}</div><div class="s">EGP · ${rev ? Math.round(margin / rev * 100) : 0}%</div></div>
      <div class="card kpi"><div class="l">تحصيلات الفترة</div><div class="v num">${fmt(collectedEgp)}</div><div class="s">EGP تقريبي · ${Object.entries(collected).map(([c, v]) => `${fmt(v)} ${c}`).join(' + ') || '—'}</div></div>
      <div class="card kpi"><div class="l">مصروف للمعلمين</div><div class="v num">${fmt(paidOut)}</div><div class="s">EGP في الفترة</div></div>
      <div class="card kpi"><div class="l">حصص ملغاة</div><div class="v num">${cancelled.length}</div><div class="s">طالب: ${cancelled.filter(s => s.status === 'cancelled_by_student').length} · معلم: ${cancelled.filter(s => s.status === 'cancelled_by_tutor').length}</div></div>
    </div>

    ${Object.keys(byCur).length ? `<div class="section-title"><h2>الإيراد حسب العملة</h2></div>
    <div class="card scrollx"><table><thead><tr><th>العملة</th><th>حصص</th><th>بالعملة الأصلية</th><th>بالجنيه (سعر يوم الحصة)</th></tr></thead><tbody>
      ${Object.entries(byCur).map(([c, v]) => `<tr><td>${c}</td><td class="num">${v.n}</td><td class="num">${fmt(v.amt, 2)} ${c}</td><td class="num">${fmt(v.egp)} EGP</td></tr>`).join('')}
    </tbody></table></div>` : ''}

    <div class="section-title"><h2>مستحقات المعلمين</h2></div>
    <div class="card scrollx"><table><thead><tr><th>المعلم</th><th>الفترة</th><th>مستحق عن الفترة</th><th>إجمالي غير مصروف</th><th></th></tr></thead><tbody>
      ${tutorRows.map(x => `<tr><td>${esc(x.t.name)}</td><td class="num">${x.p.n} حصة<div class="sub small">${fmt(x.p.h || 0, 1)} ساعة</div></td><td class="num">${fmt(x.p.egp)} EGP</td>
        <td class="num ${x.b.due > 0 ? 'neg' : ''}">${fmt(x.b.due)} EGP</td>
        <td>${x.b.due > 0 ? `<button class="btn btn-brand sm" onclick="openPayoutForm(${jsq(x.t.id)})">صرف</button>` : '<span class="pill ok">مصروف</span>'}</td></tr>`).join('')
        || '<tr><td colspan="5" class="empty">لا توجد مستحقات</td></tr>'}
    </tbody></table></div>

    <div class="section-title"><h2>أسر عليها مستحقات</h2></div>
    <div class="card scrollx"><table><thead><tr><th>الأسرة</th><th>المستحق</th><th></th></tr></thead><tbody>
      ${owing.map(x => `<tr><td>${esc(x.f.name)}</td><td class="num neg">${money(-x.b.balance, x.f.currency)}</td>
        <td class="row-gap"><button class="btn btn-brand sm" onclick="openPaymentForm(${jsq(x.f.id)})">+ دفعة</button>
        <button class="btn btn-wa sm" onclick="openPaymentReminder(${jsq(x.f.id)})">📲 مطالبة</button>
        <button class="btn btn-ghost sm" onclick="openFamilyStatement(${jsq(x.f.id)})">كشف</button></td></tr>`).join('')
        || '<tr><td colspan="3" class="empty">كل الأسر رصيدها سليم 👌</td></tr>'}
    </tbody></table></div>

    <div class="section-title"><h2>الدفعات المستلمة في الفترة</h2></div>
    <div class="card scrollx"><table><thead><tr><th>التاريخ</th><th>الأسرة</th><th>المبلغ</th><th>ملاحظة</th></tr></thead><tbody>
      ${tx.map(t => `<tr><td class="num">${fmtShortDate(t.created_at)}</td><td>${esc(byId(state.families, t.family_id)?.name || '')}</td>
        <td class="num ${t.type === 'refund' ? 'neg' : 'pos'}">${t.type === 'refund' ? '−' : ''}${money(t.amount, t.currency)}</td><td class="sub">${esc(t.note || '')}</td></tr>`).join('')
        || '<tr><td colspan="4" class="empty">لا توجد دفعات في الفترة</td></tr>'}
    </tbody></table></div>

    <div class="section-title"><h2>أسعار الصرف</h2>${isAdmin ? `<button class="btn btn-ghost sm" onclick="openFxForm()">تعديل</button>` : ''}</div>
    <div class="card item"><div class="meta">
      ${['SAR', 'AED'].map(c => `<span dir="ltr">1 ${c} = <b>${fmt(state.fx[c], 4)}</b> EGP</span>`).join('')}
      <span class="small">آخر تحديث: ${state.fxRows?.[0] ? fmtShortDate(state.fxRows.reduce((a, r) => r.updated_at > a ? r.updated_at : a, '')) : ''}</span>
    </div><p class="sub small" style="margin:8px 0 0">سعر الصرف بيتثبت على كل حصة لحظة تسجيلها "تمت"، فتغيير السعر هنا مش بيأثر على الحصص القديمة.</p></div>`;
}
function openFxForm() {
  const fields = ['SAR', 'AED'].map(c => ({ name: 'fx_' + c, label: `1 ${c} = ؟ جنيه مصري`, type: 'number', required: true, value: state.fx[c], step: '0.0001' }));
  openModal('تعديل أسعار الصرف', formHtml([fields], 'حفظ'));
  window._formSubmit = () => runSubmit(async () => {
    for (const c of ['SAR', 'AED']) {
      await q(sb.from('fx_rates').update({ rate_to_egp: fnum('fx_' + c), updated_at: new Date().toISOString() }).eq('currency', c));
    }
    closeModal(); showToast('تم تحديث الأسعار ✓'); await refreshAll();
  });
}

/* ============================================================
   تنبيهات الحصص (والصفحة مفتوحة)
   ============================================================ */
let alertsOn = false, alertTimer = null;
const alerted = new Set();
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
    });
  } catch (e) {}
}
async function toggleInPageAlerts() {
  alertsOn = !alertsOn;
  try { localStorage.setItem('ostaz_alerts', alertsOn ? '1' : '0'); } catch (e) {}
  if (alertsOn) { beep(); startAlerts(); showToast('صوت التنبيه شغال طول ما اللوحة مفتوحة'); }
  else { clearInterval(alertTimer); showToast('تم إيقاف صوت التنبيه'); }
  openAlertsPanel();
}

/* ----- إشعارات حقيقية (Web Push) — بتوصل والتطبيق مقفول ----- */
const VAPID_PUBLIC = 'BNg8dUDp2rzXqgQHiFpGdVOpnISXlN-0HO36wH9C9_ENwGFm0zi7KApfg_D4KmdhGJDVc0L4TQrzzdCiciFJgzs';
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
function b64uToUint8(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  const bin = atob(s); return Uint8Array.from(bin, c => c.charCodeAt(0));
}
let swReg = null;
async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try { swReg = await navigator.serviceWorker.register('sw.js'); return swReg; } catch (e) { console.warn('SW register failed', e); return null; }
}
async function currentPushSub() {
  if (!pushSupported()) return null;
  const reg = swReg || await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}
async function refreshAlertIcon() {
  const sub = await currentPushSub().catch(() => null);
  const on = !!sub && Notification.permission === 'granted';
  document.getElementById('btn-alerts').textContent = on ? '🔔' : '🔕';
  return on;
}
async function enablePush() {
  const btn = document.getElementById('push-enable'); if (btn) btn.disabled = true;
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { showToast('لازم تسمح بالإشعارات عشان توصلك التنبيهات', true); return openAlertsPanel(); }
    const reg = swReg || await registerSW();
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToUint8(VAPID_PUBLIC) });
    const j = sub.toJSON();
    await q(sb.from('push_subscriptions').upsert({ user_id: currentUser.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200) }, { onConflict: 'endpoint' }));
    showToast('تم تفعيل الإشعارات على الجهاز ده ✓');
    await sendTestPush(true);
  } catch (e) { showToast('تعذر التفعيل: ' + (e.message || e), true); }
  finally { await refreshAlertIcon(); openAlertsPanel(); }
}
async function disablePush() {
  try {
    const sub = await currentPushSub();
    if (sub) { await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
    showToast('تم إيقاف الإشعارات على الجهاز ده');
  } catch (e) { showToast(dbError(e), true); }
  await refreshAlertIcon(); openAlertsPanel();
}
async function sendTestPush(quiet) {
  try {
    const { data, error } = await sb.functions.invoke('session-alerts', { body: { action: 'test' } });
    if (error) throw error;
    if (!quiet) showToast(data.sent ? `اتبعت إشعار تجريبي لـ ${data.sent} جهاز ✓ اقفل التطبيق واستناه` : 'مفيش أجهزة مفعّل عليها الإشعارات لحسابك', !data.sent);
    return data;
  } catch (e) { if (!quiet) showToast('فشل الإرسال التجريبي: ' + (e.message || e), true); }
}
async function delayedTestPush() {
  try {
    await q(sb.from('push_test_requests').insert({}));
    closeModal();
    showToast('اقفل الموبايل دلوقتي 🔒 — الإشعار هيوصل خلال دقيقة لدقيقتين');
  } catch (e) { showToast(dbError(e), true); }
}
async function openAlertsPanel() {
  const on = await refreshAlertIcon();
  let body = '';
  if (isIOS && !isStandalone()) {
    body = `<p><b>على الآيفون، الإشعارات بتشتغل بس لو اللوحة متثبتة كتطبيق على الشاشة الرئيسية:</b></p>
      <ol class="steps">
        <li>افتح الرابط ده في <b>Safari</b> (مش Brave ولا Chrome).</li>
        <li>دوس زرار المشاركة <b>⬆︎</b> تحت.</li>
        <li>اختار <b>"إضافة إلى الشاشة الرئيسية" / Add to Home Screen</b> ← إضافة.</li>
        <li>افتح اللوحة من الأيقونة الجديدة وسجّل دخول، وبعدها ادخل هنا ودوس <b>تفعيل الإشعارات</b>.</li>
      </ol>
      <p class="sub small">محتاج iOS 16.4 أو أحدث.</p>
      <div class="modal-foot"><button class="btn btn-ghost" onclick="copyText(location.origin + location.pathname, 'تم نسخ الرابط ✓ الصقه في Safari')">نسخ رابط اللوحة</button></div>`;
  } else if (!pushSupported()) {
    body = `<p>المتصفح ده مش بيدعم الإشعارات في الخلفية. جرّب Chrome على أندرويد أو الكمبيوتر، أو Safari على الآيفون بعد تثبيت اللوحة على الشاشة الرئيسية.</p>`;
  } else if (Notification.permission === 'denied') {
    body = `<p class="neg"><b>الإشعارات مقفولة للوحة دي من إعدادات الجهاز/المتصفح.</b></p>
      <p>${isIOS ? 'افتح الإعدادات ← الإشعارات ← "أستاذ أونلاين" ← فعّل السماح بالإشعارات والأصوات.' : 'دوس على القفل 🔒 جنب الرابط ← الأذونات ← الإشعارات ← سماح، وبعدين حدّث الصفحة.'}</p>`;
  } else if (on) {
    body = `<p class="pos"><b>✓ الإشعارات شغالة على الجهاز ده.</b></p>
      <p class="sub">هيوصلك تنبيه قبل كل حصة بـ 15 دقيقة، وتاني عند موعدها، حتى لو التطبيق مقفول والموبايل مقفول. التنبيه بيوصل لكل المشرفين اللي مفعّلينه.</p>
      <div class="modal-foot" style="flex-wrap:wrap">
        <button class="btn btn-brand" onclick="delayedTestPush()">🔒 تجربة والتطبيق مقفول (بعد دقيقة)</button>
        <button class="btn btn-ghost" onclick="sendTestPush()">إشعار تجريبي الآن</button>
        <button class="btn btn-ghost" onclick="disablePush()">إيقاف على الجهاز ده</button>
      </div>
      ${isIOS ? `<details class="mt"><summary><b>الإشعار مش بيظهر؟</b></summary>
        <ol class="steps small">
          <li>الإعدادات ← الإشعارات ← <b>أستاذ أونلاين</b>: فعّل السماح، وشاشة القفل، والشعارات (Banners)، والأصوات.</li>
          <li>اتأكد إن وضع التركيز (Focus / عدم الإزعاج) مقفول أو إن "أستاذ أونلاين" مسموح له.</li>
          <li>لازم تفتح اللوحة دايماً من <b>الأيقونة على الشاشة الرئيسية</b>، مش من Safari.</li>
          <li>لو لسه مش شغال: دوس "إيقاف على الجهاز ده" وبعدين فعّل تاني.</li>
        </ol></details>` : ''}`;
  } else {
    body = `<p>فعّل الإشعارات عشان يوصلك تنبيه <b>قبل كل حصة بـ 15 دقيقة وعند موعدها</b> — حتى والتطبيق مقفول والموبايل مقفول.</p>
      <div class="modal-foot"><button class="btn btn-brand" id="push-enable" onclick="enablePush()">🔔 تفعيل الإشعارات</button></div>`;
  }
  body += `<hr class="sep"><div class="item-head"><div><b>صوت تنبيه واللوحة مفتوحة</b><div class="sub small">صفارة قوية من جوه الصفحة وهي مفتوحة قدامك (إضافي).</div></div>
    <button class="btn ${alertsOn ? 'btn-ok' : 'btn-ghost'} sm" onclick="toggleInPageAlerts()">${alertsOn ? 'شغال' : 'تشغيل'}</button></div>`;
  openModal('إشعارات الحصص', body);
}
function startAlerts() {
  clearInterval(alertTimer);
  loadUpcomingForAlerts().then(checkAlerts).catch(() => {});
  alertTimer = setInterval(() => { checkAlerts(); }, 30000);
  if (!window._alertReload) window._alertReload = setInterval(() => { if (alertsOn) loadUpcomingForAlerts().catch(() => {}); }, 5 * 60000);
}
function checkAlerts() {
  if (!alertsOn) return;
  const now = Date.now();
  (state.alertSessions || []).forEach(s => {
    if (s.status !== 'scheduled') return;
    const t = new Date(s.scheduled_at).getTime();
    const { st, tu } = sessionView(s);
    [[15, 'بعد 15 دقيقة'], [0, 'دلوقتي']].forEach(([mins, label]) => {
      const key = s.id + ':' + mins;
      const at = t - mins * 60e3;
      if (now >= at && now < at + 5 * 60e3 && !alerted.has(key)) {
        alerted.add(key);
        const msg = `حصة ${st?.name || ''} مع ${tu?.name || ''} ${label}`;
        beep(); showToast('⏰ ' + msg);
      }
    });
  });
}

/* ============================================================
   شريط "محتاج انتباهك" أعلى الجدول
   ============================================================ */
async function loadAttention() {
  const now = new Date();
  state.unrecorded = await q(sb.from('sessions').select('*').in('status', ['scheduled', 'in_progress'])
    .gte('scheduled_at', new Date(now.getTime() - 21 * 864e5).toISOString())
    .lte('scheduled_at', now.toISOString()).order('scheduled_at'));
  state.unrecorded = state.unrecorded.filter(needsConfirm);
  const todayEnd = parseDay(todayStr()); todayEnd.setDate(todayEnd.getDate() + 1);
  const nxt = await q(sb.from('sessions').select('*').eq('status', 'scheduled')
    .gte('scheduled_at', now.toISOString()).lt('scheduled_at', todayEnd.toISOString()).order('scheduled_at').limit(1));
  state.nextSession = nxt[0] || null;
}
function renderAttention() {
  const el = document.getElementById('attention'); if (!el) return;
  const items = [];
  const ns = state.nextSession;
  if (ns) {
    const v = sessionView(ns), mins = Math.round((sStart(ns) - Date.now()) / 60e3);
    items.push(`<button class="att att-next" onclick="setDayMode('day'); setDay(todayStr())">⏰ الجاية: <b>${esc(v.st?.name || '')}</b> ${esc(ns.subject || '')} — ${timeStr(new Date(ns.scheduled_at))} <span class="sub">(${mins < 60 ? `بعد ${mins} د` : `بعد ${durLabel(Math.round(mins / 5) * 5)}`})</span></button>`);
  }
  const un = state.unrecorded || [];
  if (un.length) items.push(`<button class="att att-warn" onclick="openUnrecorded()">⏳ <b>${un.length}</b> حصة عدّت ولسه ماتسجلتش</button>`);
  const relay = state.relay.filter(r => r.status !== 'done').length;
  if (relay) items.push(`<button class="att" onclick="switchTab('relay')">🔁 <b>${relay}</b> مهمة ترحيل مفتوحة</button>`);
  const owing = state.families.filter(f => famBalance(f).balance < 0).length;
  if (owing) items.push(`<button class="att" onclick="switchTab('fin')">💸 <b>${owing}</b> أسرة عليها مستحقات</button>`);
  const noRate = state.tutors.filter(t => t.default_rate_egp == null).length;
  if (noRate) items.push(`<button class="att" onclick="switchTab('tutors')">🧑‍🏫 <b>${noRate}</b> معلم بدون أجر ساعة</button>`);
  const noPrice = state.students.filter(s => s.default_price == null).length;
  if (noPrice) items.push(`<button class="att" onclick="switchTab('families')">🏷️ <b>${noPrice}</b> طالب بدون سعر ساعة</button>`);
  el.innerHTML = items.join('');
  el.classList.toggle('hidden', !items.length);
}
function openUnrecorded() {
  const un = state.unrecorded || [];
  openModal(`حصص محتاجة تسجيل (${un.length})`, `
    <p class="sub">دي حصص معادها عدّى ولسه متسجلتش "تمت" أو "ملغاة". الحصة مش بتتحسب على الأسرة ولا للمعلم غير لما تتسجل.</p>
    <div class="list">${un.map(s => { const v = sessionView(s); return `<div class="card item">
      <div class="item-head"><div><b>${esc(v.st?.name || '')}</b> <span class="sub small">${esc(v.fam?.name || '')}</span>
        <div class="small">${fmtShortDate(s.scheduled_at)} · ${timeStr(new Date(s.scheduled_at))} · ${durLabel(sMins(s))} · ${esc(s.subject || '')} · ${esc(v.tu?.name || '')}</div></div></div>
      <div class="actions"><button class="btn btn-ok sm" onclick="openDone(${jsq(s.id)})">✓ تمت…</button>
        <button class="btn btn-ghost sm" onclick="openCancel(${jsq(s.id)})">اتلغت…</button></div></div>`; }).join('') || '<div class="empty">مفيش 👌</div>'}</div>`);
}

/* ============================================================
   رسائل جاهزة (نسخ + فتح الجروب) — بدون كشف أرقام أي طرف للتاني
   ============================================================ */
function msgActionsHtml(text, { group, phone, country, editFamily, editTutor } = {}) {
  const key = 'm' + Math.random().toString(36).slice(2, 8);
  (window._msgs ||= {})[key] = text;
  const num = phone ? waNumber(phone, country || 'مصر') : '';
  return `<div class="modal-foot" style="flex-wrap:wrap;position:static;padding:8px 0 0">
    ${group ? `<button class="btn btn-wa sm" onclick="copyAndOpen(window._msgs[${jsq(key)}], ${jsq(group)})">نسخ وفتح الجروب</button>` : ''}
    ${num ? `<a class="btn ${group ? 'btn-ghost' : 'btn-wa'} sm" href="https://wa.me/${num}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">رقم خاص</a>` : ''}
    <button class="btn btn-ghost sm" onclick="copyText(window._msgs[${jsq(key)}],'تم نسخ الرسالة ✓')">نسخ النص</button>
    ${!group && !num ? `<span class="sub small">مفيش جروب ولا رقم — <a href="javascript:void(0)" onclick="${editFamily ? `openFamilyForm(${jsq(editFamily)})` : `openTutorForm(${jsq(editTutor)})`}">أضفهم</a></span>` : ''}
  </div>`;
}
function msgBlock(title, text, opts) {
  return `<details class="card item msg-item"><summary><b>${esc(title)}</b></summary>
    <div class="msg-preview mt">${esc(text)}</div>${msgActionsHtml(text, opts)}</details>`;
}
const greetTutor = n => `أهلاً ${/^(أ\.|أ\/|أستاذ|م\.|د\.)/.test(n || '') ? n : 'أ/ ' + (n || '')} 👋`;
const SIGN_T = 'فريق الإشراف – أستاذ أونلاين';
const SIGN_F = 'فريق الإشراف – أكاديمية أستاذ أونلاين';

// جدول اليوم لكل معلمة
function tutorDayMessage(tu, list, dayIso) {
  const lines = list.map(s => { const v = sessionView(s);
    return `• ${fmtTime(s.scheduled_at, CAIRO_TZ)} – ${fmtTime(new Date(sStart(s) + (s.duration_minutes || 60) * 60e3).toISOString(), CAIRO_TZ)}: ${v.st?.name || ''} (${v.st?.grade_level || ''})${s.subject ? ' — ' + s.subject : ''}${s.kind === 'revision' ? ' [مراجعة]' : ''}${s.meeting_link ? `\n   🔗 ${linkHref(s.meeting_link)}` : ''}`; }).join('\n');
  return `${greetTutor(tu?.name)}
جدول حصصك ${relDayLabel(dayIso, CAIRO_TZ)} (${fmtDate(dayIso, CAIRO_TZ)}) بتوقيت القاهرة:
${lines}

لو فيه أي تعارض أو الطالب طلب وقت زيادة بلّغينا هنا.
${SIGN_T}`;
}
function openTutorSchedules() {
  const list = state.daySessions.filter(s => s.status === 'scheduled' || s.status === 'in_progress');
  const byTutor = {};
  list.forEach(s => (byTutor[s.tutor_id] ||= []).push(s));
  const dayIso = parseDay(state.day).toISOString();
  const blocks = Object.entries(byTutor).map(([tid, ss]) => {
    const tu = byId(state.tutors, tid);
    return msgBlock(`${tu?.name || ''} — ${ss.length} حصة`, tutorDayMessage(tu, ss, ss[0].scheduled_at || dayIso),
      { group: tu?.whatsapp_group, phone: tu?.phone, editTutor: tid });
  });
  openModal(`جداول المعلمين — ${fmtDate(dayIso)}`, blocks.length
    ? `<p class="sub small">رسالة واحدة لكل معلمة فيها كل حصصها في اليوم ده. افتح أي واحدة وابعتها لجروبها.</p><div class="list">${blocks.join('')}</div>`
    : '<div class="empty">مفيش حصص مجدولة في اليوم ده.</div>');
}

// جدول الأسبوع لكل أسرة (بتوقيت بلدها)
function familyWeekMessage(fam, list) {
  const c = COUNTRIES[fam.country] || COUNTRIES['مصر'];
  const byDay = {};
  list.forEach(s => { const k = new Intl.DateTimeFormat('en-CA', { timeZone: c.tz }).format(new Date(s.scheduled_at)); (byDay[k] ||= []).push(s); });
  const body = Object.keys(byDay).sort().map(k => {
    const ss = byDay[k];
    return `*${fmtDate(ss[0].scheduled_at, c.tz)}*\n` + ss.map(s => { const v = sessionView(s);
      return `• ${fmtTime(s.scheduled_at, c.tz)} — ${v.st?.name || ''}${s.subject ? ': ' + s.subject : ''} (${durLabel(s.duration_minutes || 60)})${s.kind === 'revision' ? ' — مراجعة' : ''}`; }).join('\n');
  }).join('\n\n');
  return `السلام عليكم ورحمة الله 🌷
جدول حصص الأسبوع بتوقيت ${c.tzName}:

${body}

لأي تعديل في المواعيد تواصلوا معنا هنا.
${SIGN_F}`;
}
function openFamilySchedules() {
  const ws = (state.weekSessions || []).filter(s => !s.status.startsWith('cancelled') && sStart(s) >= Date.now() - 3600e3);
  const byFam = {};
  ws.forEach(s => { const v = sessionView(s); if (v.fam) (byFam[v.fam.id] ||= []).push(s); });
  const blocks = Object.entries(byFam).map(([fid, ss]) => {
    const fam = byId(state.families, fid);
    return msgBlock(`${fam.name} — ${ss.length} حصة`, familyWeekMessage(fam, ss),
      { group: fam.whatsapp_group, phone: fam.whatsapp, country: fam.country, editFamily: fid });
  });
  openModal('جداول الأسر — الحصص الجاية في الأسبوع ده', blocks.length
    ? `<p class="sub small">رسالة لكل أسرة فيها حصصها الجاية الأسبوع ده، بتوقيت بلدها. (من غير أسماء أو أرقام المعلمين.)</p><div class="list">${blocks.join('')}</div>`
    : '<div class="empty">مفيش حصص جاية في الأسبوع ده.</div>');
}

// مطالبة بالسداد
async function openPaymentReminder(familyId) {
  const f = byId(state.families, familyId);
  const b = famBalance(f);
  let last = null;
  try { const tx = await q(sb.from('family_transactions').select('*').eq('family_id', familyId).eq('type', 'payment').order('created_at', { ascending: false }).limit(1)); last = tx[0]; } catch (e) {}
  const text = `السلام عليكم ورحمة الله 🌷
نحيطكم علماً إن رصيد حصص الأسرة حالياً عليه مستحقات بقيمة *${fmt(-b.balance, 2)} ${f.currency}*.
عدد الحصص اللي تمت حتى الآن: ${b.count}${last ? `\nآخر دفعة: ${fmt(last.amount, 2)} ${last.currency} بتاريخ ${fmtShortDate(last.created_at)}` : ''}

برجاء التكرم بالسداد لضمان استمرار الحصص بدون انقطاع، ولو حابين كشف حساب تفصيلي نبعتهولكم فوراً.
شكراً لتعاونكم 🙏
${SIGN_F}`;
  openModal(`مطالبة — ${f.name}`, `<div class="msg-preview">${esc(text)}</div>${msgActionsHtml(text, { group: f.whatsapp_group, phone: f.whatsapp, country: f.country, editFamily: f.id })}`);
}

// كشف مستحقات للمعلمة (من بعد آخر صرف)
async function openTutorStatementMessage(tutorId) {
  const t = byId(state.tutors, tutorId);
  try {
    const po = await q(sb.from('tutor_payouts').select('*').eq('tutor_id', tutorId).eq('paid', true).order('paid_at', { ascending: false }).limit(1));
    const since = po[0]?.paid_at || po[0]?.created_at || null;
    let qq = sb.from('sessions').select('*').eq('tutor_id', tutorId).eq('status', 'done').order('scheduled_at');
    if (since) qq = qq.gt('scheduled_at', since);
    const ss = await q(qq);
    const b = tutBalance(t);
    const lines = ss.map(s => { const v = sessionView(s); return `• ${fmtShortDate(s.scheduled_at)} — ${v.st?.name || ''}${s.subject ? ' (' + s.subject + ')' : ''} — ${durLabel(sMins(s))} = ${fmt(charges(s).tut, 2)} ج`; }).join('\n');
    const totalMins = ss.reduce((a, s) => a + sMins(s), 0);
    const text = `${greetTutor(t.name)}
كشف حصصك${since ? ` من بعد آخر تحويل (${fmtShortDate(since)})` : ''}:
${lines || '— لا توجد حصص مسجلة —'}

إجمالي الوقت: ${durLabel(totalMins)}
*المستحق: ${fmt(b.due, 2)} جنيه*${t.default_rate_egp != null ? ` (أجر الساعة ${fmt(t.default_rate_egp)} ج)` : ''}

لو فيه أي ملاحظة على الكشف بلّغينا قبل التحويل.
${SIGN_T}`;
    openModal(`كشف للمعلمة — ${t.name}`, `<div class="msg-preview">${esc(text)}</div>${msgActionsHtml(text, { group: t.whatsapp_group, phone: t.phone, editTutor: t.id })}`);
  } catch (e) { showToast(dbError(e), true); }
}

/* ============================================================
   تأجيل سريع + رسائل للطرفين
   ============================================================ */
function openPostpone(id) {
  const s = findSession(id); if (!s) return;
  const d = new Date(s.scheduled_at); d.setDate(d.getDate() + 1);
  openModal('تأجيل / تغيير موعد الحصة', formHtml([
    [{ name: 'date', label: 'التاريخ الجديد', type: 'date', required: true, value: dateStr(d) },
     { name: 'time', label: 'الوقت الجديد (بتوقيتك)', type: 'time', required: true, value: timeStr(d) }],
    { name: 'duration_minutes', label: 'المدة (دقيقة)', type: 'number', required: true, value: s.duration_minutes || 60, step: 5, min: 5 },
    { name: 'reason', label: 'السبب (اختياري — بيتكتب في ملاحظات الحصة)', placeholder: 'مثال: طلب ولي الأمر' },
  ], 'تأجيل الحصة'));
  window._formSubmit = () => runSubmit(async () => {
    const start = new Date(`${fv('date')}T${fv('time')}`);
    if (isNaN(start)) return formError('التاريخ أو الوقت غير صحيح');
    const dur = fnum('duration_minutes');
    const row = { scheduled_at: start.toISOString(), duration_minutes: dur, status: 'scheduled', actual_minutes: null };
    const conflicts = await findConflicts([{ ...s, ...row }], s.id);
    if (conflicts.length && !confirm(`⚠️ الموعد الجديد فيه تعارض:\n${conflicts.slice(0, 4).map(({ o }) => { const v = sessionView(o); return `• ${timeStr(new Date(o.scheduled_at))}: ${v.st?.name || ''} مع ${v.tu?.name || ''}`; }).join('\n')}\n\nتكمل برضه؟`)) return;
    const oldIso = s.scheduled_at;
    const reason = fv('reason');
    if (reason) row.notes = [s.notes, `تأجيل من ${fmtShortDate(oldIso)} ${timeStr(new Date(oldIso))}: ${reason}`].filter(Boolean).join(' | ');
    await q(sb.from('sessions').update(row).eq('id', s.id));
    await refreshAll();
    const ns = { ...s, ...row };
    const { st, fam, tu } = sessionView(ns);
    const c = COUNTRIES[fam?.country] || COUNTRIES['مصر'];
    const parentText = `السلام عليكم ورحمة الله 🌷
تم تغيير موعد حصة ${st?.name || ''}${s.subject ? ` (${s.subject})` : ''}:
❌ الموعد القديم: ${fmtDate(oldIso, c.tz)} الساعة ${fmtTime(oldIso, c.tz)}
✅ الموعد الجديد: ${fmtDate(ns.scheduled_at, c.tz)} الساعة ${fmtTime(ns.scheduled_at, c.tz)} بتوقيت ${c.tzName}
هنبعت الرابط والتذكير قبل الحصة إن شاء الله.
${SIGN_F}`;
    const tutorText = `${greetTutor(tu?.name)}
تم تغيير موعد حصة ${st?.name || ''}${s.subject ? ` (${s.subject})` : ''}:
❌ القديم: ${fmtDate(oldIso, CAIRO_TZ)} الساعة ${fmtTime(oldIso, CAIRO_TZ)}
✅ الجديد: ${fmtDate(ns.scheduled_at, CAIRO_TZ)} الساعة ${fmtTime(ns.scheduled_at, CAIRO_TZ)} بتوقيت القاهرة (${durLabel(dur)})
برجاء التأكيد 🙏
${SIGN_T}`;
    openModal('تم التأجيل ✓ — بلّغ الطرفين', `<div class="list">
      ${msgBlock('رسالة ولي الأمر', parentText, { group: fam?.whatsapp_group, phone: fam?.whatsapp, country: fam?.country, editFamily: fam?.id })}
      ${msgBlock('رسالة المعلم', tutorText, { group: tu?.whatsapp_group, phone: tu?.phone, editTutor: tu?.id })}</div>`);
    document.querySelectorAll('.msg-item').forEach(d => d.open = true);
  });
}

/* ============================================================
   تصدير Excel (CSV)
   ============================================================ */
function downloadCSV(filename, header, rows) {
  const escCsv = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = '﻿' + [header, ...rows].map(r => r.map(escCsv).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function exportSessionsCSV() {
  if (!state.fin) return;
  const r = state.fin.range;
  const rows = [...state.fin.sessions].sort((a, b) => sStart(a) - sStart(b)).map(s => {
    const v = sessionView(s), c = charges(s);
    const done = s.status === 'done';
    return [dateStr(new Date(s.scheduled_at)), timeStr(new Date(s.scheduled_at)), v.st?.name, v.fam?.name, v.tu?.name, s.subject,
      s.kind === 'revision' ? 'مراجعة' : 'عادية', (STATUS[s.status] || {}).label, s.duration_minutes, s.actual_minutes ?? '',
      s.student_price, s.student_currency, done ? c.fam.toFixed(2) : '', s.tutor_cost_egp, done ? c.tut.toFixed(2) : '',
      done ? Number(s.fx_rate_to_egp).toFixed(4) : '', done ? Number(s.revenue_egp).toFixed(2) : '', done ? Number(s.margin_egp).toFixed(2) : '', s.notes];
  });
  downloadCSV(`حصص_${r.from}_${r.toIncl}.csv`, ['التاريخ', 'الوقت', 'الطالب', 'الأسرة', 'المعلم', 'المادة', 'النوع', 'الحالة', 'المدة المخططة (د)', 'المدة الفعلية (د)',
    'سعر الساعة للأسرة', 'العملة', 'إجمالي الأسرة', 'أجر الساعة للمعلم (EGP)', 'إجمالي المعلم (EGP)', 'سعر الصرف', 'الإيراد (EGP)', 'الهامش (EGP)', 'ملاحظات'], rows);
}
function exportPaymentsCSV() {
  if (!state.fin) return;
  const r = state.fin.range;
  const rows = state.fin.tx.map(t => [dateStr(new Date(t.created_at)), byId(state.families, t.family_id)?.name, t.type === 'refund' ? 'استرداد' : 'دفعة', t.amount, t.currency, t.note]);
  const po = state.fin.payouts.map(p => [dateStr(new Date(p.paid_at || p.created_at)), byId(state.tutors, p.tutor_id)?.name, 'صرف لمعلم', p.total_egp, 'EGP', [p.method, p.note].filter(Boolean).join(' — ')]);
  downloadCSV(`مدفوعات_${r.from}_${r.toIncl}.csv`, ['التاريخ', 'الأسرة / المعلم', 'النوع', 'المبلغ', 'العملة', 'ملاحظة'], [...rows, ...po]);
}

/* ============================================================
   المصادقة وموافقة الأدمن
   ============================================================ */
function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  document.getElementById('auth-fields-name').classList.toggle('hidden', !isSignUpMode);
  document.getElementById('auth-submit').textContent = isSignUpMode ? 'إنشاء حساب' : 'دخول';
  document.getElementById('auth-toggle-text').textContent = isSignUpMode ? 'عندك حساب بالفعل؟' : 'مفيش حساب؟';
  document.getElementById('auth-toggle-link').textContent = isSignUpMode ? 'سجّل دخول' : 'سجّل مشرف جديد';
  hideAuthError();
}
function showAuthError(msg) { const el = document.getElementById('auth-error'); el.textContent = msg; el.classList.remove('hidden'); }
function hideAuthError() { document.getElementById('auth-error').classList.add('hidden'); }
function translateAuthError(msg) {
  if (/already registered/i.test(msg)) return 'هذا البريد مسجّل بالفعل، جرّب تسجيل الدخول';
  if (/invalid login/i.test(msg)) return 'البريد أو كلمة المرور غير صحيحة';
  if (/email not confirmed/i.test(msg)) return 'لازم تأكد بريدك الإلكتروني الأول من الرسالة اللي وصلتك';
  if (/password/i.test(msg) && /least/i.test(msg)) return 'كلمة المرور قصيرة جداً (6 أحرف على الأقل)';
  return msg;
}
async function submitAuth() {
  hideAuthError();
  const email = document.getElementById('auth-email').value.trim();
  const pass = document.getElementById('auth-pass').value;
  const name = document.getElementById('auth-name').value.trim();
  if (!email || !pass) return showAuthError('من فضلك أدخل البريد وكلمة المرور');
  if (isSignUpMode && !name) return showAuthError('من فضلك أدخل اسمك');
  const btn = document.getElementById('auth-submit');
  btn.disabled = true;
  try {
    if (isSignUpMode) {
      const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { name }, emailRedirectTo: window.location.origin + window.location.pathname } });
      if (error) throw error;
      if (!data.session) { showAuthError('تم إنشاء الحساب ✓ افتح بريدك وأكّد الإيميل، وبعدها سجّل دخول.'); return; }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
    }
    await handlePostAuth();
  } catch (err) { showAuthError(translateAuthError(err.message)); }
  finally { btn.disabled = false; }
}
async function signInWithGoogle() {
  hideAuthError();
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } });
  if (error) showAuthError(translateAuthError(error.message));
}
async function signOut() {
  await sb.auth.signOut();
  currentUser = null; currentSupervisor = null; _postAuthHandled = false;
  if (realtimeChannel) { sb.removeChannel(realtimeChannel); realtimeChannel = null; }
  showView('auth');
}
function showView(name) {
  ['auth', 'pending', 'app'].forEach(v => document.getElementById('view-' + v).classList.toggle('hidden', v !== name));
}
async function handlePostAuth(attempt = 0) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { showView('auth'); return; }
  currentUser = user;
  const { data: supervisor, error } = await sb.from('supervisors').select('*').eq('id', user.id).maybeSingle();
  if (error || !supervisor) {
    if (attempt < 5) { await new Promise(r => setTimeout(r, 800)); return handlePostAuth(attempt + 1); }
    showAuthError('تعذر تحميل بيانات حسابك، حدّث الصفحة.'); showView('auth'); return;
  }
  currentSupervisor = supervisor;
  if (!supervisor.active) { showView('pending'); return; }
  enterApp();
}
async function enterApp() {
  isAdmin = currentSupervisor.role === 'admin';
  document.getElementById('current-user-name').textContent = currentSupervisor.name + (isAdmin ? ' · أدمن' : ' · مشرف');
  document.getElementById('tab-admin').classList.toggle('hidden', !isAdmin);
  // تنظيف أي داتا تجريبية قديمة من النسخة السابقة
  try { localStorage.removeItem('ostaz_sessions'); } catch (e) {}
  // فتح يوم معيّن لو جاي من إشعار (?day=YYYY-MM-DD)
  const qDay = new URLSearchParams(location.search).get('day');
  if (qDay && /^\d{4}-\d{2}-\d{2}$/.test(qDay)) state.day = qDay;
  // مسح بقايا رابط جوجل (?code=… / #…) من شريط العنوان
  if (location.search || location.hash) history.replaceState(null, '', location.pathname);
  showView('app');
  await refreshAll();
  subscribeRealtime();
  if (!window._tick) window._tick = setInterval(() => {
    if (document.hidden) return;
    loadAttention().then(renderAttention).catch(() => {});
    if (currentTab === 'daily' && state.dayMode === 'day' && document.getElementById('modal').classList.contains('hidden')) renderDaily();
  }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && currentUser) scheduleRefresh(); });
  let savedAlerts = false; try { savedAlerts = localStorage.getItem('ostaz_alerts') === '1'; } catch (e) {}
  if (savedAlerts && !alertsOn) { alertsOn = true; startAlerts(); }
  await registerSW();
  refreshAlertIcon().then(on => {
    let asked = false; try { asked = localStorage.getItem('ostaz_push_asked') === '1'; } catch (e) {}
    if (!on && !asked) { try { localStorage.setItem('ostaz_push_asked', '1'); } catch (e) {} openAlertsPanel(); }
  }).catch(() => {});
}
async function checkPendingStatus() {
  const { data: supervisor } = await sb.from('supervisors').select('*').eq('id', currentUser.id).maybeSingle();
  if (supervisor?.active) { currentSupervisor = supervisor; enterApp(); showToast('تم تفعيل حسابك ✓'); }
  else showToast('لسه في انتظار الموافقة');
}

/* ----- إدارة المشرفين (أدمن) ----- */
async function loadSupervisorsList() {
  if (!isAdmin) return;
  try {
    const data = await q(sb.from('supervisors').select('*').order('active', { ascending: true }));
    document.getElementById('admin-list').innerHTML = data.map(s => `<div class="card item">
      <div class="item-head">
        <div><div class="item-title">${esc(s.name)}${s.id === currentUser.id ? ' <span class="sub small">(أنت)</span>' : ''}</div>
          <div class="sub small">${s.role === 'admin' ? 'أدمن' : 'مشرف'}</div></div>
        <span class="badge ${s.active ? 'b-done' : 'b-pending'}">${s.active ? 'نشط' : 'بانتظار الموافقة'}</span>
      </div>
      ${s.id !== currentUser.id ? `<div class="actions">
        ${!s.active ? `<button class="btn btn-brand sm" onclick="updateSupervisor(${jsq(s.id)},{active:true})">موافقة</button>`
                    : `<button class="btn btn-ghost sm" onclick="updateSupervisor(${jsq(s.id)},{active:false})">تعطيل</button>`}
        ${s.role === 'admin' ? `<button class="btn btn-ghost sm" onclick="updateSupervisor(${jsq(s.id)},{role:'supervisor'})">إلغاء صلاحية الأدمن</button>`
                             : s.active ? `<button class="btn btn-ghost sm" onclick="if(confirm('تديله صلاحيات أدمن كاملة (حذف + إدارة مشرفين)؟')) updateSupervisor(${jsq(s.id)},{role:'admin'})">ترقية لأدمن</button>` : ''}
      </div>` : ''}
    </div>`).join('');
  } catch (e) { showToast(dbError(e), true); }
}
async function updateSupervisor(id, patch) {
  try { await q(sb.from('supervisors').update(patch).eq('id', id)); showToast('تم التحديث ✓'); loadSupervisorsList(); }
  catch (e) { showToast(dbError(e), true); }
}

/* ----- بدء التشغيل ----- */
let _postAuthHandled = false;
sb.auth.onAuthStateChange((event, session) => {
  if (session && !_postAuthHandled && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
    _postAuthHandled = true;
    setTimeout(() => handlePostAuth(), 0);
  }
});
(async function init() {
  const params = new URLSearchParams(location.search + '&' + location.hash.slice(1));
  if (params.get('error_description')) {
    showView('auth');
    showAuthError('فشل الدخول بجوجل: ' + params.get('error_description'));
    history.replaceState(null, '', location.pathname);
    return;
  }
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) { if (!_postAuthHandled) { _postAuthHandled = true; await handlePostAuth(); } }
    else showView('auth');
  } catch (err) {
    showAuthError('حصل خطأ أثناء تحميل الصفحة: ' + err.message);
    showView('auth');
  }
})();
