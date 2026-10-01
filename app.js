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
const KINDS = { regular: 'حصة', revision: 'مراجعة', trial: 'تجريبية', group: 'مجموعة' };
const kindWord = s => KINDS[s.kind] || 'حصة';
const kindBadge = s => s.kind === 'revision' ? '<span class="badge b-rev">مراجعة</span>' : s.kind === 'trial' ? '<span class="badge b-trial">🧪 تجريبية</span>' : s.kind === 'group' ? '<span class="badge b-group">👥 مجموعة</span>' : '';
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
function allLoadedSessions() { return [...state.daySessions, ...(state.weekSessions || []), ...(state.unrecorded || []), ...(state.pendingTrials || []), ...(state.nextSession ? [state.nextSession] : [])]; }
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
    const n = occurrences(all.filter(f.f)).length;
    if (!n && !['all', 'done'].includes(f.k) && state.dayFilter !== f.k) return '';
    return `<button class="chip ${state.dayFilter === f.k ? 'active' : ''} ${f.k === 'confirm' && n ? 'warn' : ''}" onclick="setDayFilter('${f.k}')">${f.l} (${n})</button>`;
  }).join('');

  const active = all.filter(s => !s.status.startsWith('cancelled'));
  const hours = occurrences(active).reduce((a, s) => a + sMins(s), 0) / 60;
  const margin = active.reduce((a, s) => a + charges(s).margin, 0);
  document.getElementById('day-stats').innerHTML = `
    <div class="card stat"><div class="v">${occurrences(all).length}</div><div class="l">حصص اليوم</div></div>
    <div class="card stat"><div class="v">${occurrences(all.filter(s => s.status === 'done')).length}</div><div class="l">تمت</div></div>
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
  el.innerHTML = occurrences(list).map(o => o.group_key ? groupCard(all.filter(x => x.group_key === o.group_key)) : sessionCard(o)).join('');
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
          <div class="item-title">${esc(st?.name || 'طالب محذوف')} ${kindBadge(s)}${s.makeup_of ? ' <span class="badge b-makeup">تعويضية</span>' : ''}</div>
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
      ${trialOutcomeLine(s)}
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
        ${s.kind === 'trial' && s.status === 'done' ? `<button class="btn ${s.trial_outcome && s.trial_outcome !== 'thinking' ? 'btn-ghost' : 'btn-brand'} sm" onclick="openTrialOutcome(${id})">🧪 ${s.trial_outcome ? 'تعديل النتيجة' : 'نتيجة التجربة'}</button>` : ''}
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
  if (s.group_key) return openGroupDone(s.group_key);
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
    if (s.kind === 'trial' && !s.trial_outcome) openTrialOutcome(s.id);
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
  const kindLine = s.kind === 'group' ? `\n👥 حصة مجموعة${s.group_name ? ': ' + s.group_name : ''}` : s.kind === 'revision' ? '\n📝 حصة مراجعة' : s.kind === 'trial' ? `\n🧪 حصة تجريبية${who === 'parent' ? ' مجانية' : ''} — ${who === 'parent' ? 'فرصة تتعرفوا فيها على المعلمة' : 'طالب جديد: ركّزي على التعارف وتحديد المستوى'}` : '';
  const durLine = (s.duration_minutes || 60) !== 60 || s.kind !== 'regular' ? `\n⏳ المدة: ${durLabel(s.duration_minutes || 60)}` : '';
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
  if (s.group_key) return openGroupReminder(s.group_key, who);
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
  if (s?.group_key) return openGroupForm(s.group_key);
  if (prefill.kind === 'group') return openGroupForm(null, { tutor_id: prefill.tutor_id, subject: prefill.subject, day: prefill.day, students: prefill.student_id ? [prefill.student_id] : [] });
  const when = s ? new Date(s.scheduled_at) : (() => {
    const d = parseDay(prefill.day || state.day); const n = new Date(); d.setHours(Math.min(n.getHours() + 1, 22), 0, 0, 0); return d; })();
  const kind = s?.kind || prefill.kind || 'regular';
  const fields = [
    { name: 'kind', label: 'نوع الحصة', type: 'select', value: kind, options: [{ v: 'regular', l: 'حصة عادية' }, { v: 'trial', l: '🧪 تجريبية مجانية (نص ساعة)' }, { v: 'revision', l: 'مراجعة (وقت ومدة مرنين)' }, ...(s ? [] : [{ v: 'group', l: '👥 مجموعة (أكتر من طالب)' }])] },
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
  let prevKind = $('kind').value;
  const kindChanged = () => {
    const k = $('kind').value;
    if (k === 'group') { closeModal(); return openGroupForm(null, { tutor_id: tuSel.value, subject: $('subject').value, day: $('date').value, students: stSel.value ? [stSel.value] : [] }); }
    const rep = document.getElementById('wrap_repeat'); if (rep) rep.classList.toggle('hidden', k !== 'regular');
    if (k === 'revision' && !s && Number(durIn.value) === 60) durIn.value = 120;
    const priceIn = $('student_price');
    if (k === 'trial') {
      if (!s || prevKind !== 'trial') { durIn.value = 30; priceIn.value = 0; }
      priceIn.readOnly = true;
      document.getElementById('hint_student_price').textContent = 'مجانية للأسرة';
      document.getElementById('hint_tutor_cost_egp') || document.getElementById('wrap_tutor_cost_egp').insertAdjacentHTML('beforeend', '<div class="hint" id="hint_tutor_cost_egp"></div>');
      document.getElementById('hint_tutor_cost_egp').textContent = 'أجر الساعة — بيتحسب على نص ساعة. خليه 0 لو المعلمة مش بتاخد عن التجريبية.';
    } else {
      priceIn.readOnly = false;
      if (prevKind === 'trial') { const st = byId(state.students, stSel.value); priceIn.value = st?.default_price ?? ''; if (Number(durIn.value) === 30) durIn.value = k === 'revision' ? 120 : 60; }
      const h = document.getElementById('hint_tutor_cost_egp'); if (h) h.textContent = '';
      updateHints(false);
    }
    prevKind = k;
    totals();
  };
  $('kind').addEventListener('change', kindChanged);
  ['input', 'change'].forEach(ev => [durIn, $('student_price'), $('tutor_cost_egp')].forEach(el => el.addEventListener(ev, totals)));

  const applyPlan = (p) => {
    $('subject').value = p.subject;
    if (p.tutor_id) {
      tuSel.value = p.tutor_id;
      const t = byId(state.tutors, p.tutor_id);
      if (p.tutor_rate_egp != null) $('tutor_cost_egp').value = p.tutor_rate_egp;
      else if (t && t.default_rate_egp != null) $('tutor_cost_egp').value = t.default_rate_egp;
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
    if (fill && st && st.default_price != null && $('kind').value !== 'trial') $('student_price').value = st.default_price;
    if ($('kind').value === 'trial') document.getElementById('hint_student_price').textContent = 'مجانية للأسرة';
    totals();
  };
  stSel.addEventListener('change', () => { updateHints(true); renderPicks(true); });
  tuSel.addEventListener('change', () => {
    const t = byId(state.tutors, tuSel.value);
    const pr = plansOf(stSel.value).find(p => p.tutor_id === tuSel.value && p.tutor_rate_egp != null);
    if (pr) $('tutor_cost_egp').value = pr.tutor_rate_egp;
    else if (t && t.default_rate_egp != null) $('tutor_cost_egp').value = t.default_rate_egp;
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
    if (row.kind === 'trial') row.student_price = 0;
    const n = s || row.kind !== 'regular' ? 1 : Number(fv('repeat') || 1);
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
      if (st.default_price == null && row.kind !== 'trial') await sb.from('students').update({ default_price: row.student_price }).eq('id', st.id);
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
  const ws = (state.weekSessions || []).filter(s => !s.status.startsWith('cancelled') && s.kind !== 'trial');
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
      <div class="card stat"><div class="v">${occurrences(active).length}</div><div class="l">حصص الأسبوع</div></div>
      <div class="card stat"><div class="v num">${fmt(occurrences(active).reduce((a, s) => a + sMins(s), 0) / 60, 1)}</div><div class="l">ساعة</div></div>
      <div class="card stat"><div class="v num">${totalNeed ? Math.round(totalBooked / totalNeed * 100) : 0}%</div><div class="l">من خطط الطلاب محجوزة</div></div>
      <div class="card stat"><div class="v">${occurrences(ws.filter(needsConfirm)).length}</div><div class="l">محتاجة تسجيل</div></div>
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
      const list = occurrences(ws.filter(s => dateStr(new Date(s.scheduled_at)) === ds));
      const label = d.toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' });
      return `<div class="card item week-day ${ds === todayStr() ? 'is-today' : ''}">
        <div class="item-head">
          <a href="javascript:void(0)" class="item-title" onclick="setDayMode('day'); setDay(${jsq(ds)})">${label}${ds === todayStr() ? ' · النهارده' : ''}</a>
          <span class="row-gap" style="align-items:center"><span class="sub small">${list.length ? `${list.length} حصة · ${fmt(list.filter(s => s._members ? s._members.some(m => !isCancelled(m)) : !isCancelled(s)).reduce((a, s) => a + sMins(s), 0) / 60, 1)} ساعة` : 'فاضي'}</span>
          <button class="btn btn-ghost sm icon" title="حصة في اليوم ده" onclick="openSessionForm(null, {day:${jsq(ds)}})">+</button></span>
        </div>
        ${list.map(s => { const v = sessionView(s); const b = s.group_key ? groupStatus(s._members) : needsConfirm(s) ? { label: 'محتاجة تسجيل', cls: 'b-pending' } : STATUS[s.status];
          return `<button class="wk-row" onclick="${s.group_key ? `openGroupActions(${jsq(s.group_key)})` : `openSessionForm(${jsq(s.id)})`}">
            <span class="num"><b>${timeStr(new Date(s.scheduled_at))}</b> <span class="sub small">${durLabel(sMins(s))}</span></span>
            <span>${s.group_key ? `👥 ${esc(s.group_name || 'مجموعة')} <span class="sub small">(${esc(groupNames(s._members))})</span>` : esc(v.st?.name || '') + ' ' + kindBadge(s)} <span class="sub small">${esc(s.subject || '')} · ${esc(v.tu?.name || '')}</span></span>
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
        <button class="btn btn-ghost sm" onclick="openSchedule('family', ${fid})">📋 الجدول</button>
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
    [{ name: 'default_price', label: `سعر الساعة برايفت (${fam.currency})`, type: 'number', value: s?.default_price, hint: 'بيتحسب على المدة الفعلية (ساعة ونص = 1.5 × السعر).' },
     { name: 'group_price', label: `سعر الساعة في المجموعة (${fam.currency})`, type: 'number', value: s?.group_price, hint: 'اختياري — لو بياخد حصص مجموعات.' }],
    { name: 'notes', label: 'ملاحظات', type: 'textarea', value: s?.notes },
  ];
  const plans = s ? plansOf(s.id) : [];
  const planBlock = `<div class="field"><label>المواد والمعلمين</label>
    <datalist id="subj-list2">${SUBJECT_LIST.map(x => `<option value="${x}">`).join('')}</datalist>
    <div class="plan-head small sub"><span>المادة</span><span>بالأسبوع</span><span>المعلم</span><span>أجره/س</span><span></span></div>
    <div id="plan-rows">${(plans.length ? plans : [{}]).map(planRowHtml).join('')}</div>
    <button type="button" class="btn btn-ghost sm" onclick="document.getElementById('plan-rows').insertAdjacentHTML('beforeend', planRowHtml())">+ مادة</button></div>`;
  const del = s && isAdmin ? `<button type="button" class="btn btn-danger" style="margin-top:6px" onclick="closeModal(); confirmDelete(${jsq('الطالب ' + s.name)}, () => q(sb.from('students').delete().eq('id', ${jsq(s.id)})))">حذف الطالب</button>` : '';
  openModal(`${s ? 'تعديل طالب' : 'طالب جديد'} — ${fam.name}`, formHtml(fields, 'حفظ', planBlock + del));
  window._formSubmit = () => runSubmit(async () => {
    const row = { family_id: familyId, name: fv('name'), grade_level: fv('grade_level'), curriculum: fv('curriculum'), default_price: fnum('default_price'), group_price: fnum('group_price'), notes: fv('notes') || null };
    let sid = s?.id;
    if (s) await q(sb.from('students').update(row).eq('id', s.id));
    else { const [ns] = await q(sb.from('students').insert(row).select()); sid = ns.id; }
    const rows = [...document.querySelectorAll('#plan-rows .plan-row')].map(r => ({
      student_id: sid, subject: r.querySelector('.pl-subject').value.trim(),
      weekly_sessions: r.querySelector('.pl-weekly').value ? Number(r.querySelector('.pl-weekly').value) : null,
      tutor_id: r.querySelector('.pl-tutor').value || null,
      tutor_rate_egp: r.querySelector('.pl-rate').value ? Number(r.querySelector('.pl-rate').value) : null,
    })).filter(x => x.subject);
    if (s) await q(sb.from('student_subjects').delete().eq('student_id', sid));
    if (rows.length) await q(sb.from('student_subjects').insert(rows));
    closeModal(); showToast('تم الحفظ ✓'); await refreshAll();
  });
}
function planRowHtml(p = {}) {
  return `<div class="plan-row">
    <input class="input pl-subject" placeholder="المادة" value="${esc(p.subject || '')}" list="subj-list2">
    <input class="input pl-weekly" type="number" min="1" max="14" inputmode="numeric" placeholder="×أسبوع" value="${esc(p.weekly_sessions ?? '')}">
    <select class="input pl-tutor"><option value="">— بدون —</option>${state.tutors.map(t => `<option value="${esc(t.id)}" ${t.id === p.tutor_id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
    <input class="input pl-rate" type="number" min="0" step="5" inputmode="numeric" placeholder="أجر/س" title="أجر المعلم في الساعة للطالب ده (لو مختلف عن أجره الافتراضي)" value="${esc(p.tutor_rate_egp ?? '')}">
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
      ...ss.map(s => ({ at: s.scheduled_at, desc: `${kindWord(s)} ${byId(state.students, s.student_id)?.name || ''}${s.subject ? ' — ' + s.subject : ''} (${durLabel(sMins(s))})`, amt: -charges(s).fam, kind: 'session' })),
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
      return `• ${new Date(s.scheduled_at).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'numeric', timeZone: c.tz })} — ${v.st?.name || ''}${s.subject ? ': ' + s.subject : ''}${s.kind === 'regular' ? '' : ` (${kindWord(s)})`} — ${durLabel(sMins(s))} = ${s.kind === 'trial' ? 'مجانية 🎁' : `${fmt(charges(s).fam, 2)} ${f.currency}`}`; }).join('\n');
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
    const oc = occurrences(ss);
    const earned = ss.reduce((a, s) => a + charges(s).tut, 0), mins = oc.reduce((a, s) => a + sMins(s), 0);
    const paid = po.reduce((a, p) => a + Number(p.total_egp), 0);
    const b = tutBalance(t);
    const label = r.fromD.getDate() === 1 && new Date(r.toD.getTime() - 1).getMonth() === r.fromD.getMonth()
      ? `شهر ${r.fromD.toLocaleDateString('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' })}` : `الفترة ${r.from} إلى ${r.toIncl}`;
    const lines = oc.map(s => `• ${new Date(s.scheduled_at).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'numeric' })} — ${occWho(s)}${s.subject ? ' (' + s.subject + ')' : ''}${s.kind === 'regular' || s.kind === 'group' ? '' : ' ' + kindWord(s)} — ${durLabel(sMins(s))} = ${fmt(occTut(s), 2)} ج`).join('\n');
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
        <button class="btn btn-ghost sm" onclick="openSchedule('tutor', ${tid})">📋 الجدول</button>
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
      ...occurrences(ss).map(s => ({ at: s.scheduled_at, desc: `${s.group_key ? '' : kindWord(s) + ' '}${occWho(s)}${s.subject ? ' — ' + s.subject : ''} (${durLabel(sMins(s))})`, amt: occTut(s) })),
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
  const hoursDone = occurrences(done).reduce((a, s) => a + sMins(s), 0) / 60;
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
  occurrences(done).forEach(s => { const x = perTutor[s.tutor_id] ||= { n: 0, egp: 0, h: 0 }; x.n++; x.h += sMins(s) / 60; x.egp += occTut(s); });
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
      <div class="card kpi"><div class="l">إيراد الحصص اللي تمت</div><div class="v num">${fmt(rev)}</div><div class="s">EGP بسعر السوق يوم الحصة · ${occurrences(done).length} ${occurrences(done).length > 2 && occurrences(done).length < 11 ? 'حصص' : 'حصة'} · ${fmt(hoursDone, 1)} ساعة</div></div>
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
const isAndroid = /Android/i.test(navigator.userAgent);
const isBrave = () => !!navigator.brave;
const ANDROID_HELP = `<details class="mt" open><summary><b>📱 أندرويد: عشان التنبيه يوصل والموبايل مقفول</b></summary>
  <ol class="steps small">
    <li>استخدم <b>Google Chrome</b>. لو بتستخدم <b>Brave</b>: افتح brave://settings/privacy وفعّل <b>"Use Google services for push messaging"</b>، وإلا الإشعارات مش هتوصل خالص.</li>
    <li>ثبّت اللوحة: قائمة Chrome <b>⋮</b> ← <b>"إضافة إلى الشاشة الرئيسية" / Install app</b>، وافتحها من الأيقونة.</li>
    <li>الإعدادات ← التطبيقات ← <b>Chrome</b> ← الإشعارات: مسموح، وخلي إشعارات موقع اللوحة على <b>"تنبيه / صوت"</b> مش "صامت".</li>
    <li>الإعدادات ← التطبيقات ← <b>Chrome</b> ← البطارية: <b>"غير مقيّد / Unrestricted"</b> (مهم جداً في شاومي، أوبو، ريلمي، هواوي، سامسونج).</li>
    <li>شاومي/ريدمي: فعّل <b>"التشغيل التلقائي / Autostart"</b> لـ Chrome. سامسونج: شيل Chrome من <b>"التطبيقات النائمة"</b>.</li>
    <li>اتأكد إن "عدم الإزعاج" مقفول، وبعدها جرّب زرار <b>"تجربة والتطبيق مقفول"</b> واقفل الشاشة.</li>
  </ol></details>`;
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
  } catch (e) {
    const m = String(e.message || e);
    if (/push service|Registration failed|AbortError/i.test(m) && (isBrave() || isAndroid)) {
      showToast(isBrave() ? 'Brave قافل خدمة الإشعارات: فعّل "Use Google services for push messaging" من brave://settings/privacy أو استخدم Chrome' : 'خدمة الإشعارات مش متاحة: اتأكد إن Google Play Services شغالة أو جرّب Chrome', true);
    } else showToast('تعذر التفعيل: ' + m, true);
  }
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
/* ----- منبه بصوت عالي عبر تطبيق ntfy (مجاني) ----- */
async function loadAlarm() { try { return (await q(sb.from('alarm_channels').select('*').eq('user_id', currentUser.id)))[0] || null; } catch (e) { return null; } }
function newAlarmTopic() { const a = crypto.getRandomValues(new Uint8Array(18)); return 'ostaz-' + [...a].map(b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join(''); }
async function enableAlarm() {
  try { await q(sb.from('alarm_channels').insert({ user_id: currentUser.id, ntfy_topic: newAlarmTopic(), enabled: true })); await openAlertsPanel(); document.getElementById('alarm-box')?.scrollIntoView({ block: 'start' }); }
  catch (e) { showToast(dbError(e), true); }
}
async function setAlarmEnabled(v) {
  try { await q(sb.from('alarm_channels').update({ enabled: v }).eq('user_id', currentUser.id)); await openAlertsPanel(); } catch (e) { showToast(dbError(e), true); }
}
async function testAlarm(delay) {
  showToast(delay ? 'اقفل الموبايل دلوقتي 🔒 — هيرن خلال 20 ثانية' : 'جاري الإرسال…');
  try {
    const { data, error } = await sb.functions.invoke('session-alerts', { body: { action: 'alarm_test', delay } });
    if (error) throw error;
    const ok = (data.sent || []).some(r => r.status >= 200 && r.status < 300);
    if (!delay || !ok) showToast(ok ? 'اتبعت ✓ لو ماسمعتش حاجة راجع إنك مشترك في القناة في تطبيق ntfy' : 'فشل الإرسال — جرّب تاني', !ok);
  } catch (e) { showToast('فشل الإرسال: ' + (e.message || e), true); }
}
function alarmHtml(ch) {
  const help = `<p class="sub small" style="margin:0 0 8px">تنبيه إضافي من تطبيق <b>ntfy</b> المجاني بيرن بصوت عالي قبل الحصة بـ 15 دقيقة وعند بدايتها، حتى والموبايل مقفول وبعيد عنك. على أندرويد ممكن يفضل يرن زي المنبه لحد ما تفتحه.</p>`;
  if (!ch) return `<div id="alarm-box"><b>🔊 منبه بصوت عالي (مجاني)</b>${help}<button class="btn btn-brand sm" onclick="enableAlarm()">تفعيل المنبه</button></div>`;
  const t = ch.ntfy_topic;
  return `<div id="alarm-box"><div class="item-head"><b>🔊 منبه بصوت عالي (ntfy)</b>
      <span class="badge ${ch.enabled ? 'b-done' : 'b-cancel'}">${ch.enabled ? (ch.last_ok_at ? 'شغال' : 'مستني الاشتراك') : 'متوقف'}</span></div>${help}
    <ol class="steps small">
      <li>نزّل تطبيق <b>ntfy</b>: ${isIOS ? '' : '<a href="https://play.google.com/store/apps/details?id=io.heckel.ntfy" target="_blank" rel="noopener">أندرويد (Google Play)</a>'}${!isIOS && !isAndroid ? ' · ' : ''}${isAndroid ? '' : '<a href="https://apps.apple.com/app/ntfy/id1625396347" target="_blank" rel="noopener">آيفون (App Store)</a>'}</li>
      <li>اشترك في قناتك: ${isAndroid ? `<a class="btn btn-ghost sm" href="ntfy://ntfy.sh/${esc(t)}">فتح في ntfy واشتراك</a> أو ` : ''}افتح ntfy ودوس <b>+</b> والصق اسم القناة ده:
        <div class="row-gap mt"><code dir="ltr" style="user-select:all;padding:4px 8px;border-radius:6px;background:var(--bg)">${esc(t)}</code>
        <button class="btn btn-ghost sm" onclick="copyText(${jsq(t)}, 'تم نسخ اسم القناة ✓')">نسخ</button></div></li>
      ${isIOS ? `<li>لما يسألك اسمح بالإشعارات، ومن إعدادات الآيفون ← الإشعارات ← ntfy فعّل <b>الأصوات</b> و<b>Time Sensitive</b>.</li>`
        : `<li>في ntfy: ⋮ ← <b>Settings</b> ← Notifications ← فعّل <b>"Keep alerting for highest priority"</b> عشان يفضل يرن لحد ما تفتحه.</li>
           <li>من إعدادات الموبايل ← التطبيقات ← ntfy ← البطارية ← <b>بدون قيود</b>.</li>`}
      <li>جرّب: دوس "تجربة بعد 20 ثانية" واقفل الشاشة.</li>
    </ol>
    <div class="modal-foot" style="flex-wrap:wrap;position:static;padding:8px 0 0">
      <button class="btn btn-brand sm" onclick="testAlarm(20)">🔒 تجربة بعد 20 ثانية</button>
      <button class="btn btn-ghost sm" onclick="testAlarm(0)">رن دلوقتي</button>
      <button class="btn btn-ghost sm" onclick="setAlarmEnabled(${!ch.enabled})">${ch.enabled ? 'إيقاف المنبه' : 'تشغيل المنبه'}</button>
    </div>
    <p class="sub small">اسم القناة سري وخاص بيك — ماتبعتهوش لحد.</p></div>`;
}
async function openAlertsPanel() {
  const on = await refreshAlertIcon();
  const alarmCh = await loadAlarm();
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
    body = `<p>المتصفح ده مش بيدعم الإشعارات في الخلفية. جرّب Chrome على أندرويد أو الكمبيوتر، أو Safari على الآيفون بعد تثبيت اللوحة على الشاشة الرئيسية.</p>${isAndroid ? ANDROID_HELP : ''}`;
  } else if (Notification.permission === 'denied') {
    body = `<p class="neg"><b>الإشعارات مقفولة للوحة دي من إعدادات الجهاز/المتصفح.</b></p>
      <p>${isIOS ? 'افتح الإعدادات ← الإشعارات ← "أستاذ أونلاين" ← فعّل السماح بالإشعارات والأصوات.' : 'دوس على القفل 🔒 جنب الرابط ← الأذونات ← الإشعارات ← سماح، وبعدين حدّث الصفحة.'}</p>${isAndroid ? ANDROID_HELP : ''}`;
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
        </ol></details>` : ''}${isAndroid ? ANDROID_HELP.replace('<details class="mt" open>', '<details class="mt">') : ''}`;
  } else {
    body = `<p>فعّل الإشعارات عشان يوصلك تنبيه <b>قبل كل حصة بـ 15 دقيقة وعند موعدها</b> — حتى والتطبيق مقفول والموبايل مقفول.</p>
      <div class="modal-foot"><button class="btn btn-brand" id="push-enable" onclick="enablePush()">🔔 تفعيل الإشعارات</button></div>
      ${isAndroid && isBrave() ? '<p class="warn-txt small">⚠️ إنت على Brave: قبل التفعيل افتح brave://settings/privacy وفعّل "Use Google services for push messaging".</p>' : ''}${isAndroid ? ANDROID_HELP : ''}`;
  }
  body += `<hr class="sep">${alarmHtml(alarmCh)}`;
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
  state.pendingTrials = await q(sb.from('sessions').select('*').eq('kind', 'trial').eq('status', 'done')
    .or('trial_outcome.is.null,trial_outcome.eq.thinking').gte('scheduled_at', new Date(now.getTime() - 45 * 864e5).toISOString()).order('scheduled_at'));
}
function renderAttention() {
  const el = document.getElementById('attention'); if (!el) return;
  const items = [];
  const ns = state.nextSession;
  if (ns) {
    const v = sessionView(ns); if (ns.group_key) v.st = { name: '👥 ' + (ns.group_name || 'مجموعة') }; const mins = Math.round((sStart(ns) - Date.now()) / 60e3);
    items.push(`<button class="att att-next" onclick="setDayMode('day'); setDay(todayStr())">⏰ الجاية: <b>${esc(v.st?.name || '')}</b> ${esc(ns.subject || '')} — ${timeStr(new Date(ns.scheduled_at))} <span class="sub">(${mins < 60 ? `بعد ${mins} د` : `بعد ${durLabel(Math.round(mins / 5) * 5)}`})</span></button>`);
  }
  const un = state.unrecorded || [];
  if (un.length) items.push(`<button class="att att-warn" onclick="openUnrecorded()">⏳ <b>${occurrences(un).length}</b> حصة عدّت ولسه ماتسجلتش</button>`);
  const pt = (state.pendingTrials || []).length;
  if (pt) items.push(`<button class="att att-warn" onclick="openPendingTrials()">🧪 <b>${pt}</b> تجريبية مستنية نتيجة</button>`);
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
  openModal(`حصص محتاجة تسجيل (${occurrences(un).length})`, `
    <p class="sub">دي حصص معادها عدّى ولسه متسجلتش "تمت" أو "ملغاة". الحصة مش بتتحسب على الأسرة ولا للمعلم غير لما تتسجل.</p>
    <div class="list">${occurrences(un).map(s => { const v = sessionView(s); return `<div class="card item">
      <div class="item-head"><div><b>${esc(s.group_key ? occWho(s) : v.st?.name || '')}</b> <span class="sub small">${s.group_key ? '' : esc(v.fam?.name || '')}</span>
        <div class="small">${fmtShortDate(s.scheduled_at)} · ${timeStr(new Date(s.scheduled_at))} · ${durLabel(sMins(s))} · ${esc(s.subject || '')} · ${esc(v.tu?.name || '')}</div></div></div>
      <div class="actions"><button class="btn btn-ok sm" onclick="openDone(${jsq(s.id)})">✓ تمت…</button>
        <button class="btn btn-ghost sm" onclick="${s.group_key ? `openGroupCancel(${jsq(s.group_key)})` : `openCancel(${jsq(s.id)})`}">اتلغت…</button></div></div>`; }).join('') || '<div class="empty">مفيش 👌</div>'}</div>`);
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
  const lines = occurrences(list).map(s => { const v = sessionView(s);
    return `• ${fmtTime(s.scheduled_at, CAIRO_TZ)} – ${fmtTime(new Date(sStart(s) + (s.duration_minutes || 60) * 60e3).toISOString(), CAIRO_TZ)}: ${s.group_key ? `👥 ${s.group_name || 'مجموعة'}: ${groupNames(s._members)}` : `${v.st?.name || ''} (${v.st?.grade_level || ''})`}${s.subject ? ' — ' + s.subject : ''}${s.kind === 'regular' || s.kind === 'group' ? '' : ` [${kindWord(s)}]`}${s.meeting_link ? `\n   🔗 ${linkHref(s.meeting_link)}` : ''}`; }).join('\n');
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
    return msgBlock(`${tu?.name || ''} — ${occurrences(ss).length} حصة`, tutorDayMessage(tu, ss, ss[0].scheduled_at || dayIso),
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
      return `• ${fmtTime(s.scheduled_at, c.tz)} — ${v.st?.name || ''}${s.subject ? ': ' + s.subject : ''} (${durLabel(s.duration_minutes || 60)})${s.kind === 'regular' ? '' : ' — ' + kindWord(s)}`; }).join('\n');
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
    const lines = occurrences(ss).map(s => `• ${fmtShortDate(s.scheduled_at)} — ${occWho(s)}${s.subject ? ' (' + s.subject + ')' : ''} — ${durLabel(sMins(s))} = ${fmt(occTut(s), 2)} ج`).join('\n');
    const totalMins = occurrences(ss).reduce((a, s) => a + sMins(s), 0);
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
  if (s.group_key) return openGroupPostpone(s.group_key);
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
      s.kind === 'regular' ? 'عادية' : kindWord(s), (STATUS[s.status] || {}).label, s.duration_minutes, s.actual_minutes ?? '',
      s.student_price, s.student_currency, done ? c.fam.toFixed(2) : '', s.tutor_cost_egp, done ? c.tut.toFixed(2) : '',
      done ? Number(s.fx_rate_to_egp).toFixed(4) : '', done ? Number(s.revenue_egp).toFixed(2) : '', done ? Number(s.margin_egp).toFixed(2) : '',
      s.cancel_reason || '', s.cancel_note || '', cancelNoticeHours(s) == null ? '' : cancelNoticeHours(s).toFixed(1), s.makeup_of ? 'نعم' : '', s.group_name || '', s.group_rate_egp ?? '', s.notes];
  });
  downloadCSV(`حصص_${r.from}_${r.toIncl}.csv`, ['التاريخ', 'الوقت', 'الطالب', 'الأسرة', 'المعلم', 'المادة', 'النوع', 'الحالة', 'المدة المخططة (د)', 'المدة الفعلية (د)',
    'سعر الساعة للأسرة', 'العملة', 'إجمالي الأسرة', 'أجر الساعة للمعلم (EGP)', 'إجمالي المعلم (EGP)', 'سعر الصرف', 'الإيراد (EGP)', 'الهامش (EGP)', 'سبب الإلغاء', 'تفاصيل الإلغاء', 'الإلغاء قبلها بكام ساعة', 'تعويضية', 'المجموعة', 'أجر ساعة المجموعة (EGP)', 'ملاحظات'], rows);
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
  const hours = occurrences(done).reduce((a, s) => a + sMins(s), 0) / 60;
  const attend = done.length + cS.length + cT.length ? done.length / (done.length + cS.length + cT.length) : null;
  const makeups = rows.filter(s => s.makeup_of).length;
  const unrec = past.filter(needsConfirm).length;

  // أسباب
  const reasonCount = list => { const m = {}; list.forEach(s => { const k = s.cancel_reason || 'بدون سبب'; m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const rS = reasonCount(cS), rT = reasonCount(cT), rA = reasonCount(cA);
  const maxR = Math.max(1, ...[...rS, ...rT, ...rA].map(x => x[1]));

  // أسبوعي
  const weeks = {};
  occurrences(past.filter(s => s.status === 'done')).forEach(s => { const w = dateStr(weekStart(dateStr(new Date(s.scheduled_at)))); const x = weeks[w] ||= { h: 0, c: 0 }; x.h += sMins(s) / 60; });
  past.filter(s => s.status.startsWith('cancelled')).forEach(s => { const w = dateStr(weekStart(dateStr(new Date(s.scheduled_at)))); const x = weeks[w] ||= { h: 0, c: 0 }; x.c++; });
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
  const seenOcc = new Set();
  past.forEach(s => { if (s.group_key) { const k = s.group_key + '|' + s.status; if (seenOcc.has(k)) return; seenOcc.add(k); } const x = tut[s.tutor_id] ||= { d: 0, h: 0, c: 0, late: 0, ns: 0 };
    if (s.status === 'done') { x.d++; x.h += sMins(s) / 60; }
    else if (s.status === 'cancelled_by_tutor') { x.c++; if (isLate(s)) x.late++; if (s.cancel_reason === 'لم يحضر') x.ns++; } });
  const tutRows = Object.entries(tut).map(([id, x]) => ({ t: byId(state.tutors, id), x, k: commitment(x.d, x.c) })).filter(r => r.t)
    .sort((a, b) => (a.k.rate ?? 1) - (b.k.rate ?? 1) || b.x.c - a.x.c);

  el.innerHTML = `
    <div class="chips">${[['this', 'الشهر ده'], ['last', 'الشهر اللي فات'], ['3m', 'آخر 3 شهور'], ['year', 'السنة دي']].map(([k, l]) => `<button class="chip ${state.repPeriod === k ? 'active' : ''}" onclick="setRepPeriod('${k}')">${l}</button>`).join('')}</div>
    <div class="kpis">
      <div class="card kpi"><div class="l">حصص تمت</div><div class="v num">${occurrences(done).length}</div><div class="s">${fmt(hours, 1)} ساعة تدريس</div></div>
      <div class="card kpi"><div class="l">نسبة الالتزام العامة</div><div class="v num ${attend == null ? '' : attend >= .9 ? 'pos' : attend >= .75 ? 'warn-txt' : 'neg'}">${attend == null ? '—' : Math.round(attend * 100) + '%'}</div><div class="s">حصص تمت ÷ (تمت + إلغاء أسرة/معلم)</div></div>
      <div class="card kpi"><div class="l">إلغاءات</div><div class="v num">${cancels.length}</div><div class="s">أسر ${cS.length} · معلمين ${cT.length} · أكاديمية ${cA.length}</div></div>
      <div class="card kpi"><div class="l">إلغاءات متأخرة</div><div class="v num ${cancels.filter(isLate).length ? 'neg' : ''}">${cancels.filter(isLate).length}</div><div class="s">أقل من ${LATE_HOURS} ساعات قبل الحصة</div></div>
      <div class="card kpi"><div class="l">لم يحضر</div><div class="v num">${cancels.filter(s => s.cancel_reason === 'لم يحضر').length}</div><div class="s">طلاب ${cS.filter(s => s.cancel_reason === 'لم يحضر').length} · معلمين ${cT.filter(s => s.cancel_reason === 'لم يحضر').length}</div></div>
      <div class="card kpi"><div class="l">حصص تعويضية</div><div class="v num">${makeups}</div><div class="s">${unrec ? `<span class="neg">${unrec} حصة لسه ماتسجلتش</span>` : 'كل الحصص متسجلة ✓'}</div></div>
    </div>

    ${trialReportHtml(rows)}
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
      <button class="btn btn-wa" onclick="openSchedule('student', ${jsq(st.id)})">📋 الجدول</button>
      <button class="btn btn-ghost" onclick="openFamilyInvoice(${jsq(st.family_id)})">📄 فاتورة الأسرة</button>
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
      studs.length ? `<div class="sub small">طلاب</div>` + studs.map(s => `<button class="wk-row" onclick="openStudentProfile(${jsq(s.id)})"><span>🎒</span><span><b>${esc(s.name)}</b> <span class="sub small">${esc(byId(state.families, s.family_id)?.name || '')} · ${esc(s.grade_level)}</span></span><span class="chip" onclick="event.stopPropagation(); openSchedule('student', ${jsq(s.id)})">📋 جدول</span></button>`).join('') : '',
      fams.length ? `<div class="sub small mt">أسر</div>` + fams.map(f => `<button class="wk-row" onclick="closeModal(); switchTab('families'); document.getElementById('family-search').value=${jsq(f.name)}; renderFamilies()"><span>👨‍👩‍👧</span><span><b>${esc(f.name)}</b> <span class="sub small">${esc(f.country)}</span></span><span class="chip" onclick="event.stopPropagation(); openSchedule('family', ${jsq(f.id)})">📋 جدول</span></button>`).join('') : '',
      tuts.length ? `<div class="sub small mt">معلمين</div>` + tuts.map(t => `<button class="wk-row" onclick="closeModal(); switchTab('tutors'); document.getElementById('tutor-search').value=${jsq(t.name)}; renderTutors()"><span>🧑‍🏫</span><span><b>${esc(t.name)}</b></span><span class="chip" onclick="event.stopPropagation(); openSchedule('tutor', ${jsq(t.id)})">📋 جدول</span></button>`).join('') : '',
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
   حصص المجموعات: صف لكل طالب بسعره وعملة أسرته،
   والمعلمة لها أجر ساعة ثابت عن المجموعة كلها (بيتقسم تلقائياً على اللي حضروا)
   ============================================================ */
