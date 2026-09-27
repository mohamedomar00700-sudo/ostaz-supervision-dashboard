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
  cancelled_by_academy: { label: 'ألغتها الأكاديمية', cls: 'b-cancel' },
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
   قائمة اختيار بالبحث (بديل للـ select العادي)
   ============================================================ */
const normAr = s => String(s || '').toLowerCase().replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ًٌٍَُِّْـ]/g, '').replace(/\s+/g, ' ').trim();
function tutorOptions() {
  return state.tutors.map(t => {
    const subs = [...new Set(state.subjects.filter(x => x.tutor_id === t.id).map(x => x.subject))].join('، ');
    return { v: t.id, l: t.name + (subs ? ` — ${subs}` : '') };
  });
}
function makeSearchable(sel) {
  if (sel._combo) return;
  const items = [...sel.options].filter(o => o.value).map(o => ({
    v: o.value, l: o.textContent, g: o.parentElement.tagName === 'OPTGROUP' ? o.parentElement.label : '',
  }));
  items.forEach(it => { it.n = normAr(it.l + ' ' + it.g); it.nl = normAr(it.l); });
  const wrap = document.createElement('div'); wrap.className = 'combo';
  sel.parentNode.insertBefore(wrap, sel); wrap.appendChild(sel);
  sel.classList.add('combo-native'); sel.tabIndex = -1;
  const inp = document.createElement('input');
  inp.className = 'input combo-input'; inp.type = 'text'; inp.autocomplete = 'off';
  inp.placeholder = '🔍 ' + (sel.options[0] && !sel.options[0].value ? sel.options[0].textContent : 'ابحث…');
  const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'combo-clear'; clear.textContent = '✕'; clear.tabIndex = -1;
  const list = document.createElement('div'); list.className = 'combo-list hidden';
  wrap.append(inp, clear, list);
  let active = -1, shown = [];
  const labelOf = v => { const it = items.find(i => i.v === v); return it ? (it.g ? `${it.l} · ${it.g}` : it.l) : ''; };
  const sync = () => { inp.value = labelOf(sel.value); clear.classList.toggle('hidden', !sel.value); };
  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  Object.defineProperty(sel, 'value', { get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); sync(); } });
  const render = () => {
    const qn = normAr(inp.value === labelOf(sel.value) ? '' : inp.value);
    const words = qn.split(' ').filter(Boolean);
    const score = it => { // الاسم نفسه الأول، بعدين اسم الأسرة/المجموعة
      if (!words.length) return 0;
      if (it.nl.startsWith(qn)) return 0;
      if (words.every(w => it.nl.includes(w))) return 1;
      if (words.some(w => it.nl.split(' ').some(t => t.startsWith(w)))) return 2;
      return 3;
    };
    shown = items.filter(it => words.every(w => it.n.includes(w))).map((it, i) => ({ it, sc: score(it), i }))
      .sort((a, b) => a.sc - b.sc || a.i - b.i).map(x => x.it).slice(0, 60);
    active = shown.length ? 0 : -1;
    list.innerHTML = shown.map((it, i) => `<div class="combo-item ${i === active ? 'on' : ''} ${it.v === sel.value ? 'sel' : ''}" data-i="${i}">
      <div>${esc(it.l)}</div>${it.g ? `<div class="sub small">${esc(it.g)}</div>` : ''}</div>`).join('')
      || '<div class="combo-empty sub small">مفيش نتايج</div>';
    list.classList.remove('hidden');
  };
  const pick = it => { desc.set.call(sel, it.v); sync(); list.classList.add('hidden'); sel.dispatchEvent(new Event('change', { bubbles: true })); };
  inp.addEventListener('focus', () => { inp.select(); render(); });
  inp.addEventListener('input', render);
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (!shown.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length;
      list.querySelectorAll('.combo-item').forEach((el, i) => el.classList.toggle('on', i === active));
      list.querySelector('.combo-item.on')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') { if (!list.classList.contains('hidden') && shown[active]) { e.preventDefault(); pick(shown[active]); } }
    else if (e.key === 'Escape') { e.stopPropagation(); list.classList.add('hidden'); sync(); }
  });
  list.addEventListener('mousedown', e => { const el = e.target.closest('.combo-item'); if (el) { e.preventDefault(); pick(shown[Number(el.dataset.i)]); } });
  inp.addEventListener('blur', () => setTimeout(() => { list.classList.add('hidden'); sync(); }, 120));
  clear.addEventListener('click', () => { desc.set.call(sel, ''); sync(); sel.dispatchEvent(new Event('change', { bubbles: true })); inp.focus(); });
  sel.addEventListener('invalid', () => inp.focus());
  sel._combo = true; sync();
}

/* ============================================================
   النافذة المنبثقة + نماذج الإدخال
   ============================================================ */
function openModal(title, html) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = html;
  document.querySelectorAll('#modal-body select[data-search]').forEach(makeSearchable);
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
    input = `<select id="${id}" name="${f.name}" class="input"${req}${f.searchable ? ' data-search="1"' : ''}>${f.placeholder ? `<option value="">${esc(f.placeholder)}</option>` : ''}${opts}</select>`;
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
    if (currentTab === 'reports') loadReports();
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
  ['daily', 'relay', 'families', 'tutors', 'fin', 'reports', 'admin'].forEach(k =>
    document.getElementById('view-' + k).classList.toggle('hidden', k !== t));
  if (t === 'fin') loadFinance();
  if (t === 'admin') loadSupervisorsList();
  if (t === 'reports') loadReports();
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
          <div class="item-title">${esc(st?.name || 'طالب محذوف')} ${s.kind === 'revision' ? '<span class="badge b-rev">مراجعة</span>' : ''}${s.makeup_of ? ' <span class="badge b-makeup">تعويضية</span>' : ''}</div>
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
      ${cancelled ? `<div class="cancel-info mt">✖ ${cancelInfo(s)}</div>` : `<div class="money">
        <span class="pill" title="${fmt(s.student_price, 2)} ${s.student_currency} في الساعة">الأسرة: ${money(c.fam, s.student_currency)}</span>
        <span class="pill" title="${fmt(s.tutor_cost_egp)} EGP في الساعة">المعلم: ${money(c.tut, 'EGP')}</span>
        <span class="pill ${c.margin >= 0 ? 'ok' : 'bad'}">الهامش: ${fmt(c.margin)} EGP${s.status === 'done' ? '' : ' (تقديري)'}</span>
      </div>`}
      <div class="actions">
        ${open && !confirmNeeded ? `
          <button class="btn btn-wa sm" onclick="openReminder(${id},'parent')">📲 ولي الأمر</button>
          <button class="btn btn-wa sm" onclick="openReminder(${id},'tutor')">📲 المعلم</button>` : ''}
        ${open ? `<button class="btn btn-ok sm" onclick="openDone(${id})">✓ تمت…</button>` : ''}
        ${cancelled && !allLoadedSessions().some(x => x.makeup_of === s.id) && s.cancel_scope !== 'permanent' ? `<button class="btn btn-ghost sm" onclick="openSessionForm(null, {student_id:${jsq(s.student_id)}, tutor_id:${jsq(s.tutor_id)}, subject:${jsq(s.subject || '')}, makeup_of:${id}, duration:${s.duration_minutes || 60}})">📅 تعويضية</button>` : ''}
        <button class="btn btn-ghost sm" onclick="openSessionActions(${id})">⋯ المزيد</button>
      </div>
    </div>
  </div>`;
}
function linkHref(l) { return /^https?:\/\//i.test(l) ? l : 'https://' + l; }

async function setStatus(id, status, extra = {}) {
  try {
    if (status === 'scheduled') Object.assign(extra, { cancel_reason: null, cancel_note: null, cancelled_at: null, cancelled_by_user: null, cancel_scope: null, actual_minutes: null });
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
/* ----- الإلغاء: مين، ليه، ولحد إمتى ----- */
const CANCEL_PARTIES = {
  cancelled_by_student: { l: 'الطالب / الأسرة', icon: '👨‍👩‍👧', reasons: ['مرض', 'سفر', 'امتحانات / ضغط مذاكرة', 'مناسبة عائلية', 'لم يحضر', 'نسيان', 'مشكلة إنترنت / تقنية', 'ظروف مادية', 'إيقاف الاشتراك', 'أخرى'] },
  cancelled_by_tutor: { l: 'المعلم', icon: '🧑‍🏫', reasons: ['ظرف طارئ', 'مرض', 'تعارض مواعيد', 'مشكلة إنترنت / كهرباء', 'لم يحضر', 'اعتذار عن الطالب', 'ترك العمل', 'أخرى'] },
  cancelled_by_academy: { l: 'الأكاديمية', icon: '🏫', reasons: ['إجازة رسمية', 'إعادة تنظيم الجدول', 'تغيير المعلم', 'عدم السداد', 'أخرى'] },
};
const LATE_HOURS = 3;
function cancelNoticeHours(s) {
  if (!s.cancelled_at) return null;
  return (sStart(s) - new Date(s.cancelled_at).getTime()) / 3600e3;
}
function cancelInfo(s) {
  if (!s.status.startsWith('cancelled')) return '';
  const h = cancelNoticeHours(s);
  const notice = h == null ? '' : h <= 0 ? ' · اتلغت بعد معادها' : h < LATE_HOURS ? ` · قبلها بـ ${durLabel(Math.max(5, Math.round(h * 60 / 5) * 5))} (متأخر)` : h < 48 ? ` · قبلها بـ ${Math.round(h)} ساعة` : ` · قبلها بـ ${Math.round(h / 24)} يوم`;
  return `${s.cancel_reason ? esc(s.cancel_reason) : ''}${s.cancel_note ? ` — ${esc(s.cancel_note)}` : ''}${notice}${s.cancel_scope === 'permanent' ? ' · <b>إيقاف دائم</b>' : ''}`;
}
async function futureSeries(s) {
  const rows = await q(sb.from('sessions').select('*').eq('student_id', s.student_id).eq('tutor_id', s.tutor_id)
    .eq('status', 'scheduled').gt('scheduled_at', s.scheduled_at).order('scheduled_at').limit(200));
  return rows.filter(r => norm(r.subject) === norm(s.subject));
}
async function openCancel(id) {
  const s = findSession(id); if (!s) return;
  const { st, fam, tu } = sessionView(s);
  let series = [];
  try { series = await futureSeries(s); } catch (e) {}
  const late = Date.now() > sStart(s) - LATE_HOURS * 3600e3;
  const cs = { party: 'cancelled_by_student', reason: '', scope: 'once', n: Math.min(2, series.length) || 1 };
  window._cs = cs;
  const render = () => {
    const P = CANCEL_PARTIES[cs.party];
    const affected = cs.scope === 'once' ? 0 : cs.scope === 'next' ? Math.min(cs.n, series.length) : series.length;
    document.getElementById('modal-body').innerHTML = `
      <div class="sub small mb">${esc(st?.name || '')} · ${esc(s.subject || '')} · ${fmtDate(s.scheduled_at)} ${timeStr(new Date(s.scheduled_at))} · ${esc(tu?.name || '')}</div>
      ${late ? `<div class="pill bad mb" style="display:inline-block">⚠️ إلغاء متأخر — أقل من ${LATE_HOURS} ساعات قبل الحصة${Date.now() > sStart(s) ? ' (بعد معادها)' : ''}</div>` : ''}
      <div class="field"><label>مين اللي لغى؟</label><div class="seg-wrap">
        ${Object.entries(CANCEL_PARTIES).map(([k, p]) => `<button type="button" class="chip ${cs.party === k ? 'active' : ''}" onclick="_cs.party='${k}'; _cs.reason=''; _csRender()">${p.icon} ${p.l}</button>`).join('')}
      </div></div>
      <div class="field"><label>السبب</label><div class="chips" style="margin:0">
        ${P.reasons.map(r => `<button type="button" class="chip ${cs.reason === r ? 'active' : ''}" onclick="_cs.reason=${esc(JSON.stringify(r))}; _csRender()">${r}</button>`).join('')}
      </div></div>
      <div class="field"><label>تفاصيل (اختياري)</label><input id="cs-note" class="input" placeholder="مثال: عندها امتحان شهر يوم الخميس" value="${esc(cs.note || '')}" oninput="_cs.note=this.value"></div>
      <div class="field"><label>الإلغاء لحد إمتى؟</label>
        <label class="radio"><input type="radio" name="cs-scope" ${cs.scope === 'once' ? 'checked' : ''} onchange="_cs.scope='once'; _csRender()"> الحصة دي بس</label>
        ${series.length ? `
        <label class="radio"><input type="radio" name="cs-scope" ${cs.scope === 'next' ? 'checked' : ''} onchange="_cs.scope='next'; _csRender()"> الحصة دي و
          <select class="input inline" onchange="_cs.n=Number(this.value); _cs.scope='next'; _csRender()">${Array.from({ length: Math.min(series.length, 12) }, (_, i) => i + 1).map(n => `<option ${cs.n === n ? 'selected' : ''} value="${n}">${n}</option>`).join('')}</select>
          ${cs.n === 1 ? 'حصة' : 'حصص'} جاية بعدها</label>
        <label class="radio"><input type="radio" name="cs-scope" ${cs.scope === 'permanent' ? 'checked' : ''} onchange="_cs.scope='permanent'; _csRender()"> كل الحصص الجاية للمادة دي (إيقاف دائم) — ${series.length} حصة</label>` :
        '<div class="sub small">مفيش حصص جاية متسجلة لنفس المادة والمعلم.</div>'}
        ${affected ? `<div class="sub small mt">هيتلغي كمان: ${series.slice(0, affected).slice(0, 6).map(r => fmtShortDate(r.scheduled_at)).join('، ')}${affected > 6 ? ` و${affected - 6} كمان` : ''}</div>` : ''}
        ${cs.scope === 'permanent' || (!series.length && cs.reason === 'إيقاف الاشتراك') ? `<label class="radio mt"><input type="checkbox" id="cs-plan" ${cs.dropPlan ? 'checked' : ''} onchange="_cs.dropPlan=this.checked"> شيل "${esc(s.subject || '')}" من خطة ${esc(st?.name || '')} الأسبوعية</label>` : ''}
      </div>
      <div id="form-error" class="err hidden"></div>
      <div class="modal-foot"><button class="btn btn-danger" style="background:var(--danger);color:#fff" id="form-submit" onclick="_saveCancel()">تأكيد الإلغاء${affected ? ` (${affected + 1} حصص)` : ''}</button>
        <button class="btn btn-ghost" onclick="closeModal()">رجوع</button></div>`;
  };
  window._csRender = render;
  openModal('إلغاء الحصة', '');
  render();
  window._saveCancel = () => runSubmit(async () => {
    if (!cs.reason) return formError('اختار سبب الإلغاء (ده اللي بيعمل تقارير الالتزام)');
    const affected = cs.scope === 'once' ? [] : cs.scope === 'next' ? series.slice(0, cs.n) : series;
    const ids = [s.id, ...affected.map(r => r.id)];
    const patch = { status: cs.party, cancel_reason: cs.reason, cancel_note: cs.note || null, cancelled_at: new Date().toISOString(),
      cancelled_by_user: currentUser.id, cancel_scope: cs.scope };
    await q(sb.from('sessions').update(patch).in('id', ids));
    if (cs.dropPlan) {
      const pl = plansOf(s.student_id).filter(p => norm(p.subject) === norm(s.subject));
      if (pl.length) await q(sb.from('student_subjects').delete().in('id', pl.map(p => p.id)));
    }
    await refreshAll();
    showCancelNotices(s, [s, ...affected], cs);
  });
}
function showCancelNotices(s, list, cs) {
  const { st, fam, tu } = sessionView(s);
  const c = COUNTRIES[fam?.country] || COUNTRIES['مصر'];
  const datesF = list.map(r => `• ${fmtDate(r.scheduled_at, c.tz)} الساعة ${fmtTime(r.scheduled_at, c.tz)}`).join('\n');
  const datesT = list.map(r => `• ${fmtDate(r.scheduled_at, CAIRO_TZ)} الساعة ${fmtTime(r.scheduled_at, CAIRO_TZ)}`).join('\n');
  const permanent = cs.scope === 'permanent';
  const blocks = [];
  if (cs.party !== 'cancelled_by_student') {
    const why = cs.party === 'cancelled_by_tutor' ? 'لظرف طارئ عند المعلمة' : cs.reason === 'إجازة رسمية' ? 'بمناسبة الإجازة الرسمية' : '';
    blocks.push(msgBlock('رسالة لولي الأمر', `السلام عليكم ورحمة الله 🌷
نعتذر عن إلغاء ${list.length > 1 ? 'حصص' : 'حصة'} ${st?.name || ''}${s.subject ? ` (${s.subject})` : ''} ${why}:
${datesF}
${permanent ? 'وهنرتب مع حضراتكم البديل المناسب في أقرب وقت.' : 'وهنرتب موعد تعويضي مناسب ونبلغكم بيه قريب إن شاء الله.'}
شكراً لتفهمكم 🙏
${SIGN_F}`, { group: fam?.whatsapp_group, phone: fam?.whatsapp, country: fam?.country, editFamily: fam?.id }));
  }
  if (cs.party !== 'cancelled_by_tutor') {
    blocks.push(msgBlock('رسالة للمعلم', `${greetTutor(tu?.name)}
تم إلغاء ${list.length > 1 ? 'حصص' : 'حصة'} ${st?.name || ''}${s.subject ? ` (${s.subject})` : ''} ${cs.party === 'cancelled_by_student' ? 'بناءً على طلب الأسرة' : ''}:
${datesT}
${permanent ? 'ده إيقاف لحد إشعار آخر، وهنبلغك لو فيه أي جديد.' : 'هنبلغك بأي موعد تعويضي.'}
${SIGN_T}`, { group: tu?.whatsapp_group, phone: tu?.phone, editTutor: tu?.id }));
  }
  const makeup = !permanent && cs.party !== 'cancelled_by_student'
    ? `<button class="btn btn-brand" onclick="openSessionForm(null, {student_id:${jsq(s.student_id)}, tutor_id:${jsq(s.tutor_id)}, subject:${jsq(s.subject || '')}, makeup_of:${jsq(s.id)}, duration:${s.duration_minutes || 60}})">📅 احجز حصة تعويضية</button>` : '';
  openModal(`تم الإلغاء ✓ (${list.length} ${list.length > 1 ? 'حصص' : 'حصة'})`, `<p class="sub">بلّغ الطرف التاني:</p><div class="list">${blocks.join('')}</div>${makeup ? `<div class="modal-foot">${makeup}</div>` : ''}`);
  document.querySelectorAll('.msg-item').forEach(d => d.open = true);
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
    .gte('scheduled_at', from).lte('scheduled_at', to).not('status', 'in', '(cancelled_by_student,cancelled_by_tutor,cancelled_by_academy)'));
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
    { name: 'student_id', label: 'الطالب', type: 'select', searchable: true, required: true, placeholder: 'اختر الطالب…', options: studentOptions(), value: s?.student_id || prefill.student_id },
    { name: 'tutor_id', label: 'المعلم', type: 'select', searchable: true, required: true, placeholder: 'اختر المعلم…', options: tutorOptions(), value: s?.tutor_id || prefill.tutor_id },
    { name: 'subject', label: 'المادة', value: s?.subject ?? prefill.subject, placeholder: 'مثال: رياضيات', list: [...new Set([...SUBJECT_LIST, ...state.subjects.map(x => x.subject)])] },
    [{ name: 'date', label: 'التاريخ', type: 'date', required: true, value: dateStr(when) },
     { name: 'time', label: 'الوقت (بتوقيتك)', type: 'time', required: true, value: timeStr(when) }],
    { name: 'duration_minutes', label: 'المدة (دقيقة)', type: 'number', required: true, value: s?.duration_minutes ?? prefill.duration ?? 60, step: 5, min: 5 },
    [{ name: 'student_price', label: 'سعر الساعة للأسرة', type: 'number', required: true, value: s?.student_price, hint: 'بعملة الأسرة' },
     { name: 'tutor_cost_egp', label: 'أجر الساعة للمعلم (EGP)', type: 'number', required: true, value: s?.tutor_cost_egp }],
    { name: 'meeting_link', label: 'رابط الحصة', value: s?.meeting_link, placeholder: 'meet.google.com/…' },
    { name: 'notes', label: 'ملاحظات', type: 'textarea', value: s?.notes },
  ];
  if (!s) fields.push({ name: 'repeat', label: 'تكرار أسبوعي', type: 'select', value: '1',
    options: [1, 2, 4, 8, 12, 16].map(n => ({ v: n, l: n === 1 ? 'بدون تكرار (حصة واحدة)' : `نفس الموعد لمدة ${n} أسابيع` })) });
  openModal(s ? 'تعديل حصة' : prefill.makeup_of ? 'حصة تعويضية' : 'حصة جديدة', formHtml(fields, s ? 'حفظ التعديل' : 'إضافة الحصة'));

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
  if (!s && prefill.tutor_id) { const t = byId(state.tutors, prefill.tutor_id); if (t?.default_rate_egp != null) $('tutor_cost_egp').value = t.default_rate_egp; totals(); }
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
    if (!s && prefill.makeup_of) row.makeup_of = prefill.makeup_of;
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
const RELAY_CATS = { material: '📎 مواد / واجب', schedule: '🗓️ مواعيد / تأجيل', level: '📈 مستوى الطالب', complaint: '⚠️ شكوى / ملاحظة', other: '💬 أخرى' };
function relayTarget(r) { // الطلب رايح لمين؟
  return r.requested_by === 'tutor' ? 'parent' : r.requested_by === 'parent' ? 'tutor' : 'both';
}
function relayMessage(r, to) {
  const st = byId(state.students, r.student_id), tu = byId(state.tutors, r.tutor_id);
  const link = r.link ? `\n🔗 ${linkHref(r.link)}` : '';
  if (to === 'parent') return `السلام عليكم ورحمة الله 🌷