const isCancelled = s => String(s.status).startsWith('cancelled');
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
// يدمج صفوف نفس حصة المجموعة في عنصر واحد (للساعات والعدّ وكشوف المعلمة)
function occurrences(list) {
  const out = [], idx = {};
  for (const s of list) {
    if (!s.group_key) { out.push(s); continue; }
    const g = idx[s.group_key];
    if (g) { g._members.push(s); continue; }
    const o = { ...s, _members: [s] }; idx[s.group_key] = o; out.push(o);
  }
  return out;
}
const occTut = o => o._members ? o._members.reduce((a, m) => a + charges(m).tut, 0) : charges(o).tut;
const groupNames = rows => rows.map(m => byId(state.students, m.student_id)?.name || '').filter(Boolean).join('، ');
const occWho = o => o._members && o.group_key ? `👥 ${o.group_name || 'مجموعة'} (${groupNames(o._members)})` : (byId(state.students, o.student_id)?.name || '');
function loadedGroup(key) {
  const seen = new Set();
  return allLoadedSessions().filter(s => s.group_key === key && !seen.has(s.id) && seen.add(s.id)).sort((a, b) => a.id < b.id ? -1 : 1);
}
async function fetchGroup(key) {
  const rows = await q(sb.from('sessions').select('*').eq('group_key', key));
  return rows.sort((a, b) => (byId(state.students, a.student_id)?.name || '').localeCompare(byId(state.students, b.student_id)?.name || '', 'ar'));
}
function groupStatus(rows) {
  const active = rows.filter(r => !isCancelled(r));
  if (!active.length) return { ...STATUS[rows[0].status], label: 'المجموعة اتلغت' };
  if (active.some(needsConfirm)) return { label: 'محتاجة تسجيل', cls: 'b-pending' };
  if (active.every(r => r.status === 'done')) return STATUS.done;
  if (active.some(isNow)) return { label: 'دلوقتي', cls: 'b-now' };
  return STATUS[active.some(r => r.status === 'in_progress') ? 'in_progress' : 'scheduled'];
}
function groupMoney(rows) {
  const active = rows.filter(r => !isCancelled(r));
  const s0 = active[0] || rows[0];
  const done = active.filter(r => r.status === 'done');
  const mins = sMins(s0);
  const rev = active.reduce((a, r) => a + charges(r).rev, 0);
  const enrolled = rows.filter(r => !(isCancelled(r) && r.cancel_scope === 'permanent')).length || 1;
  const tut = done.length ? done.reduce((a, r) => a + charges(r).tut, 0) : Number(s0.group_rate_egp || 0) * mins / 60 * active.length / enrolled;
  return { mins, rev, tut, margin: rev - tut, final: active.length && done.length === active.length };
}