${r.requested_by === 'tutor' ? `رسالة من معلمة ${st ? st.name : 'الطالب'}${r.category === 'material' ? ' (مواد للمذاكرة)' : ''}:` : `بخصوص ${st ? st.name : 'الطالب'}:`}
${r.description}${link}
${SIGN_F}`;
  return `${greetTutor(tu?.name)}
${r.requested_by === 'parent' ? `رسالة من ولي أمر ${st ? st.name : 'الطالب'}:` : `بخصوص ${st ? st.name : 'الطالب'}:`}
${r.description}${link}
${SIGN_T}`;
}
function openRelayDeliver(id) {
  const r = state.relay.find(x => x.id === id); if (!r) return;
  const st = byId(state.students, r.student_id), fam = st ? byId(state.families, st.family_id) : null, tu = byId(state.tutors, r.tutor_id);
  const to = relayTarget(r);
  const blocks = [];
  if (to !== 'tutor') blocks.push(msgBlock('لولي الأمر', relayMessage(r, 'parent'), { group: fam?.whatsapp_group, phone: fam?.whatsapp, country: fam?.country, editFamily: fam?.id }));
  if (to !== 'parent') blocks.push(tu ? msgBlock('للمعلم', relayMessage(r, 'tutor'), { group: tu.whatsapp_group, phone: tu.phone, editTutor: tu.id })
    : `<div class="card item sub small">حدد المعلم في المهمة عشان نجهّز رسالته — <a href="javascript:void(0)" onclick="openRelayForm(null, ${jsq(r.id)})">تعديل</a></div>`);
  openModal('توصيل للطرف التاني', `<div class="list">${blocks.join('')}</div>
    <div class="modal-foot"><button class="btn btn-ok" onclick="closeModal(); setRelay(${jsq(r.id)},'done')">✓ اتوصّلت — اقفل المهمة</button></div>`);
  document.querySelectorAll('.msg-item').forEach(d => d.open = true);
}
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
      <span class="small">سجّل هنا أي حاجة لازم تتوصل بين ولي الأمر والمعلم (مواد، تأجيل، ملاحظات) — وبعدين "📲 توصيل" بيجهّز الرسالة للطرف التاني.</span></div>`;
    return;
  }
  el.innerHTML = list.map(r => {
    const st = byId(state.students, r.student_id);
    const fam = st ? byId(state.families, st.family_id) : null;
    const tu = byId(state.tutors, r.tutor_id);
    const done = r.status === 'done';
    const age = (Date.now() - new Date(r.created_at)) / 3600e3;
    return `<div class="card item ${!done && age > 24 ? 's-confirm' : ''}">
      <div class="item-head">
        <div>
          <div class="item-title">${esc(REQUESTERS[r.requested_by] || r.requested_by)} ← ${relayTarget(r) === 'parent' ? 'ولي الأمر' : relayTarget(r) === 'tutor' ? 'المعلم' : 'الطرفين'}${st ? ` · ${esc(st.name)}` : ''}</div>
          <div class="sub small">${r.category ? RELAY_CATS[r.category] + ' · ' : ''}${esc(fam?.name || '')}${tu ? ' · ' + esc(tu.name) : ''} · ${ago(r.created_at)}${!done && age > 24 ? ' · <span class="warn-txt">متأخرة</span>' : ''}</div>
        </div>
        <span class="badge ${done ? 'b-done' : 'b-pending'}">${done ? 'اتوصّلت' : 'مفتوحة'}</span>
      </div>
      <div class="mt" style="white-space:pre-wrap">${esc(r.description)}</div>
      ${r.link ? `<div class="mt"><a href="${esc(linkHref(r.link))}" target="_blank" rel="noopener">📎 المرفق ↗</a></div>` : ''}
      <div class="actions">
        ${done ? `<button class="btn btn-ghost sm" onclick="setRelay(${jsq(r.id)},'pending')">إعادة فتح</button>`
               : `<button class="btn btn-wa sm" onclick="openRelayDeliver(${jsq(r.id)})">📲 توصيل</button>
                  <button class="btn btn-ok sm" onclick="setRelay(${jsq(r.id)},'done')">✓ تم</button>`}
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
    [{ name: 'requested_by', label: 'جاي من', type: 'select', required: true, value: v.requested_by || 'tutor',
       options: Object.entries(REQUESTERS).map(([k, l]) => ({ v: k, l })) },
     { name: 'category', label: 'النوع', type: 'select', value: v.category || 'material', options: Object.entries(RELAY_CATS).map(([k, l]) => ({ v: k, l })) }],
    { name: 'student_id', label: 'الطالب', type: 'select', searchable: true, placeholder: '— بدون —', options: studentOptions(), value: v.student_id },
    { name: 'tutor_id', label: 'المعلم', type: 'select', searchable: true, placeholder: '— بدون —', options: tutorOptions(), value: v.tutor_id },
    { name: 'description', label: 'المطلوب توصيله', type: 'textarea', required: true, value: v.description,
      placeholder: 'مثال: الشيت ده مراجعة الوحدة التانية، يتحل قبل حصة الخميس' },
    { name: 'link', label: 'رابط مرفق (اختياري)', type: 'url', value: v.link, placeholder: 'لينك Google Drive / ملف / صورة' },
  ];
  openModal(r ? 'تعديل مهمة ترحيل' : 'مهمة ترحيل جديدة', formHtml(fields, 'حفظ'));
  const stSel = document.getElementById('f_student_id'), tuSel = document.getElementById('f_tutor_id');
  stSel.addEventListener('change', () => { // اقترح المعلم من خطة الطالب
    const ps = plansOf(stSel.value).filter(p => p.tutor_id);
    if (!tuSel.value && ps.length === 1) tuSel.value = ps[0].tutor_id;
  });
  window._formSubmit = () => runSubmit(async () => {
    const row = { requested_by: fv('requested_by'), category: fv('category'), student_id: fv('student_id') || null,
      tutor_id: fv('tutor_id') || null, description: fv('description'), link: fv('link') || null };
    let saved;
    if (r) { await q(sb.from('relay_tasks').update(row).eq('id', r.id)); }
    else { [saved] = await q(sb.from('relay_tasks').insert({ ...row, session_id: v.session_id || null }).select()); }
    closeModal(); showToast('تم الحفظ ✓'); await refreshAll();
    if (saved) openRelayDeliver(saved.id);
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
  const FF = { all: () => true, owe: f => famBalance(f).balance < 0, low: lowPrepaid, nogroup: f => !f.whatsapp_group,
    noprice: f => state.students.some(s => s.family_id === f.id && s.default_price == null) };
  const counts = Object.fromEntries(Object.entries(FF).map(([k, fn]) => [k, state.families.filter(fn).length]));
  document.getElementById('family-chips').innerHTML = [['all', 'الكل'], ['owe', '💸 عليها فلوس'], ['low', '🪫 باقة قربت تخلص'], ['nogroup', 'بدون جروب'], ['noprice', 'طالب بدون سعر']]
    .filter(([k]) => k === 'all' || counts[k] || state.famFilter === k)
    .map(([k, l]) => `<button class="chip ${(state.famFilter || 'all') === k ? 'active' : ''}" onclick="state.famFilter='${k}'; renderFamilies()">${l} (${counts[k]})</button>`).join('');
  const list = state.families.filter(FF[state.famFilter || 'all'] || FF.all).filter(f => {
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
          <div class="sub small">${esc(f.parent_name || '')}${f.parent_name ? ' · ' : ''}${esc(f.country)} · ${esc(f.currency)} · <span class="pill">${CYCLES[f.billing_cycle] || 'شهري'}</span></div>
        </div>
        <div style="text-align:left">
          <div class="num ${b.balance < 0 ? 'neg' : 'pos'}" style="font-weight:800">${money(b.balance, f.currency)}</div>
          <div class="sub small">${b.balance < 0 ? 'مستحق على الأسرة' : f.billing_cycle === 'prepaid' ? (lowPrepaid(f) ? '🪫 الباقة قربت تخلص' : 'رصيد الباقة') : 'رصيد'}</div>
        </div>
      </div>
      ${f.whatsapp_group ? `<div class="actions" style="margin-top:8px"><a class="btn btn-wa sm" href="${esc(f.whatsapp_group)}" target="_blank" rel="noopener">💬 جروب الأسرة</a></div>` : ''}
      <div class="meta"><span>واتساب: ${f.whatsapp ? `<b dir="ltr">${esc(f.whatsapp)}</b>` : `<a href="javascript:void(0)" onclick="openFamilyForm(${fid})">أضف الرقم</a>`}</span><span>حصص تمت: <b>${b.count}</b></span></div>
      ${f.notes ? `<div class="sub small mt">📝 ${esc(f.notes)}</div>` : ''}
      <div class="stu-list">
        ${studs.map(s => `<button class="stu-row" onclick="openStudentProfile(${jsq(s.id)})">
          <div class="stu-top"><b>${esc(s.name)}</b><span class="num">${s.default_price != null ? `${fmt(s.default_price)} ${esc(f.currency)}<span class="sub small">/ساعة</span>` : '<span class="neg">بدون سعر</span>'}</span></div>
          <div class="sub small">${esc(s.grade_level)} · ${esc(CURRICULA[s.curriculum])}</div>
          ${plansOf(s.id).length ? `<div class="plan-lines">${plansOf(s.id).map(p => `<span class="plan ${p.tutor_id ? '' : 'no-tutor'}">${esc(planLabel(p))}</span>`).join('')}</div>` : ''}
          ${s.notes ? `<div class="small warn-note">⚠️ ${esc(s.notes)}</div>` : ''}
        </button>`).join('')}
        <button class="stu" style="background:transparent;border:1px dashed var(--brand)" onclick="openStudentForm(${fid})">+ طالب</button>
      </div>
      <div class="actions">
        <button class="btn btn-brand sm" onclick="openPaymentForm(${fid})">+ دفعة</button>
        <button class="btn btn-wa sm" onclick="openFamilyInvoice(${fid})">📄 ${f.billing_cycle === 'prepaid' ? 'كشف رصيد' : 'فاتورة'}</button>
        ${b.balance < 0 ? `<button class="btn btn-ghost sm" onclick="openPaymentReminder(${fid})">📲 مطالبة</button>` : ''}
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
    { name: 'billing_cycle', label: 'طريقة المحاسبة', type: 'select', value: f?.billing_cycle || 'monthly', options: Object.entries(CYCLES).map(([v, l]) => ({ v, l })) },
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
    const row = { name: fv('name'), parent_name: fv('parent_name') || null, country: fv('country'), currency: fv('currency'), whatsapp: fv('whatsapp') || null, whatsapp_group: cleanGroup(fv('whatsapp_group')), billing_cycle: fv('billing_cycle'), notes: fv('notes') || null };
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
/* ----- دفعات الأسر: طريقة الاستلام + اللي وصل فعلاً بالجنيه ----- */
const PAY_METHODS = ['ويسترن يونيون', 'تطبيق تحويل', 'استلام بالجنيه المصري', 'تحويل بنكي', 'أخرى'];
const CYCLES = { monthly: 'شهري', weekly: 'أسبوعي', prepaid: 'مقدّم (باقة)' };
function txEgp(t) { // الجنيه اللي وصل فعلاً (أو تقدير بسعر السوق لو ماتسجلش)
  const sign = t.type === 'refund' ? -1 : 1;
  if (t.received_egp != null) return { v: sign * Number(t.received_egp), est: false };
  return { v: sign * Number(t.amount) * Number(t.market_rate || fxRate(t.currency)), est: t.currency !== 'EGP' };
}
function txFxDiff(t) { // فرق العملة = الواصل فعلاً − المبلغ × سعر السوق يوم الدفع
  if (t.received_egp == null || t.currency === 'EGP' || !t.market_rate) return null;
  const sign = t.type === 'refund' ? -1 : 1;
  return sign * (Number(t.received_egp) - Number(t.amount) * Number(t.market_rate));
}
function openPaymentForm(familyId) {
  if (!state.families.length) { showToast('أضف أسرة الأول', true); switchTab('families'); return; }
  const fields = [
    { name: 'family_id', label: 'الأسرة', type: 'select', searchable: true, required: true, placeholder: 'اختر الأسرة…', value: familyId,
      options: state.families.map(f => ({ v: f.id, l: `${f.name} (${f.currency})` })) },
    [{ name: 'type', label: 'النوع', type: 'select', value: 'payment', options: [{ v: 'payment', l: 'دفعة مستلمة' }, { v: 'refund', l: 'استرداد للأسرة' }] },
     { name: 'method', label: 'طريقة الاستلام', type: 'select', value: 'ويسترن يونيون', options: PAY_METHODS.map(m => ({ v: m, l: m })) }],
    { name: 'amount', label: 'المبلغ اللي اتحسب للأسرة', type: 'number', required: true, hint: 'بعملة الأسرة' },
    { name: 'received_egp', label: 'المبلغ اللي وصلك فعلاً بالجنيه', type: 'number', hint: ' ' },
    { name: 'date', label: 'تاريخ الاستلام', type: 'date', value: todayStr() },
    { name: 'note', label: 'ملاحظة', placeholder: 'مثال: شهر أكتوبر — رقم الحوالة MTCN …' },
  ];
  openModal('تسجيل دفعة', formHtml(fields, 'تسجيل'));
  const $ = n => document.getElementById('f_' + n);
  const upd = () => {
    const f = byId(state.families, $('family_id').value);
    const cur = f?.currency || '';
    document.getElementById('hint_amount').textContent = cur ? `بالـ ${cur} — ده اللي بيتخصم من مستحقات الأسرة` : 'بعملة الأسرة';
    const egpFam = cur === 'EGP';
    document.getElementById('wrap_received_egp').classList.toggle('hidden', egpFam);
    const amt = Number($('amount').value) || 0, got = Number($('received_egp').value) || 0, mr = fxRate(cur);
    let h = cur && !egpFam ? `بسعر السوق النهارده ≈ ${fmt(amt * mr, 2)} ج (1 ${cur} = ${fmt(mr, 4)} ج).` : '';
    if (got && amt && !egpFam) {
      const eff = got / amt, diff = got - amt * mr;
      h += ` السعر الفعلي اللي وصلك: ${fmt(eff, 4)} ج — ${diff >= 0 ? 'مكسب' : 'خسارة'} فرق عملة ${fmt(Math.abs(diff), 2)} ج.`;
    }
    if (!egpFam) h += ' لو مش عارفه دلوقتي سيبه فاضي وعدّله بعدين.';
    document.getElementById('hint_received_egp').textContent = h;
    document.querySelector('#wrap_received_egp label').textContent = $('method').value === 'استلام بالجنيه المصري'
      ? 'المبلغ اللي استلمته بالجنيه *' : 'المبلغ اللي وصلك فعلاً بالجنيه';
  };
  ['family_id', 'amount', 'received_egp', 'method'].forEach(n => { $(n).addEventListener('input', upd); $(n).addEventListener('change', upd); });
  upd();
  window._formSubmit = () => runSubmit(async () => {
    const f = byId(state.families, fv('family_id'));
    const amount = fnum('amount');
    if (!(amount > 0)) return formError('اكتب مبلغ صحيح');
    const got = f.currency === 'EGP' ? amount : fnum('received_egp');
    if (fv('method') === 'استلام بالجنيه المصري' && !(got > 0)) return formError('اكتب المبلغ اللي استلمته بالجنيه');
    const d = fv('date') ? new Date(`${fv('date')}T12:00:00`) : new Date();
    await q(sb.from('family_transactions').insert({ family_id: f.id, amount, currency: f.currency, type: fv('type'), method: fv('method'),
      received_egp: got || null, note: fv('note') || null, created_at: d.toISOString() }));
    closeModal(); showToast('تم تسجيل الدفعة ✓'); await refreshAll();
  });
}
function openEditReceived(txId) {
  const t = (state.fin?.tx || []).find(x => x.id === txId); if (!t) return;
  openModal('تعديل المبلغ اللي وصل بالجنيه', formHtml([
    { name: 'received_egp', label: `${money(t.amount, t.currency)} وصلوا كام جنيه؟`, type: 'number', required: true, value: t.received_egp ?? '',
      hint: `بسعر السوق يوم الدفع ≈ ${fmt(Number(t.amount) * Number(t.market_rate || fxRate(t.currency)), 2)} ج` },
    { name: 'method', label: 'طريقة الاستلام', type: 'select', value: t.method || 'ويسترن يونيون', options: PAY_METHODS.map(m => ({ v: m, l: m })) },
  ], 'حفظ'));
  window._formSubmit = () => runSubmit(async () => {
    await q(sb.from('family_transactions').update({ received_egp: fnum('received_egp'), method: fv('method') }).eq('id', t.id));
    closeModal(); showToast('تم الحفظ ✓'); await loadFinance(true);
  });
}

/* ----- فواتير الأسر حسب طريقة المحاسبة ----- */
function periodFor(cycle, which) { // which: 0 = الحالية، -1 = اللي فاتت
  const now = new Date();
  if (cycle === 'weekly') {
    const from = weekStart(todayStr()); from.setDate(from.getDate() + 7 * which);
    const to = new Date(from); to.setDate(to.getDate() + 7);
    return { from, to, label: which ? 'الأسبوع اللي فات' : 'الأسبوع ده' };
  }
  if (cycle === 'prepaid') {
    const to = new Date(parseDay(todayStr()).getTime() + 864e5), from = new Date(to.getTime() - (which ? 60 : 30) * 864e5);
    return { from, to, label: which ? 'آخر 60 يوم' : 'آخر 30 يوم' };
  }
  const from = new Date(now.getFullYear(), now.getMonth() + which, 1), to = new Date(now.getFullYear(), now.getMonth() + which + 1, 1);
  return { from, to, label: `شهر ${from.toLocaleDateString('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' })}` };
}
function lowPrepaid(f) {
  if (f.billing_cycle !== 'prepaid') return false;
  const prices = state.students.filter(s => s.family_id === f.id).map(s => Number(s.default_price || 0));
  const hour = Math.max(20, ...prices);
  return famBalance(f).balance < 2 * hour;
}
async function openFamilyInvoice(familyId, which = 0) {
  const f = byId(state.families, familyId);
  const cycle = f.billing_cycle || 'monthly';
  const p = periodFor(cycle, which);
  const studIds = state.students.filter(s => s.family_id === familyId).map(s => s.id);
  try {
    const [ss, tx] = await Promise.all([
      studIds.length ? q(sb.from('sessions').select('*').in('student_id', studIds).eq('status', 'done')
        .gte('scheduled_at', p.from.toISOString()).lt('scheduled_at', p.to.toISOString()).order('scheduled_at')) : [],
      q(sb.from('family_transactions').select('*').eq('family_id', familyId).gte('created_at', p.from.toISOString()).lt('created_at', p.to.toISOString())),
    ]);
    const c = COUNTRIES[f.country] || COUNTRIES['مصر'];
    const total = ss.reduce((a, s) => a + charges(s).fam, 0), mins = ss.reduce((a, s) => a + sMins(s), 0);
    const paid = tx.reduce((a, t) => a + (t.type === 'refund' ? -1 : 1) * Number(t.amount), 0);
    const bal = famBalance(f).balance;
    const lines = ss.map(s => { const v = sessionView(s);
      return `• ${new Date(s.scheduled_at).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'numeric', timeZone: c.tz })} — ${v.st?.name || ''}${s.subject ? ': ' + s.subject : ''}${s.kind === 'revision' ? ' (مراجعة)' : ''} — ${durLabel(sMins(s))} = ${fmt(charges(s).fam, 2)} ${f.currency}`; }).join('\n');
    const closing = cycle === 'prepaid'
      ? (bal <= 0 ? 'رصيد الباقة خلص، برجاء التجديد لاستمرار الحصص 🙏' : lowPrepaid(f) ? 'رصيد الباقة قرب يخلص، برجاء التجديد قريب 🙏' : 'شكراً لثقتكم 🌷')
      : (bal < 0 ? 'برجاء التكرم بسداد المستحق، ولأي استفسار إحنا موجودين 🙏' : 'شكراً لالتزامكم 🌷');
    const text = `السلام عليكم ورحمة الله 🌷