function groupCard(rows) {
  const s = rows.find(r => !isCancelled(r)) || rows[0];
  const K = jsq(s.group_key);
  const tu = byId(state.tutors, s.tutor_id);
  const badge = groupStatus(rows);
  const m = groupMoney(rows);
  const open = rows.some(r => r.status === 'scheduled' || r.status === 'in_progress');
  const confirmNeeded = rows.some(needsConfirm);
  const now = rows.some(isNow);
  const extended = s.actual_minutes && s.actual_minutes !== s.duration_minutes;
  const tzs = [...new Set(rows.map(r => sessionView(r).fam?.country).filter(c => c && c !== 'مصر'))];
  const member = r => {
    const { st, fam } = sessionView(r);
    const b = isCancelled(r) ? { label: r.cancel_reason === 'لم يحضر' ? 'غاب' : 'اعتذر', cls: 'b-cancel' } : r.status === 'done' ? { label: 'حضر', cls: 'b-done' } : null;
    return `<div class="gm-row">
      <a href="javascript:void(0)" onclick="openStudentProfile(${jsq(r.student_id)})"><b>${esc(st?.name || 'طالب محذوف')}</b></a>
      <span class="sub small">${esc(fam?.name || '')} · ${fmt(r.student_price, 2)} ${r.student_currency}/س</span>
      <span class="gm-act">${b ? `<span class="badge ${b.cls}">${b.label}</span>` : ''}
        ${r.status === 'scheduled' || r.status === 'in_progress' ? `<button class="btn btn-ghost sm" title="الطالب ده بس مش هيحضر" onclick="openCancel(${jsq(r.id)})">✖ اعتذار</button>` : ''}
        ${isCancelled(r) && open ? `<button class="btn btn-ghost sm" title="رجّعه للمجموعة" onclick="setStatus(${jsq(r.id)},'scheduled')">↺</button>` : ''}</span>
    </div>`;
  };
  return `<div class="card item session group-card ${now ? 's-now' : ''} ${confirmNeeded ? 's-confirm' : ''}">
    <div class="left">
      <div class="time">${esc(timeStr(new Date(s.scheduled_at)))}</div>
      <div class="sub small">حتى ${esc(timeStr(new Date(sEnd(s))))}</div>
      ${tzs.map(c => `<div class="sub small">${COUNTRIES[c].flag} ${esc(fmtTime(s.scheduled_at, COUNTRIES[c].tz))}</div>`).join('')}
    </div>
    <div>
      <div class="item-head">
        <div>
          <div class="item-title">👥 ${esc(s.group_name || 'مجموعة')} <span class="badge b-group">${rows.some(r => r.status === 'done') ? `حضر ${rows.filter(r => r.status === 'done').length} من ${rows.length}` : `${rows.filter(r => !isCancelled(r)).length} طلاب`}</span></div>
          <div class="sub small">${[...new Set(rows.map(r => sessionView(r).fam?.name).filter(Boolean))].map(esc).join(' · ')}</div>
        </div>
        <span class="badge ${badge.cls}">${badge.label}</span>
      </div>
      <div class="meta">
        <span>المعلم: <b>${esc(tu?.name || '—')}</b></span>
        ${s.subject ? `<span>المادة: <b>${esc(s.subject)}</b></span>` : ''}
        <span>المدة: <b>${durLabel(m.mins)}</b>${extended ? ` <span class="${s.actual_minutes > s.duration_minutes ? 'pos' : 'neg'}">(المخطط ${durLabel(s.duration_minutes)})</span>` : ''}</span>
        ${s.meeting_link ? `<span><a href="${esc(linkHref(s.meeting_link))}" target="_blank" rel="noopener">رابط الحصة ↗</a></span>` : (open ? '<span class="neg">لا يوجد رابط</span>' : '')}
      </div>
      <div class="gm-list">${rows.map(member).join('')}</div>
      ${s.notes ? `<div class="sub small mt">📝 ${esc(s.notes)}</div>` : ''}
      ${m.rev || m.tut ? `<div class="money">
        <span class="pill" title="مجموع اللي على الأسر بالجنيه">الأسر: ${fmt(m.rev)} EGP</span>
        <span class="pill" title="${fmt(s.group_rate_egp)} EGP في الساعة عن المجموعة كلها">المعلم: ${money(m.tut, 'EGP')}</span>
        <span class="pill ${m.margin >= 0 ? 'ok' : 'bad'}">الهامش: ${fmt(m.margin)} EGP${m.final ? '' : ' (تقديري)'}</span>
      </div>` : ''}
      <div class="actions">
        ${open && !confirmNeeded ? `
          <button class="btn btn-wa sm" onclick="openGroupReminder(${K},'parent')">📲 الأسر</button>
          <button class="btn btn-wa sm" onclick="openGroupReminder(${K},'tutor')">📲 المعلم</button>` : ''}
        ${open ? `<button class="btn btn-ok sm" onclick="openGroupDone(${K})">✓ تمت… (الحضور)</button>` : ''}
        <button class="btn btn-ghost sm" onclick="openGroupActions(${K})">⋯ المزيد</button>
      </div>
    </div>
  </div>`;
}