${cycle === 'prepaid' ? 'كشف رصيد الباقة' : 'فاتورة حصص ' + p.label} — ${f.name}
${lines || '— لا توجد حصص منفذة في الفترة —'}

إجمالي الوقت: ${mins ? durLabel(mins) : '0'}
إجمالي الحصص: *${fmt(total, 2)} ${f.currency}*${paid ? `\nالمدفوع في الفترة: ${fmt(paid, 2)} ${f.currency}` : ''}
${bal < 0 ? `المستحق حالياً: *${fmt(-bal, 2)} ${f.currency}*` : `الرصيد لصالحكم: *${fmt(bal, 2)} ${f.currency}*`}

${closing}
${SIGN_F}`;
    openModal(`${cycle === 'prepaid' ? 'كشف رصيد' : 'فاتورة'} — ${f.name}`, `
      <div class="chips"><span class="sub small" style="align-self:center">طريقة المحاسبة: <b>${CYCLES[cycle]}</b></span>
        <button class="chip ${which === 0 ? 'active' : ''}" onclick="openFamilyInvoice(${jsq(familyId)}, 0)">${periodFor(cycle, 0).label}</button>
        <button class="chip ${which === -1 ? 'active' : ''}" onclick="openFamilyInvoice(${jsq(familyId)}, -1)">${periodFor(cycle, -1).label}</button></div>
      <div class="msg-preview">${esc(text)}</div>${msgActionsHtml(text, { group: f.whatsapp_group, phone: f.whatsapp, country: f.country, editFamily: f.id })}`);
  } catch (e) { showToast(dbError(e), true); }
}

/* ----- كشف المعلمة عن فترة (للتسوية الشهرية) ----- */
async function openTutorPeriodMessage(tutorId) {
  const t = byId(state.tutors, tutorId), r = state.fin?.range || finRange();
  try {
    const [ss, po] = await Promise.all([
      q(sb.from('sessions').select('*').eq('tutor_id', tutorId).eq('status', 'done').gte('scheduled_at', r.fromD.toISOString()).lt('scheduled_at', r.toD.toISOString()).order('scheduled_at')),
      q(sb.from('tutor_payouts').select('*').eq('tutor_id', tutorId).eq('paid', true).gte('created_at', r.fromD.toISOString()).lt('created_at', r.toD.toISOString())),
    ]);
    const earned = ss.reduce((a, s) => a + charges(s).tut, 0), mins = ss.reduce((a, s) => a + sMins(s), 0);
    const paid = po.reduce((a, p) => a + Number(p.total_egp), 0);
    const b = tutBalance(t);
    const label = r.fromD.getDate() === 1 && new Date(r.toD.getTime() - 1).getMonth() === r.fromD.getMonth()
      ? `شهر ${r.fromD.toLocaleDateString('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' })}` : `الفترة ${r.from} إلى ${r.toIncl}`;
    const lines = ss.map(s => { const v = sessionView(s); return `• ${new Date(s.scheduled_at).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'numeric' })} — ${v.st?.name || ''}${s.subject ? ' (' + s.subject + ')' : ''}${s.kind === 'revision' ? ' مراجعة' : ''} — ${durLabel(sMins(s))} = ${fmt(charges(s).tut, 2)} ج`; }).join('\n');
    const text = `${greetTutor(t.name)}