/* ----- تذكير المجموعة: رسالة لكل أسرة (بتوقيتها) + رسالة واحدة للمعلمة ----- */
function groupReminderText(rows, who, fam) {
  const s = rows[0];
  const link = s.meeting_link ? linkHref(s.meeting_link) : '(سيتم إرسال الرابط قبل الحصة)';
  const durLine = `\n⏳ المدة: ${durLabel(s.duration_minutes || 60)}`;
  if (who === 'parent') {
    const c = COUNTRIES[fam?.country] || COUNTRIES['مصر'];
    const mine = rows.filter(r => sessionView(r).fam?.id === fam?.id).map(r => byId(state.students, r.student_id)?.name).filter(Boolean);
    return `السلام عليكم ورحمة الله 🌷
تذكير بحصة المجموعة لـ ${mine.join(' و')} ${relDayLabel(s.scheduled_at, c.tz)}
👥 ${s.group_name || 'مجموعة'}${s.subject ? ` — ${s.subject}` : ''}
⏰ الساعة ${fmtTime(s.scheduled_at, c.tz)} بتوقيت ${c.tzName}${durLine}
🔗 رابط الحصة: ${link}

برجاء الدخول قبل الموعد بدقيقتين. لأي تعديل أو ملاحظات تواصلوا معنا هنا مباشرة.
${SIGN_F}`;
  }
  const tu = byId(state.tutors, s.tutor_id);
  const list = rows.map(r => { const st = byId(state.students, r.student_id); return `• ${st?.name || ''}${st?.grade_level ? ` (${st.grade_level})` : ''}`; }).join('\n');
  return `${greetTutor(tu?.name)}
تذكير بحصة المجموعة ${relDayLabel(s.scheduled_at, CAIRO_TZ)}
👥 ${s.group_name || 'مجموعة'}${s.subject ? ` — ${s.subject}` : ''} (${rows.length} طلاب)
${list}
⏰ الساعة ${fmtTime(s.scheduled_at, CAIRO_TZ)} بتوقيت القاهرة${durLine}
🔗 رابط الحصة: ${link}

بعد الحصة بلّغينا مين حضر ومين غاب، ولو الوقت اتمد اكتبي المدة الفعلية.
${SIGN_T}`;
}
async function openGroupReminder(key, who) {
  const rows = (await fetchGroup(key)).filter(r => !isCancelled(r));
  if (!rows.length) return showToast('مفيش طلاب في المجموعة دي', true);
  const tu = byId(state.tutors, rows[0].tutor_id);
  let blocks;
  if (who === 'tutor') blocks = [msgBlock(`للمعلم — ${tu?.name || ''}`, groupReminderText(rows, 'tutor'), { group: tu?.whatsapp_group, phone: tu?.phone, editTutor: tu?.id })];
  else {
    const fams = [...new Map(rows.map(r => sessionView(r).fam).filter(Boolean).map(f => [f.id, f])).values()];
    blocks = fams.map(f => msgBlock(f.name, groupReminderText(rows, 'parent', f), { group: f.whatsapp_group, phone: f.whatsapp, country: f.country, editFamily: f.id }));
  }
  openModal(who === 'tutor' ? 'تذكير المعلم — المجموعة' : `تذكير الأسر (${blocks.length})`,
    `${who === 'parent' ? '<p class="sub small">رسالة لكل أسرة في جروبها، بتوقيت بلدها — ومن غير أسماء أو بيانات الأسر التانية.</p>' : ''}<div class="list">${blocks.join('')}</div>`);
  if (blocks.length <= 3) document.querySelectorAll('.msg-item').forEach(d => d.open = true);
}

/* ----- تسجيل المجموعة "تمت": المدة الفعلية + مين حضر ----- */
async function openGroupDone(key) {
  const rows = (await fetchGroup(key)).filter(r => !isCancelled(r) || r.cancel_reason === 'لم يحضر');
  if (!rows.length) return;
  const s = rows[0];
  const planned = s.duration_minutes || 60;
  const current = s.actual_minutes || planned;
  const present = new Set(rows.filter(r => !isCancelled(r)).map(r => r.id));
  const opts = [...new Set([planned, planned + 15, planned + 30, planned + 60, Math.max(15, planned - 15), Math.max(15, planned - 30)])].sort((a, b) => a - b);
  openModal(`👥 ${s.group_name || 'المجموعة'}: الحضور والمدة`, `
    <div class="field"><label>مين حضر؟</label><div class="gm-list" id="gd-list">
      ${rows.map(r => { const v = sessionView(r); return `<label class="gm-row gm-check"><input type="checkbox" data-id="${esc(r.id)}" ${present.has(r.id) ? 'checked' : ''} onchange="_gdPrev()">
        <b>${esc(v.st?.name || '')}</b> <span class="sub small">· ${esc(v.fam?.name || '')}</span></label>`; }).join('')}
    </div><div class="hint">اللي مش متعلّم عليه بيتسجل "لم يحضر" ومش بيتحسب على أسرته، ونصيبه بيتخصم من أجر المعلمة في الحصة دي.</div></div>
    <div class="field"><label>المدة الفعلية</label>
      <div class="chips" id="dur-chips">${opts.map(m => `<button type="button" class="chip" data-m="${m}" onclick="_pickDur(${m})">${durLabel(m)}${m === planned ? ' (المخطط)' : ''}</button>`).join('')}</div>
      <input id="f_actual" class="input" type="number" min="5" max="720" step="5" inputmode="numeric" value="${current}"></div>
    <div id="done-preview" class="card item" style="background:var(--bg)"></div>
    <div id="form-error" class="err hidden"></div>
    <div class="modal-foot"><button class="btn btn-ok" id="form-submit" onclick="_saveGroupDone()">حفظ</button><button class="btn btn-ghost" onclick="closeModal()">إلغاء</button></div>`);
  const inp = document.getElementById('f_actual');
  const picked = () => [...document.querySelectorAll('#gd-list input')].filter(x => x.checked).map(x => x.dataset.id);
  const preview = () => {
    const m = Number(inp.value) || planned, ids = picked();
    document.querySelectorAll('#dur-chips .chip').forEach(c => c.classList.toggle('active', Number(c.dataset.m) === m));
    const att = rows.filter(r => ids.includes(r.id));
    const rev = att.reduce((a, r) => a + toEGP(Number(r.student_price) * m / 60, r.student_currency), 0);
    const tut = Number(s.group_rate_egp || 0) * m / 60 * att.length / (rows.length || 1);
    document.getElementById('done-preview').innerHTML = `<div class="meta" style="margin:0">
      <span>حضر: <b>${att.length} من ${rows.length}</b></span><span>المدة: <b>${durLabel(m)}</b></span>
      <span>الأسر: <b>≈ ${fmt(rev)} EGP</b></span><span>للمعلم: <b>${money(tut, 'EGP')}</b>${att.length < rows.length ? ` <span class="sub small">(من ${fmt(Number(s.group_rate_egp || 0) * m / 60)} — اتخصم نصيب ${rows.length - att.length})</span>` : ''}</span>
      <span>الهامش: <b>${fmt(rev - tut)} EGP</b></span></div>
      <div class="sub small mt">كل طالب بيتحسب بسعر ساعته (${att.map(r => `${byId(state.students, r.student_id)?.name || ''} ${fmt(r.student_price, 2)} ${r.student_currency}`).join('، ') || '—'}).</div>`;
  };
  window._gdPrev = preview;
  window._pickDur = m => { inp.value = m; preview(); };
  inp.addEventListener('input', preview); preview();
  window._saveGroupDone = () => runSubmit(async () => {
    const m = Math.round(Number(inp.value));
    if (!(m >= 5 && m <= 720)) return formError('المدة لازم تكون بين 5 دقايق و12 ساعة');
    const ids = picked();
    if (!ids.length) return formError('محدش حضر؟ استخدم "إلغاء المجموعة" من ⋯ المزيد بدل كده');
    const absent = rows.filter(r => !ids.includes(r.id)).map(r => r.id);
    await q(sb.from('sessions').update({ status: 'done', actual_minutes: m, cancel_reason: null, cancel_note: null, cancelled_at: null, cancel_scope: null, cancelled_by_user: null }).in('id', ids));
    if (absent.length) await q(sb.from('sessions').update({ status: 'cancelled_by_student', cancel_reason: 'لم يحضر', cancel_scope: 'once',
      cancelled_at: new Date().toISOString(), cancelled_by_user: currentUser.id, actual_minutes: null }).in('id', absent));
    closeModal(); showToast(`تم تسجيل المجموعة ✓ (حضر ${ids.length})`); await refreshAll();
  });
}

/* ----- قائمة إجراءات المجموعة ----- */
async function openGroupActions(key) {
  const rows = await fetchGroup(key); if (!rows.length) return;
  const s = rows.find(r => !isCancelled(r)) || rows[0];
  const open = rows.some(r => r.status === 'scheduled' || r.status === 'in_progress');
  const allCancelled = rows.every(isCancelled), anyDone = rows.some(r => r.status === 'done');
  const K = jsq(key);
  const a = (icon, label, fn, cls = '') => `<button class="wk-row ${cls}" onclick="closeModal(); ${fn}"><span>${icon}</span><span><b>${label}</b></span><span></span></button>`;
  openModal(`👥 ${s.group_name || 'مجموعة'} · ${timeStr(new Date(s.scheduled_at))}`, `<div class="list">
    ${rows.some(r => r.status === 'scheduled') ? a('▶', 'الحصة بدأت', `_groupSet(${K},'in_progress')`) : ''}
    ${open ? a('🔁', 'تأجيل / تغيير الموعد (للمجموعة كلها)', `openGroupPostpone(${K})`) : ''}
    ${open ? a('✖', 'إلغاء المجموعة…', `openGroupCancel(${K})`) : ''}
    ${anyDone ? a('⏱', 'تعديل الحضور / المدة', `openGroupDone(${K})`) : ''}
    ${anyDone || allCancelled ? a('↺', 'إرجاع المجموعة لمجدولة', `_groupSet(${K},'scheduled')`) : ''}
    ${a('✏️', 'تعديل المجموعة (الطلاب، الأسعار، الموعد)', `openGroupForm(${K})`)}
    ${a('📋', 'رسائل التذكير', `openGroupReminder(${K},'parent')`)}
    ${a('🔁', 'مهمة ترحيل', `openRelayForm({tutor_id:${jsq(s.tutor_id)}, session_id:${jsq(s.id)}, requested_by:'tutor'})`)}
    ${isAdmin ? a('🗑', 'حذف حصة المجموعة', `confirmDelete('حصة المجموعة دي (كل الطلاب)', () => q(sb.from('sessions').delete().eq('group_key', ${K})))`, 'danger-row') : ''}
  </div>`);
}
async function _groupSet(key, status) {
  try {
    const patch = { status };
    if (status === 'scheduled') Object.assign(patch, { cancel_reason: null, cancel_note: null, cancelled_at: null, cancelled_by_user: null, cancel_scope: null, actual_minutes: null });
    let qq = sb.from('sessions').update(patch).eq('group_key', key);
    if (status === 'in_progress') qq = qq.eq('status', 'scheduled');
    await q(qq);
    showToast('تم تحديث المجموعة ✓'); await refreshAll();
  } catch (e) { showToast(dbError(e), true); }
}

/* ----- إلغاء المجموعة كلها (مرة أو كل الجاي) ----- */
async function openGroupCancel(key) {
  const rows = (await fetchGroup(key)).filter(r => r.status === 'scheduled' || r.status === 'in_progress');
  if (!rows.length) return;
  const s = rows[0];
  let later = [];
  if (s.group_series) try {
    later = await q(sb.from('sessions').select('*').eq('group_series', s.group_series).eq('status', 'scheduled').gt('scheduled_at', s.scheduled_at).order('scheduled_at'));
  } catch (e) {}
  const laterKeys = [...new Set(later.map(r => r.group_key))];
  const cs = { party: 'cancelled_by_tutor', reason: '', scope: 'once', note: '' };
  window._gc = cs;
  const render = () => {
    const P = CANCEL_PARTIES[cs.party];
    document.getElementById('modal-body').innerHTML = `
      <div class="sub small mb">👥 ${esc(s.group_name || 'مجموعة')} · ${esc(s.subject || '')} · ${fmtDate(s.scheduled_at)} ${timeStr(new Date(s.scheduled_at))} · ${rows.length} طلاب</div>
      <p class="sub small">لو طالب واحد بس هو اللي مش هيحضر، استخدم "✖ اعتذار" جنب اسمه في الكارت بدل إلغاء المجموعة.</p>
      <div class="field"><label>مين اللي لغى؟</label><div class="seg-wrap">
        ${Object.entries(CANCEL_PARTIES).map(([k, p]) => `<button type="button" class="chip ${cs.party === k ? 'active' : ''}" onclick="_gc.party='${k}'; _gc.reason=''; _gcRender()">${p.icon} ${p.l}</button>`).join('')}
      </div></div>
      <div class="field"><label>السبب</label><div class="chips" style="margin:0">
        ${P.reasons.map(r => `<button type="button" class="chip ${cs.reason === r ? 'active' : ''}" onclick="_gc.reason=${esc(JSON.stringify(r))}; _gcRender()">${r}</button>`).join('')}
      </div></div>
      <div class="field"><label>تفاصيل (اختياري)</label><input class="input" value="${esc(cs.note)}" oninput="_gc.note=this.value"></div>
      ${laterKeys.length ? `<div class="field"><label>الإلغاء لحد إمتى؟</label>
        <label class="radio"><input type="radio" name="gc-scope" ${cs.scope === 'once' ? 'checked' : ''} onchange="_gc.scope='once'"> الحصة دي بس</label>
        <label class="radio"><input type="radio" name="gc-scope" ${cs.scope === 'permanent' ? 'checked' : ''} onchange="_gc.scope='permanent'"> كل حصص المجموعة الجاية (${laterKeys.length}) — إيقاف المجموعة</label></div>` : ''}
      <div id="form-error" class="err hidden"></div>
      <div class="modal-foot"><button class="btn btn-danger" style="background:var(--danger);color:#fff" id="form-submit" onclick="_saveGroupCancel()">تأكيد الإلغاء</button>
        <button class="btn btn-ghost" onclick="closeModal()">رجوع</button></div>`;
  };
  window._gcRender = render;
  openModal('إلغاء حصة المجموعة', ''); render();
  window._saveGroupCancel = () => runSubmit(async () => {
    if (!cs.reason) return formError('اختار سبب الإلغاء');
    const patch = { status: cs.party, cancel_reason: cs.reason, cancel_note: cs.note || null, cancelled_at: new Date().toISOString(), cancelled_by_user: currentUser.id, cancel_scope: cs.scope };
    await q(sb.from('sessions').update(patch).eq('group_key', key).in('status', ['scheduled', 'in_progress']));
    if (cs.scope === 'permanent' && later.length) await q(sb.from('sessions').update(patch).in('id', later.map(r => r.id)));
    await refreshAll();
    const tu = byId(state.tutors, s.tutor_id);
    const dates = tz => [s, ...(cs.scope === 'permanent' ? laterKeys.map(k => later.find(r => r.group_key === k)) : [])].slice(0, 8)
      .map(r => `• ${fmtDate(r.scheduled_at, tz)} الساعة ${fmtTime(r.scheduled_at, tz)}`).join('\n');
    const blocks = [];
    if (cs.party !== 'cancelled_by_tutor') blocks.push(msgBlock(`للمعلم — ${tu?.name || ''}`, `${greetTutor(tu?.name)}
تم إلغاء حصة المجموعة (${s.group_name || ''}${s.subject ? ' — ' + s.subject : ''}):
${dates(CAIRO_TZ)}
${cs.scope === 'permanent' ? 'ده إيقاف للمجموعة لحد إشعار آخر.' : 'هنبلغك بأي موعد تعويضي.'}
${SIGN_T}`, { group: tu?.whatsapp_group, phone: tu?.phone, editTutor: tu?.id }));
    const fams = [...new Map(rows.map(r => sessionView(r).fam).filter(Boolean).map(f => [f.id, f])).values()];
    fams.forEach(f => { const c = COUNTRIES[f.country] || COUNTRIES['مصر'];
      blocks.push(msgBlock(f.name, `السلام عليكم ورحمة الله 🌷
نعتذر عن إلغاء حصة المجموعة${s.subject ? ` (${s.subject})` : ''}${cs.party === 'cancelled_by_tutor' ? ' لظرف طارئ عند المعلمة' : cs.reason === 'إجازة رسمية' ? ' بمناسبة الإجازة الرسمية' : ''}:
${dates(c.tz)}
${cs.scope === 'permanent' ? 'وهنرتب مع حضراتكم البديل المناسب في أقرب وقت.' : 'وهنبلغكم بالموعد التعويضي قريب إن شاء الله.'}
شكراً لتفهمكم 🙏
${SIGN_F}`, { group: f.whatsapp_group, phone: f.whatsapp, country: f.country, editFamily: f.id })); });
    openModal('تم إلغاء المجموعة ✓ — بلّغ الأطراف', `<div class="list">${blocks.join('')}</div>`);
  });
}