كشف حصصك عن ${label}:
${lines || '— لا توجد حصص —'}

إجمالي الوقت: ${mins ? durLabel(mins) : '0'}
إجمالي المستحق عن الفترة: *${fmt(earned, 2)} جنيه*${paid ? `\nتم تحويل: ${fmt(paid, 2)} جنيه` : ''}
${b.due > 0 ? `المتبقي لكِ حالياً: *${fmt(b.due, 2)} جنيه*` : 'لا يوجد متبقي ✅'}

لو فيه أي ملاحظة على الكشف بلّغينا قبل التحويل.
${SIGN_T}`;
    openModal(`كشف ${label} — ${t.name}`, `<div class="msg-preview">${esc(text)}</div>${msgActionsHtml(text, { group: t.whatsapp_group, phone: t.phone, editTutor: t.id })}`);
  } catch (e) { showToast(dbError(e), true); }
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
  const TF = { all: () => true, due: t => tutBalance(t).due > 0, norate: t => t.default_rate_egp == null, nogroup: t => !t.whatsapp_group };
  const tc = Object.fromEntries(Object.entries(TF).map(([k, fn]) => [k, state.tutors.filter(fn).length]));
  document.getElementById('tutor-chips').innerHTML = [['all', 'الكل'], ['due', '💰 ليه مستحقات'], ['norate', 'بدون أجر ساعة'], ['nogroup', 'بدون جروب']]
    .filter(([k]) => k === 'all' || tc[k] || state.tutFilter === k)
    .map(([k, l]) => `<button class="chip ${(state.tutFilter || 'all') === k ? 'active' : ''}" onclick="state.tutFilter='${k}'; renderTutors()">${l} (${tc[k]})</button>`).join('');
  const list = state.tutors.filter(TF[state.tutFilter || 'all'] || TF.all).filter(t => {
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
  // الكاش الفعلي
  let cashIn = 0, estCount = 0, fxDiff = 0, fxKnown = 0;
  const collected = {};
  tx.forEach(t => {
    const e = txEgp(t); cashIn += e.v; if (e.est) estCount++;
    const d = txFxDiff(t); if (d != null) { fxDiff += d; fxKnown++; }
    collected[t.currency] = (collected[t.currency] || 0) + (t.type === 'refund' ? -1 : 1) * Number(t.amount);
  });
  const paidOut = payouts.filter(p => p.paid).reduce((a, p) => a + Number(p.total_egp), 0);

  // المعلمين — تسوية الفترة (بالجنيه)
  const perTutor = {};
  done.forEach(s => { const x = perTutor[s.tutor_id] ||= { n: 0, egp: 0, h: 0 }; x.n++; x.h += sMins(s) / 60; x.egp += charges(s).tut; });
  const paidPerTutor = {};
  payouts.filter(p => p.paid).forEach(p => paidPerTutor[p.tutor_id] = (paidPerTutor[p.tutor_id] || 0) + Number(p.total_egp));
  const tutorRows = state.tutors.map(t => ({ t, p: perTutor[t.id] || { n: 0, egp: 0, h: 0 }, paid: paidPerTutor[t.id] || 0, b: tutBalance(t) }))
    .filter(x => x.p.n || x.b.due > 0 || x.paid).sort((a, b) => b.b.due - a.b.due);

  // الأسر — حصص الفترة والمدفوع والرصيد
  const famPeriod = {};
  done.forEach(s => { const st = byId(state.students, s.student_id); if (!st) return; const x = famPeriod[st.family_id] ||= { charge: 0, mins: 0 }; x.charge += charges(s).fam; x.mins += sMins(s); });
  const famPaid = {};
  tx.forEach(t => famPaid[t.family_id] = (famPaid[t.family_id] || 0) + (t.type === 'refund' ? -1 : 1) * Number(t.amount));
  const famRows = state.families.map(f => ({ f, p: famPeriod[f.id] || { charge: 0, mins: 0 }, paid: famPaid[f.id] || 0, b: famBalance(f) }))
    .filter(x => x.p.charge || x.paid || x.b.balance < 0 || lowPrepaid(x.f))
    .sort((a, b) => a.b.balance - b.b.balance);

  const fxRows = (state.fxRows || []).filter(r => r.currency !== 'EGP');
  document.getElementById('fin-content').innerHTML = `
    <div class="kpis">
      <div class="card kpi"><div class="l">إيراد الحصص اللي تمت</div><div class="v num">${fmt(rev)}</div><div class="s">EGP بسعر السوق يوم الحصة · ${done.length} ${done.length > 2 && done.length < 11 ? 'حصص' : 'حصة'} · ${fmt(hoursDone, 1)} ساعة</div></div>
      <div class="card kpi"><div class="l">مستحقات المعلمين عن الفترة</div><div class="v num">${fmt(cost)}</div><div class="s">EGP</div></div>
      <div class="card kpi"><div class="l">هامش الأكاديمية</div><div class="v num ${margin >= 0 ? 'pos' : 'neg'}">${fmt(margin)}</div><div class="s">EGP · ${rev ? Math.round(margin / rev * 100) : 0}% من الإيراد</div></div>
      <div class="card kpi"><div class="l">المحصّل فعلياً بالجنيه</div><div class="v num">${fmt(cashIn)}</div><div class="s">${Object.entries(collected).map(([c, v]) => `${fmt(v)} ${c}`).join(' + ') || '—'}${estCount ? ` · ${estCount} دفعة لسه مقدّرة` : ''}</div></div>
      <div class="card kpi"><div class="l">فرق العملة (مكسب/خسارة)</div><div class="v num ${fxDiff >= 0 ? 'pos' : 'neg'}">${fxKnown ? (fxDiff >= 0 ? '+' : '') + fmt(fxDiff) : '—'}</div><div class="s">${fxKnown ? `EGP · من ${fxKnown} تحويل: الواصل فعلاً مقابل سعر السوق` : 'سجّل "المبلغ اللي وصلك بالجنيه" في الدفعات'}</div></div>
      <div class="card kpi"><div class="l">صافي الكاش في الفترة</div><div class="v num ${cashIn - paidOut >= 0 ? 'pos' : 'neg'}">${fmt(cashIn - paidOut)}</div><div class="s">المحصّل − المحوَّل للمعلمين (${fmt(paidOut)})</div></div>
    </div>

    <div class="section-title"><h2>تسوية المعلمين (بالجنيه)</h2></div>
    <div class="card scrollx"><table><thead><tr><th>المعلم</th><th>الفترة</th><th>مستحق الفترة</th><th>اتحوّل في الفترة</th><th>المتبقي الكلي</th><th></th></tr></thead><tbody>
      ${tutorRows.map(x => `<tr><td>${esc(x.t.name)}${x.t.default_rate_egp == null ? '<div class="small neg">بدون أجر ساعة</div>' : ''}</td>
        <td class="num">${x.p.n} حصة<div class="sub small">${fmt(x.p.h || 0, 1)} ساعة</div></td>
        <td class="num">${fmt(x.p.egp)}</td><td class="num">${x.paid ? fmt(x.paid) : '—'}</td>
        <td class="num ${x.b.due > 0 ? 'neg' : ''}">${fmt(x.b.due)}</td>
        <td class="row-gap">${x.b.due > 0 ? `<button class="btn btn-brand sm" onclick="openPayoutForm(${jsq(x.t.id)})">صرف</button>` : '<span class="pill ok">مصروف</span>'}
          <button class="btn btn-wa sm" onclick="openTutorPeriodMessage(${jsq(x.t.id)})">📲 كشف</button></td></tr>`).join('')
        || '<tr><td colspan="6" class="empty">لا توجد حصص أو مستحقات في الفترة</td></tr>'}
    </tbody></table></div>

    <div class="section-title"><h2>الأسر — الفواتير والرصيد</h2></div>
    <div class="card scrollx"><table><thead><tr><th>الأسرة</th><th>حصص الفترة</th><th>مدفوع في الفترة</th><th>الرصيد الحالي</th><th></th></tr></thead><tbody>
      ${famRows.map(x => { const cur = x.f.currency; return `<tr><td>${esc(x.f.name)}<div class="sub small">${CYCLES[x.f.billing_cycle] || ''}${lowPrepaid(x.f) ? ' · <span class="neg">🪫 الباقة قربت تخلص</span>' : ''}</div></td>
        <td class="num">${fmt(x.p.charge, 2)} ${cur}<div class="sub small">${x.p.mins ? durLabel(x.p.mins) : ''}</div></td>
        <td class="num">${x.paid ? fmt(x.paid, 2) + ' ' + cur : '—'}</td>
        <td class="num ${x.b.balance < 0 ? 'neg' : 'pos'}">${x.b.balance < 0 ? 'عليها ' : 'لها '}${fmt(Math.abs(x.b.balance), 2)} ${cur}</td>
        <td class="row-gap"><button class="btn btn-wa sm" onclick="openFamilyInvoice(${jsq(x.f.id)})">📄 فاتورة</button>
          <button class="btn btn-brand sm" onclick="openPaymentForm(${jsq(x.f.id)})">+ دفعة</button></td></tr>`; }).join('')
        || '<tr><td colspan="5" class="empty">لا توجد حصص أو مستحقات في الفترة</td></tr>'}
    </tbody></table></div>

    <div class="section-title"><h2>الدفعات المستلمة في الفترة</h2></div>
    <div class="card scrollx"><table><thead><tr><th>التاريخ</th><th>الأسرة</th><th>المبلغ</th><th>وصل بالجنيه</th><th>فرق العملة</th><th>الطريقة</th></tr></thead><tbody>
      ${tx.map(t => { const e = txEgp(t), d = txFxDiff(t); return `<tr><td class="num">${fmtShortDate(t.created_at)}</td><td>${esc(byId(state.families, t.family_id)?.name || '')}<div class="sub small">${esc(t.note || '')}</div></td>
        <td class="num ${t.type === 'refund' ? 'neg' : 'pos'}">${t.type === 'refund' ? '−' : ''}${money(t.amount, t.currency)}</td>
        <td class="num">${e.est ? `<a href="javascript:void(0)" onclick="openEditReceived(${jsq(t.id)})" title="مقدّر بسعر السوق — دوس لتسجيل المبلغ الفعلي">≈ ${fmt(e.v)} ✎</a>` : `${fmt(e.v)}${t.currency !== 'EGP' ? ` <a href="javascript:void(0)" onclick="openEditReceived(${jsq(t.id)})">✎</a>` : ''}`}</td>
        <td class="num ${d == null ? '' : d >= 0 ? 'pos' : 'neg'}">${d == null ? '—' : (d >= 0 ? '+' : '') + fmt(d)}</td>
        <td class="sub small">${esc(t.method || '')}</td></tr>`; }).join('')
        || '<tr><td colspan="6" class="empty">لا توجد دفعات في الفترة</td></tr>'}
    </tbody></table></div>

    ${Object.keys(byCur).length ? `<div class="section-title"><h2>الإيراد حسب العملة</h2></div>
    <div class="card scrollx"><table><thead><tr><th>العملة</th><th>حصص</th><th>بالعملة الأصلية</th><th>بالجنيه (سعر يوم الحصة)</th></tr></thead><tbody>
      ${Object.entries(byCur).map(([c, v]) => `<tr><td>${c}</td><td class="num">${v.n}</td><td class="num">${fmt(v.amt, 2)} ${c}</td><td class="num">${fmt(v.egp)} EGP</td></tr>`).join('')}
    </tbody></table></div>` : ''}

    <div class="section-title"><h2>أسعار الصرف</h2>${isAdmin ? `<button class="btn btn-ghost sm" onclick="openFxForm()">تعديل</button>` : ''}</div>
    <div class="card item">
      ${fxRows.map(r => `<div class="item-head" style="padding:4px 0"><span dir="ltr"><b>1 ${r.currency} = ${fmt(r.rate_to_egp, 4)} EGP</b></span>
        <span class="sub small">${r.auto ? `🔄 سعر السوق — بيتحدث تلقائي كل 6 ساعات · آخر تحديث ${ago(r.updated_at)}` : `✋ سعر يدوي من ${fmtShortDate(r.updated_at)}`}</span></div>`).join('')}
      <p class="sub small" style="margin:8px 0 0">سعر السوق بيتثبت على كل حصة لحظة تسجيلها "تمت" (لحساب الإيراد والهامش). الفلوس اللي وصلت فعلاً بتتسجل مع كل دفعة، والفرق بينهم بيظهر في "فرق العملة".</p>
    </div>`;
}
function openFxForm() {
  const rows = (state.fxRows || []).filter(r => r.currency !== 'EGP');
  const body = rows.map(r => `<div class="card item mb" style="background:var(--bg)">
      <label class="row-gap" style="align-items:center;margin-bottom:8px"><input type="checkbox" id="fxauto_${r.currency}" ${r.auto ? 'checked' : ''}> <b>${r.currency}</b>: تحديث تلقائي من سعر السوق</label>
      <div class="field" style="margin:0"><label>أو سعر يدوي: 1 ${r.currency} = ؟ جنيه</label>
        <input id="fxval_${r.currency}" class="input" type="number" step="0.0001" value="${r.rate_to_egp}"></div></div>`).join('');
  openModal('أسعار الصرف', `${body}
    <p class="sub small">لو قفلت "تحديث تلقائي" السعر اليدوي هيفضل ثابت لحد ما ترجّعه تلقائي.</p>
    <div id="form-error" class="err hidden"></div>
    <div class="modal-foot"><button class="btn btn-brand" id="form-submit" onclick="_saveFx()">حفظ</button><button class="btn btn-ghost" onclick="closeModal()">إلغاء</button></div>`);
  window._saveFx = () => runSubmit(async () => {
    for (const r of rows) {
      const auto = document.getElementById('fxauto_' + r.currency).checked;
      const val = Number(document.getElementById('fxval_' + r.currency).value);
      const patch = { auto };
      if (!auto) { if (!(val > 0)) return formError('اكتب سعر صحيح'); patch.rate_to_egp = val; patch.updated_at = new Date().toISOString(); patch.source = 'manual'; }
      await q(sb.from('fx_rates').update(patch).eq('currency', r.currency));
    }
    closeModal(); showToast('تم الحفظ ✓ — الأسعار التلقائية بتتحدث خلال 6 ساعات'); await refreshAll();
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
  const low = state.families.filter(lowPrepaid).length;
  if (low) items.push(`<button class="att att-warn" onclick="switchTab('families')">🪫 <b>${low}</b> باقة قربت تخلص</button>`);
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
      done ? Number(s.fx_rate_to_egp).toFixed(4) : '', done ? Number(s.revenue_egp).toFixed(2) : '', done ? Number(s.margin_egp).toFixed(2) : '',
      s.cancel_reason || '', s.cancel_note || '', cancelNoticeHours(s) == null ? '' : cancelNoticeHours(s).toFixed(1), s.makeup_of ? 'نعم' : '', s.notes];
  });
  downloadCSV(`حصص_${r.from}_${r.toIncl}.csv`, ['التاريخ', 'الوقت', 'الطالب', 'الأسرة', 'المعلم', 'المادة', 'النوع', 'الحالة', 'المدة المخططة (د)', 'المدة الفعلية (د)',
    'سعر الساعة للأسرة', 'العملة', 'إجمالي الأسرة', 'أجر الساعة للمعلم (EGP)', 'إجمالي المعلم (EGP)', 'سعر الصرف', 'الإيراد (EGP)', 'الهامش (EGP)', 'سبب الإلغاء', 'تفاصيل الإلغاء', 'الإلغاء قبلها بكام ساعة', 'تعويضية', 'ملاحظات'], rows);
}
function exportPaymentsCSV() {
  if (!state.fin) return;
  const r = state.fin.range;
  const rows = state.fin.tx.map(t => { const d = txFxDiff(t); return [dateStr(new Date(t.created_at)), byId(state.families, t.family_id)?.name, t.type === 'refund' ? 'استرداد' : 'دفعة', t.amount, t.currency,
    t.method, t.received_egp ?? '', t.market_rate ?? '', d == null ? '' : d.toFixed(2), t.note]; });
  const po = state.fin.payouts.map(p => [dateStr(new Date(p.paid_at || p.created_at)), byId(state.tutors, p.tutor_id)?.name, 'صرف لمعلم', p.total_egp, 'EGP', p.method, p.total_egp, '', '', p.note]);
  downloadCSV(`مدفوعات_${r.from}_${r.toIncl}.csv`, ['التاريخ', 'الأسرة / المعلم', 'النوع', 'المبلغ', 'العملة', 'الطريقة', 'وصل/اتحوّل بالجنيه', 'سعر السوق يومها', 'فرق العملة (EGP)', 'ملاحظة'], [...rows, ...po]);
}

/* ============================================================
   التقارير: الالتزام، أسباب الإلغاء، الساعات
   ============================================================ */
state.repPeriod = 'this';
function repRange() {
  const now = new Date(); let from, to = new Date(now.getFullYear(), now.getMonth() + 1, 1), label;
  if (state.repPeriod === 'last') { from = new Date(now.getFullYear(), now.getMonth() - 1, 1); to = new Date(now.getFullYear(), now.getMonth(), 1); label = 'الشهر اللي فات'; }
  else if (state.repPeriod === '3m') { from = new Date(now.getFullYear(), now.getMonth() - 2, 1); label = 'آخر 3 شهور'; }
  else if (state.repPeriod === 'year') { from = new Date(now.getFullYear(), 0, 1); to = new Date(now.getFullYear() + 1, 0, 1); label = 'السنة دي'; }
  else { from = new Date(now.getFullYear(), now.getMonth(), 1); label = 'الشهر ده'; }
  return { from, to, label };
}
async function loadReports() {
  const r = repRange();
  setLoading(true);
  try {
    state.rep = { rows: await q(sb.from('sessions').select('*').gte('scheduled_at', r.from.toISOString()).lt('scheduled_at', r.to.toISOString()).order('scheduled_at')), r };
    renderReports();
  } catch (e) { showToast(dbError(e), true); } finally { setLoading(false); }
}
function setRepPeriod(p) { state.repPeriod = p; loadReports(); }
const isLate = s => { const h = cancelNoticeHours(s); return h != null && h < LATE_HOURS; };
function commitment(done, cancels) {
  const total = done + cancels;
  if (total < 3) return { rate: total ? done / total : null, label: 'بيانات قليلة', cls: 'b-cancel' };
  const rate = done / total;
  return rate >= 0.9 ? { rate, label: 'ملتزم ✅', cls: 'b-done' } : rate >= 0.75 ? { rate, label: 'متوسط', cls: 'b-pending' } : { rate, label: 'محتاج متابعة', cls: 'b-now' };
}
function bars(entries, max, cls = '') {
  return entries.map(([k, v]) => `<div class="bar-row"><span class="bar-label">${esc(k)}</span>
    <span class="bar-track"><span class="bar-fill ${cls}" style="width:${max ? Math.max(4, v / max * 100) : 0}%"></span></span><span class="num bar-val">${v}</span></div>`).join('');
}
function renderReports() {
  const el = document.getElementById('reports-content'); if (!el || !state.rep) return;
  const { rows, r } = state.rep;
  const past = rows.filter(s => s.status !== 'scheduled' || sStart(s) < Date.now());
  const done = past.filter(s => s.status === 'done');
  const byParty = k => past.filter(s => s.status === k);
  const cS = byParty('cancelled_by_student'), cT = byParty('cancelled_by_tutor'), cA = byParty('cancelled_by_academy');
  const cancels = [...cS, ...cT, ...cA];
  const hours = done.reduce((a, s) => a + sMins(s), 0) / 60;
  const attend = done.length + cS.length + cT.length ? done.length / (done.length + cS.length + cT.length) : null;
  const makeups = rows.filter(s => s.makeup_of).length;
  const unrec = past.filter(needsConfirm).length;

  // أسباب
  const reasonCount = list => { const m = {}; list.forEach(s => { const k = s.cancel_reason || 'بدون سبب'; m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const rS = reasonCount(cS), rT = reasonCount(cT), rA = reasonCount(cA);
  const maxR = Math.max(1, ...[...rS, ...rT, ...rA].map(x => x[1]));

  // أسبوعي
  const weeks = {};
  past.forEach(s => { const w = dateStr(weekStart(dateStr(new Date(s.scheduled_at)))); const x = weeks[w] ||= { h: 0, c: 0 }; if (s.status === 'done') x.h += sMins(s) / 60; else if (s.status.startsWith('cancelled')) x.c++; });
  const wk = Object.entries(weeks).sort();
  const maxH = Math.max(1, ...wk.map(([, v]) => v.h));

  // الأسر
  const fam = {};
  past.forEach(s => { const st = byId(state.students, s.student_id); if (!st) return; const x = fam[st.family_id] ||= { d: 0, h: 0, c: 0, late: 0, ns: 0, other: 0 };
    if (s.status === 'done') { x.d++; x.h += sMins(s) / 60; }
    else if (s.status === 'cancelled_by_student') { x.c++; if (isLate(s)) x.late++; if (s.cancel_reason === 'لم يحضر') x.ns++; }
    else if (s.status.startsWith('cancelled')) x.other++; });
  const famRows = Object.entries(fam).map(([id, x]) => ({ f: byId(state.families, id), x, k: commitment(x.d, x.c) })).filter(r => r.f)
    .sort((a, b) => (a.k.rate ?? 1) - (b.k.rate ?? 1) || b.x.c - a.x.c);
  // المعلمين
  const tut = {};
  past.forEach(s => { const x = tut[s.tutor_id] ||= { d: 0, h: 0, c: 0, late: 0, ns: 0 };
    if (s.status === 'done') { x.d++; x.h += sMins(s) / 60; }
    else if (s.status === 'cancelled_by_tutor') { x.c++; if (isLate(s)) x.late++; if (s.cancel_reason === 'لم يحضر') x.ns++; } });
  const tutRows = Object.entries(tut).map(([id, x]) => ({ t: byId(state.tutors, id), x, k: commitment(x.d, x.c) })).filter(r => r.t)
    .sort((a, b) => (a.k.rate ?? 1) - (b.k.rate ?? 1) || b.x.c - a.x.c);

  el.innerHTML = `
    <div class="chips">${[['this', 'الشهر ده'], ['last', 'الشهر اللي فات'], ['3m', 'آخر 3 شهور'], ['year', 'السنة دي']].map(([k, l]) => `<button class="chip ${state.repPeriod === k ? 'active' : ''}" onclick="setRepPeriod('${k}')">${l}</button>`).join('')}</div>
    <div class="kpis">
      <div class="card kpi"><div class="l">حصص تمت</div><div class="v num">${done.length}</div><div class="s">${fmt(hours, 1)} ساعة تدريس</div></div>
      <div class="card kpi"><div class="l">نسبة الالتزام العامة</div><div class="v num ${attend == null ? '' : attend >= .9 ? 'pos' : attend >= .75 ? 'warn-txt' : 'neg'}">${attend == null ? '—' : Math.round(attend * 100) + '%'}</div><div class="s">حصص تمت ÷ (تمت + إلغاء أسرة/معلم)</div></div>
      <div class="card kpi"><div class="l">إلغاءات</div><div class="v num">${cancels.length}</div><div class="s">أسر ${cS.length} · معلمين ${cT.length} · أكاديمية ${cA.length}</div></div>
      <div class="card kpi"><div class="l">إلغاءات متأخرة</div><div class="v num ${cancels.filter(isLate).length ? 'neg' : ''}">${cancels.filter(isLate).length}</div><div class="s">أقل من ${LATE_HOURS} ساعات قبل الحصة</div></div>
      <div class="card kpi"><div class="l">لم يحضر</div><div class="v num">${cancels.filter(s => s.cancel_reason === 'لم يحضر').length}</div><div class="s">طلاب ${cS.filter(s => s.cancel_reason === 'لم يحضر').length} · معلمين ${cT.filter(s => s.cancel_reason === 'لم يحضر').length}</div></div>
      <div class="card kpi"><div class="l">حصص تعويضية</div><div class="v num">${makeups}</div><div class="s">${unrec ? `<span class="neg">${unrec} حصة لسه ماتسجلتش</span>` : 'كل الحصص متسجلة ✓'}</div></div>
    </div>

    ${wk.length ? `<div class="section-title"><h2>ساعات التدريس أسبوعياً</h2></div>
    <div class="card item">${wk.map(([w, v]) => `<div class="bar-row"><span class="bar-label">${new Date(parseDay(w)).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short' })}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${Math.max(3, v.h / maxH * 100)}%"></span></span><span class="num bar-val">${fmt(v.h, 1)} س${v.c ? ` <span class="neg small">· ${v.c} إلغاء</span>` : ''}</span></div>`).join('')}</div>` : ''}

    <div class="section-title"><h2>أسباب الإلغاء</h2></div>
    <div class="grid2">
      <div class="card item"><h3>👨‍👩‍👧 من الأسر (${cS.length})</h3>${rS.length ? bars(rS, maxR, 'fill-fam') : '<div class="sub small">مفيش</div>'}</div>
      <div class="card item"><h3>🧑‍🏫 من المعلمين (${cT.length})</h3>${rT.length ? bars(rT, maxR, 'fill-tut') : '<div class="sub small">مفيش</div>'}</div>
      ${rA.length ? `<div class="card item"><h3>🏫 من الأكاديمية (${cA.length})</h3>${bars(rA, maxR)}</div>` : ''}
    </div>

    <div class="section-title"><h2>التزام الأسر</h2></div>
    <div class="card scrollx"><table class="rep-table"><thead><tr><th>الأسرة</th><th>تمت</th><th>ألغت</th><th>متأخر</th><th>لم يحضر</th><th>الالتزام</th></tr></thead><tbody>
      ${famRows.map(({ f, x, k }) => `<tr class="clickable" onclick="openCommitDetail('family', ${jsq(f.id)})"><td>${esc(f.name)}<div class="sub small">${fmt(x.h, 1)} ساعة</div></td>
        <td class="num">${x.d}</td><td class="num ${x.c ? 'neg' : ''}">${x.c}</td><td class="num">${x.late || '—'}</td><td class="num">${x.ns || '—'}</td>
        <td><span class="badge ${k.cls}">${k.rate == null ? '' : Math.round(k.rate * 100) + '% · '}${k.label}</span></td></tr>`).join('') || '<tr><td colspan="6" class="empty">لا توجد بيانات في الفترة</td></tr>'}
    </tbody></table></div>

    <div class="section-title"><h2>التزام المعلمين</h2></div>
    <div class="card scrollx"><table class="rep-table"><thead><tr><th>المعلم</th><th>تمت</th><th>ألغى</th><th>متأخر</th><th>لم يحضر</th><th>الالتزام</th></tr></thead><tbody>
      ${tutRows.map(({ t, x, k }) => `<tr class="clickable" onclick="openCommitDetail('tutor', ${jsq(t.id)})"><td>${esc(t.name)}<div class="sub small">${fmt(x.h, 1)} ساعة</div></td>
        <td class="num">${x.d}</td><td class="num ${x.c ? 'neg' : ''}">${x.c}</td><td class="num">${x.late || '—'}</td><td class="num">${x.ns || '—'}</td>
        <td><span class="badge ${k.cls}">${k.rate == null ? '' : Math.round(k.rate * 100) + '% · '}${k.label}</span></td></tr>`).join('') || '<tr><td colspan="6" class="empty">لا توجد بيانات في الفترة</td></tr>'}
    </tbody></table></div>
    <p class="sub small">الالتزام = الحصص اللي تمت ÷ (اللي تمت + اللي الطرف ده لغاها). الإلغاء المتأخر = أقل من ${LATE_HOURS} ساعات قبل معاد الحصة. دوس على أي صف عشان تشوف التفاصيل.</p>`;
}
function openCommitDetail(kind, id) {
  const { rows, r } = state.rep;
  const list = rows.filter(s => s.status.startsWith('cancelled') && (kind === 'family' ? byId(state.students, s.student_id)?.family_id === id : s.tutor_id === id));
  const name = kind === 'family' ? byId(state.families, id)?.name : byId(state.tutors, id)?.name;
  openModal(`إلغاءات ${name} — ${r.label}`, list.length ? `<div class="list">${list.map(s => { const v = sessionView(s);
    return `<div class="card item"><div class="item-head"><div><b>${esc(v.st?.name || '')}</b> · ${esc(s.subject || '')} · ${esc(v.tu?.name || '')}
      <div class="sub small">${fmtDate(s.scheduled_at)} ${timeStr(new Date(s.scheduled_at))}</div></div><span class="badge b-cancel">${STATUS[s.status].label}</span></div>
      <div class="cancel-info mt">${cancelInfo(s) || 'بدون سبب مسجّل'}</div></div>`; }).join('')}</div>` : '<div class="empty">مفيش إلغاءات في الفترة 👌</div>');
}

/* ============================================================
   ملف الطالب (من البحث أو من كارت الحصة)
   ============================================================ */
async function openStudentProfile(studentId) {
  const st = byId(state.students, studentId); if (!st) return;
  const fam = byId(state.families, st.family_id);
  let rows = [];
  try { rows = await q(sb.from('sessions').select('*').eq('student_id', studentId).gte('scheduled_at', new Date(Date.now() - 90 * 864e5).toISOString()).order('scheduled_at')); } catch (e) {}
  const now = Date.now();
  const upcoming = rows.filter(s => s.status === 'scheduled' && sStart(s) > now).slice(0, 5);
  const recent = rows.filter(s => sStart(s) <= now || s.status !== 'scheduled').slice(-6).reverse();
  const d = rows.filter(s => s.status === 'done').length, c = rows.filter(s => s.status === 'cancelled_by_student').length;
  const k = commitment(d, c);
  const b = famBalance(fam);
  const line = s => { const v = sessionView(s); const bd = needsConfirm(s) ? { label: 'محتاجة تسجيل', cls: 'b-pending' } : STATUS[s.status];
    return `<button class="wk-row" onclick="closeModal(); setDayMode('day'); setDay(${jsq(dateStr(new Date(s.scheduled_at)))}); switchTab('daily')">
      <span class="num"><b>${new Date(s.scheduled_at).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short' })}</b> ${timeStr(new Date(s.scheduled_at))}</span>
      <span>${esc(s.subject || '')} <span class="sub small">${esc(v.tu?.name || '')} · ${durLabel(sMins(s))}</span></span><span class="badge ${bd.cls}">${bd.label}</span></button>`; };
  openModal(`${st.name}`, `
    <div class="sub mb">${esc(fam?.name || '')} · ${esc(st.grade_level)} · ${esc(CURRICULA[st.curriculum])}${st.default_price != null ? ` · ${fmt(st.default_price)} ${fam?.currency}/ساعة` : ''}</div>
    <div class="stats">
      <div class="card stat"><div class="v">${d}</div><div class="l">حصص تمت (90 يوم)</div></div>
      <div class="card stat"><div class="v">${c}</div><div class="l">إلغاءات الأسرة</div></div>
      <div class="card stat"><div class="v"><span class="badge ${k.cls}">${k.rate == null ? '—' : Math.round(k.rate * 100) + '%'}</span></div><div class="l">${k.label}</div></div>
      <div class="card stat"><div class="v num ${b.balance < 0 ? 'neg' : 'pos'}" style="font-size:16px">${fmt(b.balance, 0)} ${fam?.currency}</div><div class="l">رصيد الأسرة</div></div>
    </div>
    ${plansOf(st.id).length ? `<h3>المواد</h3><div class="plan-lines mb">${plansOf(st.id).map(p => `<span class="plan ${p.tutor_id ? '' : 'no-tutor'}">${esc(planLabel(p))}</span>`).join('')}</div>` : ''}
    ${st.notes ? `<div class="warn-note small mb">⚠️ ${esc(st.notes)}</div>` : ''}
    <h3>الحصص الجاية</h3>${upcoming.map(line).join('') || '<div class="sub small mb">مفيش حصص جاية محجوزة</div>'}
    <h3 class="mt">آخر الحصص</h3>${recent.map(line).join('') || '<div class="sub small">لا يوجد</div>'}
    <div class="modal-foot" style="flex-wrap:wrap">
      <button class="btn btn-brand" onclick="openSessionForm(null, {student_id:${jsq(st.id)}})">+ حصة</button>
      <button class="btn btn-wa" onclick="openFamilyInvoice(${jsq(st.family_id)})">📄 فاتورة الأسرة</button>
      <button class="btn btn-ghost" onclick="openStudentForm(${jsq(st.family_id)}, ${jsq(st.id)})">تعديل</button>
    </div>`);
}

/* ============================================================
   بحث شامل من أعلى الشاشة
   ============================================================ */
function openGlobalSearch() {
  openModal('بحث', `<input id="gs-input" class="input" placeholder="🔍 اسم طالب، أسرة، معلم، أو مادة…" autocomplete="off">
    <div id="gs-results" class="list mt"></div>`);
  const inp = document.getElementById('gs-input');
  const run = () => {
    const qn = normAr(inp.value); const words = qn.split(' ').filter(Boolean);
    const out = document.getElementById('gs-results');
    if (!words.length) { out.innerHTML = '<div class="sub small">ابدأ اكتب…</div>'; return; }
    const match = t => words.every(w => normAr(t).includes(w));
    const studs = state.students.filter(s => { const f = byId(state.families, s.family_id); return match(`${s.name} ${f?.name || ''} ${plansOf(s.id).map(p => p.subject).join(' ')}`); }).slice(0, 12);
    const fams = state.families.filter(f => match(`${f.name} ${f.parent_name || ''}`)).slice(0, 6);
    const tuts = state.tutors.filter(t => match(`${t.name} ${state.subjects.filter(x => x.tutor_id === t.id).map(x => x.subject).join(' ')}`)).slice(0, 8);
    out.innerHTML = [
      studs.length ? `<div class="sub small">طلاب</div>` + studs.map(s => `<button class="wk-row" onclick="openStudentProfile(${jsq(s.id)})"><span>🎒</span><span><b>${esc(s.name)}</b> <span class="sub small">${esc(byId(state.families, s.family_id)?.name || '')} · ${esc(s.grade_level)}</span></span><span></span></button>`).join('') : '',
      fams.length ? `<div class="sub small mt">أسر</div>` + fams.map(f => `<button class="wk-row" onclick="closeModal(); switchTab('families'); document.getElementById('family-search').value=${jsq(f.name)}; renderFamilies()"><span>👨‍👩‍👧</span><span><b>${esc(f.name)}</b> <span class="sub small">${esc(f.country)}</span></span><span></span></button>`).join('') : '',
      tuts.length ? `<div class="sub small mt">معلمين</div>` + tuts.map(t => `<button class="wk-row" onclick="closeModal(); switchTab('tutors'); document.getElementById('tutor-search').value=${jsq(t.name)}; renderTutors()"><span>🧑‍🏫</span><span><b>${esc(t.name)}</b></span><span></span></button>`).join('') : '',
    ].join('') || '<div class="empty">مفيش نتايج</div>';
  };
  inp.addEventListener('input', run); run(); setTimeout(() => inp.focus(), 50);
}

/* ============================================================
   قائمة الإعدادات + الوضع الليلي
   ============================================================ */
function applyTheme(t) {
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
}
try { applyTheme(localStorage.getItem('ostaz_theme')); } catch (e) {}
function setTheme(t) { try { localStorage.setItem('ostaz_theme', t); } catch (e) {} applyTheme(t); openMenu(); }
function openMenu() {
  let t = 'auto'; try { t = localStorage.getItem('ostaz_theme') || 'auto'; } catch (e) {}
  openModal('الإعدادات', `
    <div class="sub small mb">${esc(currentSupervisor?.name || '')} · ${isAdmin ? 'أدمن' : 'مشرف'}</div>
    <div class="list">
      <button class="wk-row" onclick="openAlertsPanel()"><span>🔔</span><span><b>إشعارات الحصص</b></span><span></span></button>
      ${isAdmin ? `<button class="wk-row" onclick="closeModal(); switchTab('admin')"><span>🛡️</span><span><b>إدارة المشرفين</b> <span class="sub small">موافقة وصلاحيات</span></span><span></span></button>
      <button class="wk-row" onclick="closeModal(); switchTab('fin'); setTimeout(openFxForm, 400)"><span>💱</span><span><b>أسعار الصرف</b></span><span></span></button>` : ''}
    </div>
    <div class="field mt"><label>المظهر</label><div class="seg-wrap">
      ${[['auto', 'تلقائي'], ['light', '☀️ فاتح'], ['dark', '🌙 غامق']].map(([k, l]) => `<button class="chip ${t === k ? 'active' : ''}" onclick="setTheme('${k}')">${l}</button>`).join('')}
    </div></div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal(); signOut()">تسجيل الخروج</button></div>`);
}

/* ============================================================
   قائمة إجراءات الحصة (⋯)
   ============================================================ */
function openSessionActions(id) {
  const s = findSession(id); if (!s) return;
  const v = sessionView(s), open = s.status === 'scheduled' || s.status === 'in_progress', cancelled = s.status.startsWith('cancelled');
  const I = jsq(id);
  const a = (icon, label, fn, cls = '') => `<button class="wk-row ${cls}" onclick="closeModal(); ${fn}"><span>${icon}</span><span><b>${label}</b></span><span></span></button>`;
  openModal(`${v.st?.name || ''} · ${timeStr(new Date(s.scheduled_at))}`, `<div class="list">
    ${s.status === 'scheduled' ? a('▶', 'الحصة بدأت', `setStatus(${I},'in_progress')`) : ''}
    ${open ? a('🔁', 'تأجيل / تغيير الموعد', `openPostpone(${I})`) : ''}
    ${open ? a('✖', 'إلغاء…', `openCancel(${I})`) : ''}
    ${s.status === 'done' ? a('⏱', 'تعديل المدة الفعلية', `openDone(${I})`) : ''}
    ${cancelled ? a('📅', 'حجز حصة تعويضية', `openSessionForm(null, {student_id:${jsq(s.student_id)}, tutor_id:${jsq(s.tutor_id)}, subject:${jsq(s.subject || '')}, makeup_of:${I}, duration:${s.duration_minutes || 60}})`) : ''}
    ${s.status === 'done' || cancelled ? a('↺', 'إرجاع لمجدولة', `setStatus(${I},'scheduled')`) : ''}
    ${a('✏️', 'تعديل الحصة', `openSessionForm(${I})`)}
    ${a('🔁', 'مهمة ترحيل', `openRelayForm({student_id:${jsq(s.student_id)}, session_id:${I}, tutor_id:${jsq(s.tutor_id)}})`)}
    ${a('🎒', 'ملف الطالب', `openStudentProfile(${jsq(s.student_id)})`)}
    ${isAdmin ? a('🗑', 'حذف الحصة', `deleteSession(${I})`, 'danger-row') : ''}
  </div>`);
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
  // إدارة المشرفين بقت من قائمة الإعدادات ⚙️
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