/* ----- تأجيل المجموعة كلها ----- */
async function openGroupPostpone(key) {
  const rows = (await fetchGroup(key)).filter(r => !isCancelled(r));
  if (!rows.length) return;
  const s = rows[0];
  const d = new Date(s.scheduled_at); d.setDate(d.getDate() + 1);
  openModal('تأجيل حصة المجموعة', formHtml([
    [{ name: 'date', label: 'التاريخ الجديد', type: 'date', required: true, value: dateStr(d) },
     { name: 'time', label: 'الوقت الجديد (بتوقيتك)', type: 'time', required: true, value: timeStr(d) }],
    { name: 'duration_minutes', label: 'المدة (دقيقة)', type: 'number', required: true, value: s.duration_minutes || 60, step: 5, min: 5 },
    { name: 'reason', label: 'السبب (اختياري)', placeholder: 'مثال: طلب المعلمة' },
  ], 'تأجيل المجموعة'));
  window._formSubmit = () => runSubmit(async () => {
    const start = new Date(`${fv('date')}T${fv('time')}`);
    if (isNaN(start)) return formError('التاريخ أو الوقت غير صحيح');
    const dur = fnum('duration_minutes');
    const conflicts = await groupConflicts(s.tutor_id, rows.map(r => r.student_id), [{ start: start.getTime(), dur }], [key]);
    if (conflicts.length && !confirm(`⚠️ الموعد الجديد فيه تعارض:\n${conflicts.slice(0, 4).join('\n')}\n\nتكمل برضه؟`)) return;
    const oldIso = s.scheduled_at, reason = fv('reason');
    const row = { scheduled_at: start.toISOString(), duration_minutes: dur, status: 'scheduled', actual_minutes: null };
    if (reason) row.notes = [s.notes, `تأجيل من ${fmtShortDate(oldIso)} ${timeStr(new Date(oldIso))}: ${reason}`].filter(Boolean).join(' | ');
    await q(sb.from('sessions').update(row).eq('group_key', key).in('status', ['scheduled', 'in_progress', 'done']));
    await refreshAll();
    const tu = byId(state.tutors, s.tutor_id), nsIso = row.scheduled_at;
    const blocks = [msgBlock(`للمعلم — ${tu?.name || ''}`, `${greetTutor(tu?.name)}
تم تغيير موعد حصة المجموعة (${s.group_name || ''}${s.subject ? ' — ' + s.subject : ''}):
❌ القديم: ${fmtDate(oldIso, CAIRO_TZ)} الساعة ${fmtTime(oldIso, CAIRO_TZ)}
✅ الجديد: ${fmtDate(nsIso, CAIRO_TZ)} الساعة ${fmtTime(nsIso, CAIRO_TZ)} بتوقيت القاهرة (${durLabel(dur)})
برجاء التأكيد 🙏
${SIGN_T}`, { group: tu?.whatsapp_group, phone: tu?.phone, editTutor: tu?.id })];
    const fams = [...new Map(rows.map(r => sessionView(r).fam).filter(Boolean).map(f => [f.id, f])).values()];
    fams.forEach(f => { const c = COUNTRIES[f.country] || COUNTRIES['مصر'];
      blocks.push(msgBlock(f.name, `السلام عليكم ورحمة الله 🌷
تم تغيير موعد حصة المجموعة${s.subject ? ` (${s.subject})` : ''}:
❌ الموعد القديم: ${fmtDate(oldIso, c.tz)} الساعة ${fmtTime(oldIso, c.tz)}
✅ الموعد الجديد: ${fmtDate(nsIso, c.tz)} الساعة ${fmtTime(nsIso, c.tz)} بتوقيت ${c.tzName}
هنبعت الرابط والتذكير قبل الحصة إن شاء الله.
${SIGN_F}`, { group: f.whatsapp_group, phone: f.whatsapp, country: f.country, editFamily: f.id })); });
    openModal('تم التأجيل ✓ — بلّغ الأطراف', `<div class="list">${blocks.join('')}</div>`);
  });
}

/* ----- تعارض مواعيد للمعلمة أو أي طالب في المجموعة ----- */
async function groupConflicts(tutorId, studentIds, slots, excludeKeys = []) {
  if (!slots.length) return [];
  const starts = slots.map(x => x.start);
  const from = new Date(Math.min(...starts) - 12 * 3600e3).toISOString(), to = new Date(Math.max(...starts) + 12 * 3600e3).toISOString();
  const ors = [`tutor_id.eq.${tutorId}`, ...studentIds.map(id => `student_id.eq.${id}`)].join(',');
  const others = await q(sb.from('sessions').select('*').or(ors).gte('scheduled_at', from).lte('scheduled_at', to)
    .not('status', 'in', '(cancelled_by_student,cancelled_by_tutor,cancelled_by_academy)'));
  const out = [], seen = new Set();
  for (const { start, dur } of slots) for (const o of others) {
    if (o.group_key && excludeKeys.includes(o.group_key)) continue;
    const k = o.group_key || o.id;
    if (seen.has(k)) continue;
    if (start < sEnd(o) && sStart(o) < start + dur * 60e3) {
      seen.add(k);
      const v = sessionView(o);
      out.push(`• ${fmtShortDate(o.scheduled_at)} ${timeStr(new Date(o.scheduled_at))}–${timeStr(new Date(sEnd(o)))}: ${o.group_key ? '👥 ' + (o.group_name || 'مجموعة') : v.st?.name || ''} مع ${v.tu?.name || ''}`);
    }
  }
  return out;
}

/* ----- إنشاء / تعديل مجموعة ----- */
async function openGroupForm(key, prefill = {}) {
  if (!state.students.length || !state.tutors.length) return showToast('لازم تضيف طلاب ومعلم الأول', true);
  const rows = key ? await fetchGroup(key) : [];
  const s = rows.find(r => !isCancelled(r)) || rows[0] || null;
  const when = s ? new Date(s.scheduled_at) : (() => { const d = parseDay(prefill.day || state.day); const n = new Date(); d.setHours(Math.min(n.getHours() + 1, 22), 0, 0, 0); return d; })();
  // الأعضاء: {sid, price, rowId?}
  const members = s ? rows.map(r => ({ sid: r.student_id, price: r.student_price, rowId: r.id, status: r.status }))
    : (prefill.students || []).map(sid => { const st = byId(state.students, sid); return { sid, price: st?.group_price ?? '' }; });
  const fields = [
    { name: 'group_name', label: 'اسم المجموعة', required: true, value: s?.group_name ?? prefill.group_name, placeholder: 'مثال: مجموعة إنجليزي — خامسة ابتدائي' },
    { name: 'tutor_id', label: 'المعلم', type: 'select', searchable: true, required: true, placeholder: 'اختر المعلم…', options: tutorOptions(), value: s?.tutor_id || prefill.tutor_id },
    { name: 'subject', label: 'المادة', value: s?.subject ?? prefill.subject, placeholder: 'مثال: إنجليزي', list: [...new Set([...SUBJECT_LIST, ...state.subjects.map(x => x.subject)])] },
    { name: 'add_student', label: 'الطلاب', type: 'select', searchable: true, placeholder: '+ أضف طالب للمجموعة…', options: studentOptions() },
    [{ name: 'date', label: 'التاريخ', type: 'date', required: true, value: dateStr(when) },
     { name: 'time', label: 'الوقت (بتوقيتك)', type: 'time', required: true, value: timeStr(when) }],
    { name: 'duration_minutes', label: 'المدة (دقيقة)', type: 'number', required: true, value: s?.duration_minutes ?? prefill.duration ?? 60, step: 5, min: 5 },
    { name: 'group_rate_egp', label: 'أجر الساعة للمعلم عن المجموعة كلها (EGP)', type: 'number', required: true, value: s?.group_rate_egp,
      hint: 'سعر المجموعة كلها. بيتقسم على عدد الطلاب، ولو طالب غاب بيتخصم نصيبه من الحصة دي (150 ج ÷ 3 = 50 لكل طالب → لو واحد غاب المعلمة تاخد 100).' },
    { name: 'meeting_link', label: 'رابط الحصة', value: s?.meeting_link, placeholder: 'meet.google.com/…' },
    { name: 'notes', label: 'ملاحظات', type: 'textarea', value: s?.notes },
  ];
  if (!s) fields.push({ name: 'repeat', label: 'تكرار أسبوعي', type: 'select', value: '1',
    options: [1, 2, 4, 8, 12, 16].map(n => ({ v: n, l: n === 1 ? 'بدون تكرار (حصة واحدة)' : `نفس الموعد لمدة ${n} أسابيع` })) });
  let futureCount = 0;
  if (s?.group_series) try {
    const fut = await q(sb.from('sessions').select('group_key').eq('group_series', s.group_series).eq('status', 'scheduled').gt('scheduled_at', s.scheduled_at));
    futureCount = new Set(fut.map(r => r.group_key)).size;
  } catch (e) {}
  const extra = futureCount ? `<label class="radio mb"><input type="checkbox" id="f_apply_future" checked> طبّق التعديل كمان على حصص المجموعة الجاية (${futureCount})</label>` : '';
  openModal(s ? '✏️ تعديل المجموعة' : '👥 حصة مجموعة جديدة', formHtml(fields, s ? 'حفظ التعديل' : 'إضافة المجموعة', extra));
  const $ = n => document.getElementById('f_' + n);
  document.getElementById('wrap_add_student').insertAdjacentHTML('beforeend', '<div id="grp-members" class="gm-list mt"></div>');
  document.getElementById('wrap_duration_minutes').insertAdjacentHTML('beforeend',
    `<div class="chips" id="dur-chips" style="margin:6px 0 0">${DUR_CHOICES.map(m => `<button type="button" class="chip" data-m="${m}" onclick="_setDur(${m})">${durLabel(m)}</button>`).join('')}</div>`);
  document.getElementById('wrap_group_rate_egp').insertAdjacentHTML('afterend', '<div id="sess-total" class="card item" style="background:var(--bg);margin-bottom:12px"></div>');
  const durIn = $('duration_minutes');
  const totals = () => {
    const m = Number(durIn.value) || 60, rate = Number($('group_rate_egp').value) || 0;
    document.querySelectorAll('#dur-chips .chip').forEach(x => x.classList.toggle('active', Number(x.dataset.m) === m));
    const rev = members.reduce((a, x) => { const f = byId(state.families, byId(state.students, x.sid)?.family_id); return a + toEGP(Number(x.price || 0) * m / 60, f?.currency); }, 0);
    const tut = rate * m / 60;
    document.getElementById('sess-total').innerHTML = `<div class="meta" style="margin:0">
      <span>الحصة (${durLabel(m)}) لو الكل حضر:</span><span>الأسر <b>≈ ${fmt(rev)} EGP</b></span>
      <span>المعلم <b>${money(tut, 'EGP')}</b></span><span>الهامش <b class="${rev - tut >= 0 ? 'pos' : 'neg'}">${fmt(rev - tut)} EGP</b></span></div>
      ${members.length ? `<div class="sub small mt">نصيب كل طالب من أجر المعلم: ${fmt(tut / members.length, 2)} ج — لو غاب بيتخصم من الحصة دي بس.</div>` : ''}
      ${s && members.length < rows.length ? `<div class="warn-txt small mt">⚠️ شلت طالب من المجموعة — اتفق مع المعلمة: سعر المجموعة هيفضل ${fmt(rate)} ج ولا هيتغير؟ عدّله فوق لو اتغير.</div>` : ''}`;
  };
  const renderMembers = () => {
    document.getElementById('grp-members').innerHTML = members.length ? members.map((x, i) => {
      const st = byId(state.students, x.sid), f = st ? byId(state.families, st.family_id) : null;
      return `<div class="gm-row gm-edit"><span><b>${esc(st?.name || '')}</b> <span class="sub small">${esc(f?.name || '')} · ${esc(st?.grade_level || '')}</span></span>
        <span class="gm-price"><input class="input" type="number" min="0" step="0.5" inputmode="decimal" value="${esc(x.price ?? '')}" placeholder="سعر الساعة" oninput="_gm[${i}].price=this.value; _gmTot()"><span class="sub small">${f?.currency || ''}/س</span></span>
        <button type="button" class="btn btn-ghost icon" title="شيله من المجموعة" onclick="_gmDel(${i})">✕</button></div>`;
    }).join('') : '<div class="sub small">لسه مفيش طلاب — اختار من القائمة فوق.</div>';
    totals();
  };
  window._gm = members; window._gmTot = totals;
  window._gmDel = i => { members.splice(i, 1); renderMembers(); };
  window._setDur = m => { durIn.value = m; totals(); };
  $('add_student').addEventListener('change', () => {
    const sid = $('add_student').value; if (!sid) return;
    if (!members.some(x => x.sid === sid)) {
      const st = byId(state.students, sid);
      members.push({ sid, price: st?.group_price ?? '' });
    } else showToast('الطالب ده موجود في المجموعة بالفعل');
    $('add_student').value = '';
    renderMembers();
  });
  $('tutor_id').addEventListener('change', () => { if (!$('subject').value) { const t = state.subjects.filter(x => x.tutor_id === $('tutor_id').value); if (t.length === 1) $('subject').value = t[0].subject; } });
  ['input', 'change'].forEach(ev => [durIn, $('group_rate_egp')].forEach(el => el.addEventListener(ev, totals)));
  renderMembers();

  window._formSubmit = () => runSubmit(async () => {
    if (members.length < 2) return formError('المجموعة لازم يكون فيها طالبين على الأقل');
    const noPrice = members.filter(x => x.price === '' || x.price == null || isNaN(Number(x.price)));
    if (noPrice.length) return formError(`اكتب سعر الساعة لـ: ${noPrice.map(x => byId(state.students, x.sid)?.name).join('، ')}`);
    const start = new Date(`${fv('date')}T${fv('time')}`);
    if (isNaN(start)) return formError('التاريخ أو الوقت غير صحيح');
    const dur = fnum('duration_minutes');
    if (!(dur >= 5 && dur <= 720)) return formError('المدة لازم تكون بين 5 دقايق و12 ساعة');
    const rate = fnum('group_rate_egp');
    if (rate == null || rate < 0) return formError('اكتب أجر الساعة للمعلم عن المجموعة');
    const common = { kind: 'group', group_name: fv('group_name'), tutor_id: fv('tutor_id'), subject: fv('subject') || null, duration_minutes: dur,
      meeting_link: fv('meeting_link') || null, notes: fv('notes') || null, group_rate_egp: rate };
    const memberRow = x => { const st = byId(state.students, x.sid), f = byId(state.families, st.family_id);
      return { student_id: x.sid, student_price: Number(x.price), student_currency: f.currency, tutor_cost_egp: Math.round(rate / members.length * 100) / 100 }; };
    const sids = members.map(x => x.sid);

    if (!s) {
      const n = Number(fv('repeat') || 1), series = uuid();
      const slots = Array.from({ length: n }, (_, i) => ({ start: start.getTime() + i * 7 * 864e5, dur }));
      const conflicts = await groupConflicts(common.tutor_id, sids, slots);
      if (conflicts.length && !confirm(`⚠️ فيه تعارض في المواعيد (المعلم أو أحد الطلاب):\n${conflicts.slice(0, 5).join('\n')}${conflicts.length > 5 ? `\n… و${conflicts.length - 5} كمان` : ''}\n\nتكمل الحفظ برضه؟`)) return;
      const ins = [];
      slots.forEach(sl => { const gk = uuid(); members.forEach(x => ins.push({ ...common, ...memberRow(x), group_key: gk, group_series: series, scheduled_at: new Date(sl.start).toISOString() })); });
      await q(sb.from('sessions').insert(ins));
      const newPrices = members.filter(x => byId(state.students, x.sid)?.group_price == null);
      for (const x of newPrices) await sb.from('students').update({ group_price: Number(x.price) }).eq('id', x.sid);
      showToast(n > 1 ? `تمت إضافة ${n} حصص للمجموعة ✓` : 'تمت إضافة حصة المجموعة ✓');
      state.day = fv('date');
      closeModal(); await refreshAll(); return;
    }

    // تعديل: الحصة دي (+ الجاية لو متعلّم)
    const delta = start.getTime() - new Date(s.scheduled_at).getTime();
    const applyFuture = document.getElementById('f_apply_future')?.checked;
    let targets = [{ key, rows, at: start.getTime() }];
    if (applyFuture) {
      const fut = await q(sb.from('sessions').select('*').eq('group_series', s.group_series).gt('scheduled_at', s.scheduled_at));
      const byKey = {}; fut.forEach(r => (byKey[r.group_key] ||= []).push(r));
      Object.entries(byKey).filter(([, rs]) => rs.some(r => r.status === 'scheduled')).forEach(([k, rs]) => targets.push({ key: k, rows: rs, at: new Date(rs[0].scheduled_at).getTime() + delta }));
    }
    const conflicts = await groupConflicts(common.tutor_id, sids, targets.map(t => ({ start: t.at, dur })), targets.map(t => t.key));
    if (conflicts.length && !confirm(`⚠️ فيه تعارض في المواعيد:\n${conflicts.slice(0, 5).join('\n')}\n\nتكمل الحفظ برضه؟`)) return;
    let skipped = 0;
    for (const t of targets) {
      await q(sb.from('sessions').update({ ...common, scheduled_at: new Date(t.at).toISOString() }).eq('group_key', t.key));
      for (const x of members) {
        const ex = t.rows.find(r => r.student_id === x.sid);
        if (ex) { if (Number(ex.student_price) !== Number(x.price)) await q(sb.from('sessions').update({ student_price: Number(x.price) }).eq('id', ex.id)); }
        else await q(sb.from('sessions').insert({ ...common, ...memberRow(x), group_key: t.key, group_series: s.group_series, scheduled_at: new Date(t.at).toISOString() }));
      }
      const gone = t.rows.filter(r => !sids.includes(r.student_id));
      const del = gone.filter(r => r.status === 'scheduled'); skipped += gone.length - del.length;
      if (del.length) await q(sb.from('sessions').delete().in('id', del.map(r => r.id)));
    }
    closeModal();
    showToast(`تم حفظ التعديل ✓${targets.length > 1 ? ` (${targets.length} حصص)` : ''}${skipped ? ` — ${skipped} طالب ماتشالش لأن حصته متسجلة` : ''}`);
    await refreshAll();
  });
}

/* ============================================================
   جدول أي طالب / أسرة / معلم — عرض + رسالة جاهزة للنسخ والإرسال
   ============================================================ */
const SCHED_RANGES = { week: 'الأسبوع ده', next: 'الأسبوع الجاي', d14: 'أسبوعين جايين', month: 'باقي الشهر' };
function schedRange(k) {
  const today = parseDay(todayStr()), ws = weekStart(todayStr());
  if (k === 'next') return { from: new Date(ws.getTime() + 7 * 864e5), to: new Date(ws.getTime() + 14 * 864e5) };
  if (k === 'd14') return { from: today, to: new Date(today.getTime() + 14 * 864e5) };
  if (k === 'month') return { from: today, to: new Date(today.getFullYear(), today.getMonth() + 1, 1) };
  return { from: today, to: new Date(ws.getTime() + 7 * 864e5) };
}
function schedSubject(kind, id) {
  if (kind === 'tutor') { const t = byId(state.tutors, id); return { name: t?.name || '', tz: 'مصر', group: t?.whatsapp_group, phone: t?.phone, edit: { editTutor: id } }; }
  if (kind === 'family') { const f = byId(state.families, id); return { name: f?.name || '', tz: f?.country || 'مصر', group: f?.whatsapp_group, phone: f?.whatsapp, country: f?.country, edit: { editFamily: id } }; }
  const st = byId(state.students, id), f = st ? byId(state.families, st.family_id) : null;
  return { name: st?.name || '', tz: f?.country || 'مصر', group: f?.whatsapp_group, phone: f?.whatsapp, country: f?.country, edit: { editFamily: f?.id } };
}
function scheduleText(sc, rows) {
  const c = COUNTRIES[sc.tz] || COUNTRIES['مصر'];
  const subj = schedSubject(sc.kind, sc.id);
  const list = sc.kind === 'student' ? rows : occurrences(rows);
  const byDay = {};
  list.forEach(s => { const k = new Intl.DateTimeFormat('en-CA', { timeZone: c.tz }).format(new Date(s.scheduled_at)); (byDay[k] ||= []).push(s); });
  const line = s => {
    const st = byId(state.students, s.student_id), tu = byId(state.tutors, s.tutor_id);
    const t = `${fmtTime(s.scheduled_at, c.tz)} – ${fmtTime(new Date(sStart(s) + (s.duration_minutes || 60) * 60e3).toISOString(), c.tz)}`;
    let what;
    if (sc.kind === 'tutor') what = s.group_key ? `👥 ${s.group_name || 'مجموعة'}: ${groupNames(s._members)}` : `${st?.name || ''}${st?.grade_level ? ` (${st.grade_level})` : ''}`;
    else what = `${sc.kind === 'family' ? (s._members ? s._members.map(m => byId(state.students, m.student_id)?.name).filter(Boolean).join(' و') : st?.name || '') + ': ' : ''}${s.subject || 'حصة'}${s.group_key ? ' 👥 مجموعة' : ''}`;
    const subjPart = sc.kind === 'tutor' && s.subject ? ` — ${s.subject}` : '';
    const kindPart = s.kind === 'revision' || s.kind === 'trial' ? ` [${kindWord(s)}]` : '';
    const tutPart = sc.kind !== 'tutor' && sc.names && tu ? ` — ${tu.name}` : '';
    const link = sc.links && s.meeting_link ? `\n   🔗 ${linkHref(s.meeting_link)}` : '';
    return `• ${t}: ${what}${subjPart}${kindPart}${tutPart} (${durLabel(s.duration_minutes || 60)})${link}`;
  };
  const body = Object.keys(byDay).sort().map(k => `*${fmtDate(byDay[k][0].scheduled_at, c.tz)}*\n${byDay[k].map(line).join('\n')}`).join('\n\n');
  const mins = list.reduce((a, s) => a + (s.duration_minutes || 60), 0);
  const greet = sc.kind === 'tutor' ? greetTutor(subj.name) : 'السلام عليكم ورحمة الله 🌷';
  const title = sc.kind === 'tutor' ? 'جدول حصصك' : `جدول حصص ${sc.kind === 'family' ? 'الأسرة' : subj.name}`;
  return `${greet}
📅 ${title} — ${SCHED_RANGES[sc.range]} (بتوقيت ${c.tzName}):

${body || '— لا توجد حصص محجوزة في الفترة دي —'}
${list.length ? `\nالإجمالي: ${list.length} ${list.length > 2 && list.length < 11 ? 'حصص' : 'حصة'} · ${durLabel(mins)}\n` : ''}
لأي تعديل في المواعيد تواصلوا معنا هنا.
${sc.kind === 'tutor' ? SIGN_T : SIGN_F}`;
}
async function shareText(key) {
  const text = window._msgs?.[key]; if (!text) return;
  if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  copyText(text, 'تم نسخ الجدول ✓');
}
async function openSchedule(kind, id, range = 'week') {
  const sc = window._sc && window._sc.kind === kind && window._sc.id === id ? { ...window._sc, range } : { kind, id, range, tz: schedSubject(kind, id).tz, names: false, links: false };
  window._sc = sc;
  const r = schedRange(range);
  let qq = sb.from('sessions').select('*').gte('scheduled_at', r.from.toISOString()).lt('scheduled_at', r.to.toISOString())
    .not('status', 'in', '(cancelled_by_student,cancelled_by_tutor,cancelled_by_academy)').order('scheduled_at');
  if (kind === 'tutor') qq = qq.eq('tutor_id', id);
  else if (kind === 'family') { const ids = state.students.filter(s => s.family_id === id).map(s => s.id); if (!ids.length) return showToast('الأسرة مفيهاش طلاب', true); qq = qq.in('student_id', ids); }
  else qq = qq.eq('student_id', id);
  let rows;
  try { rows = await q(qq); } catch (e) { return showToast(dbError(e), true); }
  window._scRows = rows;
  const subj = schedSubject(kind, id);
  const render = () => {
    const text = scheduleText(sc, rows);
    const key = 'sc' + Math.random().toString(36).slice(2, 8); (window._msgs ||= {})[key] = text;
    const chip = (on, label, fn) => `<button class="chip ${on ? 'active' : ''}" onclick="${fn}">${label}</button>`;
    document.getElementById('modal-body').innerHTML = `
      <div class="chips" style="margin-bottom:6px">${Object.entries(SCHED_RANGES).map(([k, l]) => chip(sc.range === k, l, `openSchedule(${jsq(kind)}, ${jsq(id)}, '${k}')`)).join('')}</div>
      <div class="chips" style="margin-bottom:6px"><span class="sub small" style="align-self:center">التوقيت:</span>
        ${Object.entries(COUNTRIES).map(([k, c]) => chip(sc.tz === k, `${c.flag} ${c.tzName}`, `_sc.tz=${jsq(k)}; _scRender()`)).join('')}</div>
      <div class="chips" style="margin-bottom:8px">
        ${kind !== 'tutor' ? chip(sc.names, '🧑‍🏫 أسماء المعلمين', `_sc.names=!_sc.names; _scRender()`) : ''}
        ${chip(sc.links, '🔗 روابط الحصص', `_sc.links=!_sc.links; _scRender()`)}</div>
      <div class="msg-preview">${esc(text)}</div>
      <div class="modal-foot" style="flex-wrap:wrap;position:static;padding:8px 0 0">
        <button class="btn btn-brand sm" onclick="copyText(window._msgs[${jsq(key)}],'تم نسخ الجدول ✓')">📋 نسخ</button>
        <button class="btn btn-ghost sm" onclick="shareText(${jsq(key)})">📤 مشاركة / إرسال لأي حد</button>
      </div>
      ${msgActionsHtml(text, { group: subj.group, phone: subj.phone, country: subj.country, ...subj.edit })}
      <p class="sub small mt">${kind === 'tutor' ? 'الجدول فيه أسماء الطلاب بس — من غير أسماء أو أرقام الأسر.' : 'الجدول من غير أرقام المعلمين. أسماء المعلمين مخفية إلا لو فعّلتها.'} الحصص الملغاة مش ظاهرة.</p>`;
  };
  window._scRender = render;
  openModal(`📋 جدول ${subj.name}`, '');
  render();
}

/* ============================================================
   قائمة إجراءات الحصة (⋯)
   ============================================================ */
function openSessionActions(id) {
  const s = findSession(id); if (!s) return;
  if (s.group_key) return openGroupActions(s.group_key);
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
    ${a('📋', 'جدول الطالب', `openSchedule('student', ${jsq(s.student_id)})`)}
    ${a('📋', 'جدول المعلم', `openSchedule('tutor', ${jsq(s.tutor_id)})`)}
    ${isAdmin ? a('🗑', 'حذف الحصة', `deleteSession(${I})`, 'danger-row') : ''}
  </div>`);
}

/* ============================================================
   الحصص التجريبية: النتيجة والمتابعة
   ============================================================ */
const TRIAL_OUT = {
  converted: { l: '✅ هيكمل مع المعلمة', short: 'اشترك', cls: 'b-done' },
  another_tutor: { l: '🔄 يجرب معلمة تانية', short: 'معلمة تانية', cls: 'b-pending' },
  thinking: { l: '🤔 لسه بيفكر', short: 'بيفكر', cls: 'b-scheduled' },
  lost: { l: '❌ مش هيحجز', short: 'مش هيحجز', cls: 'b-cancel' },
};
const TRIAL_REASONS = {
  another_tutor: ['أسلوب المعلمة', 'مستوى الشرح', 'الطالب مش مرتاح', 'المواعيد', 'أخرى'],
  lost: ['السعر', 'المواعيد مش مناسبة', 'أسلوب / مستوى المعلمة', 'الطالب مش مرتاح', 'مش محتاج دلوقتي', 'لم يرد', 'أخرى'],
};
const trialPending = s => s.kind === 'trial' && s.status === 'done' && (!s.trial_outcome || s.trial_outcome === 'thinking');
function trialOutcomeLine(s) {
  if (s.kind !== 'trial' || s.status !== 'done') return '';
  if (!s.trial_outcome) return `<div class="cancel-info mt" style="background:var(--warn-soft);color:var(--warn)">🧪 نتيجة التجربة لسه ماتسجلتش</div>`;
  const o = TRIAL_OUT[s.trial_outcome];
  return `<div class="cancel-info mt"><span class="badge ${o.cls}">${o.short}</span>${s.trial_outcome_reason ? ' · ' + esc(s.trial_outcome_reason) : ''}${s.trial_outcome_note ? ' — ' + esc(s.trial_outcome_note) : ''}</div>`;
}
function openTrialOutcome(id) {
  const s = findSession(id); if (!s) return;
  const { st, fam, tu } = sessionView(s);
  const to = { out: s.trial_outcome || '', reason: s.trial_outcome_reason || '', note: s.trial_outcome_note || '' };
  window._to = to;
  const feedback = `السلام عليكم ورحمة الله 🌷
نتمنى تكون الحصة التجريبية${s.subject ? ` (${s.subject})` : ''} عجبت ${st?.name || ''} 😊
يسعدنا نعرف رأيكم في الحصة والمعلمة: تحبوا نكمل ونثبّت مواعيد أسبوعية مناسبة ليكم؟
ولو حابين تجربوا معلمة تانية مفيش أي مشكلة.
${SIGN_F}`;
  const render = () => {
    const reasons = TRIAL_REASONS[to.out] || [];
    document.getElementById('modal-body').innerHTML = `
      <div class="sub small mb">${esc(st?.name || '')} · ${esc(s.subject || '')} · ${esc(tu?.name || '')} · ${fmtShortDate(s.scheduled_at)}</div>
      ${msgBlock('📲 اسأل الأسرة عن رأيها', feedback, { group: fam?.whatsapp_group, phone: fam?.whatsapp, country: fam?.country, editFamily: fam?.id })}
      <div class="field mt"><label>النتيجة</label><div class="seg-wrap">
        ${Object.entries(TRIAL_OUT).map(([k, o]) => `<button type="button" class="chip ${to.out === k ? 'active' : ''}" onclick="_to.out='${k}'; _to.reason=''; _toRender()">${o.l}</button>`).join('')}
      </div></div>
      ${reasons.length ? `<div class="field"><label>${to.out === 'lost' ? 'السبب' : 'ليه عايز يغيّر؟'}</label><div class="chips" style="margin:0">
        ${reasons.map(r => `<button type="button" class="chip ${to.reason === r ? 'active' : ''}" onclick="_to.reason=${esc(JSON.stringify(r))}; _toRender()">${r}</button>`).join('')}</div></div>` : ''}
      <div class="field"><label>ملاحظة (اختياري)</label><input class="input" id="to-note" value="${esc(to.note)}" oninput="_to.note=this.value" placeholder="مثال: عايز مواعيد بعد 6 مساءً"></div>
      <div id="form-error" class="err hidden"></div>
      <div class="modal-foot"><button class="btn btn-brand" id="form-submit" onclick="_saveTrial()">حفظ${to.out === 'converted' ? ' وتثبيت المواعيد' : to.out === 'another_tutor' ? ' وحجز تجربة تانية' : ''}</button>
        <button class="btn btn-ghost" onclick="closeModal()">بعدين</button></div>`;
  };
  window._toRender = render;
  openModal('🧪 نتيجة الحصة التجريبية', '');
  render();
  window._saveTrial = () => runSubmit(async () => {
    if (!to.out) return formError('اختار النتيجة');
    if ((to.out === 'lost') && !to.reason) return formError('اختار السبب — مهم عشان نعرف ليه بنخسر طلاب');
    await q(sb.from('sessions').update({ trial_outcome: to.out, trial_outcome_reason: to.reason || null, trial_outcome_note: to.note || null,
      trial_outcome_at: new Date().toISOString() }).eq('id', s.id));
    if (to.out === 'converted' && s.subject) {
      const pl = plansOf(s.student_id).filter(p => norm(p.subject) === norm(s.subject));
      if (!pl.length) await q(sb.from('student_subjects').insert({ student_id: s.student_id, subject: s.subject, tutor_id: s.tutor_id }));
      else if (!pl[0].tutor_id || pl[0].tutor_id !== s.tutor_id) await q(sb.from('student_subjects').update({ tutor_id: s.tutor_id }).eq('id', pl[0].id));
    }
    await refreshAll();
    if (to.out === 'converted') {
      showToast(`✓ ${st?.name || ''} اشترك مع ${tu?.name || ''} — حدد المواعيد الثابتة`);
      openSessionForm(null, { student_id: s.student_id, tutor_id: s.tutor_id, subject: s.subject || '', kind: 'regular' });
    } else if (to.out === 'another_tutor') {
      showToast('اختار المعلمة التانية للتجربة');
      openSessionForm(null, { student_id: s.student_id, subject: s.subject || '', kind: 'trial' });
    } else { closeModal(); showToast('تم الحفظ ✓'); }
  });
}
function openPendingTrials() {
  const list = state.pendingTrials || [];
  openModal(`تجريبية مستنية نتيجة (${list.length})`, `<p class="sub">حصص تجريبية خلصت ولسه ماتعرفناش الطالب هيكمل ولا لأ. تابع مع الأسرة وسجّل النتيجة.</p>
    <div class="list">${list.map(s => { const v = sessionView(s); return `<div class="card item"><div class="item-head"><div><b>${esc(v.st?.name || '')}</b> <span class="sub small">${esc(v.fam?.name || '')}</span>
      <div class="small">${esc(s.subject || '')} · ${esc(v.tu?.name || '')} · ${ago(s.scheduled_at)}</div></div>
      ${s.trial_outcome === 'thinking' ? '<span class="badge b-scheduled">بيفكر</span>' : ''}</div>
      <div class="actions"><button class="btn btn-brand sm" onclick="openTrialOutcome(${jsq(s.id)})">🧪 سجّل النتيجة</button></div></div>`; }).join('') || '<div class="empty">مفيش 👌</div>'}</div>`);
}
function trialReportHtml(rows) {
  const trials = rows.filter(s => s.kind === 'trial' && s.status === 'done');
  if (!trials.length) return '';
  const by = k => trials.filter(s => s.trial_outcome === k).length;
  const conv = by('converted'), other = by('another_tutor'), lost = by('lost'), pend = trials.length - conv - other - lost;
  const decided = conv + other + lost;
  const cost = trials.reduce((a, s) => a + charges(s).tut, 0);
  const perTutor = {};
  trials.forEach(s => { const x = perTutor[s.tutor_id] ||= { n: 0, c: 0, o: 0, l: 0 }; x.n++; if (s.trial_outcome === 'converted') x.c++; if (s.trial_outcome === 'another_tutor') x.o++; if (s.trial_outcome === 'lost') x.l++; });
  const tRows = Object.entries(perTutor).map(([id, x]) => ({ t: byId(state.tutors, id), x, rate: (x.c + x.o + x.l) ? x.c / (x.c + x.o + x.l) : null }))
    .filter(r => r.t).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.x.n - a.x.n);
  const reasons = {}; trials.filter(s => ['lost', 'another_tutor'].includes(s.trial_outcome)).forEach(s => { const k = s.trial_outcome_reason || 'بدون سبب'; reasons[k] = (reasons[k] || 0) + 1; });
  const rs = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
  return `<div class="section-title"><h2>🧪 الحصص التجريبية</h2></div>
    <div class="kpis">
      <div class="card kpi"><div class="l">تجريبية تمت</div><div class="v num">${trials.length}</div><div class="s">تكلفة المعلمات: ${fmt(cost)} EGP</div></div>
      <div class="card kpi"><div class="l">نسبة الاشتراك</div><div class="v num ${decided ? (conv / decided >= .5 ? 'pos' : 'warn-txt') : ''}">${decided ? Math.round(conv / decided * 100) + '%' : '—'}</div><div class="s">${conv} اشترك من ${decided} قرروا</div></div>
      <div class="card kpi"><div class="l">جربوا معلمة تانية</div><div class="v num">${other}</div><div class="s">مش هيحجزوا: ${lost}</div></div>
      <div class="card kpi"><div class="l">مستنية نتيجة</div><div class="v num ${pend ? 'warn-txt' : ''}">${pend}</div><div class="s">${pend ? '<a href="javascript:void(0)" onclick="openPendingTrials()">تابعهم ←</a>' : 'كله متسجل ✓'}</div></div>
    </div>
    <div class="grid2 mt">
      <div class="card scrollx"><table><thead><tr><th>المعلمة</th><th>تجارب</th><th>اشترك</th><th>غيّر/مشي</th><th>نسبة الاشتراك</th></tr></thead><tbody>
        ${tRows.map(({ t, x, rate }) => `<tr><td>${esc(t.name)}</td><td class="num">${x.n}</td><td class="num pos">${x.c}</td><td class="num">${x.o + x.l || '—'}</td>
          <td>${rate == null ? '<span class="sub small">لسه</span>' : `<span class="badge ${rate >= .6 ? 'b-done' : rate >= .35 ? 'b-pending' : 'b-now'}">${Math.round(rate * 100)}%</span>`}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="card item"><h3>ليه بنخسر بعد التجربة؟</h3>${rs.length ? bars(rs, Math.max(...rs.map(x => x[1])), 'fill-fam') : '<div class="sub small">مفيش لسه</div>'}</div>
    </div>`;
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
  if (/invalid login/i.test(msg)) return 'البريد أو كلمة المرور غير صحيحة — لو إيميلك جيميل جرّب "الدخول بحساب جوجل" تحت من غير باسورد';
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
    const [data, invites] = await Promise.all([q(sb.from('supervisors').select('*').order('active', { ascending: true })),
      q(sb.from('supervisor_invites').select('*').is('used_at', null).order('created_at')).catch(() => [])]);
    document.getElementById('admin-list').innerHTML = `<div class="card item">
      <h3 style="margin:0 0 6px">➕ إضافة مشرف بالإيميل</h3>
      <p class="sub small" style="margin:0 0 8px">اكتب إيميله هنا، وأول ما يدخل بيه (بجوجل أو يعمل حساب بنفس الإيميل) هيتفعّل على طول من غير ما يستنى موافقة.</p>
      <div class="row-gap"><input class="input" id="inv-email" type="email" placeholder="name@gmail.com" style="flex:1;min-width:180px">
        <button class="btn btn-brand" onclick="inviteSupervisor()">إضافة</button></div>
      ${invites.length ? `<div class="gm-list">${invites.map(i => `<div class="gm-row"><b dir="ltr">${esc(i.email)}</b><span class="sub small">لسه مادخلش</span>
        <span class="gm-act"><button class="btn btn-ghost sm" onclick="removeInvite(${jsq(i.email)})">إلغاء</button></span></div>`).join('')}</div>` : ''}
    </div>` + data.map(s => `<div class="card item">
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
async function inviteSupervisor() {
  const email = document.getElementById('inv-email').value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast('اكتب إيميل صحيح', true);
  try { await q(sb.from('supervisor_invites').upsert({ email, role: 'supervisor', invited_by: currentUser.id, used_at: null }));
    showToast('تمت الإضافة ✓ — ابعتله لينك التطبيق يدخل بالإيميل ده'); loadSupervisorsList(); }
  catch (e) { showToast(dbError(e), true); }
}
async function removeInvite(email) {
  try { await q(sb.from('supervisor_invites').delete().eq('email', email)); loadSupervisorsList(); } catch (e) { showToast(dbError(e), true); }
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
