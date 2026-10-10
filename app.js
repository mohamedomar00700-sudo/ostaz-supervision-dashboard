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
  const [families, students, tutors, subjects, fx, fb, tb, plans, act] = await Promise.all([
    q(sb.from('families').select('*').order('name')),
    q(sb.from('students').select('*').order('name')),
    q(sb.from('tutors').select('*').order('name')),
    q(sb.from('tutor_subjects').select('*')),
    q(sb.from('fx_rates').select('*')),
    q(sb.from('family_balances').select('*')),
    q(sb.from('tutor_balances').select('*')),
    q(sb.from('student_subjects').select('*').order('created_at')),
    q(sb.from('sessions').select('student_id,tutor_id').eq('status', 'done').gte('scheduled_at', new Date(Date.now() - 30 * 864e5).toISOString()).limit(5000)),
  ]);
  state.plans = plans;
  state.act = { stu: new Set(act.map(x => x.student_id)), tut: new Set(act.map(x => x.tutor_id)) };
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
  if (t === 'families' && !state.leads && !state._leadsLoading) { state._leadsLoading = true; loadLeads().finally(() => state._leadsLoading = false); }
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
// الطالب بيدرس بالإنجليزي (لغات / دولي)؟
const isEN = studentId => { const st = byId(state.students, studentId); return !!st && st.curriculum && st.curriculum !== 'arabic'; };
const enTag = studentId => isEN(studentId) ? ' <span class="badge b-en" title="منهج لغات / دولي — الحصة بالإنجليزي">EN</span>' : '';
const enTxt = studentId => isEN(studentId) ? ' (EN)' : '';
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
    <div class="card stat owner-only"><div class="v num">${fmt(margin)}</div><div class="l">هامش متوقع (EGP)</div></div>`;

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
        ${s.subject ? `<span>المادة: <b>${esc(s.subject)}</b>${enTag(s.student_id)}</span>` : ''}
        <span>المدة: <b>${durLabel(c.mins)}</b>${extended ? ` <span class="${s.actual_minutes > s.duration_minutes ? 'pos' : 'neg'}">(${s.actual_minutes > s.duration_minutes ? 'اتمدت' : 'اتقصرت'} — المخطط ${durLabel(s.duration_minutes)})</span>` : ''}</span>
        ${s.meeting_link ? `<span><a href="${esc(linkHref(s.meeting_link))}" target="_blank" rel="noopener">رابط الحصة ↗</a></span>` : (open ? '<span class="neg">لا يوجد رابط</span>' : '')}
      </div>
      ${s.notes ? `<div class="sub small mt">📝 ${esc(s.notes)}</div>` : ''}
      ${reportLine(s)}
      ${trialOutcomeLine(s)}
      ${cancelled ? `<div class="cancel-info mt">✖ ${cancelInfo(s)}</div>` : `<div class="money">
        <span class="pill" title="${fmt(s.student_price, 2)} ${s.student_currency} في الساعة">الأسرة: ${money(c.fam, s.student_currency)}</span>
        <span class="pill" title="${fmt(s.tutor_cost_egp)} EGP في الساعة">المعلم: ${money(c.tut, 'EGP')}</span>
        <span class="pill owner-only ${c.margin >= 0 ? 'ok' : 'bad'}">الهامش: ${fmt(c.margin)} EGP${s.status === 'done' ? '' : ' (تقديري)'}</span>
      </div>`}
      <div class="actions">
        ${open && !confirmNeeded ? `
          <button class="btn btn-wa sm" onclick="openReminder(${id},'parent')">📲 ولي الأمر</button>
          <button class="btn btn-wa sm" onclick="openReminder(${id},'tutor')">📲 المعلم</button>` : ''}
        ${open ? `<button class="btn btn-ok sm" onclick="openDone(${id})">✓ تمت…</button>` : ''}
        ${s.kind === 'trial' && s.status === 'done' ? `<button class="btn ${s.trial_outcome && s.trial_outcome !== 'thinking' ? 'btn-ghost' : 'btn-brand'} sm" onclick="openTrialOutcome(${id})">🧪 ${s.trial_outcome ? 'تعديل النتيجة' : 'نتيجة التجربة'}</button>` : ''}
        ${cancelled && !allLoadedSessions().some(x => x.makeup_of === s.id) && s.cancel_scope !== 'permanent' ? `<button class="btn btn-ghost sm" onclick="openSessionForm(null, {student_id:${jsq(s.student_id)}, tutor_id:${jsq(s.tutor_id)}, subject:${jsq(s.subject || '')}, makeup_of:${id}, duration:${s.duration_minutes || 60}})">📅 تعويضية</button>` : ''}
        ${reportBtn(s)}
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
// مدة بإيدك: ساعات + دقايق (لأي مدة زي ساعة وتلت أو ساعة و50 دقيقة)
function hmHtml(id, mins, label = 'أو اكتب المدة بإيدك') {
  mins = Math.round(Number(mins) || 0);
  return `<div class="field"><label>${label}</label><div class="hm-row">
    <input id="${id}_h" class="input hm" type="number" min="0" max="12" inputmode="numeric" value="${Math.floor(mins / 60)}"><span>ساعة</span>
    <input id="${id}_m" class="input hm" type="number" min="0" max="59" inputmode="numeric" value="${mins % 60}"><span>دقيقة</span>
    <b id="${id}_l" class="hm-l">${mins ? '= ' + durLabel(mins) : ''}</b></div></div>`;
}
// يحوّل خانة "المدة بالدقائق" في الفورم لساعات + دقايق (القيمة الحقيقية بتفضل في الخانة المخفية)
function attachHm(durIn, onChange) {
  durIn.type = 'hidden';
  const chips = document.getElementById('dur-chips');
  (chips || durIn).insertAdjacentHTML('afterend', `<div class="hm-row mt">
    <input id="f_dhm_h" class="input hm" type="number" min="0" max="12" inputmode="numeric"><span>ساعة</span>
    <input id="f_dhm_m" class="input hm" type="number" min="0" max="59" inputmode="numeric"><span>دقيقة</span><b id="f_dhm_l" class="hm-l"></b></div>`);
  const hm = hmWire('f_dhm', v => { durIn.value = v; onChange && onChange(); });
  hm.set(durIn.value);
  return { sync() { const a = document.activeElement; if (!a || !String(a.id).startsWith('f_dhm')) hm.set(durIn.value); } };
}
function hmWire(id, onChange) {
  const H = document.getElementById(id + '_h'), M = document.getElementById(id + '_m'), L = document.getElementById(id + '_l');
  if (!H) return { set() {}, get: () => 0 };
  const get = () => Math.max(0, Math.round(Number(H.value) || 0)) * 60 + Math.max(0, Math.round(Number(M.value) || 0));
  const upd = () => { const v = get(); L.textContent = v ? '= ' + durLabel(v) : ''; onChange && onChange(v); };
  H.addEventListener('input', upd); M.addEventListener('input', upd);
  return { get, set(v) { v = Math.round(Number(v) || 0); H.value = Math.floor(v / 60); M.value = v % 60; L.textContent = v ? '= ' + durLabel(v) : ''; } };
}
function openDone(id) {
  const s = findSession(id); if (!s) return;
  if (s.group_key) return openGroupDone(s.group_key);
  const planned = s.duration_minutes || 60;
  const current = s.actual_minutes || planned;
  const opts = [...new Set([planned, planned + 15, planned + 20, planned + 30, planned + 45, planned + 60, planned + 90, Math.max(15, planned - 15), Math.max(15, planned - 30)])].sort((a, b) => a - b);
  openModal(s.status === 'done' ? 'تعديل مدة الحصة' : 'تسجيل الحصة: تمت ✓', `
    <p class="sub">المدة المخططة: <b>${durLabel(planned)}</b>. لو الحصة اتمدت أو اتقصرت اختار المدة الفعلية، والحساب هيتعدل للأسرة وللمعلم تلقائياً.</p>
    <div class="chips" id="dur-chips">${opts.map(m => `<button type="button" class="chip ${m === current ? 'active' : ''}" data-m="${m}" onclick="_pickDur(${m})">${durLabel(m)}${m === planned ? ' (المخطط)' : m > planned ? ` (+${m - planned}د)` : ''}</button>`).join('')}</div>
    <input id="f_actual" type="hidden" value="${current}">${hmHtml('f_hm', current)}
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
      <span class="owner-only">الهامش: <b>${fmt(toEGP(fam, s.student_currency) - tut)} EGP</b></span></div>
      <div class="sub small mt">محسوبة على سعر ساعة ${fmt(s.student_price, 2)} ${s.student_currency} للأسرة و${fmt(s.tutor_cost_egp)} جنيه للمعلم.</div>`;
  };
  const hm = hmWire('f_hm', v => { inp.value = v; preview(); });
  window._pickDur = m => { inp.value = m; hm.set(m); preview(); };
  preview();
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
⏰ الساعة ${fmtTime(s.scheduled_at, CAIRO_TZ)} بتوقيت القاهرة${durLine}${s.subject ? `\n📚 المادة: ${s.subject}${isEN(s.student_id) ? ' (بالإنجليزي)' : ''}` : ''}
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
// رسايل جاهزة للأسرة والمعلمة بعد إضافة حصة / حصص جديدة
function newSessionNotices(rows) {
  const r0 = rows[0], { st, fam, tu } = sessionView(r0);
  const c = COUNTRIES[fam?.country] || COUNTRIES['مصر'];
  const subj = `${st?.name || ''}${r0.subject ? ` (${r0.subject})` : ''}`;
  const weekly = rows.length > 1;
  const list = tz => rows.slice(0, 8).map(x => `• ${fmtDate(x.scheduled_at, tz)} الساعة ${fmtTime(x.scheduled_at, tz)}`).join('\n') + (rows.length > 8 ? `\n… و${rows.length - 8} حصص كمان` : '');
  const famText = `السلام عليكم ورحمة الله 🌷
${weekly ? `تم إضافة موعد ثابت لحصة ${subj}: يوم ${new Date(r0.scheduled_at).toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', timeZone: c.tz })} من كل أسبوع الساعة ${fmtTime(r0.scheduled_at, c.tz)} بتوقيت ${c.tzName} (${durLabel(r0.duration_minutes)})
بداية من ${fmtDate(r0.scheduled_at, c.tz)}.` : `تم إضافة حصة ${r0.makeup_of ? 'تعويضية' : 'إضافية'} لـ ${subj}:
📅 ${fmtDate(r0.scheduled_at, c.tz)} الساعة ${fmtTime(r0.scheduled_at, c.tz)} بتوقيت ${c.tzName} (${durLabel(r0.duration_minutes)})`}
لو المعاد مش مناسب بلّغونا ونرتب معاد تاني إن شاء الله 🙏
${SIGN_F}`;
  const tuText = `${greetTutor(tu?.name)}
تم اعتماد ${weekly ? 'الموعد الثابت' : 'الحصة الإضافية'} مع ${subj} — بتوقيت القاهرة (${durLabel(r0.duration_minutes)}):
${list(CAIRO_TZ)}
${SIGN_T}`;
  openModal(`تم ✓ ${weekly ? `${rows.length} حصص` : 'الحصة اتضافت'} — بلّغ الأطراف`, `<div class="list">${[
    msgBlock(`رسالة ${fam?.name || 'الأسرة'}`, famText, { group: fam?.whatsapp_group, phone: fam?.whatsapp, country: fam?.country, editFamily: fam?.id }),
    msgBlock(`للمعلمة — ${tu?.name || ''}`, tuText, { group: tu?.whatsapp_group, phone: tu?.phone, editTutor: tu?.id })].join('')}</div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="openTutorRequests()">باقي الطلبات</button></div>`);
  document.querySelectorAll('.msg-item').forEach(d => d.open = true);
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
  const when = s ? new Date(s.scheduled_at) : prefill.at ? new Date(prefill.at) : (() => {
    const d = parseDay(prefill.day || state.day); const n = new Date(); d.setHours(Math.min(n.getHours() + 1, 22), 0, 0, 0); return d; })();
  const kind = s?.kind || prefill.kind || 'regular';
  const fields = [
    { name: 'kind', label: 'نوع الحصة', type: 'select', value: kind, options: [{ v: 'regular', l: 'حصة عادية' }, { v: 'trial', l: '🧪 تجريبية مجانية (نص ساعة)' }, { v: 'revision', l: 'مراجعة (وقت ومدة مرنين)' }, ...(s ? [] : [{ v: 'group', l: '👥 مجموعة (أكتر من طالب)' }])] },
    { name: 'student_id', label: 'الطالب', type: 'select', searchable: true, required: true, placeholder: 'اختر الطالب…', options: studentOptions(), value: s?.student_id || prefill.student_id },
    { name: 'tutor_id', label: 'المعلم', type: 'select', searchable: true, required: true, placeholder: 'اختر المعلم…', options: tutorOptions(), value: s?.tutor_id || prefill.tutor_id },
    { name: 'subject', label: 'المادة', value: s?.subject ?? prefill.subject, placeholder: 'مثال: رياضيات', list: [...new Set([...SUBJECT_LIST, ...state.subjects.map(x => x.subject)])] },
    [{ name: 'date', label: 'التاريخ', type: 'date', required: true, value: dateStr(when) },
     { name: 'time', label: 'الوقت (بتوقيتك)', type: 'time', required: true, value: timeStr(when) }],
    { name: 'duration_minutes', label: 'المدة', type: 'number', required: true, value: s?.duration_minutes ?? prefill.duration ?? 60, step: 5, min: 5 },
    [{ name: 'student_price', label: 'سعر الساعة للأسرة', type: 'number', required: true, value: s?.student_price, hint: 'بعملة الأسرة' },
     { name: 'tutor_cost_egp', label: 'أجر الساعة للمعلم (EGP)', type: 'number', required: true, value: s?.tutor_cost_egp }],
    { name: 'meeting_link', label: 'رابط الحصة', value: s?.meeting_link, placeholder: 'meet.google.com/…' },
    { name: 'notes', label: 'ملاحظات', type: 'textarea', value: s?.notes ?? prefill.notes },
  ];
  if (!s) fields.push({ name: 'repeat', label: 'تكرار أسبوعي', type: 'select', value: String(prefill.repeat || 1),
    options: [1, 2, 4, 8, 12, 16].map(n => ({ v: n, l: n === 1 ? 'بدون تكرار (حصة واحدة)' : `نفس الموعد لمدة ${n} أسابيع` })) });
  openModal(s ? 'تعديل حصة' : prefill.title || (prefill.makeup_of ? 'حصة تعويضية' : 'حصة جديدة'), formHtml(fields, s ? 'حفظ التعديل' : 'إضافة الحصة'));

  const $ = n => document.getElementById('f_' + n);
  const stSel = $('student_id'), tuSel = $('tutor_id'), durIn = $('duration_minutes');
  document.getElementById('wrap_student_id').insertAdjacentHTML('beforeend', '<div id="plan-picks" class="students"></div>');
  document.getElementById('wrap_duration_minutes').insertAdjacentHTML('beforeend',
    `<div class="chips" id="dur-chips" style="margin:6px 0 0">${DUR_CHOICES.map(m => `<button type="button" class="chip" data-m="${m}" onclick="_setDur(${m})">${durLabel(m)}</button>`).join('')}</div>`);
  document.getElementById('wrap_tutor_cost_egp').parentElement.insertAdjacentHTML('afterend', '<div id="sess-total" class="card item" style="background:var(--bg);margin-bottom:12px"></div>');
  let hmD = null;
  const totals = () => {
    hmD && hmD.sync();
    const st = byId(state.students, stSel.value); const fam = st ? byId(state.families, st.family_id) : null;
    const m = Number(durIn.value) || 60, p = Number($('student_price').value) || 0, c = Number($('tutor_cost_egp').value) || 0;
    document.querySelectorAll('#dur-chips .chip').forEach(x => x.classList.toggle('active', Number(x.dataset.m) === m));
    const cur = fam?.currency || '';
    document.getElementById('sess-total').innerHTML = `<div class="meta" style="margin:0">
      <span>إجمالي الحصة (${durLabel(m)}):</span>
      <span>الأسرة <b>${money(p * m / 60, cur)}</b></span><span>المعلم <b>${money(c * m / 60, 'EGP')}</b></span>
      ${cur ? `<span class="owner-only">الهامش <b>${fmt(toEGP(p * m / 60, cur) - c * m / 60)} EGP</b></span>` : ''}</div>`;
  };
  window._setDur = m => { durIn.value = m; totals(); };
  hmD = attachHm(durIn, totals);
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
    if (p.meeting_link && !$('meeting_link').value) $('meeting_link').value = p.meeting_link;
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
  if (prefill.duration) durIn.value = prefill.duration;
  if (prefill.intro) document.getElementById('modal-body').insertAdjacentHTML('afterbegin', prefill.intro);
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
    if (!s && prefill.onDone) await prefill.onDone(rows);
    await refreshAll();
    if (!s && prefill.notify) newSessionNotices(rows);
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
            <span>${s.group_key ? `👥 ${esc(s.group_name || 'مجموعة')} <span class="sub small">(${esc(groupNames(s._members))})</span>` : esc(v.st?.name || '') + ' ' + kindBadge(s)} <span class="sub small">${esc(s.subject || '')}${s.group_key ? '' : enTxt(s.student_id)} · ${esc(v.tu?.name || '')}</span></span>
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
  renderFamSwitch();
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
  const fams = state.families.filter(f => state.students.some(s => s.family_id === f.id)), act = state.act || { stu: new Set() };
  const actFam = new Set(state.students.filter(s => act.stu.has(s.id)).map(s => s.family_id));
  const byC = {}; fams.forEach(f => byC[f.country || '—'] = (byC[f.country || '—'] || 0) + 1);
  document.getElementById('families-stats').innerHTML = `<div class="sstat"><b class="num">${fams.length}</b><span>أسرة متسجلة</span></div><div class="sstat"><b class="num">${state.students.length}</b><span>طالب</span></div>
    <div class="sstat"><b class="num pos">${act.stu.size}</b><span>طالب حضر آخر 30 يوم</span></div><div class="sstat"><b class="num pos">${actFam.size}</b><span>أسرة نشطة</span></div>
    ${Object.entries(byC).sort((a, b) => b[1] - a[1]).map(([c, n]) => `<div class="sstat"><b class="num">${n}</b><span>${(COUNTRIES[c]?.flag || '') + ' ' + esc(c)}</span></div>`).join('')}`;
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
function openFamilyForm(id, pre) {
  const f = id ? byId(state.families, id) : (pre || null);
  const isNew = !id;
  const fields = [
    { name: 'name', label: 'اسم الأسرة', required: true, value: f?.name, placeholder: 'مثال: أسرة أحمد الشهري' },
    { name: 'parent_name', label: 'اسم ولي الأمر', value: f?.parent_name },
    [{ name: 'country', label: 'الدولة', type: 'select', required: true, value: f?.country || 'السعودية',
       options: Object.keys(COUNTRIES).map(k => ({ v: k, l: `${COUNTRIES[k].flag} ${k}` })) },
     { name: 'currency', label: 'عملة الدفع', type: 'select', required: true, value: f?.currency || 'SAR',
       options: CURRENCIES.map(c => ({ v: c, l: c })) }],
    { name: 'billing_cycle', label: 'طريقة المحاسبة', type: 'select', value: f?.billing_cycle || 'monthly', options: Object.entries(CYCLES).map(([v, l]) => ({ v, l })) },
    [{ name: 'cycle_start', label: 'بداية الباقة الحالية', type: 'date', value: f?.cycle_start || '', hint: 'للباقة بس — عدّ الحصص في التقرير بيبدأ من هنا' },
     { name: 'package_size', label: 'عدد حصص الباقة', type: 'number', value: f?.package_size ?? '', hint: 'مثال: 16' }],
    { name: 'whatsapp_group', label: 'لينك جروب واتساب الأسرة', type: 'url', value: f?.whatsapp_group, placeholder: 'https://chat.whatsapp.com/…' },
    { name: 'acquisition', label: 'جت لنا منين؟', value: f?.acquisition, placeholder: 'إحالة من أسرة … / حملة إعلانية / سوشيال ميديا', hint: 'بيظهر في لوحة الأعمال (مصادر العملاء)' },
    { name: 'whatsapp', label: 'رقم واتساب ولي الأمر', type: 'tel', value: f?.whatsapp, placeholder: '9665xxxxxxxx', hint: 'بكود الدولة — للاستخدام الداخلي فقط ولا يظهر للمعلم' },
    { name: 'notes', label: 'ملاحظات', type: 'textarea', value: f?.notes },
  ];
  let extra = '';
  if (isNew) extra = `<h3 class="mt">أول طالب (اختياري)</h3>` + [
    { name: 'st_name', label: 'اسم الطالب' },
    [{ name: 'st_grade', label: 'الصف', list: GRADES }, { name: 'st_curr', label: 'المنهج', type: 'select', value: 'arabic', options: Object.entries(CURRICULA).map(([v, l]) => ({ v, l })) }],
    { name: 'st_price', label: 'سعر الساعة (بعملة الأسرة)', type: 'number' },
  ].map(x => Array.isArray(x) ? `<div class="field-row">${x.map(fieldHtml).join('')}</div>` : fieldHtml(x)).join('');
  openModal(!isNew ? 'تعديل الأسرة' : 'أسرة جديدة', formHtml(fields, 'حفظ', extra));
  document.getElementById('f_country').addEventListener('change', e => {
    document.getElementById('f_currency').value = COUNTRIES[e.target.value].cur;
  });
  window._formSubmit = () => runSubmit(async () => {
    const row = { name: fv('name'), parent_name: fv('parent_name') || null, country: fv('country'), currency: fv('currency'), whatsapp: fv('whatsapp') || null, whatsapp_group: cleanGroup(fv('whatsapp_group')), acquisition: fv('acquisition') || null, billing_cycle: fv('billing_cycle'), cycle_start: fv('cycle_start') || null, package_size: fnum('package_size') || null, notes: fv('notes') || null };
    if (isNew && fv('st_name') && !fv('st_grade')) return formError('اكتب صف الطالب أو امسح اسمه');
    if (!isNew) {
      await q(sb.from('families').update(row).eq('id', f.id));
    } else {
      const [nf] = await q(sb.from('families').insert(row).select());
      if (pre?._leadId) { await q(sb.from('leads').update({ family_id: nf.id, status: 'won', stage: 4, status_at: new Date().toISOString() }).eq('id', pre._leadId)); state.leads = null; }
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
      ...tx.map(t => ({ at: t.created_at, desc: (t.type === 'refund' ? 'استرداد' : t.type === 'discount' ? '🎁 خصم' : 'دفعة') + (t.note ? ` — ${t.note}` : ''), amt: t.type === 'refund' ? -Number(t.amount) : Number(t.amount), id: t.id, kind: 'tx' })),
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
  if (t.type === 'discount') return { v: 0, est: false }; // الخصم مش فلوس داخلة
  const sign = t.type === 'refund' ? -1 : 1;
  if (t.received_egp != null) return { v: sign * Number(t.received_egp), est: false };
  return { v: sign * Number(t.amount) * Number(t.market_rate || fxRate(t.currency)), est: t.currency !== 'EGP' };
}
function txFxDiff(t) { // فرق العملة = الواصل فعلاً − المبلغ × سعر السوق يوم الدفع
  if (t.type === 'discount' || t.received_egp == null || t.currency === 'EGP' || !t.market_rate) return null;
  const sign = t.type === 'refund' ? -1 : 1;
  return sign * (Number(t.received_egp) - Number(t.amount) * Number(t.market_rate));
}
function openPaymentForm(familyId) {
  if (!state.families.length) { showToast('أضف أسرة الأول', true); switchTab('families'); return; }
  const fields = [
    { name: 'family_id', label: 'الأسرة', type: 'select', searchable: true, required: true, placeholder: 'اختر الأسرة…', value: familyId,
      options: state.families.map(f => ({ v: f.id, l: `${f.name} (${f.currency})` })) },
    [{ name: 'type', label: 'النوع', type: 'select', value: 'payment', options: [{ v: 'payment', l: 'دفعة مستلمة' }, { v: 'discount', l: '🎁 خصم للأسرة' }, { v: 'refund', l: 'استرداد للأسرة' }] },
     { name: 'method', label: 'طريقة الاستلام', type: 'select', value: 'ويسترن يونيون', options: PAY_METHODS.map(m => ({ v: m, l: m })) }],
    { name: 'amount', label: 'المبلغ اللي اتحسب للأسرة', type: 'number', required: true, hint: 'بعملة الأسرة' },
    { name: 'received_egp', label: 'المبلغ اللي وصلك فعلاً بالجنيه', type: 'number', hint: ' ' },
    { name: 'date', label: 'تاريخ الاستلام', type: 'date', value: todayStr() },
    { name: 'note', label: 'ملاحظة', placeholder: 'مثال: شهر أكتوبر — رقم الحوالة MTCN …' },
  ];
  openModal('تسجيل دفعة', formHtml(fields, 'تسجيل', `<label class="radio mb hidden" id="wrap_newpkg"><input type="checkbox" id="f_newpkg"> دي باقة جديدة — ابدأ عدّ الحصص من أول حصة بعد النهارده
    <span class="field-row" style="display:flex;gap:8px;align-items:center;margin-top:6px">عدد الحصص: <input id="f_newpkg_n" class="input" type="number" min="1" style="width:90px"></span></label>`));
  const $ = n => document.getElementById('f_' + n);
  const upd = () => {
    const f = byId(state.families, $('family_id').value);
    const cur = f?.currency || '';
    const np = document.getElementById('wrap_newpkg'); if (np) { np.classList.toggle('hidden', f?.billing_cycle !== 'prepaid'); const nn = document.getElementById('f_newpkg_n'); if (nn && !nn.value && f?.package_size) nn.value = f.package_size; }
    document.getElementById('hint_amount').textContent = cur ? `بالـ ${cur} — ده اللي بيتخصم من مستحقات الأسرة` : 'بعملة الأسرة';
    const egpFam = cur === 'EGP';
    const egpPay = $('method').value === 'استلام بالجنيه المصري';
    const isDisc = $('type').value === 'discount';
    document.getElementById('wrap_received_egp').classList.toggle('hidden', isDisc || egpFam || (!isAdmin && !egpPay));
    document.getElementById('wrap_method')?.classList.toggle('hidden', isDisc);
    document.querySelector('#wrap_amount label').textContent = isDisc ? 'قيمة الخصم' : 'المبلغ اللي اتحسب للأسرة';
    // استلام بالمصري: اكتب الجنيه واحنا نحسب المقابل بعملة الأسرة (لو المبلغ ماتكتبش يدوي)
    if (egpPay && !egpFam && document.activeElement === $('received_egp') && fxRate(cur)) {
      const g = Number($('received_egp').value) || 0;
      let a = g ? Math.round(g / (Math.round(fxRate(cur) * 100) / 100) * 100) / 100 : 0;
      const due = -famBalance(f).balance; // لو دفعوا مقابل الفاتورة بالظبط (فرق تقريب الجنيه) → نسجّل المستحق بالظبط
      if (a && due > 0 && Math.abs(a - due) <= Math.max(0.5, due * 0.01)) a = Math.round(due * 100) / 100;
      $('amount').value = a || '';
    }
    const amt = Number($('amount').value) || 0, got = Number($('received_egp').value) || 0, mr = fxRate(cur);
    let h = cur && !egpFam ? `بسعر السوق النهارده ≈ ${fmt(amt * mr, 2)} ج (1 ${cur} = ${fmt(mr, 4)} ج).` : '';
    if (got && amt && !egpFam) {
      const eff = got / amt, diff = got - amt * mr;
      h += ` السعر الفعلي اللي وصلك: ${fmt(eff, 4)} ج — ${diff >= 0 ? 'مكسب' : 'خسارة'} فرق عملة ${fmt(Math.abs(diff), 2)} ج.`;
    }
    if (egpPay && !egpFam) h = `اكتب الجنيهات اللي وصلت، والمقابل بالـ ${cur} هيتحسب لوحده فوق (بسعر ${fmt(mr, 2)}). لو دفعوا مقابل الفاتورة، هيتسجل المستحق بالظبط من غير كسور.`;
    else if (!egpFam) h += ' لو مش عارفه دلوقتي سيبه فاضي وعدّله بعدين.';
    document.getElementById('hint_received_egp').textContent = h;
    document.querySelector('#wrap_received_egp label').textContent = $('method').value === 'استلام بالجنيه المصري'
      ? 'المبلغ اللي استلمته بالجنيه *' : 'المبلغ اللي وصلك فعلاً بالجنيه';
  };
  ['family_id', 'amount', 'received_egp', 'method', 'type'].forEach(n => { $(n).addEventListener('input', upd); $(n).addEventListener('change', upd); });
  upd();
  window._formSubmit = () => runSubmit(async () => {
    const f = byId(state.families, fv('family_id'));
    const amount = fnum('amount');
    if (!(amount > 0)) return formError('اكتب مبلغ صحيح');
    const disc = fv('type') === 'discount';
    const got = disc ? null : f.currency === 'EGP' ? amount : fnum('received_egp');
    if (!disc && fv('method') === 'استلام بالجنيه المصري' && !(got > 0)) return formError('اكتب المبلغ اللي استلمته بالجنيه');
    const d = fv('date') ? new Date(`${fv('date')}T12:00:00`) : new Date();
    await q(sb.from('family_transactions').insert({ family_id: f.id, amount, currency: f.currency, type: fv('type'), method: disc ? 'خصم' : fv('method'),
      received_egp: got || null, note: fv('note') || null, created_at: d.toISOString() }));
    if (f.billing_cycle === 'prepaid' && document.getElementById('f_newpkg')?.checked)
      await q(sb.from('families').update({ cycle_start: fv('date') || todayStr(), package_size: Number(document.getElementById('f_newpkg_n').value) || f.package_size || null }).eq('id', f.id));
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
function finPeriod() { // فترة قسم المالية المختارة
  const r = state.fin?.range || finRange();
  const whole = r.fromD.getDate() === 1 && r.toD.getDate() === 1 && (r.toD.getMonth() - r.fromD.getMonth() + 12) % 12 === 1;
  if (r.sel && r.sel !== 'custom' && r.sel !== 'this' && r.sel !== 'last' && FIN_LBL[r.sel]) return { from: r.fromD, to: r.toD, label: `${FIN_LBL[r.sel]} (${r.fromD.toLocaleDateString('ar-EG-u-nu-latn', { month: 'short', year: 'numeric' })} – ${new Date(r.toD.getTime() - 864e5).toLocaleDateString('ar-EG-u-nu-latn', { month: 'short', year: 'numeric' })})` };
  return { from: r.fromD, to: r.toD, label: whole ? `شهر ${r.fromD.toLocaleDateString('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' })}` : `الفترة من ${r.from} إلى ${r.toIncl}` };
}
// ملخص لكل طالب: عدد الحصص لكل مادة والوقت والمبلغ
function perStudentSummary(ss) {
  const m = {};
  ss.forEach(s => { const x = m[s.student_id] ||= { mins: 0, amt: 0, subj: {} }; x.mins += sMins(s); x.amt += charges(s).fam; const k = s.subject || 'حصة'; x.subj[k] = (x.subj[k] || 0) + sMins(s) / 60; });
  return Object.entries(m).map(([sid, x]) => ({ st: byId(state.students, sid), ...x, n: x.mins / 60, subj: Object.fromEntries(Object.entries(x.subj).map(([k, v]) => [k, fmtU(v)])) })).sort((a, b) => (a.st?.name || '').localeCompare(b.st?.name || '', 'ar'));
}
// حصص معلمة واحدة مجمّعة لكل طالب (المجموعة سطر لوحدها)
function tutorStudentSummary(ss) {
  const m = {};
  occurrences(ss).forEach(o => {
    const key = o.group_key ? 'g:' + (o.group_series || o.group_name || o.group_key) : 's:' + o.student_id;
    const x = m[key] ||= { mins0: 0, who: o.group_key ? `👥 ${o.group_name || 'مجموعة'} (${groupNames(o._members)})` : (byId(state.students, o.student_id)?.name || ''), fam: o.group_key ? '' : byId(state.families, byId(state.students, o.student_id)?.family_id)?.name || '', n: 0, mins: 0, amt: 0, subjects: {} };
    x.mins += sMins(o); x.amt += occTut(o); const k = o.subject || 'حصة'; x.subjects[k] = (x.subjects[k] || 0) + sMins(o) / 60;
  });
  return Object.values(m).map(x => ({ ...x, n: x.mins / 60, subj: Object.keys(x.subjects).length > 1 ? Object.entries(x.subjects).map(([k, v]) => `${k} ${fmtU(v)}`).join('، ') : Object.keys(x.subjects)[0] })).sort((a, b) => b.n - a.n);
}
// عدد الحصص بالساعة: الساعة = حصة، نص الساعة = نص حصة
const fmtU = u => { u = Math.round(u * 100) / 100; return Number.isInteger(u) ? String(u) : fmt(u, 2).replace(/0$/, ''); };
const nSess = n => { n = Math.round(n * 100) / 100; return n === 1 ? 'حصة واحدة' : n === 2 ? 'حصتين' : n === 0.5 ? 'نص حصة' : `${fmtU(n)} ${Number.isInteger(n) && n >= 3 && n <= 10 ? 'حصص' : 'حصة'}`; };
const unitsOf = rows => rows.reduce((a, s) => a + sMins(s), 0) / 60;
const _invRate = {};
async function toggleInvoiceEgp(familyId, which, detailed) {
  const f = byId(state.families, familyId);
  try {
    await q(sb.from('families').update({ invoice_egp: !f.invoice_egp }).eq('id', familyId));
    f.invoice_egp = !f.invoice_egp;
    openFamilyInvoice(familyId, which, detailed);
  } catch (e) { showToast(dbError(e), true); }
}
async function openFamilyInvoice(familyId, which = null, detailed = false) {
  const f = byId(state.families, familyId);
  const cycle = f.billing_cycle || 'monthly';
  if (which === null) which = cycle === 'monthly' && new Date().getDate() <= 10 ? -1 : 0; // أول الشهر: الفاتورة غالباً عن الشهر اللي فات
  const p = which === 'fin' ? finPeriod() : periodFor(cycle, which);
  const studIds = state.students.filter(s => s.family_id === familyId).map(s => s.id);
  try {
    const [ss, tx, ssBefore, txBefore] = await Promise.all([
      studIds.length ? q(sb.from('sessions').select('*').in('student_id', studIds).eq('status', 'done')
        .gte('scheduled_at', p.from.toISOString()).lt('scheduled_at', p.to.toISOString()).order('scheduled_at')) : [],
      q(sb.from('family_transactions').select('*').eq('family_id', familyId).gte('created_at', p.from.toISOString()).lt('created_at', p.to.toISOString())),
      studIds.length ? q(sb.from('sessions').select('*').in('student_id', studIds).eq('status', 'done').lt('scheduled_at', p.from.toISOString())) : [],
      q(sb.from('family_transactions').select('*').eq('family_id', familyId).lt('created_at', p.from.toISOString())),
    ]);
    const c = COUNTRIES[f.country] || COUNTRIES['مصر'];
    const sum = (rows) => rows.reduce((a, s) => a + charges(s).fam, 0);
    const paidOf = (rows) => rows.reduce((a, t) => a + (t.type === 'refund' ? -1 : 1) * Number(t.amount), 0);
    const discOf = rows => rows.filter(t => t.type === 'discount').reduce((a, t) => a + Number(t.amount), 0);
    const bill = ss.filter(s => charges(s).fam > 0), free = ss.filter(s => !(charges(s).fam > 0)); // المجانية / المش محسوبة ما تدخلش في العدد
    const freeMins = free.reduce((a, s) => a + sMins(s), 0);
    const total = sum(ss), mins = bill.reduce((a, s) => a + sMins(s), 0), paid = paidOf(tx);
    const prev = paidOf(txBefore) - sum(ssBefore);          // رصيد قبل الفترة (+ لصالحهم / − عليهم)
    const bal = prev + paid - total;                         // الرصيد في نهاية الفترة
    const cur = f.currency;
    // المقابل بالجنيه: بسعر السوق النهارده (قابل للتعديل)، والمبلغ بيتقرّب لأعلى جنيه
    const showEgp = cur !== 'EGP' && !!f.invoice_egp;
    const rate = showEgp ? (Number(_invRate[familyId]) || Math.round(fxRate(cur) * 100) / 100) : 0;
    const egpOf = v => Math.ceil(v * rate);
    const egpLine = showEgp && bal < 0 && rate > 0
      ? `\nبالجنيه المصري: *${fmt(egpOf(-bal), 0)} ج.م*\n(سعر الصرف: 1 ${cur} = ${fmt(rate, 2)} ج — بتاريخ ${new Date().toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' })})` : '';
    const lines = detailed
      ? ss.map(s => { const v = sessionView(s);
          return `• ${new Date(s.scheduled_at).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'numeric', timeZone: c.tz })} — ${v.st?.name || ''}${s.subject ? ': ' + s.subject : ''}${s.kind === 'regular' || s.kind === 'group' ? '' : ` (${kindWord(s)})`}${s.group_key ? ' 👥' : ''} — ${durLabel(sMins(s))} = ${!(charges(s).fam > 0) ? (s.kind === 'trial' ? 'مجانية 🎁' : 'مش محسوبة عليكم ✓') : `${fmt(charges(s).fam, 2)} ${cur}`}`; }).join('\n')
      : perStudentSummary(bill).map(x => `• *${x.st?.name || ''}*: ${nSess(x.n)} (${Object.entries(x.subj).map(([k, n]) => `${k} ${n}`).join('، ')}) — ${durLabel(x.mins)} = ${fmt(x.amt, 2)} ${cur}`).join('\n');
    const closing = cycle === 'prepaid'
      ? (bal <= 0 ? 'رصيد الباقة خلص، برجاء التجديد لاستمرار الحصص 🙏' : lowPrepaid(f) ? 'رصيد الباقة قرب يخلص، برجاء التجديد قريب 🙏' : 'شكراً لثقتكم 🌷')
      : (bal < 0 ? 'برجاء التكرم بسداد المستحق، ولأي استفسار إحنا موجودين 🙏' : 'شكراً لالتزامكم 🌷');
    const text = `السلام عليكم ورحمة الله 🌷
${cycle === 'prepaid' ? 'كشف رصيد الباقة' : 'فاتورة حصص'} ${p.label} — ${f.name}

${lines || '— لا توجد حصص منفذة في الفترة —'}

عدد الحصص: ${fmtU(unitsOf(bill))} (الساعة = حصة) · إجمالي الوقت: ${mins ? durLabel(mins) : '0'}${freeMins ? `\n＋ ${durLabel(freeMins)} ${free.every(x => x.kind === 'trial') ? 'تجريبية مجانية' : 'مش محسوبة عليكم'} 🎁` : ''}
إجمالي الحصص: *${fmt(total, 2)} ${cur}*${Math.abs(prev) >= 0.01 ? `\n${prev < 0 ? 'متأخرات سابقة' : 'رصيد سابق لصالحكم'}: ${fmt(Math.abs(prev), 2)} ${cur}` : ''}${paid - discOf(tx) ? `\nالمدفوع في الفترة: ${fmt(paid - discOf(tx), 2)} ${cur}` : ''}${discOf(tx) ? `\nخصم: ${fmt(discOf(tx), 2)} ${cur} 🎁` : ''}
${bal < 0 ? `المطلوب سداده: *${fmt(-bal, 2)} ${cur}*${egpLine}` : `الرصيد لصالحكم: *${fmt(bal, 2)} ${cur}*`}

${closing}
${SIGN_F}`;
    const F = jsq(familyId), W = jsq(which);
    const chip = (w, label) => `<button class="chip ${which === w ? 'active' : ''}" onclick="openFamilyInvoice(${F}, ${jsq(w)}, ${detailed})">${label}</button>`;
    const nowBal = famBalance(f).balance;
    openModal(`${cycle === 'prepaid' ? 'كشف رصيد' : 'فاتورة'} — ${f.name}`, `
      <div class="chips"><span class="sub small" style="align-self:center">${CYCLES[cycle]}:</span>
        ${chip(0, periodFor(cycle, 0).label)}${chip(-1, periodFor(cycle, -1).label)}
        ${state.fin ? chip('fin', '📊 ' + finPeriod().label + ' (من المالية)') : ''}</div>
      <div class="chips"><button class="chip ${!detailed ? 'active' : ''}" onclick="openFamilyInvoice(${F}, ${W}, false)">ملخص لكل طالب</button>
        <button class="chip ${detailed ? 'active' : ''}" onclick="openFamilyInvoice(${F}, ${W}, true)">بالتفصيل حصة حصة</button></div>
      ${cur !== 'EGP' ? `<div class="chips"><button class="chip ${showEgp ? 'active' : ''}" onclick="toggleInvoiceEgp(${F}, ${W}, ${detailed})">💱 ${showEgp ? 'المقابل بالمصري ظاهر' : 'اكتب المقابل بالجنيه المصري'}</button>
        ${showEgp ? `<span class="sub small" style="align-self:center">سعر ${cur}:</span><input class="input" type="number" step="0.01" style="width:90px" value="${rate}"
          onchange="_invRate[${F}]=Number(this.value)||0; openFamilyInvoice(${F}, ${W}, ${detailed})">
          <span class="sub small" style="align-self:center">(سعر السوق النهارده ${fmt(fxRate(cur), 2)})</span>` : ''}</div>` : ''}
      <div class="msg-preview">${esc(text)}</div>${msgActionsHtml(text, { group: f.whatsapp_group, phone: f.whatsapp, country: f.country, editFamily: f.id })}
      ${Math.abs(nowBal - bal) >= 0.01 ? `<p class="sub small mt">ℹ️ الفاتورة محسوبة لحد آخر ${p.label}. رصيد الأسرة النهارده: ${nowBal < 0 ? 'عليها' : 'لها'} ${fmt(Math.abs(nowBal), 2)} ${cur} (فيه حصص أو دفعات بعد الفترة).</p>` : ''}`);
  } catch (e) { showToast(dbError(e), true); }
}

/* ----- كشف المعلمة عن فترة (للتسوية الشهرية) ----- */
async function openTutorPeriodMessage(tutorId, detailed = false) {
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
    const lines = detailed
      ? oc.map(s => `• ${new Date(s.scheduled_at).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'numeric' })} — ${occWho(s)}${s.subject ? ' (' + s.subject + ')' : ''}${s.kind === 'regular' || s.kind === 'group' ? '' : ' ' + kindWord(s)} — ${durLabel(sMins(s))} = ${fmt(occTut(s), 2)} ج`).join('\n')
      : tutorStudentSummary(ss).map(x => `• ${x.who}: ${nSess(x.n)}${x.subj ? ` (${x.subj})` : ''} — ${durLabel(x.mins)} = ${fmt(x.amt, 2)} ج`).join('\n');
    const text = `${greetTutor(t.name)}
كشف حصصك عن ${label}:
${lines || '— لا توجد حصص —'}

إجمالي الوقت: ${mins ? durLabel(mins) : '0'}
إجمالي المستحق عن الفترة: *${fmt(earned, 2)} جنيه*${paid ? `\nتم تحويل: ${fmt(paid, 2)} جنيه` : ''}
${b.due > 0.01 ? `المتبقي لكِ حالياً: *${fmt(b.due, 2)} جنيه*` : b.due < -0.01 ? `💚 مدفوع لكِ مقدّم: *${fmt(-b.due, 2)} جنيه* — هيتخصم من الحصص الجاية` : 'لا يوجد متبقي ✅'}

لو فيه أي ملاحظة على الكشف بلّغينا قبل التحويل.
${SIGN_T}`;
    const T = jsq(tutorId);
    openModal(`كشف ${label} — ${t.name}`, `<div class="chips"><button class="chip ${!detailed ? 'active' : ''}" onclick="openTutorPeriodMessage(${T}, false)">ملخص لكل طالب</button>
      <button class="chip ${detailed ? 'active' : ''}" onclick="openTutorPeriodMessage(${T}, true)">بالتفصيل حصة حصة</button></div>
      <div class="msg-preview">${esc(text)}</div>${msgActionsHtml(text, { group: t.whatsapp_group, phone: t.phone, editTutor: t.id })}`);
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
  { const act = state.act || { tut: new Set() }; const due = state.tutors.filter(t => tutBalance(t).due > 0.01);
    document.getElementById('tutors-stats').innerHTML = `<div class="sstat"><b class="num">${state.tutors.length}</b><span>معلم/ة</span></div><div class="sstat"><b class="num pos">${act.tut.size}</b><span>شغالين آخر 30 يوم</span></div>
      <div class="sstat"><b class="num">${state.tutors.filter(t => t.user_id).length}</b><span>على البوابة</span></div><div class="sstat"><b class="num">${new Set(state.plans.filter(p => p.tutor_id).map(p => p.student_id)).size}</b><span>طالب ليه معلم ثابت</span></div>
      <div class="sstat"><b class="num ${due.length ? 'neg' : ''}">${fmt(Math.round(due.reduce((a, t) => a + tutBalance(t).due, 0)))}</b><span>ج مستحقات لـ ${due.length}</span></div>`; }
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
          <div class="num ${b.due > 0.01 ? 'neg' : b.due < -0.01 ? 'pos' : ''}" style="font-weight:800">${money(Math.abs(b.due), 'EGP')}</div>
          <div class="sub small">${b.due < -0.01 ? 'مدفوع مقدّم (للحصص الجاية)' : 'مستحقات لم تُصرف'}</div>
        </div>
      </div>
      ${t.whatsapp_group || t.phone ? `<div class="actions" style="margin-top:8px">
        ${t.whatsapp_group ? `<a class="btn btn-wa sm" href="${esc(t.whatsapp_group)}" target="_blank" rel="noopener">💬 جروب المعلم</a>` : ''}
        ${t.phone ? `<a class="btn btn-ghost sm" href="https://wa.me/${waNumber(t.phone, 'مصر')}" target="_blank" rel="noopener">واتساب خاص</a>` : ''}
      </div>` : ''}
      <div class="meta">
        ${t.default_rate_egp != null ? `<span>أجر الساعة: <b>${fmt(t.default_rate_egp)} EGP</b></span>` : `<span><a href="javascript:void(0)" onclick="openTutorForm(${tid})">حدد أجر الساعة</a></span>`}
        <span>حصص تمت: <b>${b.count}</b></span>
        <span>البوابة: ${t.user_id ? `<b class="pos">✅ مفعّلة</b>${t.portal_last_seen ? ` <span class="sub small">(آخر دخول ${ago(t.portal_last_seen)})</span>` : ''}` : t.email ? '<b class="warn-txt">مستنية تدخل</b>' : '<span class="sub">مش مفعّلة</span>'}</span>
        ${t.vodafone_cash ? `<span>${/^[^:]+:/.test(t.vodafone_cash) ? 'تحويل' : 'فودافون كاش'}: <b dir="ltr">${esc(t.vodafone_cash)}</b></span>` : ''}
        ${t.bank_account ? `<span>${/^[^:]+:/.test(t.bank_account) ? 'تحويل' : 'بنك'}: <b>${esc(t.bank_account)}</b></span>` : ''}
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
        ${!t.user_id ? `<button class="btn btn-ghost sm" onclick="openTutorInvite(${tid})">📲 دعوة للبوابة</button>` : ''}
        <button class="btn btn-ghost sm" onclick="tutorPreview(${tid})">👁 شوف بوابتها</button>
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
function openTutorInvite(id) {
  const t = byId(state.tutors, id);
  if (!t.email) { showToast('اكتب إيميل المعلمة الأول (جيميل أحسن)', true); return openTutorForm(id); }
  const url = location.origin + location.pathname;
  const text = `${greetTutor(t.name)}
عملنالك حساب على *بوابة المعلمات — أستاذ أونلاين* 🎉
فيها هتلاقي:
📅 جدول حصصك النهارده والأسبوع ده
🔔 تذكير على الموبايل قبل كل حصة بـ 15 دقيقة
🔗 مكان تحطي فيه لينك الزوم لكل طالب مرة واحدة
💰 حصصك ومستحقك لكل طالب أول بأول

ادخلي من هنا: ${url}
دوسي "الدخول بحساب جوجل" واختاري الإيميل ده: ${t.email}
(أو "سجّل حساب جديد" بنفس الإيميل وأي باسورد)

📱 على الآيفون: افتحي اللينك من Safari ← زرار المشاركة ⬆︎ ← "إضافة إلى الشاشة الرئيسية" عشان يوصلك التذكير.
📱 على أندرويد: افتحيه من Chrome ← ⋮ ← "إضافة إلى الشاشة الرئيسية".
${SIGN_T}`;
  openModal(`دعوة ${t.name} للبوابة`, `<div class="msg-preview">${esc(text)}</div>${msgActionsHtml(text, { group: t.whatsapp_group, phone: t.phone, editTutor: t.id })}
    <p class="sub small mt">أول ما تدخل بالإيميل ده هتتربط بحسابها تلقائياً، وكارتها هيبقى "✅ مفعّلة". مش هتشوف أي بيانات أو أرقام للأسر ولا أسعارهم.</p>`);
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
    { name: 'meeting_link', label: 'لينك الحصة الثابت (زووم / ميت)', type: 'url', value: t?.meeting_link, placeholder: 'https://zoom.us/j/…', hint: 'بيتحط لوحده على كل حصص المعلمة اللي مالهاش لينك خاص بالطالب' },
    { name: 'email', label: 'إيميل المعلمة (للدخول على بوابة المعلمات)', type: 'email', value: t?.email, placeholder: 'name@gmail.com',
      hint: t?.user_id ? '✅ المعلمة دخلت البوابة بالإيميل ده' : 'بعد الحفظ دوس "📲 دعوة للبوابة" من كارت المعلمة' },
    { name: 'notes', label: 'ملاحظات', type: 'textarea', value: t?.notes },
  ];
  const subjBlock = `<div class="field"><label>المواد اللي بيدرّسها</label>
    <datalist id="subj-list">${['رياضيات', 'لغة عربية', 'English', 'علوم', 'فيزياء', 'كيمياء', 'أحياء', 'Math', 'Science', 'French', 'دراسات اجتماعية', 'قرآن'].map(x => `<option value="${x}">`).join('')}</datalist>
    <div id="subj-rows">${(subs.length ? subs : [{}]).map(subjRowHtml).join('')}</div>
    <button type="button" class="btn btn-ghost sm" onclick="document.getElementById('subj-rows').insertAdjacentHTML('beforeend', subjRowHtml())">+ مادة</button></div>`;
  openModal(t ? 'تعديل معلم' : 'معلم جديد', formHtml(fields, 'حفظ', subjBlock));
  window._formSubmit = () => runSubmit(async () => {
    const row = { name: fv('name'), phone: fv('phone') || null, whatsapp_group: cleanGroup(fv('whatsapp_group')), default_rate_egp: fnum('default_rate_egp'),
      vodafone_cash: fv('vodafone_cash') || null, bank_account: fv('bank_account') || null, notes: fv('notes') || null, email: fv('email').toLowerCase() || null, meeting_link: fv('meeting_link').trim() || null };
    if (t && t.user_id && (t.email || '') !== (row.email || '') && !confirm('المعلمة مربوطة بالإيميل القديم — تغيير الإيميل مش هيفصلها. تكمل؟')) return;
    let tutorId = t?.id;
    if (t) await q(sb.from('tutors').update(row).eq('id', t.id));
    if (t && row.meeting_link && row.meeting_link !== t.meeting_link) { // اللينك الجديد يتطبق على الطلاب والحصص الجاية اللي ماخدتش لينك خاص
      await q(sb.from('student_subjects').update({ meeting_link: row.meeting_link }).eq('tutor_id', t.id).or(`meeting_link.is.null${t.meeting_link ? `,meeting_link.eq."${t.meeting_link}"` : ''}`));
      await q(sb.from('sessions').update({ meeting_link: row.meeting_link }).eq('tutor_id', t.id).eq('status', 'scheduled').gte('scheduled_at', new Date().toISOString()).or(`meeting_link.is.null${t.meeting_link ? `,meeting_link.eq."${t.meeting_link}"` : ''}`));
    }
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
    { name: 'total_egp', label: 'المبلغ المصروف (EGP)', type: 'number', required: true, value: Math.max(b.due, 0).toFixed(2), hint: b.due < -0.01 ? `ليها رصيد مقدّم ${money(-b.due, 'EGP')} — أي مبلغ هتصرفه هيزود المقدّم` : `إجمالي المستحق حالياً: ${money(b.due, 'EGP')}` },
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
const ACADEMY_START = new Date(2025, 5, 1); // أول شهر في الأكاديمية (يونيو 2025)
const acadStart = d => new Date(d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1, 8, 1); // السنة الدراسية بتبدأ سبتمبر (يوليو وأغسطس إجازة الصيف في آخرها)
const FIN_LBL = { this: 'الشهر ده', last: 'الشهر اللي فات', q: 'آخر 3 شهور', year: 'السنة دي', lastyear: 'السنة اللي فاتت', ayear: 'السنة الدراسية دي', lastayear: 'السنة الدراسية اللي فاتت', all: 'كل الفترة من أول الأكاديمية' };
function finRange() {
  const sel = document.getElementById('fin-period').value;
  const now = new Date(), Y = now.getFullYear(), M = now.getMonth();
  let from, to;
  if (sel === 'last') { from = new Date(Y, M - 1, 1); to = new Date(Y, M, 1); }
  else if (sel === 'q') { from = new Date(Y, M - 2, 1); to = new Date(Y, M + 1, 1); }
  else if (sel === 'year') { from = new Date(Y, 0, 1); to = new Date(Y, M + 1, 1); }
  else if (sel === 'lastyear') { from = new Date(Y - 1, 0, 1); to = new Date(Y, 0, 1); }
  else if (sel === 'ayear') { from = acadStart(now); to = new Date(Y, M + 1, 1); }
  else if (sel === 'lastayear') { from = addMonths(acadStart(now), -12); to = acadStart(now); }
  else if (sel === 'all') { from = new Date(ACADEMY_START.getTime()); to = new Date(Y, M + 1, 1); }
  else if (sel === 'custom') {
    const a = document.getElementById('fin-from').value, b = document.getElementById('fin-to').value;
    from = a ? parseDay(a) : new Date(Y, M, 1);
    to = b ? new Date(parseDay(b).getTime() + 864e5) : new Date(Y, M + 1, 1);
  } else { from = new Date(Y, M, 1); to = new Date(Y, M + 1, 1); }
  return { fromD: from, toD: to, from: dateStr(from), toIncl: dateStr(new Date(to.getTime() - 864e5)), sel };
}
function onFinPeriod() {
  const custom = document.getElementById('fin-period').value === 'custom';
  ['fin-from', 'fin-to'].forEach(i => document.getElementById(i).classList.toggle('hidden', !custom));
  if (custom && !document.getElementById('fin-from').value) {
    const r = finRange(); document.getElementById('fin-from').value = r.from; document.getElementById('fin-to').value = r.toIncl;
  }
  loadFinance();
}
const monthKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
async function loadFinance(silent) {
  const r = finRange();
  if (!silent) setLoading(true);
  try {
    const mFrom0 = addMonths(new Date(r.fromD.getFullYear(), r.fromD.getMonth(), 1), -24), mFrom = mFrom0 < ACADEMY_START ? mFrom0 : new Date(ACADEMY_START.getTime()); // لمقارنة الفترة اللي قبلها والسنة اللي فاتت
    const nowM = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const mTo = addMonths(r.toD > addMonths(nowM, 1) ? r.toD : addMonths(nowM, 1), -1); // لازم يغطي السنة الدراسية دي عشان المقارنة
    const [sessions, tx, payouts, expenses, monthly, history] = await Promise.all([
      q(sb.from('sessions').select('*').gte('scheduled_at', r.fromD.toISOString()).lt('scheduled_at', r.toD.toISOString())),
      q(sb.from('family_transactions').select('*').gte('created_at', r.fromD.toISOString()).lt('created_at', r.toD.toISOString()).order('created_at', { ascending: false })),
      q(sb.from('tutor_payouts').select('*').gte('created_at', r.fromD.toISOString()).lt('created_at', r.toD.toISOString()).order('created_at', { ascending: false })),
      isAdmin ? q(sb.from('expenses').select('*').gte('period_month', dateStr(new Date(r.fromD.getFullYear(), r.fromD.getMonth(), 1))).lt('period_month', dateStr(r.toD)).order('period_month', { ascending: false }).order('paid_at', { ascending: false })) : [],
      isAdmin ? sb.rpc('finance_monthly', { p_from: dateStr(mFrom), p_to: dateStr(mTo) }).then(x => x.data || []) : [],
      isAdmin ? sb.from('finance_history').select('*').order('period_start').then(x => x.data || []) : [],
    ]);
    state.fin = { sessions, tx, payouts, expenses, monthly, history, range: r };
    state.collect = null;
    if (!state.finTab || (!isAdmin && ['expenses', 'monthly'].includes(state.finTab))) state.finTab = 'overview';
    renderFinance();
  } catch (e) { showToast(dbError(e), true); }
  finally { if (!silent) setLoading(false); }
}
// مجموع الشهور من الملخص الشهري لفترة [from, to)
function monthlySum(from, to) {
  const a = monthKey(from), b = monthKey(addMonths(to, -1)), z = { rev: 0, tc: 0, ex: 0, sal: 0, cin: 0, po: 0, h: 0, n: 0, months: 0, any: false };
  (state.fin.monthly || []).forEach(m => { const k = m.month.slice(0, 7); if (k >= a && k <= b) {
    z.rev += +m.revenue_egp; z.tc += +m.tutor_cost_egp; z.ex += +m.expenses_egp; z.sal += +m.salaries_egp; z.cin += +m.cash_in_egp; z.po += +m.payouts_egp; z.h += +m.hours; z.n += +m.sessions; z.months++;
    if (+m.sessions || +m.cash_in_egp || +m.expenses_egp) z.any = true; } });
  z.net = z.rev - z.tc - z.ex; z.cash = z.cin - z.po - z.ex;
  return z;
}
function finCompare() { // الفترة اللي قبلها بنفس الطول + نفس الفترة السنة اللي فاتت (بالشهور)
  const r = state.fin.range, f = new Date(r.fromD.getFullYear(), r.fromD.getMonth(), 1), t = r.toD.getDate() === 1 ? r.toD : addMonths(r.toD, 1);
  const len = (t.getFullYear() - f.getFullYear()) * 12 + t.getMonth() - f.getMonth();
  return { prev: monthlySum(addMonths(f, -len), f), ly: monthlySum(addMonths(f, -12), addMonths(t, -12)), len };
}
const deltaHtml = (cur, old, has, inverse) => {
  if (!has) return '<span class="sub">—</span>';
  if (!old) return cur ? '<span class="sub">جديد</span>' : '<span class="sub">—</span>';
  const p = (cur - old) / Math.abs(old) * 100, good = inverse ? p <= 0 : p >= 0;
  return `<span class="${good ? 'pos' : 'neg'}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p) >= 100 ? Math.round(Math.abs(p)) : Math.abs(p).toFixed(1)}%</span>`;
};
function kpiCard(label, val, sub, cmp, opts = {}) {
  return `<div class="card kpi ${opts.cls || ''}"><div class="l">${label}</div><div class="v num ${opts.vcls || ''}">${val}</div>${sub ? `<div class="s">${sub}</div>` : ''}
    ${cmp ? `<div class="s kpi-cmp">${cmp}</div>` : ''}</div>`;
}
function setFinTab(t) { state.finTab = t; renderFinance(); try { document.getElementById('fin-content').scrollIntoView({ block: 'start' }); } catch (e) {} }
function finSearch(kind, v) { state['finQ_' + kind] = v; const w = normAr(v); document.querySelectorAll(`#fin-${kind}-list [data-q]`).forEach(r => r.classList.toggle('hidden', !!w && !r.dataset.q.includes(w))); finCount(kind); }
function finFilter(kind, f) { state['finF_' + kind] = f; renderFinance(); }
function finCount(kind) { const el = document.getElementById(`fin-${kind}-count`); if (el) el.textContent = document.querySelectorAll(`#fin-${kind}-list [data-q]:not(.hidden)`).length; }

function renderFinance() {
  const { sessions, tx, payouts, expenses = [], range } = state.fin;
  const done = sessions.filter(s => s.status === 'done');
  const discEgp = tx.filter(t => t.type === 'discount').reduce((a, t) => a + Number(t.amount) * Number(t.market_rate || fxRate(t.currency)), 0);
  const hz = histInRange(range); // الشهور القديمة المتسجلة إجمالي (قبل السيستم)
  const rev = done.reduce((a, s) => a + Number(s.revenue_egp || 0), 0) - discEgp + hz.rev;
  const cost = done.reduce((a, s) => a + charges(s).tut, 0) + hz.tc;
  const hoursDone = occurrences(done).reduce((a, s) => a + sMins(s), 0) / 60 + hz.h;
  const exp = expenses.reduce((a, e) => a + Number(e.amount_egp), 0) + hz.ex, sal = expenses.filter(e => e.category === 'salary').reduce((a, e) => a + Number(e.amount_egp), 0) + hz.ex;
  const net = rev - cost - exp;
  let cashIn = hz.rev, estCount = 0, fxDiff = 0, fxKnown = 0; const collected = {};
  tx.forEach(t => { const e = txEgp(t); cashIn += e.v; if (e.est) estCount++; const d = txFxDiff(t); if (d != null) { fxDiff += d; fxKnown++; }
    if (t.type !== 'discount') collected[t.currency] = (collected[t.currency] || 0) + (t.type === 'refund' ? -1 : 1) * Number(t.amount); });
  const paidOut = payouts.filter(p => p.paid).reduce((a, p) => a + Number(p.total_egp), 0) + hz.tc;
  // أرصدة دلوقتي
  const owing = state.families.map(f => ({ f, b: famBalance(f) })).filter(x => x.b.balance < -0.01);
  const recvEgp = owing.reduce((a, x) => a + -x.b.balance * fxRate(x.f.currency), 0);
  const recvByCur = {}; owing.forEach(x => recvByCur[x.f.currency] = (recvByCur[x.f.currency] || 0) - x.b.balance);
  const tutDue = state.tutors.map(t => tutBalance(t).due).filter(d => d > 0.01).reduce((a, d) => a + d, 0);
  const tutDueN = state.tutors.filter(t => tutBalance(t).due > 0.01).length;
  const activeStu = new Set(done.map(s => s.student_id)).size;

  const tab = state.finTab || 'overview';
  const tabs = [['overview', '📊 الملخص'], ['families', '👨‍👩‍👧 الأسر'], ['tutors', '👩‍🏫 المعلمين'], ['collect', '📥 التحصيل'], ['payments', '💳 الدفعات والحصص'],
    ...(isAdmin ? [['expenses', '🧾 الرواتب والمصروفات'], ['monthly', '📈 شهر بشهر']] : [])];
  const tabBar = `<div class="chips fin-tabs">${tabs.map(([k, l]) => `<button class="chip ${tab === k ? 'active' : ''}" onclick="setFinTab('${k}')">${l}</button>`).join('')}</div>`;
  const periodLbl = finPeriod().label;
  let body = '';

  if (tab === 'overview') {
    const c = isAdmin ? finCompare() : null;
    const cm = (cur, key, inv) => c ? `مقابل الفترة اللي قبلها ${deltaHtml(cur, c.prev[key], c.prev.any, inv)} · السنة اللي فاتت ${deltaHtml(cur, c.ly[key], c.ly.any, inv)}` : '';
    body = `
      ${isAdmin ? `<div class="section-title"><h2>الربح عن ${esc(periodLbl)}</h2></div>
      ${hz.n ? `<p class="sub small mb">📚 الفترة دي فيها ${hz.n === 1 ? 'شهر' : hz.n + ' شهور'} من الحسابات القديمة (قبل السيستم) — داخلين في الأرقام كإجمالي، ومعتبرين اتحصّلوا واتصرفوا للمعلمين. تفاصيلهم في "📈 شهر بشهر".</p>` : ''}
      <div class="kpis">
        ${kpiCard('إيراد الحصص اللي تمت', fmt(Math.round(rev)), `ج · ${nSess(unitsOf(occurrences(done)))} · ${fmt(hoursDone, 1)} ساعة`, cm(rev, 'rev'))}
        ${kpiCard('مستحقات المعلمين', fmt(Math.round(cost)), 'ج عن حصص الفترة', cm(cost, 'tc', true))}
        ${kpiCard('الرواتب والمصروفات', fmt(Math.round(exp)), sal ? `ج · منها رواتب ${fmt(sal)}` : 'ج', cm(exp, 'ex', true))}
        ${kpiCard('صافي الربح', fmt(Math.round(net)), `ج · ${rev ? Math.round(net / rev * 100) : 0}% من الإيراد`, cm(net, 'net'), { vcls: net >= 0 ? 'pos' : 'neg', cls: 'kpi-hero' })}
      </div>
      <div class="section-title"><h2>الكاش في ${esc(periodLbl)}</h2></div>
      <div class="kpis">
        ${kpiCard('الفلوس اللي دخلت', fmt(Math.round(cashIn)), `ج · ${Object.entries(collected).map(([cu, v]) => `${fmt(v)} ${cu}`).join(' + ') || '—'}${estCount ? ` · ${estCount} مقدّرة` : ''}`, cm(cashIn, 'cin'))}
        ${kpiCard('اتحوّل للمعلمين', fmt(Math.round(paidOut)), 'ج', cm(paidOut, 'po', true))}
        ${kpiCard('رواتب ومصروفات', fmt(Math.round(exp)), 'ج')}
        ${kpiCard('صافي الكاش', fmt(Math.round(cashIn - paidOut - exp)), 'ج = اللي دخل − المعلمين − المصروفات', '', { vcls: cashIn - paidOut - exp >= 0 ? 'pos' : 'neg' })}
        ${kpiCard('فرق العملة', fxKnown ? (fxDiff >= 0 ? '+' : '') + fmt(fxDiff) : '—', fxKnown ? `ج · من ${fxKnown} تحويل مقابل سعر السوق` : 'سجّل اللي وصل بالجنيه مع الدفعات', '', { vcls: fxDiff >= 0 ? 'pos' : 'neg' })}
      </div>` : `<div class="section-title"><h2>${esc(periodLbl)}</h2></div>
      <div class="kpis">${kpiCard('مستحقات المعلمين عن الفترة', fmt(Math.round(cost)), `ج · ${nSess(unitsOf(occurrences(done)))}`)}${kpiCard('اتحوّل للمعلمين', fmt(Math.round(paidOut)), 'ج')}${kpiCard('دفعات من الأسر', String(tx.length), 'دفعة في الفترة')}</div>`}
      <div class="section-title"><h2>الوضع دلوقتي</h2></div>
      <div class="kpis">
        <div class="card kpi clickable" onclick="state.finF_families='owing'; setFinTab('families')"><div class="l">فلوس عند الأسر</div><div class="v num neg">${isAdmin ? fmt(Math.round(recvEgp)) : owing.length}</div>
          <div class="s">${isAdmin ? `ج تقريباً · ${owing.length} أسرة` : 'أسرة عليها فلوس'} · ${Object.entries(recvByCur).map(([cu, v]) => `<bdi>${fmt(v)} ${cu}</bdi>`).join(' + ') || '—'}</div><div class="s kpi-cmp">اعرض الأسر ←</div></div>
        <div class="card kpi clickable" onclick="state.finF_tutors='due'; setFinTab('tutors')"><div class="l">لسه للمعلمين</div><div class="v num">${fmt(Math.round(tutDue))}</div><div class="s">ج · ${tutDueN} معلم/ة</div><div class="s kpi-cmp">اعرض المعلمين ←</div></div>
        ${kpiCard('طلاب حضروا في الفترة', String(activeStu), `${new Set(done.map(s => s.tutor_id)).size} معلم/ة شغالين`)}
      </div>
      ${isAdmin ? finYearsHtml() : ''}
      ${isAdmin ? finChartHtml(range) : ''}
      ${isAdmin ? finFxHtml(done) : ''}`;
  }

  if (tab === 'families') {
    const famPeriod = {};
    done.forEach(s => { const st = byId(state.students, s.student_id); if (!st) return; const x = famPeriod[st.family_id] ||= { charge: 0, mins: 0 }; const ch = charges(s).fam; x.charge += ch; if (ch > 0) x.mins += sMins(s); });
    const famPaid = {}; tx.forEach(t => famPaid[t.family_id] = (famPaid[t.family_id] || 0) + (t.type === 'refund' ? -1 : 1) * Number(t.amount));
    const F = state.finF_families || 'active';
    const all = state.families.map(f => ({ f, p: famPeriod[f.id] || { charge: 0, mins: 0 }, paid: famPaid[f.id] || 0, b: famBalance(f) }));
    const test = (k, x) => k === 'all' ? true : k === 'owing' ? x.b.balance < -0.01 : k === 'clear' ? Math.abs(x.b.balance) <= 0.01 && !!(x.p.charge || x.paid) : k === 'credit' ? x.b.balance > 0.01 : k === 'paid' ? x.paid > 0 : k === 'low' ? lowPrepaid(x.f) : !!(x.p.charge || x.paid || x.b.balance < -0.01 || lowPrepaid(x.f));
    const rows = all.filter(x => test(F, x)).sort((a, b) => a.b.balance - b.b.balance || a.f.name.localeCompare(b.f.name, 'ar'));
    const cnt = k => all.filter(x => test(k, x)).length;
    const chips = [['active', 'فيها حركة'], ['owing', '🔴 عليها فلوس'], ['clear', '✅ خالصة'], ['credit', '🟢 ليها رصيد'], ['paid', '💳 دفعت في الفترة'], ['low', '🪫 الباقة قربت تخلص'], ['all', 'الكل']];
    body = `<div class="fin-tools"><input class="input search" placeholder="🔎 ابحث باسم الأسرة أو الطالب أو البلد…" value="${esc(state.finQ_families || '')}" oninput="finSearch('families', this.value)">
        <span class="sub small"><b id="fin-families-count">${rows.length}</b> أسرة</span></div>
      <div class="chips">${chips.map(([k, l]) => { const n = cnt(k); return `<button class="chip ${F === k ? 'active' : ''}" onclick="finFilter('families','${k}')">${l} <span class="sub">${n}</span></button>`; }).join('')}</div>
      ${Object.keys(recvByCur).length ? `<div class="card item mb fin-sum"><b>إجمالي اللي على الأسر دلوقتي:</b> ${Object.entries(recvByCur).map(([cu, v]) => `<bdi class="neg num">${fmt(v, 2)} ${cu}</bdi>`).join(' + ')}${isAdmin ? ` <span class="sub">≈ ${fmt(Math.round(recvEgp))} ج</span>` : ''}</div>` : ''}
      <div class="list" id="fin-families-list">${rows.map(x => { const cur = x.f.currency; const kids = state.students.filter(s => s.family_id === x.f.id).map(s => s.name).join(' ');
        return `<div class="card item fin-row" data-q="${esc(normAr(`${x.f.name} ${kids} ${x.f.country || ''}`))}">
          <div class="item-head"><div><div class="item-title">${esc(x.f.name)}</div><div class="sub small">${esc(x.f.country || '')} · ${CYCLES[x.f.billing_cycle] || ''}${lowPrepaid(x.f) ? ' · <span class="neg">🪫 الباقة قربت تخلص</span>' : ''}</div></div>
            <span class="badge ${x.b.balance < -0.01 ? 'b-cancel' : x.b.balance > 0.01 ? 'b-done' : 'b-sched'} num">${x.b.balance < -0.01 ? 'عليها ' : x.b.balance > 0.01 ? 'ليها ' : 'خالصة '}${Math.abs(x.b.balance) > 0.01 ? `<bdi>${fmt(Math.abs(x.b.balance), 2)} ${cur}</bdi>` : '✓'}</span></div>
          <div class="meta"><span>حصص الفترة: <b class="num"><bdi>${fmt(x.p.charge, 2)} ${cur}</bdi></b>${x.p.mins ? ` (${durLabel(x.p.mins)})` : ''}</span><span>دفعت في الفترة: <b class="num">${x.paid ? `<bdi>${fmt(x.paid, 2)} ${cur}</bdi>` : '—'}</b></span></div>
          <div class="actions"><button class="btn btn-wa sm" onclick="openFamilyInvoice(${jsq(x.f.id)}, 'fin')">📄 فاتورة</button>
            <button class="btn btn-brand sm" onclick="openPaymentForm(${jsq(x.f.id)})">+ دفعة</button>
            <button class="btn btn-ghost sm" onclick="openFamilyStatement(${jsq(x.f.id)})">📒 كشف حساب</button></div></div>`; }).join('') || '<div class="card empty">مفيش أسر بالفلتر ده</div>'}</div>`;
  }

  if (tab === 'tutors') {
    const perTutor = {}; occurrences(done).forEach(s => { const x = perTutor[s.tutor_id] ||= { n: 0, egp: 0, h: 0 }; x.n++; x.h += sMins(s) / 60; x.egp += occTut(s); });
    const paidPer = {}; payouts.filter(p => p.paid).forEach(p => paidPer[p.tutor_id] = (paidPer[p.tutor_id] || 0) + Number(p.total_egp));
    const F = state.finF_tutors || 'active';
    const all = state.tutors.map(t => ({ t, p: perTutor[t.id] || { n: 0, egp: 0, h: 0 }, paid: paidPer[t.id] || 0, b: tutBalance(t) }));
    const test = (k, x) => k === 'all' ? true : k === 'due' ? x.b.due > 0.01 : k === 'settled' ? Math.abs(x.b.due) <= 0.01 && (x.p.n || x.paid) : k === 'advance' ? x.b.due < -0.01 : (x.p.n || Math.abs(x.b.due) > 0.01 || x.paid);
    const rows = all.filter(x => test(F, x)).sort((a, b) => b.b.due - a.b.due || a.t.name.localeCompare(b.t.name, 'ar'));
    const byT = {}; done.forEach(s => (byT[s.tutor_id] ||= []).push(s));
    const chips = [['active', 'فيها حركة'], ['due', '🔴 ليها فلوس'], ['settled', '✅ اتصرفت'], ['advance', '🟢 واخدة مقدّم'], ['all', 'الكل']];
    body = `<div class="fin-tools"><input class="input search" placeholder="🔎 ابحث باسم المعلم/ة…" value="${esc(state.finQ_tutors || '')}" oninput="finSearch('tutors', this.value)">
        <span class="sub small"><b id="fin-tutors-count">${rows.length}</b> معلم/ة</span></div>
      <div class="chips">${chips.map(([k, l]) => `<button class="chip ${F === k ? 'active' : ''}" onclick="finFilter('tutors','${k}')">${l} <span class="sub">${all.filter(x => test(k, x)).length}</span></button>`).join('')}</div>
      <div class="card item mb fin-sum"><b>لسه للمعلمين دلوقتي:</b> <span class="num neg">${fmt(tutDue)} ج</span> <span class="sub">(${tutDueN} معلم/ة)</span> · <b>مستحق الفترة:</b> <span class="num">${fmt(cost)} ج</span> · <b>اتحوّل:</b> <span class="num">${fmt(paidOut)} ج</span></div>
      <div class="list" id="fin-tutors-list">${rows.map(x => { const sum = byT[x.t.id] ? tutorStudentSummary(byT[x.t.id]) : [];
        return `<div class="card item fin-row" data-q="${esc(normAr(x.t.name + ' ' + sum.map(r => r.who + ' ' + r.fam).join(' ')))}">
          <div class="item-head"><div><div class="item-title">${esc(x.t.name)}</div>${x.t.default_rate_egp == null ? '<div class="small neg">بدون أجر ساعة</div>' : `<div class="sub small">${fmt(x.t.default_rate_egp)} ج/ساعة</div>`}</div>
            <span class="badge ${x.b.due > 0.01 ? 'b-cancel' : x.b.due < -0.01 ? 'b-done' : 'b-sched'} num">${x.b.due > 0.01 ? 'ليها ' + fmt(x.b.due) + ' ج' : x.b.due < -0.01 ? 'مقدّم ' + fmt(-x.b.due) + ' ج' : 'خالصة ✓'}</span></div>
          <div class="meta"><span>الفترة: <b class="num">${nSess(x.p.h || 0)}</b></span><span>مستحق الفترة: <b class="num">${fmt(x.p.egp)} ج</b></span><span>اتحوّل: <b class="num">${x.paid ? fmt(x.paid) + ' ج' : '—'}</b></span></div>
          ${sum.length ? `<details class="mt"><summary class="sub small" style="cursor:pointer">حصص كل طالب (${sum.length})</summary><div class="scrollx mt"><table><thead><tr><th>الطالب</th><th>الحصص</th><th>المادة</th><th>للمعلم</th></tr></thead><tbody>
            ${sum.map(r => `<tr><td><b>${esc(r.who)}</b>${r.fam ? `<div class="sub small">${esc(r.fam)}</div>` : ''}</td><td class="num"><b>${fmtU(r.n)}</b></td><td class="small">${esc(r.subj || '')}</td><td class="num">${fmt(r.amt, 2)}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
          <div class="actions">${x.b.due > 0.01 ? `<button class="btn btn-brand sm" onclick="openPayoutForm(${jsq(x.t.id)})">💸 صرف</button>` : ''}
            <button class="btn btn-wa sm" onclick="openTutorPeriodMessage(${jsq(x.t.id)})">📲 كشف</button></div></div>`; }).join('') || '<div class="card empty">مفيش معلمين بالفلتر ده</div>'}</div>`;
  }

  if (tab === 'payments') {
    body = `<div class="section-title"><h2>الدفعات المستلمة (${tx.length})</h2></div>
      <input class="input search mb" placeholder="🔎 ابحث باسم الأسرة أو الملاحظة…" oninput="finSearch('pay', this.value)">
      <div class="card scrollx"><table><thead><tr><th>التاريخ</th><th>الأسرة</th><th>المبلغ</th><th class="owner-only">وصل بالجنيه</th><th class="owner-only">فرق العملة</th><th>الطريقة</th></tr></thead><tbody id="fin-pay-list">
        ${tx.map(t => { const e = txEgp(t), d = txFxDiff(t), fn = byId(state.families, t.family_id)?.name || ''; return `<tr data-q="${esc(normAr(fn + ' ' + (t.note || '') + ' ' + (t.method || '')))}"><td class="num">${fmtShortDate(t.created_at)}</td><td>${esc(fn)}<div class="sub small">${esc(t.note || '')}</div></td>
          <td class="num ${t.type === 'refund' ? 'neg' : 'pos'}">${t.type === 'refund' ? '−' : ''}${money(t.amount, t.currency)}${t.type === 'discount' ? ' <span class="badge b-pending">🎁 خصم</span>' : ''}</td>
          <td class="num owner-only">${e.est ? `<a href="javascript:void(0)" onclick="openEditReceived(${jsq(t.id)})" title="مقدّر بسعر السوق — دوس لتسجيل المبلغ الفعلي">≈ ${fmt(e.v)} ✎</a>` : `${fmt(e.v)}${t.currency !== 'EGP' ? ` <a href="javascript:void(0)" onclick="openEditReceived(${jsq(t.id)})">✎</a>` : ''}`}</td>
          <td class="num owner-only ${d == null ? '' : d >= 0 ? 'pos' : 'neg'}">${d == null ? '—' : (d >= 0 ? '+' : '') + fmt(d)}</td>
          <td class="sub small">${esc(t.method || '')}</td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">لا توجد دفعات في الفترة</td></tr>'}
      </tbody></table></div>
      <div class="section-title"><h2>حصص كل طالب في الفترة</h2></div>
      <input class="input search mb" placeholder="🔎 ابحث باسم الطالب أو الأسرة…" oninput="_stuFilter(this.value)">
      <div class="card scrollx"><table id="stu-count-table"><thead><tr><th>الطالب</th><th>الحصص</th><th>المواد</th><th>الوقت</th><th>المبلغ</th></tr></thead><tbody>
        ${perStudentSummary(done).sort((a, b) => b.n - a.n).map(x => { const fam = x.st ? byId(state.families, x.st.family_id) : null;
          return `<tr class="clickable" data-q="${esc(normAr((x.st?.name || '') + ' ' + (fam?.name || '')))}" onclick="openStudentProfile(${jsq(x.st?.id)})"><td><b>${esc(x.st?.name || '')}</b><div class="sub small">${esc(fam?.name || '')}</div></td>
          <td class="num"><b>${fmtU(x.n)}</b></td><td class="small">${Object.entries(x.subj).map(([k, n]) => `${esc(k)} ${n}`).join('، ')}</td>
          <td class="num">${durLabel(x.mins)}</td><td class="num">${fmt(x.amt, 2)} ${fam?.currency || ''}</td></tr>`; }).join('') || '<tr><td colspan="5" class="empty">لا توجد حصص في الفترة</td></tr>'}
      </tbody></table></div>`;
  }

  if (tab === 'expenses' && isAdmin) {
    const byMonth = {}; expenses.forEach(e => (byMonth[e.period_month.slice(0, 7)] ||= []).push(e));
    const byCat = {}; expenses.forEach(e => byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount_egp));
    body = `<div class="fin-tools"><button class="btn btn-brand" onclick="openExpenseForm()">+ راتب / مصروف</button>
        <button class="btn btn-ghost" onclick="copyLastSalaries()">📋 نفس رواتب الشهر اللي فات</button></div>
      <div class="kpis mb">${kpiCard('إجمالي الفترة', fmt(Math.round(exp)), 'ج')}${Object.entries(byCat).map(([k, v]) => kpiCard(EXP_CAT[k] || k, fmt(Math.round(v)), 'ج')).join('')}</div>
      ${Object.keys(byMonth).sort().reverse().map(m => `<div class="section-title"><h2>${new Date(m + '-01T12:00').toLocaleDateString('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' })}</h2><span class="sub num">${fmt(byMonth[m].reduce((a, e) => a + Number(e.amount_egp), 0))} ج</span></div>
        <div class="list">${byMonth[m].map(e => `<div class="card item"><div class="item-head"><div><div class="item-title">${esc(e.payee || EXP_CAT[e.category])}</div>
          <div class="sub small">${EXP_CAT[e.category] || ''}${e.method ? ' · ' + esc(e.method) : ''} · اتدفع ${fmtShortDate(e.paid_at)}${e.note ? ' · ' + esc(e.note) : ''}</div></div>
          <b class="num">${fmt(e.amount_egp)} ج</b></div>
          <div class="actions"><button class="btn btn-ghost sm" onclick="openExpenseForm(${jsq(e.id)})">✎ تعديل</button>
            <button class="btn btn-ghost sm" onclick="confirmDelete(${jsq((e.payee || 'المصروف') + ' — ' + fmt(e.amount_egp) + ' ج')}, () => q(sb.from('expenses').delete().eq('id', ${jsq(e.id)})))">🗑</button></div></div>`).join('')}</div>`).join('')
      || '<div class="card empty">مفيش رواتب أو مصروفات متسجلة في الفترة دي.<br>سجّل رواتب الموظفين وأي مصروفات (إعلانات، اشتراكات زووم…) عشان صافي الربح يطلع مظبوط.</div>'}`;
  }

  if (tab === 'monthly' && isAdmin) body = finMonthlyHtml();
  if (tab === 'collect') body = finCollectHtml();

  document.getElementById('fin-content').innerHTML = tabBar + body;
  ['families', 'tutors', 'coll'].forEach(k => { if (state['finQ_' + k] && document.getElementById(`fin-${k}-list`)) finSearch(k, state['finQ_' + k]); });
}

const EXP_CAT = { salary: '👤 راتب', marketing: '📣 إعلانات وتسويق', tools: '💻 اشتراكات وأدوات', rent: '🏢 إيجار', fees: '🏦 رسوم تحويل', other: '📦 أخرى' };
function openExpenseForm(id) {
  const e = id ? (state.fin.expenses || []).find(x => x.id === id) : null;
  const payees = [...new Set((state.fin.expenses || []).map(x => x.payee).filter(Boolean))];
  const r = state.fin.range, pm = e ? e.period_month.slice(0, 7) : monthKey(r.sel === 'this' || !r.sel ? new Date() : r.fromD);
  openModal(e ? 'تعديل' : 'راتب / مصروف جديد', formHtml([
    { name: 'category', label: 'النوع', type: 'select', value: e?.category || 'salary', options: Object.entries(EXP_CAT).map(([v, l]) => ({ v, l })) },
    { name: 'payee', label: 'لمين / إيه', value: e?.payee, placeholder: 'مثال: مس سهى (مشرفة) / إعلانات فيسبوك', required: true },
    [{ name: 'amount_egp', label: 'المبلغ بالجنيه', type: 'number', value: e?.amount_egp, required: true },
     { name: 'period_month', label: 'عن شهر', type: 'month', value: pm, required: true }],
    [{ name: 'paid_at', label: 'اتدفع يوم', type: 'date', value: e ? dateStr(new Date(e.paid_at)) : todayStr() },
     { name: 'method', label: 'طريقة الدفع', value: e?.method, placeholder: 'InstaPay / كاش / فودافون كاش' }],
    { name: 'note', label: 'ملاحظة', value: e?.note },
  ], 'حفظ', `<datalist id="payee-list">${payees.map(p => `<option value="${esc(p)}">`).join('')}</datalist>`));
  document.getElementById('f_payee')?.setAttribute('list', 'payee-list');
  window._formSubmit = () => runSubmit(async () => {
    const amt = fnum('amount_egp'); if (!(amt > 0)) return formError('اكتب مبلغ صحيح');
    const row = { category: fv('category'), payee: fv('payee').trim(), amount_egp: amt, period_month: fv('period_month') + '-01',
      paid_at: new Date(`${fv('paid_at') || todayStr()}T12:00:00`).toISOString(), method: fv('method') || null, note: fv('note') || null };
    await q(e ? sb.from('expenses').update(row).eq('id', e.id) : sb.from('expenses').insert(row));
    closeModal(); showToast('اتسجل ✓'); await loadFinance(true);
  });
}
async function copyLastSalaries() {
  try {
    const now = new Date(), cur = monthKey(now) + '-01', prev = monthKey(addMonths(now, -1)) + '-01';
    const [last, mine] = await Promise.all([q(sb.from('expenses').select('*').eq('category', 'salary').eq('period_month', prev)), q(sb.from('expenses').select('payee').eq('category', 'salary').eq('period_month', cur))]);
    const have = new Set(mine.map(x => x.payee)); const todo = last.filter(x => !have.has(x.payee));
    if (!todo.length) return showToast(last.length ? 'رواتب الشهر ده متسجلة خلاص ✓' : 'مفيش رواتب متسجلة الشهر اللي فات', !last.length);
    if (!confirm(`تسجيل رواتب ${now.toLocaleDateString('ar-EG-u-nu-latn', { month: 'long' })} زي الشهر اللي فات؟\n\n${todo.map(x => `• ${x.payee}: ${fmt(x.amount_egp)} ج`).join('\n')}\n\nتقدر تعدّل أي مبلغ بعدها.`)) return;
    await q(sb.from('expenses').insert(todo.map(x => ({ category: 'salary', payee: x.payee, amount_egp: x.amount_egp, period_month: cur, method: x.method, note: `راتب ${now.toLocaleDateString('ar-EG-u-nu-latn', { month: 'long' })}` }))));
    showToast(`اتسجل ${todo.length} راتب ✓`);
    document.getElementById('fin-period').value = 'this'; onFinPeriod();
  } catch (e) { showToast(dbError(e), true); }
}

// مجموع الشهور القديمة (finance_history شهر واحد) اللي جوه الفترة
function histInRange(r) {
  const a = monthKey(r.fromD), b = r.toIncl.slice(0, 7), z = { rev: 0, tc: 0, ex: 0, h: 0, n: 0 };
  (state.fin?.history || []).forEach(h => { const k = h.period_start.slice(0, 7); if (k !== h.period_end.slice(0, 7) || k < a || k > b) return;
    z.rev += +h.revenue_egp || 0; z.tc += +h.tutor_cost_egp || 0; z.ex += +h.opex_egp || 0; z.h += +h.hours || 0; z.n++; });
  return z;
}
// مقارنة السنة الدراسية دي باللي فاتت (السنة الدراسية من يونيو لمايو)
function finYearsHtml() {
  const now = new Date(), st = acadStart(now), nextM = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), 1);
  const cur = monthlySum(st, nextM), same = monthlySum(addMonths(st, -12), addMonths(nextM, -12)), full = monthlySum(addMonths(st, -12), st);
  const pre = addMonths(st, -12) > ACADEMY_START ? monthlySum(ACADEMY_START, addMonths(st, -12)) : { any: false };
  if (!full.any && !same.any) return '';
  const ml = d => d.toLocaleDateString('ar-EG-u-nu-latn', { month: 'short', year: 'numeric' }), lastM = addMonths(nextM, -1);
  const rows = [['الإيراد', 'rev'], ['أجور المعلمين', 'tc', true], ['رواتب ومصروفات وإعلانات', 'ex', true], ['صافي الربح', 'net'], ['الساعات', 'h']];
  const f = (z, k) => k === 'h' ? fmt(Math.round(z.h)) : fmt(Math.round(z[k]));
  return `<div class="section-title"><h2>السنة دي مقابل السنة اللي فاتت</h2><button class="btn btn-ghost sm" onclick="document.getElementById('fin-period').value='ayear'; onFinPeriod()">اعرض السنة الدراسية دي ←</button></div>
    <div class="card scrollx"><table class="fin-years"><thead><tr><th></th>
      <th>السنة اللي فاتت كاملة<div class="sub small">${ml(addMonths(st, -12))} – ${ml(addMonths(st, -1))}</div></th>
      <th>نفس الشهور السنة اللي فاتت<div class="sub small">${ml(addMonths(st, -12))} – ${ml(addMonths(lastM, -12))}</div></th>
      <th>السنة دي لحد دلوقتي<div class="sub small">${ml(st)} – ${ml(lastM)}</div></th><th>التغيير</th></tr></thead><tbody>
      ${rows.map(([l, k, inv]) => `<tr${k === 'net' ? ' class="fin-total"' : ''}><td><b>${l}</b></td><td class="num">${f(full, k)}</td><td class="num">${f(same, k)}</td><td class="num"><b>${f(cur, k)}</b></td><td class="num">${deltaHtml(cur[k], same[k], same.any, inv)}</td></tr>`).join('')}
      <tr><td><b>هامش الربح</b></td><td class="num">${full.rev ? Math.round(full.net / full.rev * 100) + '%' : '—'}</td><td class="num">${same.rev ? Math.round(same.net / same.rev * 100) + '%' : '—'}</td><td class="num"><b>${cur.rev ? Math.round(cur.net / cur.rev * 100) + '%' : '—'}</b></td><td></td></tr>
    </tbody></table></div>
    ${pre.any ? `<p class="sub small">📚 قبل السنة اللي فاتت (${ml(ACADEMY_START)} – ${ml(addMonths(st, -13))}، بداية الأكاديمية): إيراد ${fmt(Math.round(pre.rev))} ج · صافي ${fmt(Math.round(pre.net))} ج — مش داخلين في الجدول، لكن داخلين في "من أول الأكاديمية".</p>` : ''}
    <p class="sub small">السنة الدراسية من سبتمبر لأغسطس — الدراسة سبتمبر لحد يونيو، ويوليو وأغسطس إجازة الصيف (فيه أسر بتكمل فيهم أو بتبدأ تأسيس من أغسطس). الأكاديمية بدأت يونيو 2025. "التغيير" = السنة دي مقابل نفس الشهور السنة اللي فاتت. الأرقام بالجنيه.</p>`;
}
// رسم بياني شهري بسيط: الإيراد / التكلفة / صافي الربح
function finChartHtml(range) {
  const rows = (state.fin.monthly || []).filter(m => m.month.slice(0, 7) <= monthKey(addMonths(range.toD, -1)));
  let last = rows.slice(-12); const busy = m => +m.sessions || +m.cash_in_egp || +m.expenses_egp;
  while (last.length && !busy(last[0])) last = last.slice(1);
  if (last.length < 1) return '';
  const max = Math.max(1, ...last.map(m => Math.max(+m.revenue_egp, +m.tutor_cost_egp + +m.expenses_egp)));
  const W = 100 / last.length;
  const bars = last.map((m, i) => { const rv = +m.revenue_egp, c = +m.tutor_cost_egp + +m.expenses_egp, n = rv - c;
    const h = v => Math.max(0, v / max * 100);
    return `<div class="fc-col" title="${m.month.slice(0, 7)} — إيراد ${fmt(rv)} · تكاليف ${fmt(c)} · صافي ${fmt(n)}">
      <div class="fc-bars"><div class="fc-bar fc-rev" style="height:${h(rv)}%"></div><div class="fc-bar fc-cost" style="height:${h(c)}%"></div><div class="fc-bar fc-net ${n < 0 ? 'neg' : ''}" style="height:${h(Math.abs(n))}%"></div></div>
      <div class="fc-lbl">${new Date(m.month + 'T12:00').toLocaleDateString('ar-EG-u-nu-latn', { month: 'short' })}</div><div class="fc-val num">${fmtK(n)}</div></div>`; }).join('');
  return `<div class="section-title"><h2>آخر ${last.length === 1 ? 'شهر' : last.length + ' شهور'}</h2><button class="btn btn-ghost sm" onclick="setFinTab('monthly')">التفاصيل شهر بشهر ←</button></div>
    <div class="card item"><div class="fc-legend"><span><i class="fc-rev"></i>الإيراد</span><span><i class="fc-cost"></i>المعلمين + المصروفات</span><span><i class="fc-net"></i>صافي الربح</span></div>
    <div class="fc">${bars}</div></div>`;
}
const fmtK = v => Math.abs(v) >= 1000 ? (v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1) + 'K' : String(Math.round(v));

function finMonthlyHtml() {
  const all = state.fin.monthly || [];
  const hist = state.fin.history || [];
  const years = [...new Set(all.filter(m => +m.sessions || +m.cash_in_egp || +m.expenses_egp).map(m => +m.month.slice(0, 4)).concat(hist.map(h => +h.period_start.slice(0, 4))).concat(new Date().getFullYear()))].sort((a, b) => b - a);
  const Y = state.finYear && years.includes(state.finYear) ? state.finYear : (years[0] || new Date().getFullYear());
  const get = (y, mo) => all.find(m => m.month.slice(0, 7) === `${y}-${String(mo).padStart(2, '0')}`);
  const nowKey = monthKey(new Date());
  const rows = []; for (let mo = 1; mo <= 12; mo++) { const k = `${Y}-${String(mo).padStart(2, '0')}`; if (k > nowKey) break; const a = get(Y, mo), b = get(Y - 1, mo); rows.push({ mo, a, b }); }
  const aggs = hist.filter(h => +h.period_start.slice(0, 4) === Y && h.period_start.slice(0, 7) !== h.period_end.slice(0, 7));
  const inAgg = mo => aggs.some(h => { const k = `${Y}-${String(mo).padStart(2, '0')}`; return k >= h.period_start.slice(0, 7) && k <= h.period_end.slice(0, 7); });
  for (let i = rows.length - 1; i >= 0; i--) if (inAgg(rows[i].mo)) rows.splice(i, 1);
  const histOf = mo => hist.find(h => h.period_start.slice(0, 7) === `${Y}-${String(mo).padStart(2, '0')}` && h.period_start.slice(0, 7) === h.period_end.slice(0, 7));
  while (rows.length > 1 && !(rows[0].a && (+rows[0].a.sessions || +rows[0].a.cash_in_egp || +rows[0].a.expenses_egp)) && !(rows[0].b && +rows[0].b.sessions)) rows.shift(); // من أول شهر فيه حركة
  const v = m => m ? { rev: +m.revenue_egp, tc: +m.tutor_cost_egp, ex: +m.expenses_egp, cin: +m.cash_in_egp, h: +m.hours, net: +m.revenue_egp - +m.tutor_cost_egp - +m.expenses_egp } : null;
  const tot = rs => rs.reduce((t, x) => { if (x) { t.rev += x.rev; t.tc += x.tc; t.ex += x.ex; t.cin += x.cin; t.h += x.h; t.net += x.net; } return t; }, { rev: 0, tc: 0, ex: 0, cin: 0, h: 0, net: 0 });
  const aggV = h => ({ rev: +h.revenue_egp, tc: +h.tutor_cost_egp, ex: +h.opex_egp, cin: +h.revenue_egp, h: +(h.hours || 0), net: +h.revenue_egp - +h.tutor_cost_egp - +h.opex_egp });
  const A = tot(rows.map(r => v(r.a)).concat(aggs.map(aggV))), B = tot(rows.map(r => v(r.b))), hasB = rows.some(r => r.b && (+r.b.sessions || +r.b.cash_in_egp));
  const mName = mo => new Date(Y, mo - 1, 15).toLocaleDateString('ar-EG-u-nu-latn', { month: 'long' });
  return `<div class="chips">${years.map(y => `<button class="chip ${y === Y ? 'active' : ''}" onclick="state.finYear=${y}; renderFinance()">${y}</button>`).join('')}</div>
    <div class="kpis mb">
      ${kpiCard(`إيراد ${Y}`, fmt(Math.round(A.rev)), `ج · ${fmt(Math.round(A.h))} ساعة`, `مقابل ${Y - 1}: ${deltaHtml(A.rev, B.rev, hasB)}`)}
      ${kpiCard('المعلمين', fmt(Math.round(A.tc)), 'ج', `مقابل ${Y - 1}: ${deltaHtml(A.tc, B.tc, hasB, true)}`)}
      ${kpiCard('رواتب ومصروفات', fmt(Math.round(A.ex)), 'ج', `مقابل ${Y - 1}: ${deltaHtml(A.ex, B.ex, hasB, true)}`)}
      ${kpiCard(`صافي ربح ${Y}`, fmt(Math.round(A.net)), `ج · ${A.rev ? Math.round(A.net / A.rev * 100) : 0}%`, `مقابل ${Y - 1}: ${deltaHtml(A.net, B.net, hasB)}`, { vcls: A.net >= 0 ? 'pos' : 'neg', cls: 'kpi-hero' })}
      ${kpiCard(`الفلوس اللي دخلت ${Y}`, fmt(Math.round(A.cin)), 'ج', `مقابل ${Y - 1}: ${deltaHtml(A.cin, B.cin, hasB)}`)}
    </div>${aggs.length || rows.some(r => histOf(r.mo)) ? '<p class="sub small mb">📚 الشهور اللي قبل سبتمبر جاية من التقفيل القديم (Gemini) بسعر ثابت 1 درهم = 13 ج، ومحسوبة على إنها اتحصّلت واتصرفت للمعلمين.</p>' : ''}
    <div class="card scrollx"><table class="fin-month"><thead><tr><th>الشهر</th><th>ساعات</th><th>الإيراد</th><th>المعلمين</th><th>المصروفات</th><th>صافي الربح</th><th>الهامش</th><th>اللي دخل</th><th>مقابل ${Y - 1}</th></tr></thead><tbody>
      ${aggs.map(h => { const x = aggV(h); return `<tr class="fin-hist"><td><b>${new Date(h.period_start + 'T12:00').toLocaleDateString('ar-EG-u-nu-latn', { month: 'long' })} – ${new Date(h.period_end + 'T12:00').toLocaleDateString('ar-EG-u-nu-latn', { month: 'long' })}</b><div class="sub small">📚 إجمالي من السجلات القديمة</div></td>
        <td class="num">${x.h ? fmt(x.h, 1) : '—'}</td><td class="num">${fmt(x.rev)}</td><td class="num">${fmt(x.tc)}</td><td class="num">${fmt(x.ex)}</td><td class="num ${x.net >= 0 ? 'pos' : 'neg'}"><b>${fmt(x.net)}</b></td><td class="num">${x.rev ? Math.round(x.net / x.rev * 100) + '%' : '—'}</td><td class="num">${fmt(x.cin)}</td><td class="num small sub">—</td></tr>`; }).join('')}
      ${rows.map(({ mo, a, b }) => { const x = v(a), y = v(b); if (!x || !(x.h || x.cin || x.ex)) return `<tr class="sub"><td>${mName(mo)}</td><td colspan="8">—</td></tr>`;
        const hm = histOf(mo);
        return `<tr${hm ? ' class="fin-hist clickable" onclick="openHistoryDetail(' + jsq(hm.id) + ')"' : ''}><td><b>${mName(mo)}</b>${hm ? '<div class="sub small">📚 سجلات قديمة · التفاصيل ←</div>' : ''}</td><td class="num">${fmt(x.h, 1)}</td><td class="num">${fmt(x.rev)}</td><td class="num">${fmt(x.tc)}</td><td class="num">${fmt(x.ex)}</td>
          <td class="num ${x.net >= 0 ? 'pos' : 'neg'}"><b>${fmt(x.net)}</b></td><td class="num">${x.rev ? Math.round(x.net / x.rev * 100) + '%' : '—'}</td><td class="num">${fmt(x.cin)}</td>
          <td class="num small">${y && (y.h || y.cin) ? `${fmt(y.net)} ${deltaHtml(x.net, y.net, true)}` : '<span class="sub">مفيش بيانات</span>'}</td></tr>`; }).join('')}
      <tr class="fin-total"><td><b>الإجمالي</b></td><td class="num">${fmt(A.h, 1)}</td><td class="num">${fmt(A.rev)}</td><td class="num">${fmt(A.tc)}</td><td class="num">${fmt(A.ex)}</td>
        <td class="num ${A.net >= 0 ? 'pos' : 'neg'}"><b>${fmt(A.net)}</b></td><td class="num">${A.rev ? Math.round(A.net / A.rev * 100) + '%' : '—'}</td><td class="num">${fmt(A.cin)}</td><td class="num small">${hasB ? `${fmt(B.net)} ${deltaHtml(A.net, B.net, true)}` : '—'}</td></tr>
    </tbody></table></div>
    <p class="sub small mt">الإيراد = الحصص اللي تمت بسعر الصرف يوم الحصة. المعلمين = مستحقاتهم عن حصص الشهر. المصروفات = الرواتب وأي مصروف متسجل عن الشهر. "اللي دخل" = الدفعات اللي وصلت فعلاً في الشهر (ممكن تكون عن شهر قبله).${hasB ? '' : ` ولما تسجل بيانات ${Y - 1} المقارنة هتظهر لوحدها.`}</p>`;
}
function finFxHtml(done) {
  const byCur = {}; done.forEach(s => { const c = byCur[s.student_currency] ||= { amt: 0, egp: 0, n: 0 }; c.amt += charges(s).fam; c.egp += Number(s.revenue_egp || 0); c.n++; });
  const fxRows = (state.fxRows || []).filter(r => r.currency !== 'EGP');
  return `${Object.keys(byCur).length ? `<div class="section-title"><h2>الإيراد حسب العملة</h2></div>
    <div class="card scrollx"><table><thead><tr><th>العملة</th><th>حصص</th><th>بالعملة الأصلية</th><th>بالجنيه</th></tr></thead><tbody>
      ${Object.entries(byCur).map(([c, v]) => `<tr><td>${c}</td><td class="num">${v.n}</td><td class="num">${fmt(v.amt, 2)} ${c}</td><td class="num">${fmt(v.egp)} ج</td></tr>`).join('')}
    </tbody></table></div>` : ''}
    <div class="section-title"><h2>أسعار الصرف</h2><button class="btn btn-ghost sm" onclick="openFxForm()">تعديل</button></div>
    <div class="card item">${fxRows.map(r => `<div class="item-head" style="padding:4px 0"><span dir="ltr"><b>1 ${r.currency} = ${fmt(r.rate_to_egp, 4)} EGP</b></span>
      <span class="sub small">${r.auto ? `🔄 سعر السوق — آخر تحديث ${ago(r.updated_at)}` : `✋ سعر يدوي من ${fmtShortDate(r.updated_at)}`}</span></div>`).join('')}</div>`;
}
// كشف حساب أسرة: كل الحصص والدفعات بالترتيب مع الرصيد
async function openFamilyStatement(familyId) {
  const f = byId(state.families, familyId), cur = f.currency, ids = state.students.filter(s => s.family_id === familyId).map(s => s.id);
  try {
    const [ss, tx, old] = await Promise.all([ids.length ? q(sb.from('sessions').select('*').in('student_id', ids).eq('status', 'done').order('scheduled_at')) : [], q(sb.from('family_transactions').select('*').eq('family_id', familyId).order('created_at')),
      sb.from('family_history').select('*').eq('family_id', familyId).order('month').then(x => x.data || [])]);
    const byM = {};
    ss.forEach(s => { const k = monthKey(new Date(s.scheduled_at)); const x = byM[k] ||= { charge: 0, mins: 0, paid: 0 }; const c = charges(s).fam; x.charge += c; if (c > 0) x.mins += sMins(s); });
    tx.forEach(t => { const k = monthKey(new Date(t.created_at)); (byM[k] ||= { charge: 0, mins: 0, paid: 0 }).paid += (t.type === 'refund' ? -1 : 1) * Number(t.amount); });
    let run = 0;
    const rows = Object.keys(byM).sort().map(k => { const x = byM[k]; run += x.paid - x.charge; return { k, ...x, bal: run }; });
    openModal(`📒 كشف حساب — ${f.name}`, `<div class="scrollx"><table><thead><tr><th>الشهر</th><th>الحصص</th><th>عليها</th><th>دفعت</th><th>الرصيد</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${new Date(r.k + '-15').toLocaleDateString('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' })}</td><td class="num">${r.mins ? fmtU(r.mins / 60) : '—'}</td>
        <td class="num">${fmt(r.charge, 2)}</td><td class="num pos">${r.paid ? fmt(r.paid, 2) : '—'}</td><td class="num ${r.bal < -0.01 ? 'neg' : 'pos'}"><b>${r.bal < -0.01 ? 'عليها ' : 'ليها '}${fmt(Math.abs(r.bal), 2)}</b></td></tr>`).join('') || '<tr><td colspan="5" class="empty">مفيش حركة</td></tr>'}
      </tbody></table></div><p class="sub small">المبالغ بالـ ${cur}. الرصيد تراكمي من أول تعامل.</p>
      ${tx.length ? `<details class="mt"><summary class="sub">الدفعات (${tx.length})</summary><div class="list mt">${tx.slice().reverse().map(t => `<div class="card item"><div class="item-head"><span>${fmtShortDate(t.created_at)} · ${esc(t.method || '')}</span><b class="num ${t.type === 'refund' ? 'neg' : 'pos'}">${t.type === 'discount' ? '🎁 خصم ' : t.type === 'refund' ? '−' : ''}${money(t.amount, t.currency)}</b></div>${t.note ? `<div class="sub small">${esc(t.note)}</div>` : ''}</div>`).join('')}</div></details>` : ''}
      ${old.length ? `<details class="mt" ${ss.length ? '' : 'open'}><summary class="sub">📚 الحسابات القديمة قبل السيستم (${old.length} شهر · ${fmt(old.reduce((a, h) => a + Number(h.amount), 0), 2)} ${esc(old[0].currency)})</summary>
        <div class="list mt">${old.map(h => `<div class="card item"><div class="item-head"><b>${new Date(h.month + 'T12:00').toLocaleDateString('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' })}</b>
          <b class="num">${fmt(h.amount, 2)} ${esc(h.currency)}</b></div><div class="sub small">${h.hours ? fmtU(+h.hours) + ' حصة' : ''}${h.price ? ` × ${fmt(h.price)}` : ''}${h.details ? ' · ' + esc(h.details) : ''}</div>
          ${h.flag ? `<div class="small warn-txt mt">⚠️ ${esc(h.flag)}</div>` : ''}</div>`).join('')}</div>
        <p class="sub small">الحسابات دي من الرسايل القديمة، ومش داخلة في رصيد الأسرة الحالي.</p></details>` : ''}
      <div class="modal-foot"><button class="btn btn-wa" onclick="openFamilyInvoice(${jsq(familyId)})">📄 فاتورة</button><button class="btn btn-brand" onclick="openPaymentForm(${jsq(familyId)})">+ دفعة</button></div>`);
  } catch (e) { showToast(dbError(e), true); }
}
window._stuFilter = v => { const w = normAr(v); document.querySelectorAll('#stu-count-table tbody tr[data-q]').forEach(r => r.classList.toggle('hidden', !!w && !r.dataset.q.includes(w))); };
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
  if (typeof T !== 'undefined' && T.me) return;
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
  try { state.tutorReqs = await q(sb.from('tutor_requests').select('*').eq('status', 'pending').order('created_at')); } catch (e) { state.tutorReqs = []; }
  try { state.reports = await q(sb.from('session_reports').select('*').gte('created_at', new Date(now.getTime() - 40 * 864e5).toISOString()).order('created_at', { ascending: false })); } catch (e) { state.reports = []; }
  try { // حصص خلصت من أكتر من ساعة ومعلمتها على البوابة ولسه مالهاش تقرير
    const linked = (state.tutors.length ? state.tutors : await q(sb.from('tutors').select('id,user_id'))).filter(t => t.user_id).map(t => t.id);
    const recent = linked.length ? await q(sb.from('sessions').select('*').in('tutor_id', linked).in('status', ['scheduled', 'in_progress', 'done'])
      .gte('scheduled_at', new Date(now.getTime() - 3 * 864e5).toISOString()).lte('scheduled_at', now.toISOString()).order('scheduled_at')) : [];
    state.missingReports = occurrences(recent.filter(x => sEnd(x) < now.getTime() - 60 * 60e3)).filter(x => !repFor(x));
  } catch (e) { state.missingReports = []; }
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
  const tr = (state.tutorReqs || []).length;
  if (tr) items.push(`<button class="att att-next" onclick="openTutorRequests()">📨 <b>${tr}</b> ${tr === 1 ? 'طلب' : 'طلبات'} من المعلمات مستنية ردك</button>`);
  const mr = (state.missingReports || []).length;
  if (mr) items.push(`<button class="att att-warn" onclick="openMissingReports()">⏳ <b>${mr}</b> ${mr === 1 ? 'حصة لسه مالهاش تقرير' : 'حصص لسه مالهاش تقرير'} من المعلمة</button>`);
  const nr = (state.reports || []).filter(r => !r.sent_at).length;
  const rb = document.getElementById('btn-reports'); if (rb) { rb.textContent = nr ? `📝 التقارير (${nr} جديد)` : '📝 التقارير'; rb.classList.toggle('btn-brand', !!nr); rb.classList.toggle('btn-ghost', !nr); }
  if (nr) items.push(`<button class="att att-next" onclick="openReports()">📝 <b>${nr}</b> ${nr === 1 ? 'تقرير حصة جديد' : 'تقارير حصص جديدة'} — ابعتها للأسر</button>`);
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
    return `• ${fmtTime(s.scheduled_at, CAIRO_TZ)} – ${fmtTime(new Date(sStart(s) + (s.duration_minutes || 60) * 60e3).toISOString(), CAIRO_TZ)}: ${s.group_key ? `👥 ${s.group_name || 'مجموعة'}: ${groupNames(s._members)}` : `${v.st?.name || ''} (${v.st?.grade_level || ''})`}${s.subject ? ' — ' + s.subject + enTxt(s.student_id) : ''}${s.kind === 'regular' || s.kind === 'group' ? '' : ` [${kindWord(s)}]`}${s.meeting_link ? `\n   🔗 ${linkHref(s.meeting_link)}` : ''}`; }).join('\n');
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
${b.due < -0.01 ? `💚 *مدفوع لكِ مقدّم: ${fmt(-b.due, 2)} جنيه* (للحصص الجاية)` : `*المستحق: ${fmt(b.due, 2)} جنيه*`}${t.default_rate_egp != null ? ` (أجر الساعة ${fmt(t.default_rate_egp)} ج)` : ''}

لو فيه أي ملاحظة على الكشف بلّغينا قبل التحويل.
${SIGN_T}`;
    openModal(`كشف للمعلمة — ${t.name}`, `<div class="msg-preview">${esc(text)}</div>${msgActionsHtml(text, { group: t.whatsapp_group, phone: t.phone, editTutor: t.id })}`);
  } catch (e) { showToast(dbError(e), true); }
}

/* ============================================================
   تأجيل سريع + رسائل للطرفين
   ============================================================ */
function openPostpone(id) { return openReschedule(id); }
function openPostponeOld(id) {
  const s = findSession(id); if (!s) return;
  if (s.group_key) return openGroupPostpone(s.group_key);
  const d = new Date(s.scheduled_at); d.setDate(d.getDate() + 1);
  openModal('تأجيل / تغيير موعد الحصة', formHtml([
    [{ name: 'date', label: 'التاريخ الجديد', type: 'date', required: true, value: dateStr(d) },
     { name: 'time', label: 'الوقت الجديد (بتوقيتك)', type: 'time', required: true, value: timeStr(d) }],
    { name: 'duration_minutes', label: 'المدة', type: 'number', required: true, value: s.duration_minutes || 60, step: 5, min: 5 },
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
      done && isAdmin ? Number(s.fx_rate_to_egp).toFixed(4) : '', done && isAdmin ? Number(s.revenue_egp).toFixed(2) : '', done && isAdmin ? Number(s.margin_egp).toFixed(2) : '',
      s.cancel_reason || '', s.cancel_note || '', cancelNoticeHours(s) == null ? '' : cancelNoticeHours(s).toFixed(1), s.makeup_of ? 'نعم' : '', s.group_name || '', s.group_rate_egp ?? '', s.notes];
  });
  downloadCSV(`حصص_${r.from}_${r.toIncl}.csv`, ['التاريخ', 'الوقت', 'الطالب', 'الأسرة', 'المعلم', 'المادة', 'النوع', 'الحالة', 'المدة المخططة (د)', 'المدة الفعلية (د)',
    'سعر الساعة للأسرة', 'العملة', 'إجمالي الأسرة', 'أجر الساعة للمعلم (EGP)', 'إجمالي المعلم (EGP)', 'سعر الصرف', 'الإيراد (EGP)', 'الهامش (EGP)', 'سبب الإلغاء', 'تفاصيل الإلغاء', 'الإلغاء قبلها بكام ساعة', 'تعويضية', 'المجموعة', 'أجر ساعة المجموعة (EGP)', 'ملاحظات'], rows);
}
function exportPaymentsCSV() {
  if (!state.fin) return;
  const r = state.fin.range;
  const rows = state.fin.tx.map(t => { const d = txFxDiff(t); return [dateStr(new Date(t.created_at)), byId(state.families, t.family_id)?.name, t.type === 'refund' ? 'استرداد' : t.type === 'discount' ? 'خصم' : 'دفعة', t.amount, t.currency,
    t.method, isAdmin ? t.received_egp ?? '' : '', isAdmin ? t.market_rate ?? '' : '', d == null || !isAdmin ? '' : d.toFixed(2), t.note]; });
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
  const el = document.getElementById('reports-content'); if (!el) return;
  const view = state.repView || 'biz';
  const sw = `<div class="chips fin-tabs no-print"><button class="chip ${view === 'biz' ? 'active' : ''}" onclick="state.repView='biz'; renderReports()">🏢 لوحة الأعمال</button>
    <button class="chip ${view === 'ret' ? 'active' : ''}" onclick="state.repView='ret'; renderReports()">🔁 متابعة الأسر</button>
    <button class="chip ${view === 'ops' ? 'active' : ''}" onclick="state.repView='ops'; renderReports()">📋 الالتزام والتشغيل</button></div>`;
  if (view === 'biz') { el.innerHTML = sw + renderBusiness(); return; }
  if (view === 'ret') { el.innerHTML = sw + renderRetention(); return; }
  if (!state.rep) { el.innerHTML = sw + '<div class="card empty">بيحمّل…</div>'; return; }
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

  el.innerHTML = sw + `
    <div class="chips">${[['this', 'الشهر ده'], ['last', 'الشهر اللي فات'], ['3m', 'آخر 3 شهور'], ['year', 'السنة دي']].map(([k, l]) => `<button class="chip ${state.repPeriod === k ? 'active' : ''}" onclick="setRepPeriod('${k}')">${l}</button>`).join('')}</div>
    <div class="kpis">
      <div class="card kpi"><div class="l">حصص تمت</div><div class="v num">${occurrences(done).length}</div><div class="s">${fmt(hours, 1)} ساعة تدريس</div></div>
      <div class="card kpi"><div class="l">نسبة الالتزام العامة</div><div class="v num ${attend == null ? '' : attend >= .9 ? 'pos' : attend >= .75 ? 'warn-txt' : 'neg'}">${attend == null ? '—' : Math.round(attend * 100) + '%'}</div><div class="s">حصص تمت ÷ (تمت + إلغاء أسرة/معلم)</div></div>
      <div class="card kpi"><div class="l">إلغاءات</div><div class="v num">${cancels.length}</div><div class="s">أسر ${cS.length} · معلمين ${cT.length} · أكاديمية ${cA.length}</div></div>
      <div class="card kpi"><div class="l">إلغاءات متأخرة</div><div class="v num ${cancels.filter(isLate).length ? 'neg' : ''}">${cancels.filter(isLate).length}</div><div class="s">أقل من ${LATE_HOURS} ساعات قبل الحصة</div></div>
      <div class="card kpi"><div class="l">لم يحضر</div><div class="v num">${cancels.filter(s => s.cancel_reason === 'لم يحضر').length}</div><div class="s">طلاب ${cS.filter(s => s.cancel_reason === 'لم يحضر').length} · معلمين ${cT.filter(s => s.cancel_reason === 'لم يحضر').length}</div></div>
      <div class="card kpi"><div class="l">تغييرات المواعيد / المعلمات</div><div class="v num">${rows.filter(x => x.reschedule_kind).length}</div><div class="s">مرة ${rows.filter(x => x.reschedule_kind === 'once').length} · مؤقت ${rows.filter(x => x.reschedule_kind === 'temp').length} · دايم ${rows.filter(x => x.reschedule_kind === 'permanent').length} · بديلة ${rows.filter(x => x.reschedule_kind === 'substitute').length}</div></div>
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
    ${(() => { const nw = new Date(); const months = [0, -1, -2].map(i => { const from = new Date(nw.getFullYear(), nw.getMonth() + i, 1), to = new Date(nw.getFullYear(), nw.getMonth() + i + 1, 1);
        const list = rows.filter(r => r.status === 'done' && sStart(r) >= from.getTime() && sStart(r) < to.getTime()); const x = perStudentSummary(list)[0];
        return { label: from.toLocaleDateString('ar-EG-u-nu-latn', { month: 'long' }), x }; });
      return `<h3>الحصص اللي تمت</h3><div class="card scrollx mb"><table><thead><tr><th>الشهر</th><th>الحصص</th><th>المواد</th><th>الوقت</th></tr></thead><tbody>
        ${months.map(m => `<tr><td>${m.label}</td><td class="num"><b>${m.x ? fmtU(m.x.n) : 0}</b></td><td class="small">${m.x ? Object.entries(m.x.subj).map(([k, n]) => `${esc(k)} ${n}`).join('، ') : '—'}</td><td class="num">${m.x ? durLabel(m.x.mins) : '—'}</td></tr>`).join('')}
        </tbody></table></div>`; })()}
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
        ${s.subject ? `<span>المادة: <b>${esc(s.subject)}</b>${enTag(s.student_id)}</span>` : ''}
        <span>المدة: <b>${durLabel(m.mins)}</b>${extended ? ` <span class="${s.actual_minutes > s.duration_minutes ? 'pos' : 'neg'}">(المخطط ${durLabel(s.duration_minutes)})</span>` : ''}</span>
        ${s.meeting_link ? `<span><a href="${esc(linkHref(s.meeting_link))}" target="_blank" rel="noopener">رابط الحصة ↗</a></span>` : (open ? '<span class="neg">لا يوجد رابط</span>' : '')}
      </div>
      <div class="gm-list">${rows.map(member).join('')}</div>
      ${s.notes ? `<div class="sub small mt">📝 ${esc(s.notes)}</div>` : ''}
      ${reportLine(s)}
      ${m.rev || m.tut ? `<div class="money">
        <span class="pill" title="مجموع اللي على الأسر بالجنيه">الأسر: ${fmt(m.rev)} EGP</span>
        <span class="pill" title="${fmt(s.group_rate_egp)} EGP في الساعة عن المجموعة كلها">المعلم: ${money(m.tut, 'EGP')}</span>
        <span class="pill owner-only ${m.margin >= 0 ? 'ok' : 'bad'}">الهامش: ${fmt(m.margin)} EGP${m.final ? '' : ' (تقديري)'}</span>
      </div>` : ''}
      <div class="actions">
        ${open && !confirmNeeded ? `
          <button class="btn btn-wa sm" onclick="openGroupReminder(${K},'parent')">📲 الأسر</button>
          <button class="btn btn-wa sm" onclick="openGroupReminder(${K},'tutor')">📲 المعلم</button>` : ''}
        ${open ? `<button class="btn btn-ok sm" onclick="openGroupDone(${K})">✓ تمت… (الحضور)</button>` : ''}
        ${reportBtn(s)}
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
      <input id="f_actual" type="hidden" value="${current}">${hmHtml('f_hm', current)}</div>
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
      <span class="owner-only">الهامش: <b>${fmt(rev - tut)} EGP</b></span></div>
      <div class="sub small mt">كل طالب بيتحسب بسعر ساعته (${att.map(r => `${byId(state.students, r.student_id)?.name || ''} ${fmt(r.student_price, 2)} ${r.student_currency}`).join('، ') || '—'}).</div>`;
  };
  window._gdPrev = preview;
  const hm = hmWire('f_hm', v => { inp.value = v; preview(); });
  window._pickDur = m => { inp.value = m; hm.set(m); preview(); };
  preview();
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
    { name: 'duration_minutes', label: 'المدة', type: 'number', required: true, value: s.duration_minutes || 60, step: 5, min: 5 },
    { name: 'reason', label: 'السبب (اختياري)', placeholder: 'مثال: طلب المعلمة' },
  ], 'تأجيل المجموعة'));
  attachHm(document.getElementById('f_duration_minutes'));
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
    { name: 'duration_minutes', label: 'المدة', type: 'number', required: true, value: s?.duration_minutes ?? prefill.duration ?? 60, step: 5, min: 5 },
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
  let hmD = null;
  const totals = () => {
    hmD && hmD.sync();
    const m = Number(durIn.value) || 60, rate = Number($('group_rate_egp').value) || 0;
    document.querySelectorAll('#dur-chips .chip').forEach(x => x.classList.toggle('active', Number(x.dataset.m) === m));
    const rev = members.reduce((a, x) => { const f = byId(state.families, byId(state.students, x.sid)?.family_id); return a + toEGP(Number(x.price || 0) * m / 60, f?.currency); }, 0);
    const tut = rate * m / 60;
    document.getElementById('sess-total').innerHTML = `<div class="meta" style="margin:0">
      <span>الحصة (${durLabel(m)}) لو الكل حضر:</span><span>الأسر <b>≈ ${fmt(rev)} EGP</b></span>
      <span>المعلم <b>${money(tut, 'EGP')}</b></span><span class="owner-only">الهامش <b class="${rev - tut >= 0 ? 'pos' : 'neg'}">${fmt(rev - tut)} EGP</b></span></div>
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
  hmD = attachHm(durIn, totals);
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
   تغيير معاد / معلمة: الحصة دي بس، مؤقت لعدد حصص، أو دايم
   ============================================================ */
// مكوّنات التاريخ والوقت بتوقيت بلد معيّن
function tzParts(iso, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' })
    .formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}`, wd: p.weekday };
}
// تاريخ + ساعة بتوقيت بلد ← ISO
function zoned(dateS, timeS, tz) {
  const [y, m, d] = dateS.split('-').map(Number), [hh, mm] = timeS.split(':').map(Number);
  let t = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 2; i++) { const p = tzParts(new Date(t).toISOString(), tz); const [py, pm, pd] = p.date.split('-').map(Number); const [ph, pmi] = p.time.split(':').map(Number);
    t -= Date.UTC(py, pm - 1, pd, ph, pmi) - Date.UTC(y, m - 1, d, hh, mm); }
  return new Date(t).toISOString();
}
const addDays = (dateS, n) => { const d = new Date(dateS + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayDiff = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);
const famTz = s => (COUNTRIES[sessionView(s).fam?.country] || COUNTRIES['مصر']).tz;
// الحصص الجاية في نفس الموعد الثابت (نفس الطالب والمعلمة والمادة واليوم والساعة بتوقيت الأسرة)
async function slotSeries(s) {
  const tz = famTz(s), p0 = tzParts(s.scheduled_at, tz);
  const rows = await q(sb.from('sessions').select('*').eq('student_id', s.student_id).eq('tutor_id', s.original_tutor_id || s.tutor_id).eq('status', 'scheduled')
    .gt('scheduled_at', s.scheduled_at).order('scheduled_at').limit(60));
  return rows.filter(r => !r.group_key && norm(r.subject) === norm(s.subject) && (() => { const p = tzParts(r.scheduled_at, tz); return p.wd === p0.wd && p.time === p0.time; })());
}
function tutorRateFor(tutorId, studentId) {
  const pl = state.plans.find(p => p.student_id === studentId && p.tutor_id === tutorId && p.tutor_rate_egp != null);
  return pl ? pl.tutor_rate_egp : byId(state.tutors, tutorId)?.default_rate_egp ?? null;
}
const SCOPE_L = { once: 'الحصة دي بس', temp: 'مؤقت', permanent: 'دايم (كل الجاي)' };

async function openReschedule(id, preset = {}) {
  const s = findSession(id) || preset.session; if (!s) return;
  if (s.group_key) return openGroupPostpone(s.group_key);
  const { st, fam, tu } = sessionView(s);
  let series = [];
  try { series = await slotSeries(s); } catch (e) {}
  const tz = famTz(s), c = COUNTRIES[fam?.country] || COUNTRIES['مصر'];
  const prop = preset.proposed_at ? new Date(preset.proposed_at) : (() => { const d = new Date(s.scheduled_at); d.setDate(d.getDate() + 1); return d; })();
  const R = { scope: preset.scope || 'once', n: 1, what: preset.what || 'time', date: dateStr(prop), time: timeStr(prop), dur: s.duration_minutes || 60, tutor: s.tutor_id, reason: preset.reason || '' };
  window._rs = R;
  const render = () => {
    const nAff = R.scope === 'once' ? 0 : R.scope === 'temp' ? Math.min(R.n, series.length) : series.length;
    const tutorChanged = R.tutor !== s.tutor_id;
    document.getElementById('modal-body').innerHTML = `
      <div class="sub small mb">${esc(st?.name || '')} · ${esc(s.subject || '')} · ${esc(tu?.name || '')} · ${fmtDate(s.scheduled_at)} ${timeStr(new Date(s.scheduled_at))}${tz !== CAIRO_TZ ? ` <span class="sub">(${c.flag} ${fmtTime(s.scheduled_at, tz)})</span>` : ''}</div>
      <div class="field"><label>إيه اللي هيتغير؟</label><div class="seg-wrap">
        ${[['time', '🕒 المعاد'], ['tutor', '🧑‍🏫 المعلمة (بديلة)'], ['both', 'الاتنين']].map(([k, l]) => `<button type="button" class="chip ${R.what === k ? 'active' : ''}" onclick="_rs.what='${k}'; ${k === 'time' ? `_rs.tutor=${jsq(s.tutor_id)};` : ''} _rsRender()">${l}</button>`).join('')}</div></div>
      ${R.what !== 'tutor' ? `<div class="field-row"><div class="field"><label>المعاد الجديد</label><input type="date" class="input" value="${R.date}" onchange="_rs.date=this.value; _rsRender()"></div>
        <div class="field"><label>الساعة (بتوقيتك)</label><input type="time" class="input" value="${R.time}" onchange="_rs.time=this.value; _rsRender()"></div></div>
        <div class="field"><label>المدة</label><div class="chips" style="margin:0">${[30, 45, 60, 90, 120, 150, 180, 240].map(m => `<button type="button" class="chip ${R.dur === m ? 'active' : ''}" onclick="_rs.dur=${m}; _rsRender()">${durLabel(m)}</button>`).join('')}</div></div>
        ${hmHtml('rs_hm', R.dur)}
        ${tz !== CAIRO_TZ ? `<div class="sub small mb">= ${c.flag} ${fmtTime(new Date(`${R.date}T${R.time}`).toISOString(), tz)} بتوقيت ${c.tzName}</div>` : ''}` : ''}
      ${R.what !== 'time' ? `<div class="field"><label>المعلمة البديلة</label><select class="input" onchange="_rs.tutor=this.value; _rsRender()">${state.tutors.map(t => `<option value="${esc(t.id)}" ${t.id === R.tutor ? 'selected' : ''}>${esc(t.name)}${t.id === s.tutor_id ? ' (الحالية)' : ''}</option>`).join('')}</select>
        ${tutorChanged ? `<div class="hint">أجرها: ${fmt(tutorRateFor(R.tutor, s.student_id) ?? 0)} ج/ساعة — الحصة بتتحسب للي ادّتها فعلاً.</div>` : ''}</div>` : ''}
      <div class="field"><label>التغيير ده لحد إمتى؟</label>
        <label class="radio"><input type="radio" name="rs-sc" ${R.scope === 'once' ? 'checked' : ''} onchange="_rs.scope='once'; _rsRender()"> الحصة دي بس</label>
        ${series.length ? `<label class="radio"><input type="radio" name="rs-sc" ${R.scope === 'temp' ? 'checked' : ''} onchange="_rs.scope='temp'; _rsRender()"> مؤقت: الحصة دي و
          <select class="input inline" onchange="_rs.n=Number(this.value); _rs.scope='temp'; _rsRender()">${Array.from({ length: Math.min(series.length, 8) }, (_, i) => i + 1).map(n => `<option ${R.n === n ? 'selected' : ''} value="${n}">${n}</option>`).join('')}</select>
          ${R.n === 1 ? 'حصة' : 'حصص'} بعدها — وبعدين ترجع لمعادها الأصلي</label>
        <label class="radio"><input type="radio" name="rs-sc" ${R.scope === 'permanent' ? 'checked' : ''} onchange="_rs.scope='permanent'; _rsRender()"> دايم: كل الحصص الجاية في الموعد ده (${series.length})</label>`
        : '<div class="sub small">مفيش حصص جاية في نفس الموعد الثابت — هيتغير الحصة دي بس.</div>'}
        ${nAff ? `<div class="sub small mt">هيتغير كمان: ${series.slice(0, nAff).slice(0, 6).map(r => fmtShortDate(r.scheduled_at)).join('، ')}${nAff > 6 ? ` و${nAff - 6} كمان` : ''}</div>` : ''}
        ${R.scope === 'permanent' && tutorChanged ? `<div class="sub small mt">✓ والمعلمة الجديدة هتتسجل في خطة ${esc(st?.name || '')} لمادة ${esc(s.subject || '')}.</div>` : ''}
      </div>
      <div class="field"><label>السبب (اختياري)</label><input class="input" value="${esc(R.reason)}" oninput="_rs.reason=this.value" placeholder="مثال: امتحانات / ظرف عند المعلمة"></div>
      <div id="form-error" class="err hidden"></div>
      <div class="modal-foot"><button class="btn btn-brand" id="form-submit" onclick="_rsSave()">تأكيد التغيير${nAff ? ` (${nAff + 1} حصص)` : ''}</button><button class="btn btn-ghost" onclick="closeModal()">رجوع</button></div>`;
  };
  window._rsRender = () => { render(); hmWire('rs_hm', v => { R.dur = v; }); };
  openModal(preset.title || 'تغيير معاد / معلمة الحصة', ''); window._rsRender();
  window._rsSave = () => runSubmit(async () => {
    const changeTime = R.what !== 'tutor', changeTutor = R.what !== 'time' && R.tutor !== s.tutor_id;
    if (!changeTime && !changeTutor) return formError('اختار المعلمة البديلة');
    if (changeTime && !(R.dur >= 5 && R.dur <= 720)) return formError('المدة لازم تكون بين 5 دقايق و12 ساعة');
    const newStart = changeTime ? new Date(`${R.date}T${R.time}`) : new Date(s.scheduled_at);
    if (isNaN(newStart)) return formError('التاريخ أو الوقت غير صحيح');
    const affected = R.scope === 'once' ? [] : R.scope === 'temp' ? series.slice(0, R.n) : series;
    // المعاد الجديد لكل حصة بتوقيت الأسرة: نفس الفرق في الأيام ونفس الساعة الجديدة
    const p0 = tzParts(s.scheduled_at, tz), pn = tzParts(newStart.toISOString(), tz), shift = dayDiff(p0.date, pn.date);
    const kind = changeTutor && !changeTime && R.scope !== 'permanent' ? 'substitute' : R.scope === 'once' ? 'once' : R.scope;
    const rate = changeTutor ? tutorRateFor(R.tutor, s.student_id) : null;
    const plan = [s, ...affected].map(r => ({ r, at: changeTime ? (r.id === s.id ? newStart.toISOString() : zoned(addDays(tzParts(r.scheduled_at, tz).date, shift), pn.time, tz)) : r.scheduled_at }));
    const conflicts = changeTime || changeTutor ? await findConflicts(plan.map(x => ({ ...x.r, scheduled_at: x.at, duration_minutes: changeTime ? R.dur : x.r.duration_minutes, tutor_id: changeTutor ? R.tutor : x.r.tutor_id })), null) : [];
    const real = conflicts.filter(({ o }) => !plan.some(x => x.r.id === o.id));
    if (real.length && !confirm(`⚠️ فيه تعارض:\n${real.slice(0, 4).map(({ o }) => { const v = sessionView(o); return `• ${fmtShortDate(o.scheduled_at)} ${timeStr(new Date(o.scheduled_at))}: ${v.st?.name || ''} مع ${v.tu?.name || ''}`; }).join('\n')}\n\nتكمل برضه؟`)) return;
    const note = `${kind === 'substitute' ? 'معلمة بديلة' : kind === 'temp' ? `تغيير مؤقت (${plan.length} حصص)` : kind === 'permanent' ? 'تغيير دايم' : 'تغيير معاد'} من ${fmtShortDate(s.scheduled_at)} ${timeStr(new Date(s.scheduled_at))}${R.reason ? ': ' + R.reason : ''}`;
    for (const { r, at } of plan) {
      const patch = { reschedule_kind: kind, notes: [r.notes, note].filter(Boolean).join(' | ') };
      if (changeTime) Object.assign(patch, { scheduled_at: at, duration_minutes: R.dur, status: 'scheduled', actual_minutes: null });
      if (changeTutor) Object.assign(patch, { tutor_id: R.tutor, original_tutor_id: r.original_tutor_id || r.tutor_id, ...(rate != null ? { tutor_cost_egp: rate } : {}),
        meeting_link: state.plans.find(p => p.student_id === s.student_id && p.tutor_id === R.tutor)?.meeting_link || r.meeting_link });
      await q(sb.from('sessions').update(patch).eq('id', r.id));
    }
    if (R.scope === 'permanent' && changeTutor) {
      const pl = plansOf(s.student_id).find(p => norm(p.subject) === norm(s.subject));
      if (pl) await q(sb.from('student_subjects').update({ tutor_id: R.tutor, tutor_rate_egp: rate }).eq('id', pl.id));
    }
    if (preset.onDone) await preset.onDone();
    await refreshAll();
    rescheduleNotices(s, plan, { kind, changeTime, changeTutor, newTutor: R.tutor, dur: R.dur, series, scope: R.scope });
  });
}
function rescheduleNotices(s, plan, o) {
  const { st, fam, tu } = sessionView(s);
  const c = COUNTRIES[fam?.country] || COUNTRIES['مصر'];
  const nt = byId(state.tutors, o.newTutor);
  const dl = (iso, tz) => `${fmtDate(iso, tz)} الساعة ${fmtTime(iso, tz)}`;
  const lines = tz => plan.slice(0, 8).map(x => `• ${o.changeTime ? `${dl(x.r.scheduled_at, tz)} ← ${dl(x.at, tz)}` : dl(x.at, tz)}`).join('\n') + (plan.length > 8 ? `\n… و${plan.length - 8} حصص كمان` : '');
  const back = o.kind === 'temp' && o.series.length > plan.length - 1 ? o.series[plan.length - 1] : null;
  const subj = `${st?.name || ''}${s.subject ? ` (${s.subject})` : ''}`;
  const famText = `السلام عليكم ورحمة الله 🌷
${!o.changeTime ? `بخصوص حصص ${subj}${o.kind === 'permanent' ? ' — من الحصة الجاية:' : ' في المواعيد دي:'}` : o.kind === 'permanent' ? `تم تغيير الموعد الثابت لحصة ${subj} — من الحصة الجاية:` : o.kind === 'temp' ? `تغيير مؤقت في مواعيد حصة ${subj}:` : `تم تغيير موعد حصة ${subj}:`}
${o.kind === 'permanent' && o.changeTime ? `✅ الموعد الجديد: كل ${new Date(plan[0].at).toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', timeZone: c.tz })} الساعة ${fmtTime(plan[0].at, c.tz)} بتوقيت ${c.tzName}` : o.kind === 'permanent' ? 'المواعيد زي ما هي بدون تغيير.' : lines(c.tz)}${back ? `\nوبعدها الحصص بترجع لموعدها المعتاد بداية من ${dl(back.scheduled_at, c.tz)}.` : ''}${o.changeTutor ? `\n\n${o.kind === 'permanent' ? 'وهتكون الحصص مع معلمة جديدة إن شاء الله.' : 'الحصص دي هتكون مع معلمة بديلة لظرف عند المعلمة، وبعدها ترجع المعلمة المعتادة إن شاء الله.'}` : ''}
هنبعت الرابط والتذكير قبل كل حصة إن شاء الله 🙏
${SIGN_F}`;
  const blocks = [msgBlock(`رسالة ${fam?.name || 'الأسرة'}`, famText, { group: fam?.whatsapp_group, phone: fam?.whatsapp, country: fam?.country, editFamily: fam?.id })];
  const tutorMsg = (t, intro) => `${greetTutor(t?.name)}
${intro}
${lines(CAIRO_TZ)}${back && t?.id === s.tutor_id && !o.changeTutor ? `\nوبعدها بترجع لمعادها المعتاد من ${dl(back.scheduled_at, CAIRO_TZ)}.` : ''}
${SIGN_T}`;
  if (o.changeTutor) {
    blocks.push(msgBlock(`للمعلمة البديلة — ${nt?.name || ''}`, tutorMsg(nt, `${o.kind === 'permanent' ? 'انضم ليكي طالب جديد' : 'معاكي حصص بديلة'}: ${st?.name || ''} (${st?.grade_level || ''})${s.subject ? ' — ' + s.subject : ''}${isEN(s.student_id) ? ' (بالإنجليزي)' : ''}:`), { group: nt?.whatsapp_group, phone: nt?.phone, editTutor: nt?.id }));
    blocks.push(msgBlock(`للمعلمة الأصلية — ${tu?.name || ''}`, `${greetTutor(tu?.name)}
${o.kind === 'permanent' ? `بنبلغك إن حصص ${subj} اتنقلت لمعلمة تانية من الحصة الجاية. شكراً على مجهودك 🙏` : `الحصص دي مع ${subj} هتكون مع معلمة بديلة:\n${lines(CAIRO_TZ)}\nوبعدها ترجعلك إن شاء الله.`}
${SIGN_T}`, { group: tu?.whatsapp_group, phone: tu?.phone, editTutor: tu?.id }));
  } else {
    blocks.push(msgBlock(`للمعلمة — ${tu?.name || ''}`, tutorMsg(tu, `${o.kind === 'permanent' ? 'تم تغيير الموعد الثابت' : o.kind === 'temp' ? 'تغيير مؤقت في مواعيد' : 'تم تغيير موعد'} حصة ${subj}${o.changeTime ? ` (${durLabel(o.dur)})` : ''} — بتوقيت القاهرة:`), { group: tu?.whatsapp_group, phone: tu?.phone, editTutor: tu?.id }));
  }
  openModal(`تم ✓ ${SCOPE_L[o.scope]}${plan.length > 1 ? ` — ${plan.length} حصص` : ''} — بلّغ الأطراف`, `<div class="list">${blocks.join('')}</div>`);
  document.querySelectorAll('.msg-item').forEach(d => d.open = true);
}

/* ============================================================
   تقارير الحصص: المعلمة بتكتب بعد الحصة ← الإشراف بيبعته للأسرة
   ============================================================ */
const REP_LEVEL = { excellent: 'ممتاز 🌟', good: 'كويس 👍', needs: 'محتاج متابعة ⚠️' };
const repFor = s => (state.reports || []).find(r => r.session_id === s.id || (s.group_key && r.group_key === s.group_key));
function reportLine(s) {
  const r = repFor(s);
  if (!r) {
    const tu = byId(state.tutors, s.tutor_id);
    const ended = sEnd(s) < Date.now() - 15 * 60e3 && sEnd(s) > Date.now() - 7 * 864e5;
    return tu?.user_id && ended && !(isCancelled(s) && s.status !== 'done') ? `<div class="rep-line mt warn-txt">⏳ لسه المعلمة ماكتبتش تقرير الحصة <a href="javascript:void(0)" onclick="nudgeReport(${jsq(s.id)})">📲 فكّرها</a></div>` : '';
  }
  const planned = s.duration_minutes || 60;
  return `<div class="rep-line mt">📝 تقرير المعلمة: ${r.attended ? `<b>${durLabel(r.minutes)}</b>${r.minutes !== planned ? ` <span class="${r.minutes > planned ? 'pos' : 'neg'}">(المخطط ${durLabel(planned)})</span>` : ''}${r.absent_ids?.length ? ` · غاب ${r.absent_ids.length}` : ''}` : '<b class="neg">الطالب ماحضرش</b>'}
    · ${r.sent_at ? '<span class="pos">اتبعت للأسرة ✓</span>' : '<span class="warn-txt">لسه ماتبعتش للأسرة</span>'}</div>`;
}
function reportBtn(s) {
  const r = repFor(s); if (!r) return '';
  return `<button class="btn ${r.sent_at ? 'btn-ghost' : 'btn-brand'} sm" onclick="openReport(${jsq(r.id)})">📝 التقرير${r.sent_at ? ' ✓' : ''}</button>`;
}
async function repSessionRows(r) {
  let rows = allLoadedSessions().filter(x => x.id === r.session_id || (r.group_key && x.group_key === r.group_key));
  if (!rows.length || (r.group_key && rows.length < 2)) {
    try { rows = await q(r.group_key ? sb.from('sessions').select('*').eq('group_key', r.group_key) : sb.from('sessions').select('*').eq('id', r.session_id)); } catch (e) {}
  }
  return rows;
}
function seqLine(q) {
  if (!q || !q.seq) return '';
  const month = new Date(q.cycle_start + 'T12:00:00').toLocaleDateString('ar-EG-u-nu-latn', { month: 'long' });
  const units = q.total_minutes / 60, rem = q.package_size ? q.package_size - units : null;
  return `🔢 الحصة رقم ${q.seq}${q.is_package ? (q.package_size ? ` من باقة ${q.package_size} حصة` : ' في الباقة الحالية') : ` في شهر ${month}`}
⏳ المجموع لحد دلوقتي: ${durLabel(q.total_minutes)}${Math.abs(units - q.seq) > 0.01 ? ` (= ${fmtU(units)} حصة)` : ''}${rem != null ? (rem > 0.01 ? ` · فاضل ${fmtU(rem)} من الباقة` : rem > -0.01 ? ' · الباقة خلصت ✅' : ` · زيادة ${fmtU(-rem)} عن الباقة`) : ''}`;
}
async function sessionSeq(id) { try { const { data } = await sb.rpc('session_seq', { p_session: id }); return Array.isArray(data) ? data[0] : data; } catch (e) { return null; } }
function reportFamilyText(r, s, st, fam, absent, q) {
  const c = COUNTRIES[fam?.country] || COUNTRIES['مصر'];
  const subj = s.subject ? ` — ${s.subject}` : '';
  if (absent) return `السلام عليكم ورحمة الله 🌷
بنبلغكم إن ${st?.name || 'الطالب'} ماحضرش حصة${subj} يوم ${fmtDate(s.scheduled_at, c.tz)} الساعة ${fmtTime(s.scheduled_at, c.tz)} بتوقيت ${c.tzName}.
لو فيه ظرف أو حابين نرتب حصة تعويضية بلّغونا 🙏
${SIGN_F}`;
  return `السلام عليكم ورحمة الله 🌷
📝 تقرير حصة ${st?.name || ''}${subj}
📅 ${fmtDate(s.scheduled_at, c.tz)} الساعة ${fmtTime(s.scheduled_at, c.tz)} بتوقيت ${c.tzName}
⏱ مدة الحصة: ${durLabel(r.minutes)}${q && q.seq ? `\n${seqLine(q)}` : ''}${r.topics ? `\n📚 اللي اتشرح: ${r.topics}` : ''}${r.homework ? `\n✍️ الواجب: ${r.homework}` : ''}${r.level ? `\n⭐ المشاركة: ${REP_LEVEL[r.level]}` : ''}
لو عندكم أي ملاحظة على الحصة بلّغونا 🙏
${SIGN_F}`;
}
async function openReport(id) {
  const r = (state.reports || []).find(x => x.id === id); if (!r) return showToast('التقرير مش موجود', true);
  const rows = await repSessionRows(r);
  const s0 = rows.find(x => x.id === r.session_id) || rows[0]; if (!s0) return showToast('الحصة مش موجودة', true);
  const tu = byId(state.tutors, r.tutor_id), planned = s0.duration_minutes || 60;
  const live = rows.filter(x => !isCancelled(x) || x.status === 'done');
  const allDone = live.length && live.every(x => x.status === 'done');
  const anyOpen = rows.some(x => x.status === 'scheduled' || x.status === 'in_progress');
  const curMins = s0.actual_minutes || planned;
  const who = s0.group_key ? `👥 ${s0.group_name || 'مجموعة'}` : (byId(state.students, s0.student_id)?.name || '');
  // رسالة لكل أسرة (في المجموعة: الغايب بياخد رسالة غياب)
  const brows = (s0.group_key ? rows : [s0]).filter(x => !isCancelled(x) || x.status === 'done' || (r.absent_ids || []).includes(x.student_id));
  const seqs = await Promise.all(brows.map(x => sessionSeq(x.id)));
  const blocks = brows.map((x, i) => {
    const st = byId(state.students, x.student_id), fam = st ? byId(state.families, st.family_id) : null;
    const absent = !r.attended || (r.absent_ids || []).includes(x.student_id);
    return msgBlock(`رسالة ${fam?.name || 'الأسرة'}${s0.group_key ? ` (${st?.name || ''})` : ''}${absent ? ' — غياب' : ''}`, reportFamilyText(r, x, st, fam, absent, absent ? null : seqs[i]), { group: fam?.whatsapp_group, phone: fam?.whatsapp, country: fam?.country, editFamily: fam?.id });
  });
  const q0 = !s0.group_key && r.attended ? seqs[0] : null;
  const absentNames = (r.absent_ids || []).map(sid => byId(state.students, sid)?.name).filter(Boolean);
  openModal(`📝 تقرير حصة ${who}`, `
    <div class="sub small mb">${esc(tu?.name || '')} · ${esc(s0.subject || '')} · ${fmtDate(s0.scheduled_at)} ${timeStr(new Date(s0.scheduled_at))} · اتكتب ${ago(r.updated_at || r.created_at)}</div>
    ${r.attended && r.minutes !== planned ? `<div class="pill bad mb" style="display:inline-block">⚠️ المدة اتغيرت: ${durLabel(planned)} ← ${durLabel(r.minutes)} — اتأكد قبل التسجيل</div>` : ''}
    <div class="card item rep-card">
      ${r.attended ? `<div class="meta" style="margin:0"><span>المدة حسب المعلمة: <b>${durLabel(r.minutes)}</b>${r.minutes !== planned ? ` <span class="${r.minutes > planned ? 'pos' : 'neg'}">(المخطط ${durLabel(planned)})</span>` : ''}</span>
        ${absentNames.length ? `<span class="neg">غاب: <b>${esc(absentNames.join('، '))}</b></span>` : ''}${r.level ? `<span>المشاركة: <b>${REP_LEVEL[r.level]}</b></span>` : ''}</div>
        ${r.topics ? `<div class="mt">📚 <b>اللي اتشرح:</b> ${esc(r.topics)}</div>` : ''}${r.homework ? `<div class="mt">✍️ <b>الواجب:</b> ${esc(r.homework)}</div>` : ''}`
        : `<div class="neg"><b>🚫 الطالب ماحضرش الحصة</b></div>`}
      ${q0 && q0.seq ? `<div class="mt" style="white-space:pre-line">${esc(seqLine(q0))}</div>` : ''}
      ${r.tutor_note ? `<div class="mt sub">🔒 ملاحظة للإشراف بس: ${esc(r.tutor_note)}</div>` : ''}
    </div>
    ${r.attended && anyOpen ? `<div class="card item mb" style="background:var(--warn-soft)">الحصة لسه متسجلتش. <button class="btn btn-ok sm" onclick="applyReport(${jsq(r.id)}, 'done')">✓ سجّلها تمت (${durLabel(r.minutes)})</button></div>` : ''}
    ${r.attended && allDone && curMins !== r.minutes ? `<div class="card item mb" style="background:var(--warn-soft)">متسجلة ${durLabel(curMins)} والمعلمة كاتبة ${durLabel(r.minutes)}. <button class="btn btn-ghost sm" onclick="applyReport(${jsq(r.id)}, 'done')">عدّل المدة لـ ${durLabel(r.minutes)}</button></div>` : ''}
    ${!r.attended && anyOpen ? `<div class="card item mb" style="background:var(--warn-soft)"><button class="btn btn-ghost sm" onclick="applyReport(${jsq(r.id)}, 'absent')">🚫 سجّل إن الطالب ماحضرش</button></div>` : ''}
    <div class="section-title"><h2>ابعته للأسرة</h2></div>
    <div class="list">${blocks.join('')}</div>
    <div class="modal-foot">${r.sent_at ? `<span class="pos small">✓ اتبعت ${ago(r.sent_at)}</span><button class="btn btn-ghost" onclick="markReportSent(${jsq(r.id)}, false)">رجّعه "لسه ماتبعتش"</button>`
      : `<button class="btn btn-ok" onclick="markReportSent(${jsq(r.id)}, true)">✓ اتبعت للأسرة</button>`}
      <button class="btn btn-ghost" onclick="openReports()">كل التقارير</button></div>`);
  if (blocks.length === 1) document.querySelectorAll('.msg-item').forEach(d => d.open = true);
}
async function markReportSent(id, sent) {
  try {
    await q(sb.from('session_reports').update(sent ? { sent_at: new Date().toISOString(), sent_by: currentUser.id } : { sent_at: null, sent_by: null }).eq('id', id));
    const r = (state.reports || []).find(x => x.id === id); if (r) r.sent_at = sent ? new Date().toISOString() : null;
    showToast(sent ? 'اتعلّم إنه اتبعت ✓' : 'رجع لسه ماتبعتش');
    renderAttention(); renderDaily(); openReports();
  } catch (e) { showToast(dbError(e), true); }
}
async function applyReport(id, what) {
  const r = (state.reports || []).find(x => x.id === id); if (!r) return;
  const rows = await repSessionRows(r);
  try {
    if (what === 'absent') {
      await q(sb.from('sessions').update({ status: 'cancelled_by_student', cancel_reason: 'لم يحضر', cancel_note: 'حسب تقرير المعلمة', cancelled_at: new Date().toISOString(), cancelled_by_user: currentUser.id, cancel_scope: 'once', actual_minutes: null }).in('id', rows.map(x => x.id)));
    } else {
      const absent = rows.filter(x => (r.absent_ids || []).includes(x.student_id)).map(x => x.id);
      const present = rows.filter(x => !absent.includes(x.id) && (!isCancelled(x) || x.status === 'done')).map(x => x.id);
      if (present.length) await q(sb.from('sessions').update({ status: 'done', actual_minutes: r.minutes, cancel_reason: null, cancel_note: null, cancelled_at: null, cancel_scope: null, cancelled_by_user: null }).in('id', present));
      if (absent.length) await q(sb.from('sessions').update({ status: 'cancelled_by_student', cancel_reason: 'لم يحضر', cancel_note: 'حسب تقرير المعلمة', cancelled_at: new Date().toISOString(), cancelled_by_user: currentUser.id, cancel_scope: 'once', actual_minutes: null }).in('id', absent));
    }
    showToast(what === 'absent' ? 'اتسجل غياب ✓' : `اتسجلت ${durLabel(r.minutes)} ✓`);
    await refreshAll(); openReport(id);
  } catch (e) { showToast(dbError(e), true); }
}
function nudgeText(list) {
  const tu = byId(state.tutors, list[0].tutor_id);
  return `${greetTutor(tu?.name)}
فكرة بسيطة 🌷 لسه تقرير ${list.length === 1 ? 'الحصة دي' : 'الحصص دي'} مااتكتبش على البوابة:
${list.map(x => `• ${x.group_key ? '👥 ' + (x.group_name || 'مجموعة') : byId(state.students, x.student_id)?.name || ''}${x.subject ? ' — ' + x.subject : ''} (${relDayLabel(x.scheduled_at, CAIRO_TZ)} ${fmtTime(x.scheduled_at, CAIRO_TZ)})`).join('\n')}
ياريت تكتبيه من زرار "📝 اكتبي تقرير الحصة" عشان نبعته لولي الأمر 🙏
${APP_URL_PUBLIC}
${SIGN_T}`;
}
const APP_URL_PUBLIC = 'https://mohamedomar00700-sudo.github.io/ostaz-supervision-dashboard/';
function nudgeReport(sessionId) {
  const s = allLoadedSessions().find(x => x.id === sessionId) || (state.missingReports || []).find(x => x.id === sessionId); if (!s) return;
  const tu = byId(state.tutors, s.tutor_id);
  openModal('📲 تذكير المعلمة بالتقرير', `<div class="list">${msgBlock(`للمعلمة — ${tu?.name || ''}`, nudgeText([s]), { group: tu?.whatsapp_group, phone: tu?.phone, editTutor: tu?.id })}</div>`);
  document.querySelectorAll('.msg-item').forEach(d => d.open = true);
}
function openMissingReports() {
  const list = state.missingReports || [];
  const byT = {}; list.forEach(x => (byT[x.tutor_id] ||= []).push(x));
  openModal(`⏳ حصص لسه مالهاش تقرير (${list.length})`, `
    <p class="sub small">حصص خلصت من أكتر من ساعة (آخر 3 أيام) والمعلمة لسه ماكتبتش تقريرها. المعلمة بيوصلها تذكير لوحده بعد الحصة وبعدها بساعتين — ولو لسه، ابعتلها الرسالة دي.</p>
    <div class="list">${Object.entries(byT).map(([tid, ss]) => { const tu = byId(state.tutors, tid);
      return msgBlock(`${tu?.name || ''} — ${ss.length} ${ss.length === 1 ? 'حصة' : 'حصص'}`, nudgeText(ss), { group: tu?.whatsapp_group, phone: tu?.phone, editTutor: tu?.id }); }).join('')}</div>`);
  if (Object.keys(byT).length === 1) document.querySelectorAll('.msg-item').forEach(d => d.open = true);
}
async function openReports() {
  const list = state.reports || [];
  const ids = [...new Set(list.map(r => r.session_id))];
  let sess = allLoadedSessions().filter(x => ids.includes(x.id));
  const miss = ids.filter(i => !sess.some(x => x.id === i));
  if (miss.length) try { sess = sess.concat(await q(sb.from('sessions').select('*').in('id', miss))); } catch (e) {}
  const card = r => { const s = sess.find(x => x.id === r.session_id); if (!s) return '';
    const who = s.group_key ? `👥 ${s.group_name || 'مجموعة'}` : (byId(state.students, s.student_id)?.name || ''), fam = s.group_key ? null : sessionView(s).fam;
    return `<div class="card item ${r.sent_at ? '' : 's-confirm'}" style="cursor:pointer" onclick="openReport(${jsq(r.id)})"><div class="item-head">
      <div><b>${esc(who)}</b> <span class="sub small">${esc(fam?.name || '')}</span><div class="sub small">${esc(byId(state.tutors, r.tutor_id)?.name || '')} · ${esc(s.subject || '')} · ${fmtShortDate(s.scheduled_at)} ${timeStr(new Date(s.scheduled_at))}</div>
        <div class="small mt">${r.attended ? `⏱ ${durLabel(r.minutes)}${s.duration_minutes && r.minutes !== s.duration_minutes ? ` <span class="neg">⚠️ (المعاد ${durLabel(s.duration_minutes)})</span>` : ''}${r.topics ? ' · 📚 ' + esc(r.topics.slice(0, 70)) + (r.topics.length > 70 ? '…' : '') : ''}` : '<span class="neg">🚫 ماحضرش</span>'}</div></div>
      ${r.sent_at ? '<span class="badge b-done">اتبعت</span>' : '<span class="badge b-pending">جديد</span>'}</div></div>`; };
  const pend = list.filter(r => !r.sent_at), done = list.filter(r => r.sent_at).slice(0, 15);
  openModal(`📝 تقارير الحصص${pend.length ? ` (${pend.length} جديد)` : ''}`, `
    <p class="sub small">المعلمة بتكتب التقرير من البوابة بعد الحصة. ابعته للأسرة وعلّم عليه "اتبعت" — كده أي اعتراض بيبان من يومها مش آخر الشهر.</p>
    ${pend.length ? `<div class="list">${pend.map(card).join('')}</div>` : '<div class="empty">مفيش تقارير جديدة 👌</div>'}
    ${done.length ? `<details class="mt"><summary class="sub">آخر التقارير اللي اتبعتت</summary><div class="list mt">${done.map(card).join('')}</div></details>` : ''}`);
}

/* ============================================================
   طلبات المعلمات (تأجيل / إلغاء / غياب / مدة / إيقاف طالب)
   ============================================================ */
const REQ_KIND = { reschedule: '🔁 تأجيل / تغيير المعاد', cancel: '✖ إلغاء الحصة', absent: '🚫 الطالب ماحضرش', extend: '⏱ الحصة اتمدت', remove_student: '⛔ إيقاف الطالب', other: '💬 طلب', payment_info: '💳 تغيير رقم التحويل', add_session: '➕ حصة إضافية / تعويض', swap_student: '👥 حضر أخ/أخت بدل الطالب' };
async function openTutorRequests() {
  let list = [];
  try { list = await q(sb.from('tutor_requests').select('*').order('created_at', { ascending: false }).limit(40)); } catch (e) { return showToast(dbError(e), true); }
  const sessIds = list.map(r => r.session_id).filter(Boolean);
  const sess = sessIds.length ? await q(sb.from('sessions').select('*').in('id', sessIds)) : [];
  window._reqData = { list, sess };
  const pending = list.filter(r => r.status === 'pending'), done = list.filter(r => r.status !== 'pending').slice(0, 10);
  const card = r => {
    const s = sess.find(x => x.id === r.session_id), tu = byId(state.tutors, r.tutor_id), st = byId(state.students, r.student_id), fam = st ? byId(state.families, st.family_id) : null;
    const late = s && r.kind === 'cancel' && (sStart(s) - new Date(r.created_at).getTime()) < LATE_HOURS * 3600e3;
    return `<div class="card item ${r.status === 'pending' ? 's-confirm' : ''}">
      <div class="item-head"><div><div class="item-title">${REQ_KIND[r.kind]}</div>
        <div class="sub small">${esc(tu?.name || '')} · ${ago(r.created_at)}</div></div>
        ${r.status === 'pending' ? '<span class="badge b-pending">مستني</span>' : r.status === 'approved' ? '<span class="badge b-done">اتوافق</span>' : '<span class="badge b-cancel">اترفض</span>'}</div>
      ${r.kind === 'payment_info' ? `<div class="meta"><span>القديم: <b>${esc(r.old_value || '—')}</b></span><span>الجديد: <b class="pos">${esc(r.new_value || '')}</b></span></div>
        ${r.status === 'pending' ? `<div class="pill bad mt" style="display:inline-block;white-space:normal">⚠️ كلّم المعلمة على رقمها المعروف واتأكد إنها هي اللي طلبت قبل الموافقة</div>` : ''}` : `
      <div class="meta"><span>الطالب: <b>${esc(s?.group_key ? '👥 ' + (s.group_name || 'مجموعة') : st?.name || '')}</b> <span class="sub small">${esc(fam?.name || '')}</span></span>
        ${s ? `<span>الحصة: <b>${fmtShortDate(s.scheduled_at)} ${timeStr(new Date(s.scheduled_at))}</b>${s.subject ? ' · ' + esc(s.subject) : ''}${isCancelled(s) ? ' <span class="neg">(ملغاة)</span>' : ''}</span>` : ''}
        ${r.proposed_at ? `<span>${r.kind === 'add_session' ? (r.scope === 'permanent' ? 'من' : 'المعاد') : 'المقترح'}: <b>${fmtShortDate(r.proposed_at)} ${timeStr(new Date(r.proposed_at))}</b> <span class="sub small">(القاهرة ${fmtTime(r.proposed_at, CAIRO_TZ)})</span></span>` : ''}
        ${r.proposed_minutes ? `<span>المدة: <b>${durLabel(r.proposed_minutes)}</b></span>` : ''}
        ${r.kind === 'swap_student' ? `<span>اللي حضر فعلاً: <b class="pos">${esc(byId(state.students, r.new_value)?.name || '')}</b></span>` : ''}
        ${r.kind === 'reschedule' ? `<span>النوع: <b>${r.scope === 'permanent' ? '♾ تغيير دايم' : 'الحصة دي بس'}</b></span>` : ''}
        ${r.kind === 'add_session' ? `${r.new_value ? `<span>المادة: <b>${esc(r.new_value)}</b></span>` : ''}<span>النوع: <b>${r.scope === 'permanent' ? '🔁 ميعاد ثابت كل أسبوع' : 'مرة واحدة'}</b></span>` : ''}</div>`}
      ${r.reason && r.kind !== 'payment_info' ? `<div class="mt" style="white-space:pre-wrap">📝 ${esc(r.reason)}</div>` : ''}
      ${late ? `<div class="pill bad mt" style="display:inline-block">⚠️ إلغاء متأخر — أقل من ${LATE_HOURS} ساعات قبل الحصة</div>` : ''}
      ${r.decision_note ? `<div class="sub small mt">ردّك: ${esc(r.decision_note)}</div>` : ''}
      ${r.status === 'pending' ? `<div class="actions"><button class="btn btn-ok sm" onclick="approveTutorRequest(${jsq(r.id)})">${r.kind === 'payment_info' ? '✓ اتأكدت — اعتمد الرقم' : '✓ موافقة وتنفيذ'}</button>
        <button class="btn btn-ghost sm" onclick="rejectTutorRequest(${jsq(r.id)})">✕ رفض</button>
        ${st ? `<button class="btn btn-ghost sm" onclick="openStudentProfile(${jsq(st.id)})">🎒 ملف الطالب</button>` : ''}</div>` : ''}
    </div>`;
  };
  openModal(`طلبات المعلمات${pending.length ? ` (${pending.length})` : ''}`, `
    ${pending.length ? `<div class="list">${pending.map(card).join('')}</div>` : '<div class="empty">مفيش طلبات مستنية 👌</div>'}
    ${done.length ? `<details class="mt"><summary class="sub">آخر الطلبات اللي اتردّ عليها</summary><div class="list mt">${done.map(card).join('')}</div></details>` : ''}`);
}
async function decideRequest(r, status, note) {
  await q(sb.from('tutor_requests').update({ status, decision_note: note || null, decided_by: currentUser.id, decided_at: new Date().toISOString() }).eq('id', r.id));
}
function rejectTutorRequest(id) {
  const r = window._reqData.list.find(x => x.id === id);
  openModal('رفض الطلب', `<div class="field"><label>سبب الرفض (هيوصل للمعلمة)</label><textarea id="rj-note" class="input" placeholder="مثال: الأسرة مش هتقدر في المعاد ده — هنكلمك نتفق على معاد تاني"></textarea></div>
    <div class="modal-foot"><button class="btn btn-danger" style="background:var(--danger);color:#fff" id="form-submit" onclick="_rj()">رفض</button><button class="btn btn-ghost" onclick="openTutorRequests()">رجوع</button></div>`);
  window._rj = () => runSubmit(async () => { await decideRequest(r, 'rejected', document.getElementById('rj-note').value.trim()); showToast('اترفض ✓ واتبلغت المعلمة'); await refreshAll(); openTutorRequests(); });
}
async function approveTutorRequest(id) {
  const { list, sess } = window._reqData;
  const r = list.find(x => x.id === id), s = sess.find(x => x.id === r.session_id);
  const tu = byId(state.tutors, r.tutor_id), st = byId(state.students, r.student_id);
  try {
    if (r.kind === 'add_session') {
      const pl = state.plans.find(p => p.student_id === r.student_id && p.tutor_id === r.tutor_id && (!r.new_value || norm(p.subject) === norm(r.new_value)))
        || state.plans.find(p => p.student_id === r.student_id && p.tutor_id === r.tutor_id);
      return openSessionForm(null, { student_id: r.student_id, tutor_id: r.tutor_id, subject: r.new_value || pl?.subject, plan_id: pl?.id, at: r.proposed_at,
        duration: r.proposed_minutes, repeat: r.scope === 'permanent' ? 8 : 1, notes: `بطلب ${tu?.name || 'المعلمة'}${r.reason ? ': ' + r.reason : ''}`,
        title: `➕ موافقة على طلب ${tu?.name || 'المعلمة'}`, notify: true,
        intro: `<div class="card item mb" style="background:var(--warn-soft)">${new Date(r.proposed_at) < new Date() ? '<b>⚠️ الحصة دي معادها فات — المعلمة بتقول إنها اتعملت ومتسجلتش. بعد الإضافة سجّلها "تمت".</b><br>' : ''}راجع المعاد والسعر${r.scope === 'permanent' ? ' وعدد الأسابيع' : ''} قبل الإضافة — الحصة هتتعمل والمعلمة هيوصلها إشعار بالموافقة.${r.reason ? `<div class="small mt">📝 ${esc(r.reason)}</div>` : ''}</div>`,
        onDone: () => decideRequest(r, 'approved') });
    }
    if (r.kind === 'swap_student') {
      const to = byId(state.students, r.new_value);
      if (!s || !to) return showToast('الحصة أو الطالب مش موجودين', true);
      if (to.family_id !== st?.family_id) return showToast('ده مش من نفس الأسرة', true);
      const priceNote = Number(to.default_price) !== Number(st?.default_price) ? `\n\n⚠️ سعر ${to.name} (${to.default_price}) مختلف عن ${st?.name} (${st?.default_price}) — الحصة هتفضل بسعرها الحالي ${s.student_price}، عدّله من الحصة لو محتاج.` : '';
      if (!confirm(`حصة ${fmtShortDate(s.scheduled_at)} ${timeStr(new Date(s.scheduled_at))}${s.subject ? ' — ' + s.subject : ''}\nهتتحسب على ${to.name} بدل ${st?.name || ''}؟${priceNote}`)) return;
      await q(sb.from('sessions').update({ student_id: to.id, notes: [s.notes, `حضر ${to.name} بدل ${st?.name || ''} (بطلب ${tu?.name || 'المعلمة'})`].filter(Boolean).join(' | ') }).eq('id', s.id));
      await decideRequest(r, 'approved', `اتسجلت الحصة على ${to.name}`);
      await refreshAll(); showToast(`اتسجلت على ${to.name} ✓ واتبلغت المعلمة`); return openTutorRequests();
    }
    if (r.kind === 'payment_info') {
      if (!confirm(`اعتماد رقم التحويل الجديد لـ ${tu?.name || 'المعلمة'}؟\n\nالقديم: ${r.old_value || '—'}\nالجديد: ${r.new_value}\n\nاتأكدت منها بنفسك؟`)) return;
      const isBank = /^(InstaPay|حساب بنكي):/.test(r.new_value || '');
      await q(sb.from('tutors').update(isBank ? { bank_account: r.new_value, vodafone_cash: null } : { vodafone_cash: r.new_value, bank_account: null }).eq('id', r.tutor_id));
      await decideRequest(r, 'approved', 'اتأكدنا معاكي واتعتمد الرقم الجديد');
      await refreshAll(); showToast('اتعتمد الرقم الجديد ✓ واتبلغت المعلمة'); return openTutorRequests();
    }
    if (r.kind === 'reschedule' && s && !s.group_key) {
      return openReschedule(s.id, { session: s, proposed_at: r.proposed_at, scope: r.scope === 'permanent' ? 'permanent' : 'once', reason: r.reason || '', title: `موافقة على طلب ${tu?.name || 'المعلمة'}`,
        onDone: () => decideRequest(r, 'approved') });
    }
    if (r.kind === 'reschedule' && s) { // مجموعة: الحصة دي بس
      const conflicts = await findConflicts([{ ...s, scheduled_at: r.proposed_at }], s.id);
      if (conflicts.length && !confirm(`⚠️ المعاد الجديد فيه تعارض:\n${conflicts.slice(0, 4).map(({ o }) => { const v = sessionView(o); return `• ${timeStr(new Date(o.scheduled_at))}: ${v.st?.name || ''} مع ${v.tu?.name || ''}`; }).join('\n')}\n\nتوافق برضه؟`)) return;
      const oldIso = s.scheduled_at;
      const patch = { scheduled_at: r.proposed_at, status: 'scheduled', actual_minutes: null, notes: [s.notes, `تأجيل بطلب المعلمة من ${fmtShortDate(oldIso)} ${timeStr(new Date(oldIso))}${r.reason ? ': ' + r.reason : ''}`].filter(Boolean).join(' | ') };
      await q(s.group_key ? sb.from('sessions').update(patch).eq('group_key', s.group_key).in('status', ['scheduled', 'in_progress']) : sb.from('sessions').update(patch).eq('id', s.id));
      await decideRequest(r, 'approved');
      await refreshAll();
      const fams = s.group_key ? [...new Map((await q(sb.from('sessions').select('student_id').eq('group_key', s.group_key))).map(x => sessionView(x).fam).filter(Boolean).map(f => [f.id, f])).values()] : [sessionView(s).fam].filter(Boolean);
      const blocks = fams.map(f => { const c = COUNTRIES[f.country] || COUNTRIES['مصر'];
        return msgBlock(`رسالة ${f.name}`, `السلام عليكم ورحمة الله 🌷
نعتذر، تم تغيير موعد حصة ${s.group_key ? 'المجموعة' : st?.name || ''}${s.subject ? ` (${s.subject})` : ''}:
❌ الموعد القديم: ${fmtDate(oldIso, c.tz)} الساعة ${fmtTime(oldIso, c.tz)}
✅ الموعد الجديد: ${fmtDate(r.proposed_at, c.tz)} الساعة ${fmtTime(r.proposed_at, c.tz)} بتوقيت ${c.tzName}
لو المعاد مش مناسب بلّغونا ونرتب معاد تاني إن شاء الله 🙏
${SIGN_F}`, { group: f.whatsapp_group, phone: f.whatsapp, country: f.country, editFamily: f.id }); });
      openModal('✅ اتوافق واتغير المعاد — بلّغ الأسرة', `<p class="sub small">المعلمة وصلها إشعار بالموافقة.</p><div class="list">${blocks.join('')}</div>
        <div class="modal-foot"><button class="btn btn-ghost" onclick="openTutorRequests()">باقي الطلبات</button></div>`);
      document.querySelectorAll('.msg-item').forEach(d => d.open = true);
      return;
    }
    if (r.kind === 'cancel' && s) {
      const patch = { status: 'cancelled_by_tutor', cancel_reason: 'ظرف طارئ', cancel_note: r.reason || null, cancelled_at: r.created_at, cancelled_by_user: currentUser.id, cancel_scope: 'once' };
      await q(s.group_key ? sb.from('sessions').update(patch).eq('group_key', s.group_key).in('status', ['scheduled', 'in_progress']) : sb.from('sessions').update(patch).eq('id', s.id));
      await decideRequest(r, 'approved');
      await refreshAll();
      if (!s.group_key) return showCancelNotices(s, [s], { party: 'cancelled_by_tutor', scope: 'once', reason: 'ظرف طارئ' });
      showToast('اتلغت حصة المجموعة ✓ — بلّغ الأسر من كارت المجموعة'); return openTutorRequests();
    }
    if (r.kind === 'absent' && s) {
      await q(sb.from('sessions').update({ status: 'cancelled_by_student', cancel_reason: 'لم يحضر', cancel_note: r.reason || 'بلاغ من المعلمة', cancelled_at: new Date().toISOString(), cancelled_by_user: currentUser.id, cancel_scope: 'once', actual_minutes: null }).eq('id', s.id));
    } else if (r.kind === 'extend' && s) {
      await q(sb.from('sessions').update({ status: 'done', actual_minutes: r.proposed_minutes }).eq(s.group_key ? 'group_key' : 'id', s.group_key || s.id));
    } else if (r.kind === 'remove_student') {
      if (!confirm(`إيقاف ${st?.name || 'الطالب'} مع ${tu?.name || 'المعلمة'}: هيتشال من خطته مع المعلمة دي، والحصص الجاية معاها هتتلغي. تكمل؟`)) return;
      const fut = await q(sb.from('sessions').select('id').eq('student_id', r.student_id).eq('tutor_id', r.tutor_id).eq('status', 'scheduled').gt('scheduled_at', new Date().toISOString()));
      if (fut.length) await q(sb.from('sessions').update({ status: 'cancelled_by_tutor', cancel_reason: 'اعتذار عن الطالب', cancel_note: r.reason || null, cancelled_at: new Date().toISOString(), cancelled_by_user: currentUser.id, cancel_scope: 'permanent' }).in('id', fut.map(x => x.id)));
      await q(sb.from('student_subjects').update({ tutor_id: null, tutor_rate_egp: null, meeting_link: null }).eq('student_id', r.student_id).eq('tutor_id', r.tutor_id));
      await decideRequest(r, 'approved', fut.length ? `اتلغت ${fut.length} حصة جاية` : null);
      showToast(`تم ✓${fut.length ? ` واتلغت ${fut.length} حصة جاية` : ''} — دوّر على معلمة بديلة للطالب`); await refreshAll(); return openTutorRequests();
    }
    await decideRequest(r, 'approved');
    showToast('اتوافق ✓ واتبلغت المعلمة'); await refreshAll(); openTutorRequests();
  } catch (e) { showToast(dbError(e), true); }
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
    ${open ? a('🔁', 'تأجيل / تغيير المعاد أو المعلمة (مرة / مؤقت / دايم)', `openReschedule(${I})`) : ''}
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
  another_tutor: { l: '🔄 هيجرب معلمة تانية', short: 'هيجرب تانية', cls: 'b-pending' },
  switched: { l: '✅ كمّل مع معلمة تانية', short: 'كمّل مع معلمة تانية', cls: 'b-done' },
  thinking: { l: '🤔 لسه بيفكر', short: 'بيفكر', cls: 'b-scheduled' },
  lost: { l: '❌ مش هيحجز', short: 'مش هيحجز', cls: 'b-cancel' },
};
const TRIAL_REASONS = {
  another_tutor: ['أسلوب المعلمة', 'مستوى الشرح', 'الطالب مش مرتاح', 'المواعيد', 'أخرى'],
  switched: ['أسلوب المعلمة', 'مستوى الشرح', 'الطالب مش مرتاح', 'المواعيد', 'أخرى'],
  lost: ['السعر', 'المواعيد مش مناسبة', 'أسلوب / مستوى المعلمة', 'الطالب مش مرتاح', 'مش محتاج دلوقتي', 'لم يرد', 'أخرى'],
};
const trialPending = s => s.kind === 'trial' && s.status === 'done' && (!s.trial_outcome || s.trial_outcome === 'thinking');
function trialOutcomeLine(s) {
  if (s.kind !== 'trial' || s.status !== 'done') return '';
  if (!s.trial_outcome) return `<div class="cancel-info mt" style="background:var(--warn-soft);color:var(--warn)">🧪 نتيجة التجربة لسه ماتسجلتش</div>`;
  const o = TRIAL_OUT[s.trial_outcome];
  return `<div class="cancel-info mt"><span class="badge ${o.cls}">${o.short}${s.trial_outcome === 'switched' && s.trial_switched_to ? ': ' + esc(byId(state.tutors, s.trial_switched_to)?.name || '') : ''}</span>${s.trial_outcome_reason ? ' · ' + esc(s.trial_outcome_reason) : ''}${s.trial_outcome_note ? ' — ' + esc(s.trial_outcome_note) : ''}</div>`;
}
function openTrialOutcome(id) {
  const s = findSession(id); if (!s) return;
  const { st, fam, tu } = sessionView(s);
  const to = { out: s.trial_outcome || '', reason: s.trial_outcome_reason || '', note: s.trial_outcome_note || '', other: s.trial_switched_to || (plansOf(s.student_id).find(p => norm(p.subject) === norm(s.subject) && p.tutor_id && p.tutor_id !== s.tutor_id) || {}).tutor_id
    || (allLoadedSessions().find(x => x.student_id === s.student_id && x.tutor_id !== s.tutor_id && x.kind !== 'trial' && norm(x.subject) === norm(s.subject) && sStart(x) > sStart(s)) || {}).tutor_id || '' };
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
      ${to.out === 'switched' ? `<div class="field"><label>كمّل مع مين؟</label><select class="input" onchange="_to.other=this.value"><option value="">اختار المعلمة…</option>${state.tutors.filter(t => t.id !== s.tutor_id).map(t => `<option value="${esc(t.id)}" ${to.other === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></div>` : ''}
      ${reasons.length ? `<div class="field"><label>${to.out === 'lost' ? 'السبب' : to.out === 'switched' ? 'ليه مكمّلش مع المعلمة دي؟' : 'ليه عايز يغيّر؟'}</label><div class="chips" style="margin:0">
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
    if (to.out === 'switched' && !to.other) return formError('اختار المعلمة اللي كمّل معاها');
    await q(sb.from('sessions').update({ trial_outcome: to.out, trial_outcome_reason: to.reason || null, trial_outcome_note: to.note || null,
      trial_switched_to: to.out === 'switched' ? to.other : null, trial_outcome_at: new Date().toISOString() }).eq('id', s.id));
    if (to.out === 'switched' && s.subject) { // خطة الطالب للمادة دي بقت مع المعلمة الجديدة
      const pl = plansOf(s.student_id).filter(p => norm(p.subject) === norm(s.subject));
      if (!pl.length) await q(sb.from('student_subjects').insert({ student_id: s.student_id, subject: s.subject, tutor_id: to.other }));
      else if (pl[0].tutor_id !== to.other) await q(sb.from('student_subjects').update({ tutor_id: to.other, tutor_rate_egp: null }).eq('id', pl[0].id));
    }
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
  const conv = by('converted'), sw = by('switched'), other = by('another_tutor'), lost = by('lost'), pend = trials.length - conv - sw - other - lost;
  const decided = conv + sw + other + lost, stayed = conv + sw; // اللي كمّل مع معلمة تانية فضل مع الأكاديمية
  const cost = trials.reduce((a, s) => a + charges(s).tut, 0);
  const perTutor = {};
  trials.forEach(s => { const x = perTutor[s.tutor_id] ||= { n: 0, c: 0, o: 0, l: 0 }; x.n++; if (s.trial_outcome === 'converted') x.c++; if (['another_tutor', 'switched'].includes(s.trial_outcome)) x.o++; if (s.trial_outcome === 'lost') x.l++; });
  const tRows = Object.entries(perTutor).map(([id, x]) => ({ t: byId(state.tutors, id), x, rate: (x.c + x.o + x.l) ? x.c / (x.c + x.o + x.l) : null }))
    .filter(r => r.t).sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.x.n - a.x.n);
  const reasons = {}; trials.filter(s => ['lost', 'another_tutor', 'switched'].includes(s.trial_outcome)).forEach(s => { const k = s.trial_outcome_reason || 'بدون سبب'; reasons[k] = (reasons[k] || 0) + 1; });
  const rs = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
  return `<div class="section-title"><h2>🧪 الحصص التجريبية</h2></div>
    <div class="kpis">
      <div class="card kpi"><div class="l">تجريبية تمت</div><div class="v num">${trials.length}</div><div class="s">تكلفة المعلمات: ${fmt(cost)} EGP</div></div>
      <div class="card kpi"><div class="l">فضلوا معانا</div><div class="v num ${decided ? (stayed / decided >= .5 ? 'pos' : 'warn-txt') : ''}">${decided ? Math.round(stayed / decided * 100) + '%' : '—'}</div><div class="s">${conv} مع نفس المعلمة${sw ? ` + ${sw} مع معلمة تانية` : ''} من ${decided}</div></div>
      <div class="card kpi"><div class="l">غيّروا المعلمة</div><div class="v num">${other + sw}</div><div class="s">لسه بيجربوا: ${other} · مش هيحجزوا: ${lost}</div></div>
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
  currentUser = null; currentSupervisor = null; _postAuthHandled = false; if (typeof T !== 'undefined') T.me = null;
  if (realtimeChannel) { sb.removeChannel(realtimeChannel); realtimeChannel = null; }
  showView('auth');
}
function showView(name) {
  ['auth', 'pending', 'app', 'tutor'].forEach(v => document.getElementById('view-' + v)?.classList.toggle('hidden', v !== name));
}
async function handlePostAuth(attempt = 0) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { showView('auth'); return; }
  currentUser = user;
  const { data: supervisor, error } = await sb.from('supervisors').select('*').eq('id', user.id).maybeSingle();
  if (!supervisor?.active) { // معلمة؟
    const { data: tme } = await sb.rpc('tutor_claim');
    if (tme) return enterTutor(tme);
  }
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
  document.body.classList.toggle('hide-profit', !isAdmin); // الإيرادات والهامش للأونر بس
  document.getElementById('current-user-name').textContent = currentSupervisor.name + (isAdmin ? ' · أدمن' : ' · مشرف');
  // إدارة المشرفين بقت من قائمة الإعدادات ⚙️
  // تنظيف أي داتا تجريبية قديمة من النسخة السابقة
  try { localStorage.removeItem('ostaz_sessions'); } catch (e) {}
  // فتح يوم معيّن لو جاي من إشعار (?day=YYYY-MM-DD)
  const openReq = new URLSearchParams(location.search).get('req');
  if (openReq) setTimeout(() => openTutorRequests(), 1500);
  if (new URLSearchParams(location.search).get('reports')) setTimeout(() => openReports(), 1500);
  if (new URLSearchParams(location.search).get('missing')) setTimeout(() => openMissingReports(), 1500);
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
    const tutorUsers = new Set(state.tutors.map(t => t.user_id).filter(Boolean));
    data.splice(0, data.length, ...data.filter(x => !tutorUsers.has(x.id)));
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

/* ============================================================
   لوحة الأعمال — صورة البيزنس كاملة (للإدارة وللعرض على مستثمر)
   ============================================================ */
const CURR_L = { arabic: 'عربي', languages: 'لغات', international: 'دولي' };
function gradeStage(g) {
  g = g || '';
  if (/روضة|KG|تمهيدي/i.test(g)) return 'رياض أطفال';
  if (/عشر|العاشر|ثانوي/.test(g)) return 'ثانوي';
  if (/السابع|الثامن|التاسع|إعدادي|متوسط/.test(g)) return 'إعدادي / متوسط';
  if (/الأول|الثاني|الثالث|الرابع|الخامس|السادس|ابتدائي/.test(g)) return 'ابتدائي';
  return 'غير محدد';
}
async function fetchAll(build) { // تخطي حد الألف صف
  const out = []; for (let i = 0; ; i += 1000) { const rows = await q(build().range(i, i + 999)); out.push(...rows); if (rows.length < 1000) break; } return out;
}
async function loadBusiness() {
  const now = new Date(), from = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  setLoading(true);
  try {
    const cols = 'id,student_id,tutor_id,status,scheduled_at,duration_minutes,actual_minutes,subject,kind,group_key,revenue_egp,tutor_charge_egp,student_charge,student_currency,cancel_reason,trial_outcome,trial_switched_to,created_at';
    const [ss, reps, monthly, fh] = await Promise.all([
      fetchAll(() => sb.from('sessions').select(cols).gte('scheduled_at', from.toISOString()).lte('scheduled_at', new Date(now.getTime() + 864e5).toISOString()).order('scheduled_at')),
      q(sb.from('session_reports').select('session_id,group_key,created_at').gte('created_at', new Date(now.getTime() - 40 * 864e5).toISOString())),
      isAdmin ? sb.rpc('finance_monthly', { p_from: dateStr(from), p_to: dateStr(now) }).then(x => x.data || []) : [],
      sb.from('family_history').select('family_name,family_id').then(x => x.data || []),
    ]);
    state.biz = { ss, reps, monthly, fh, at: Date.now() };
    renderReports();
  } catch (e) { showToast(dbError(e), true); } finally { setLoading(false); }
}
function bizCompute() {
  const { ss, reps, monthly } = state.biz, now = Date.now(), D = 864e5;
  const done = ss.filter(s => s.status === 'done');
  const stuOf = id => byId(state.students, id), famOf = sid => byId(state.families, stuOf(sid)?.family_id);
  const win = (a, b) => done.filter(s => { const t = new Date(s.scheduled_at).getTime(); return t >= now - a * D && t < now - b * D; });
  const cur = win(30, 0), prev = win(60, 30);
  const agg = list => { const occ = occurrences(list); return {
    stu: new Set(list.map(s => s.student_id)), fam: new Set(list.map(s => stuOf(s.student_id)?.family_id).filter(Boolean)), tut: new Set(list.map(s => s.tutor_id)),
    h: occ.reduce((a, s) => a + sMins(s), 0) / 60, rev: list.reduce((a, s) => a + Number(s.revenue_egp || 0), 0), tc: list.reduce((a, s) => a + charges(s).tut, 0), n: occ.length }; };
  const A = agg(cur), P = agg(prev);
  // شهور
  const months = []; const d0 = new Date(); for (let i = 11; i >= 0; i--) months.push(monthKey(new Date(d0.getFullYear(), d0.getMonth() - i, 1)));
  const byM = Object.fromEntries(months.map(k => [k, []])); done.forEach(s => { const k = monthKey(new Date(s.scheduled_at)); if (byM[k]) byM[k].push(s); });
  const firstSeen = {}; done.forEach(s => { const k = monthKey(new Date(s.scheduled_at)); if (!firstSeen[s.student_id] || k < firstSeen[s.student_id]) firstSeen[s.student_id] = k; });
  const firstData = months.find(k => byM[k].length);
  const M = months.map((k, i) => { const a = agg(byM[k]); const prevSet = i ? agg(byM[months[i - 1]]).stu : new Set();
    const kept = [...prevSet].filter(x => a.stu.has(x)).length;
    const fm = (monthly || []).find(m => m.month.slice(0, 7) === k);
    return { k, ...a, newStu: [...a.stu].filter(x => firstSeen[x] === k && k !== firstData).length, lost: k === months[months.length - 1] ? null : prevSet.size - kept,
      ret: prevSet.size && k !== months[months.length - 1] ? kept / prevSet.size : null, ex: fm ? +fm.expenses_egp : 0, cin: fm ? +fm.cash_in_egp : 0 }; });
  const startIdx = M.findIndex(m => m.n); const MM = startIdx < 0 ? [] : M.slice(startIdx);
  const lastFull = MM.length >= 2 ? MM[MM.length - 2] : null;
  // توزيعات (آخر 30 يوم بالساعات + عدد الطلاب)
  const dist = keyFn => { const m = {}; occurrences(cur).forEach(o => { const k = keyFn(o) || 'غير محدد'; const x = m[k] ||= { h: 0, stu: new Set(), rev: 0 }; x.h += sMins(o) / 60; (o._members || [o]).forEach(z => { x.stu.add(z.student_id); x.rev += Number(z.revenue_egp || 0); }); });
    return Object.entries(m).map(([k, x]) => ({ k, h: x.h, n: x.stu.size, rev: x.rev })).sort((a, b) => b.h - a.h); };
  const byCountry = dist(o => famOf(o.student_id)?.country), byCurr = dist(o => CURR_L[stuOf(o.student_id)?.curriculum]), byStage = dist(o => gradeStage(stuOf(o.student_id)?.grade_level)), bySubj = dist(o => normSubj(o.subject));
  const topFam = (() => { const m = {}; cur.forEach(s => { const f = famOf(s.student_id); if (!f) return; const x = m[f.id] ||= { f, h: 0, rev: 0, stu: new Set() }; x.h += sMins(s) / 60; x.rev += Number(s.revenue_egp || 0); x.stu.add(s.student_id); }); return Object.values(m).sort((a, b) => b.h - a.h); })();
  const topTut = (() => { const m = {}; occurrences(cur).forEach(o => { const x = m[o.tutor_id] ||= { t: byId(state.tutors, o.tutor_id), h: 0, stu: new Set(), cost: 0 }; x.h += sMins(o) / 60; x.cost += occTut(o); (o._members || [o]).forEach(z => x.stu.add(z.student_id)); }); return Object.values(m).filter(x => x.t).sort((a, b) => b.h - a.h); })();
  // جودة التشغيل (آخر 30 يوم)
  const past30 = ss.filter(s => { const t = new Date(s.scheduled_at).getTime(); return t >= now - 30 * D && t < now; });
  const cS = past30.filter(s => s.status === 'cancelled_by_student').length, cT = past30.filter(s => s.status === 'cancelled_by_tutor').length;
  const commit = cur.length + cS + cT ? cur.length / (cur.length + cS + cT) : null;
  const linked = new Set(state.tutors.filter(t => t.user_id).map(t => t.id));
  const repBase = occurrences(cur.filter(s => linked.has(s.tutor_id) && new Date(s.scheduled_at).getTime() >= now - 14 * D));
  const repDone = repBase.filter(o => reps.some(r => r.session_id === o.id || (o.group_key && r.group_key === o.group_key))).length;
  const trials = ss.filter(s => s.kind === 'trial' && new Date(s.scheduled_at).getTime() >= now - 90 * D && s.status === 'done');
  const trialWon = trials.filter(s => s.trial_outcome === 'converted' || s.trial_outcome === 'switched').length, trialDecided = trials.filter(s => s.trial_outcome).length;
  // الأرصدة
  const owing = state.families.map(f => ({ f, b: famBalance(f) })).filter(x => x.b.balance < -0.01);
  const recv = owing.reduce((a, x) => a + -x.b.balance * fxRate(x.f.currency), 0);
  const tutDue = state.tutors.reduce((a, t) => a + Math.max(0, tutBalance(t).due), 0);
  const famWithStu = state.families.filter(f => state.students.some(s => s.family_id === f.id));
  const everFam = famWithStu.length + new Set((state.biz.fh || []).filter(h => !h.family_id || !byId(state.families, h.family_id)).map(h => h.family_name)).size;
  return { A, P, MM, lastFull, byCountry, byCurr, byStage, bySubj, topFam, topTut, commit, cS, cT, repBase: repBase.length, repDone, trials: trials.length, trialWon, trialDecided, owing, recv, tutDue,
    totals: { fam: famWithStu.length, ever: everFam, stu: state.students.length, tut: state.tutors.length, linked: linked.size } };
}
function normSubj(s) { s = (s || '').trim(); if (!s) return 'غير محدد'; if (/رياض|math/i.test(s)) return 'رياضيات'; if (/إنج|انج|english/i.test(s)) return 'إنجليزي'; if (/عربي|لغة عربية|arabic/i.test(s)) return 'عربي';
  if (/علوم|science/i.test(s)) return 'علوم'; if (/قرآن|قران|إسلام|اسلام|دين/.test(s)) return 'قرآن وتربية إسلامية'; return s; }
const pctChg = (a, b) => b ? (a - b) / Math.abs(b) * 100 : null;
const chgHtml = (a, b, inv) => { const p = pctChg(a, b); if (p == null) return a ? '<span class="sub">جديد</span>' : ''; const good = inv ? p <= 0 : p >= 0;
  return `<span class="${good ? 'pos' : 'neg'}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p) >= 100 ? Math.round(Math.abs(p)) : Math.abs(p).toFixed(1)}%</span>`; };
function bizKpi(label, val, sub, chg, opts = {}) {
  return `<div class="card kpi biz-kpi ${opts.cls || ''}"${opts.click ? ` onclick="${opts.click}" style="cursor:pointer"` : ''}><div class="l">${opts.icon ? `<span class="biz-ic">${opts.icon}</span>` : ''}${label}</div>
    <div class="v num ${opts.vcls || ''}">${val}</div>${sub ? `<div class="s">${sub}</div>` : ''}${chg ? `<div class="s kpi-cmp">${chg} <span class="sub">مقابل الـ30 يوم اللي قبلهم</span></div>` : ''}</div>`;
}
function distCard(title, rows, total, money) {
  if (!rows.length) return '';
  const colors = ['#3b82f6', '#16a34a', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4', '#84cc16', '#ec4899'];
  let acc = 0; const segs = rows.slice(0, 8).map((r, i) => { const w = total ? r.h / total * 100 : 0; acc += w; return `<span style="width:${w}%;background:${colors[i % 8]}" title="${esc(r.k)} ${Math.round(w)}%"></span>`; }).join('');
  return `<div class="card item biz-dist"><h3>${title}</h3><div class="stackbar">${segs}</div>
    ${rows.slice(0, 8).map((r, i) => `<div class="dist-row"><i style="background:${colors[i % 8]}"></i><span class="dist-k">${esc(r.k)}</span>
      <span class="sub small">${r.n} طالب</span><span class="num"><b>${total ? Math.round(r.h / total * 100) : 0}%</b></span>${money && isAdmin ? `<span class="num small sub">${fmtK(r.rev)} ج</span>` : ''}</div>`).join('')}</div>`;
}
function bizTrendHtml(MM) {
  if (!MM.length) return '';
  const showMoney = isAdmin;
  const maxH = Math.max(1, ...MM.map(m => m.h)), maxR = Math.max(1, ...MM.map(m => m.rev));
  const mn = k => new Date(k + '-15').toLocaleDateString('ar-EG-u-nu-latn', { month: 'short' });
  return `<div class="card item"><div class="fc-legend"><span><i class="fc-rev"></i>ساعات التدريس</span>${showMoney ? '<span><i class="fc-net"></i>الإيراد</span>' : ''}<span><i style="background:var(--text)"></i>طلاب حضروا</span></div>
    <div class="fc">${MM.map((m, i) => `<div class="fc-col" title="${m.k}: ${fmt(m.h, 1)} ساعة · ${m.stu.size} طالب${showMoney ? ` · ${fmt(m.rev)} ج` : ''}">
      <div class="fc-top num">${m.stu.size}</div>
      <div class="fc-bars"><div class="fc-bar fc-rev" style="height:${m.h / maxH * 100}%"></div>${showMoney ? `<div class="fc-bar fc-net" style="height:${m.rev / maxR * 100}%"></div>` : ''}</div>
      <div class="fc-lbl">${mn(m.k)}${i === MM.length - 1 ? ' <span class="sub">(لسه)</span>' : ''}</div><div class="fc-val num">${fmt(Math.round(m.h))}س</div></div>`).join('')}</div></div>`;
}
function renderBusiness() {
  if (!state.biz || Date.now() - state.biz.at > 5 * 60e3) { if (!state._bizLoading) { state._bizLoading = true; loadBusiness().finally(() => state._bizLoading = false); } if (!state.biz) return '<div class="card empty">بيحمّل الأرقام…</div>'; }
  const z = bizCompute(), A = z.A, P = z.P, lf = z.lastFull;
  const arpf = A.fam.size ? A.rev / A.fam.size : 0, perHour = A.h ? A.rev / A.h : 0, costHour = A.h ? A.tc / A.h : 0, gm = A.rev ? (A.rev - A.tc) / A.rev : 0;
  const hPerStu = A.stu.size ? A.h / A.stu.size : 0;
  const runRev = lf ? lf.rev * 12 : A.rev * 12, runNet = lf ? (lf.rev - lf.tc - lf.ex) * 12 : (A.rev - A.tc) * 12;
  const repRate = z.repBase ? z.repDone / z.repBase : null;
  const newThis = z.MM.length ? z.MM[z.MM.length - 1].newStu : 0;
  const totalH = A.h;
  const html = `
    <div class="biz-hero card">
      <div class="biz-hero-t"><img src="logo.png" alt="" onerror="this.remove()"><div><h2>أكاديمية أستاذ أونلاين</h2><div class="sub">دروس خصوصية 1-on-1 أونلاين · طلاب في الإمارات والسعودية ومصر · معلمين من مصر</div></div></div>
      <div class="biz-hero-n">
        <div title="الأسر اللي ليها ملف وطلاب على السيستم دلوقتي"><b class="num">${z.totals.fam}</b><span>أسرة متسجلة</span></div>${z.totals.ever > z.totals.fam ? `<div title="كل الأسر اللي اتعاملنا معاها — شامل أسر الحسابات القديمة"><b class="num">${z.totals.ever}</b><span>أسرة من أول الأكاديمية</span></div>` : ''}<div><b class="num">${z.totals.stu}</b><span>طالب متسجل</span></div>
        <div><b class="num">${z.totals.tut}</b><span>معلم/ة</span></div><div><b class="num">${fmt(Math.round(A.h))}</b><span>ساعة آخر 30 يوم</span></div>
        ${isAdmin ? `<div><b class="num">${fmtK(runRev)}</b><span>إيراد سنوي متوقع (ج)</span></div>` : ''}
      </div>
      <div class="biz-actions no-print"><button class="btn btn-brand sm" onclick="bizPrint()">🖨️ تقرير PDF للعرض</button><button class="btn btn-ghost sm" onclick="bizCopy()">📋 نسخ الملخص</button><button class="btn btn-ghost sm" onclick="state.biz=null; loadBusiness()">🔄 تحديث</button></div>
    </div>

    <div class="section-title"><h2>👥 العملاء والنشاط <span class="sub small">(آخر 30 يوم)</span></h2></div>
    <div class="kpis">
      ${bizKpi('طلاب حضروا', A.stu.size, `من ${z.totals.stu} طالب مسجّل${newThis ? ` · ${newThis} جديد الشهر ده` : ''}`, chgHtml(A.stu.size, P.stu.size), { icon: '🎒' })}
      ${bizKpi('أسر نشطة', A.fam.size, `من ${z.totals.fam} أسرة · ${A.fam.size ? (A.stu.size / A.fam.size).toFixed(1) : 0} طالب لكل أسرة`, chgHtml(A.fam.size, P.fam.size), { icon: '👨‍👩‍👧' })}
      ${bizKpi('معلمين شغالين', A.tut.size, `من ${z.totals.tut} · ${z.totals.linked} على بوابة المعلمات`, chgHtml(A.tut.size, P.tut.size), { icon: '🧑‍🏫' })}
      ${bizKpi('ساعات التدريس', fmt(A.h, 1), `${A.n} حصة · ${hPerStu.toFixed(1)} ساعة لكل طالب`, chgHtml(A.h, P.h), { icon: '⏱' })}
    </div>

    ${isAdmin ? `<div class="section-title"><h2>💰 الاقتصاديات <span class="sub small">(آخر 30 يوم)</span></h2></div>
    <div class="kpis">
      ${bizKpi('الإيراد', fmt(A.rev), 'ج بسعر الصرف يوم الحصة', chgHtml(A.rev, P.rev), { icon: '📈' })}
      ${bizKpi('الربح الإجمالي', fmt(A.rev - A.tc), `ج · هامش ${Math.round(gm * 100)}% بعد المعلمين`, chgHtml(A.rev - A.tc, P.rev - P.tc), { icon: '💵', vcls: 'pos', cls: 'kpi-hero' })}
      ${bizKpi('متوسط سعر الساعة', fmt(Math.round(perHour)), `ج · تكلفة المعلم ${fmt(Math.round(costHour))} ج للساعة`, chgHtml(perHour, P.h ? P.rev / P.h : 0), { icon: '🏷️' })}
      ${bizKpi('متوسط إيراد الأسرة', fmt(Math.round(arpf)), 'ج شهرياً لكل أسرة نشطة', chgHtml(arpf, P.fam.size ? P.rev / P.fam.size : 0), { icon: '🏠' })}
      ${lf ? bizKpi(`صافي ربح ${new Date(lf.k + '-15').toLocaleDateString('ar-EG-u-nu-latn', { month: 'long' })}`, fmt(lf.rev - lf.tc - lf.ex), `ج بعد المعلمين والرواتب (${lf.rev ? Math.round((lf.rev - lf.tc - lf.ex) / lf.rev * 100) : 0}%)`, '', { icon: '🏦', vcls: lf.rev - lf.tc - lf.ex >= 0 ? 'pos' : 'neg' }) : ''}
      ${bizKpi('صافي ربح سنوي متوقع', fmtK(runNet), `ج لو استمر نفس معدل ${lf ? 'الشهر اللي فات' : 'آخر 30 يوم'}`, '', { icon: '🚀' })}
    </div>` : ''}

    <div class="section-title"><h2>📊 النمو شهر بشهر</h2></div>
    ${bizTrendHtml(z.MM)}
    ${z.MM.length > 1 ? `<div class="card scrollx mt"><table class="fin-month"><thead><tr><th>الشهر</th><th>طلاب</th><th>جداد</th><th>وقفوا</th><th>الاستمرار</th><th>أسر</th><th>ساعات</th>${isAdmin ? '<th>الإيراد</th><th>صافي الربح</th>' : ''}</tr></thead><tbody>
      ${z.MM.map((m, i) => `<tr><td><b>${new Date(m.k + '-15').toLocaleDateString('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' })}</b>${i === z.MM.length - 1 ? ' <span class="sub small">(لسه شغال)</span>' : ''}</td>
        <td class="num">${m.stu.size}</td><td class="num pos">${i ? (m.newStu ? '+' + m.newStu : '—') : '<span class="sub small">البداية</span>'}</td><td class="num ${m.lost ? 'neg' : ''}">${i && m.lost != null ? (m.lost ? '−' + m.lost : '0') : '—'}</td>
        <td class="num">${m.ret != null && i ? Math.round(m.ret * 100) + '%' : '—'}</td><td class="num">${m.fam.size}</td><td class="num">${fmt(m.h, 1)}</td>
        ${isAdmin ? `<td class="num">${fmt(m.rev)}</td><td class="num ${m.rev - m.tc - m.ex >= 0 ? 'pos' : 'neg'}">${fmt(m.rev - m.tc - m.ex)}</td>` : ''}</tr>`).join('')}
    </tbody></table></div><p class="sub small">"وقفوا" = طلاب حضروا الشهر اللي قبله ومحضروش الشهر ده. "الاستمرار" = نسبة اللي كمّلوا من الشهر اللي قبله.</p>` : ''}

    <div class="section-title"><h2>🌍 مين عملاءنا؟ <span class="sub small">(نسبة من ساعات آخر 30 يوم)</span></h2></div>
    <div class="grid2 biz-grid">
      ${distCard('حسب البلد', z.byCountry, totalH, true)}${distCard('حسب المنهج', z.byCurr, totalH, true)}
      ${distCard('حسب المرحلة', z.byStage, totalH, true)}${distCard('حسب المادة', z.bySubj, totalH, true)}
    </div>

    <div class="section-title"><h2>⭐ الأكثر نشاطاً <span class="sub small">(آخر 30 يوم)</span></h2></div>
    <div class="grid2 biz-grid">
      <div class="card item"><h3>أكبر الأسر</h3>${z.topFam.slice(0, 6).map((x, i) => `<div class="dist-row clickable" onclick="openFamilyStatement && openFamilyStatement(${jsq(x.f.id)})"><span class="rank">${i + 1}</span><span class="dist-k">${esc(x.f.name)}</span><span class="sub small">${x.stu.size} طالب</span><span class="num"><b>${fmt(x.h, 1)}</b> س</span>${isAdmin ? `<span class="num small sub">${fmtK(x.rev)} ج</span>` : ''}</div>`).join('') || '<div class="sub small">—</div>'}
        ${isAdmin && z.topFam.length && A.rev ? `<div class="sub small mt">أكبر 3 أسر = ${Math.round(z.topFam.slice(0, 3).reduce((a, x) => a + x.rev, 0) / A.rev * 100)}% من الإيراد</div>` : ''}</div>
      <div class="card item"><h3>أكتر المعلمين ساعات</h3>${z.topTut.slice(0, 6).map((x, i) => `<div class="dist-row"><span class="rank">${i + 1}</span><span class="dist-k">${esc(x.t.name)}</span><span class="sub small">${x.stu.size} طالب</span><span class="num"><b>${fmt(x.h, 1)}</b> س</span></div>`).join('') || '<div class="sub small">—</div>'}</div>
    </div>

    <div class="section-title"><h2>✅ جودة الخدمة <span class="sub small">(آخر 30 يوم)</span></h2></div>
    <div class="kpis">
      ${bizKpi('نسبة الالتزام', z.commit == null ? '—' : Math.round(z.commit * 100) + '%', `إلغاء من الأسر ${z.cS} · من المعلمين ${z.cT}`, '', { icon: '📆', vcls: z.commit == null ? '' : z.commit >= .9 ? 'pos' : z.commit >= .75 ? 'warn-txt' : 'neg', click: "state.repView='ops'; renderReports()" })}
      ${bizKpi('تقارير الحصص', repRate == null ? '—' : Math.round(repRate * 100) + '%', repRate == null ? 'لسه مفيش معلمات على البوابة' : `${z.repDone} من ${z.repBase} حصة (آخر أسبوعين، معلمات البوابة)`, '', { icon: '📝', vcls: repRate == null ? '' : repRate >= .8 ? 'pos' : 'neg', click: 'openReports()' })}
      ${bizKpi('تحويل الحصص التجريبية', z.trialDecided ? Math.round(z.trialWon / z.trialDecided * 100) + '%' : '—', `${z.trials} تجريبية في آخر 3 شهور${z.trialDecided ? ` · ${z.trialWon} كمّلوا` : ''}`, '', { icon: '🧪' })}
      ${bizKpi('فلوس عند الأسر', isAdmin ? fmtK(z.recv) + ' ج' : String(z.owing.length), `${z.owing.length} أسرة عليها مستحقات`, '', { icon: '🧾', vcls: z.owing.length ? 'neg' : 'pos', click: "state.finTab='families'; state.finF_families='owing'; switchTab('fin')" })}
    </div>
    <p class="sub small mt no-print">كل الأرقام محسوبة لحظياً من الحصص المسجلة. "آخر 30 يوم" مقارنة بالـ30 يوم اللي قبلهم.</p>`;
  state.bizSummary = { z, A, P, arpf, perHour, gm, runRev, runNet, lf, repRate };
  return html;
}
function bizCopy() {
  const s = state.bizSummary; if (!s) return;
  const { z, A } = s;
  const pct = r => r.slice(0, 3).map(x => `${x.k} ${Math.round(x.h / (A.h || 1) * 100)}%`).join('، ');
  const t = `📊 أكاديمية أستاذ أونلاين — ملخص ${new Date().toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' })}

👥 ${z.totals.fam} أسرة · ${z.totals.stu} طالب · ${z.totals.tut} معلم/ة
🎒 طلاب حضروا آخر 30 يوم: ${A.stu.size} (${A.fam.size} أسرة)
⏱ ساعات تدريس آخر 30 يوم: ${fmt(Math.round(A.h))} ساعة (${A.n} حصة)
${isAdmin ? `💰 إيراد آخر 30 يوم: ${fmt(A.rev)} ج · هامش بعد المعلمين ${Math.round(s.gm * 100)}%
🏷️ متوسط سعر الساعة: ${fmt(Math.round(s.perHour))} ج · متوسط إيراد الأسرة: ${fmt(Math.round(s.arpf))} ج/شهر
🚀 إيراد سنوي متوقع: ${fmt(s.runRev)} ج · صافي ربح سنوي متوقع: ${fmt(s.runNet)} ج
` : ''}🌍 البلاد: ${pct(z.byCountry)}
📚 المواد: ${pct(z.bySubj)}
✅ الالتزام: ${z.commit == null ? '—' : Math.round(z.commit * 100) + '%'}${z.trialDecided ? ` · تحويل التجريبي: ${Math.round(z.trialWon / z.trialDecided * 100)}%` : ''}`;
  copyText(t, 'اتنسخ الملخص ✓');
}
function bizPrint() { document.body.classList.add('print-biz'); setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove('print-biz'), 500); }, 50); }

/* ============================================================
   متابعة الأسر: مين كان معانا السنة اللي فاتت ومجاش السنة دي، ومين بعد عننا
   السنة الدراسية من سبتمبر لأغسطس
   ============================================================ */
async function loadRetention() {
  const now = new Date(), from = addMonths(acadStart(now), -12);
  try {
    const [hist, ss, up] = await Promise.all([
      q(sb.from('family_history').select('family_name,family_id,month,amount,hours,details,acquisition').order('month')),
      fetchAll(() => sb.from('sessions').select('id,student_id,scheduled_at,student_charge').eq('status', 'done').gte('scheduled_at', from.toISOString()).order('scheduled_at')),
      fetchAll(() => sb.from('sessions').select('id,student_id,scheduled_at').eq('status', 'scheduled').gte('scheduled_at', now.toISOString()).lte('scheduled_at', new Date(now.getTime() + 30 * 864e5).toISOString()).order('scheduled_at')),
    ]);
    state.ret = { hist, ss, up, at: Date.now() };
  } catch (e) { showToast(dbError(e), true); state.ret = { hist: [], ss: [], up: [], at: Date.now(), err: true }; }
  if (state.repView === 'ret') renderReports();
}
function retCompute() {
  const { hist, ss, up } = state.ret, now = new Date(), st = acadStart(now), lst = addMonths(st, -12);
  const stK = monthKey(st), lstK = monthKey(lst), F = {};
  const get = (key, name, f) => F[key] ||= { key, name, f, months: new Set(), last: 0, ly: 0, ty: 0, src: '', kids: new Set(), up: 0, det: '' };
  hist.forEach(h => { const f = h.family_id ? byId(state.families, h.family_id) : null; const x = get(f ? f.id : 'h:' + h.family_name, f ? f.name : h.family_name, f);
    const k = h.month.slice(0, 7); x.months.add(k); x.last = Math.max(x.last, addMonths(new Date(h.month + 'T12:00'), 1).getTime() - 864e5);
    if (k >= lstK && k < stK) x.ly += +h.amount || 0; if (k >= stK) x.ty += +h.amount || 0; if (h.acquisition) x.src = h.acquisition; if (h.details) x.det = h.details; });
  ss.forEach(s => { const stu = byId(state.students, s.student_id), f = stu && byId(state.families, stu.family_id); if (!f) return; const x = get(f.id, f.name, f);
    const t = new Date(s.scheduled_at), k = monthKey(t); x.months.add(k); x.last = Math.max(x.last, t.getTime()); x.kids.add(stu.name);
    const c = Number(s.student_charge || 0); if (k >= lstK && k < stK) x.ly += c; if (k >= stK) x.ty += c; });
  up.forEach(s => { const stu = byId(state.students, s.student_id), f = stu && byId(state.families, stu.family_id); if (f) get(f.id, f.name, f).up++; });
  const all = Object.values(F);
  all.forEach(x => { if (x.f) { x.src = x.f.acquisition || x.src; x.cur = x.f.currency; } else x.cur = 'AED';
    const ms = [...x.months].sort(); x.lastMonth = ms[ms.length - 1]; x.firstMonth = ms[0];
    const lyM = ms.filter(k => k >= lstK && k < stK); x.inLY = lyM.length > 0; x.inTY = ms.some(k => k >= stK); x.lyMonths = lyM.length;
    x.exams = x.inLY && lyM.every(k => ['05', '06'].includes(k.slice(5))); // جم في الامتحانات بس
    x.days = x.last ? Math.floor((Date.now() - x.last) / 864e5) : null; });
  const lost = all.filter(x => x.inLY && !x.inTY).sort((a, b) => b.ly - a.ly);
  const kept = all.filter(x => x.inLY && x.inTY);
  const fresh = all.filter(x => !x.inLY && x.inTY && x.firstMonth >= stK).sort((a, b) => b.ty - a.ty);
  const quiet = all.filter(x => x.inTY && x.days != null && x.days >= 10 && !x.up).sort((a, b) => b.days - a.days);
  const never = state.families.filter(f => state.students.some(s => s.family_id === f.id) && !F[f.id]);
  return { lost, kept, fresh, quiet, never, lyN: lost.length + kept.length, st, lst };
}
const retMarks = () => { try { return JSON.parse(localStorage.getItem('ret_marks') || '{}'); } catch (e) { return {}; } };
function retMark(key) { const m = retMarks(); if (m[key]) delete m[key]; else m[key] = new Date().toISOString(); try { localStorage.setItem('ret_marks', JSON.stringify(m)); } catch (e) {} renderReports(); }
const retParent = n => (n || '').replace(/^(أسرة|عائلة)\s+/, '').replace(/\s*\(.*\)\s*/g, '').trim();
function retMsg(key, kind) {
  const z = retCompute(), x = [...z.lost, ...z.quiet].find(y => y.key === key); if (!x) return;
  const p = retParent(x.name), hi = `السلام عليكم ورحمة الله يا ${p} 🌷\nإزيكم وإزي الولاد؟`;
  const t = kind === 'quiet'
    ? `${hi}\nلاحظنا إن الحصص وقفت من حوالي ${x.days} يوم، وحابين نطمن إن كل حاجة تمام 🙏\nلو محتاجين نرجّع المواعيد، أو نغيّر الوقت أو المعلمة، أو فيه أي حاجة مش مريحاكم — قولولنا وإحنا نظبطها على طول.\nأكاديمية أستاذ أونلاين 💙`
    : x.exams
    ? `${hi} وحشتونا في أكاديمية أستاذ أونلاين 💙\nالسنة الدراسية الجديدة بدأت، وحابين نطمن على الولاد ونعرف لو محتاجين متابعة أسبوعية أو مراجعات قبل امتحانات نص السنة — والمعلمات اللي كانوا معاهم موجودين.\nلو حابين نرتب مواعيد، قولولنا الأيام والأوقات اللي تناسبكم 🙏`
    : `${hi} وحشتونا في أكاديمية أستاذ أونلاين 💙\nالسنة الدراسية الجديدة بدأت، وحابين نعرف لو تحبوا تكملوا معانا السنة دي.\nولو كان فيه أي حاجة مكانتش مريحاكم في الحصص اللي فاتت، يهمنا جداً نسمعها ونحسّنها 🙏`;
  copyText(t, 'اتنسخت رسالة المتابعة ✓ — ابعتها على الواتساب');
}
function renderRetention() {
  if (!state.ret || Date.now() - state.ret.at > 5 * 60e3) { if (!state._retLoading) { state._retLoading = true; loadRetention().finally(() => state._retLoading = false); } if (!state.ret) return '<div class="card empty">بيحمّل…</div>'; }
  const z = retCompute(), marks = retMarks();
  const ml = k => k ? new Date(k + '-15').toLocaleDateString('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' }) : '—';
  const yl = d => `${d.getFullYear()}/${d.getFullYear() + 1}`;
  const pct = z.lyN ? Math.round(z.kept.length / z.lyN * 100) : null;
  const markBtn = x => `<button class="btn ${marks[x.key] ? 'btn-brand' : 'btn-ghost'} sm" onclick="retMark(${jsq(x.key)})">${marks[x.key] ? `✓ اتواصلنا ${fmtShortDate(marks[x.key])}` : '☐ اتواصلنا'}</button>`;
  const card = (x, kind) => `<div class="card item fin-row${marks[x.key] ? ' ret-done' : ''}">
    <div class="item-head"><div><div class="item-title">${esc(x.name)}</div><div class="sub small">${x.src ? '📍 ' + esc(x.src) : 'المصدر مش متسجّل'}</div></div>
      ${kind === 'quiet' ? `<span class="badge b-cancel num">من ${x.days} يوم</span>` : x.exams ? '<span class="badge b-pending">📝 مراجعات امتحانات</span>' : `<span class="badge b-sched">${x.lyMonths} ${x.lyMonths === 1 ? 'شهر' : 'شهور'}</span>`}</div>
    <div class="meta"><span>آخر نشاط: <b>${kind === 'quiet' ? fmtShortDate(new Date(x.last).toISOString()) : ml(x.lastMonth)}</b></span>
      ${isAdmin && x.ly ? `<span>حسابهم السنة اللي فاتت: <b class="num"><bdi>${fmt(x.ly, 2)} ${x.cur}</bdi></b></span>` : ''}
      ${x.kids.size ? `<span>${[...x.kids].map(esc).join('، ')}</span>` : ''}</div>
    ${!x.kids.size && x.det ? `<div class="sub small">${esc(x.det)}</div>` : ''}
    <div class="actions"><button class="btn btn-wa sm" onclick="retMsg(${jsq(x.key)}, '${kind}')">📲 رسالة متابعة</button>${markBtn(x)}
      ${x.f ? `<button class="btn btn-ghost sm" onclick="openFamilyStatement(${jsq(x.f.id)})">📒 كشف حساب</button>` : ''}</div></div>`;
  return `<div class="section-title"><h2>🔁 الأسر بين السنة دي واللي فاتت</h2></div>
    <p class="sub small mb">السنة الدراسية من سبتمبر لأغسطس · السنة اللي فاتت ${yl(z.lst)} · السنة دي ${yl(z.st)}</p>
    <div class="kpis">
      ${bizKpi('أسر السنة اللي فاتت', z.lyN, `من سبتمبر ${z.lst.getFullYear()} لأغسطس ${z.st.getFullYear()}`, '', { icon: '📅' })}
      ${bizKpi('كمّلوا معانا', z.kept.length, pct == null ? '' : `نسبة الاستمرار ${pct}%`, '', { icon: '🤝', vcls: 'pos' })}
      ${bizKpi('لسه ماجوش السنة دي', z.lost.length, `${z.lost.filter(x => x.exams).length} منهم كانوا مراجعات امتحانات بس`, '', { icon: '📞', vcls: z.lost.length ? 'neg' : '' })}
      ${bizKpi('أسر جديدة السنة دي', z.fresh.length, z.fresh.length ? z.fresh.slice(0, 3).map(x => retParent(x.name)).join('، ') + (z.fresh.length > 3 ? '…' : '') : '', '', { icon: '✨' })}
    </div>
    <div class="section-title"><h2>📞 كانوا معانا السنة اللي فاتت ولسه ماجوش (${z.lost.length})</h2></div>
    <p class="sub small mb">ابعتلهم رسالة متابعة: هل محتاجين مراجعات؟ هيكملوا؟ ولو مش هيكملوا نعرف ليه. علّم "اتواصلنا" بعد ما تبعت.</p>
    <div class="list">${z.lost.map(x => card(x, 'lost')).join('') || '<div class="card empty">كل أسر السنة اللي فاتت كمّلوا 🎉</div>'}</div>
    <div class="section-title"><h2>⏸️ بعدوا عننا السنة دي (${z.quiet.length})</h2></div>
    <p class="sub small mb">أسر حضرت السنة دي، بس آخر حصة من 10 أيام أو أكتر ومفيش حصص جاية متسجلة في الـ30 يوم الجايين.</p>
    <div class="list">${z.quiet.map(x => card(x, 'quiet')).join('') || '<div class="card empty">مفيش أسر واقفة 👌</div>'}</div>
    ${z.kept.length ? `<div class="section-title"><h2>🤝 كمّلوا معانا (${z.kept.length})</h2></div><div class="card item">${z.kept.map(x => `<div class="dist-row"><span class="dist-k">${esc(x.name)}</span><span class="sub small">من ${ml(x.firstMonth)}</span></div>`).join('')}</div>` : ''}
    ${z.fresh.length ? `<div class="section-title"><h2>✨ جداد السنة دي (${z.fresh.length})</h2></div><div class="card item">${z.fresh.map(x => `<div class="dist-row"><span class="dist-k">${esc(x.name)}</span><span class="sub small">${esc(x.src || '')}</span><span class="sub small">من ${ml(x.firstMonth)}</span></div>`).join('')}</div>` : ''}
    ${z.never.length ? `<div class="section-title"><h2>🫥 متسجلين ومحضروش ولا حصة (${z.never.length})</h2></div><div class="card item">${z.never.map(f => `<div class="dist-row"><span class="dist-k">${esc(f.name)}</span></div>`).join('')}</div>` : ''}
    <p class="sub small mt">الأسر القديمة اللي قبل السيستم جاية من الحسابات القديمة (من غير أرقام تليفونات) — الرسالة بتتنسخ وتبعتها إنت من الواتساب.</p>`;
}

/* ============================================================
   الاستفسارات (Leads): كل حد سأل → تجريبية → اشترك أو لأ
   ============================================================ */
const LEAD_ST = { new: { l: 'جديد', c: 'b-sched' }, talking: { l: 'بنتكلم', c: 'b-pending' }, trial_booked: { l: 'تجريبية محجوزة', c: 'b-trial' },
  trial_done: { l: 'حضر التجريبية', c: 'b-rev' }, won: { l: '✅ اشترك', c: 'b-done' }, lost: { l: 'ماشتركش', c: 'b-cancel' }, later: { l: '⏳ بعدين', c: 'b-pending' } };
const LEAD_STAGE = { new: 0, talking: 1, trial_booked: 2, trial_done: 3, won: 4 };
const LEAD_SRC = { instagram: '📸 إنستجرام', whatsapp: '💬 واتساب', referral: '🤝 ترشيح', facebook: '📘 فيسبوك', tiktok: '🎵 تيك توك', other: 'تاني' };
const LEAD_LOST = ['السعر غالي', 'المواعيد مش مناسبة', 'مردّش بعد التجريبية', 'مردّش خالص', 'مش مقتنع بالأونلاين', 'لقى مدرّس تاني', 'كان بيسأل بس', 'تاني'];
function renderFamSwitch() {
  const el = document.getElementById('fam-switch'); if (!el) return;
  const v = state.famView || 'fams', due = (state.leads || []).filter(leadDue).length;
  el.innerHTML = `<button class="chip ${v === 'fams' ? 'active' : ''}" onclick="setFamView('fams')">👨‍👩‍👧 الأسر</button>
    <button class="chip ${v === 'leads' ? 'active' : ''}" onclick="setFamView('leads')">📥 الاستفسارات${due ? ` <span class="badge b-cancel">${due}</span>` : ''}</button>`;
}
function setFamView(v) {
  state.famView = v; renderFamSwitch();
  document.getElementById('fam-main').classList.toggle('hidden', v !== 'fams');
  document.getElementById('leads-view').classList.toggle('hidden', v !== 'leads');
  if (v === 'leads') { if (!state.leads) loadLeads(); else renderLeads(); }
}
async function loadLeads() {
  const el = document.getElementById('leads-view'); if (!state.leads) el.innerHTML = '<div class="card empty">بيحمّل…</div>';
  try { state.leads = await fetchAll(() => sb.from('leads').select('*').order('created_at', { ascending: false })); }
  catch (e) { showToast(dbError(e), true); state.leads = []; }
  renderFamSwitch(); renderLeads();
}
const leadOpen = l => !['won', 'lost'].includes(l.status);
const leadDue = l => leadOpen(l) && (l.next_followup ? l.next_followup <= todayStr() : l.status === 'new');
function leadRange() {
  const p = state.leadPeriod || 'all', n = new Date();
  if (p === 'month') return new Date(n.getFullYear(), n.getMonth(), 1);
  if (p === '30') return new Date(n.getTime() - 30 * 864e5);
  if (p === '90') return new Date(n.getTime() - 90 * 864e5);
  return null;
}
function leadFunnel(list) {
  const n = list.length, talk = list.filter(l => l.stage >= 1 || l.status === 'lost' || l.status === 'later').length;
  const booked = list.filter(l => l.stage >= 2).length, came = list.filter(l => l.stage >= 3).length, won = list.filter(l => l.status === 'won').length;
  return { n, talk, booked, came, won };
}
const pctOf = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
function renderLeads() {
  const el = document.getElementById('leads-view'); if (!el) return;
  const all = state.leads || [], from = leadRange();
  const inP = from ? all.filter(l => new Date(l.created_at) >= from) : all;
  const F = state.leadFilter || 'open', Q = normAr(state.leadQ || '');
  const tests = { open: leadOpen, due: leadDue, new: l => l.status === 'new', talking: l => l.status === 'talking', trial_booked: l => l.status === 'trial_booked', trial_done: l => l.status === 'trial_done', won: l => l.status === 'won', lost: l => l.status === 'lost', later: l => l.status === 'later', all: () => true };
  const chips = [['due', '🔔 محتاج متابعة'], ['open', 'مفتوح'], ['new', 'جديد'], ['talking', 'بنتكلم'], ['trial_booked', 'تجريبية محجوزة'], ['trial_done', 'حضر التجريبية'], ['won', 'اشترك'], ['lost', 'ماشتركش'], ['later', 'بعدين'], ['all', 'الكل']];
  const rows = inP.filter(tests[F] || tests.open).filter(l => !Q || normAr(`${l.name} ${l.phone || ''} ${l.kids || ''} ${l.notes || ''} ${l.campaign || ''} ${l.referred_by || ''}`).includes(Q))
    .sort((a, b) => (leadDue(b) - leadDue(a)) || (b.created_at > a.created_at ? 1 : -1));
  const f = leadFunnel(inP);
  const bySrc = {}; inP.forEach(l => { (bySrc[l.source] ||= []).push(l); });
  const lostR = {}; inP.filter(l => l.status === 'lost').forEach(l => { const k = l.lost_reason || 'من غير سبب'; lostR[k] = (lostR[k] || 0) + 1; });
  const step = (lbl, v, base, sub) => `<div class="card kpi"><div class="l">${lbl}</div><div class="v num">${v}</div><div class="s">${sub || ''}${base != null ? ` <b>${pctOf(v, base)}</b>` : ''}</div></div>`;
  el.innerHTML = `
    <div class="toolbar"><input class="input search" placeholder="🔎 ابحث بالاسم أو الرقم أو الأولاد…" value="${esc(state.leadQ || '')}" oninput="state.leadQ=this.value; renderLeads(); this.focus(); this.setSelectionRange(this.value.length, this.value.length)">
      <select class="input" style="max-width:180px" onchange="state.leadPeriod=this.value; renderLeads()">${[['all', 'من الأول'], ['month', 'الشهر ده'], ['30', 'آخر 30 يوم'], ['90', 'آخر 3 شهور']].map(([v, l]) => `<option value="${v}" ${(state.leadPeriod || 'all') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button class="btn btn-brand" onclick="openLeadForm()">+ استفسار جديد</button></div>
    <div class="kpis">
      ${step('📥 استفسروا', f.n, null, 'في الفترة')}
      ${step('🧪 حجزوا تجريبية', f.booked, f.n, 'من اللي استفسروا')}
      ${step('🎒 حضروا التجريبية', f.came, f.booked, 'من اللي حجزوا')}
      ${step('✅ اشتركوا', f.won, f.came, 'من اللي حضروا')}
    </div>
    ${f.n ? `<p class="sub small mb">من كل 10 بيستفسروا، حوالي <b>${f.n ? Math.round(f.won / f.n * 10) : 0}</b> بيشتركوا (${pctOf(f.won, f.n)}).</p>` : ''}
    ${Object.keys(bySrc).length ? `<div class="grid2 biz-grid"><div class="card item"><h3>حسب المصدر</h3>${Object.entries(bySrc).sort((a, b) => b[1].length - a[1].length).map(([k, ls]) => { const z = leadFunnel(ls); return `<div class="dist-row"><span class="dist-k">${LEAD_SRC[k] || esc(k)}</span><span class="sub small">${z.n} استفسار · ${z.booked} تجريبية</span><span class="num"><b>${z.won}</b> اشترك</span><span class="num small sub">${pctOf(z.won, z.n)}</span></div>`; }).join('')}</div>
      <div class="card item"><h3>ليه ماشتركوش؟</h3>${Object.entries(lostR).sort((a, b) => b[1] - a[1]).map(([k, c]) => `<div class="dist-row"><span class="dist-k">${esc(k)}</span><span class="num"><b>${c}</b></span></div>`).join('') || '<div class="sub small">لسه مفيش</div>'}</div></div>` : ''}
    <div class="chips mt">${chips.map(([k, l]) => { const c = inP.filter(tests[k]).length; return (c || k === F || ['due', 'open', 'all'].includes(k)) ? `<button class="chip ${F === k ? 'active' : ''}" onclick="state.leadFilter='${k}'; renderLeads()">${l} <span class="sub">${c}</span></button>` : ''; }).join('')}</div>
    <div class="list">${rows.map(leadCard).join('') || `<div class="card empty">${all.length ? 'مفيش استفسارات بالفلتر ده' : 'سجّل أول استفسار — كل حد يسأل على إنستجرام أو واتساب'}<br><button class="btn btn-brand mt" onclick="openLeadForm()">+ استفسار جديد</button></div>`}</div>`;
}
function leadCard(l) {
  const st = LEAD_ST[l.status] || LEAD_ST.new, id = jsq(l.id), due = leadDue(l);
  const next = { new: ['talking', '💬 كلّمته'], talking: ['trial_booked', '🧪 حجز تجريبية'], trial_booked: ['trial_done', '🎒 حضر التجريبية'], trial_done: ['won', '✅ اشترك'], later: ['talking', '💬 رجعنا نتكلم'] }[l.status];
  const fam = l.family_id ? byId(state.families, l.family_id) : null;
  const wa = l.phone ? l.phone.replace(/[^0-9]/g, '') : '';
  return `<div class="card item fin-row${due ? ' lead-due' : ''}">
    <div class="item-head"><div><div class="item-title">${COUNTRIES[l.country]?.flag || ''} ${esc(l.name)}</div>
      <div class="sub small">${LEAD_SRC[l.source] || esc(l.source)}${l.referred_by ? ' · من ' + esc(l.referred_by) : ''}${l.campaign ? ' · ' + esc(l.campaign) : ''} · ${fmtShortDate(l.created_at)}</div></div>
      <span class="badge ${st.c}">${st.l}</span></div>
    ${l.kids ? `<div class="small">🎒 ${esc(l.kids)}</div>` : ''}
    ${l.status === 'lost' && l.lost_reason ? `<div class="small neg">السبب: ${esc(l.lost_reason)}</div>` : ''}
    ${l.next_followup && leadOpen(l) ? `<div class="small ${due ? 'neg' : 'sub'}">🔔 متابعة: ${fmtShortDate(l.next_followup + 'T12:00')}${due ? ' — النهارده أو فات' : ''}</div>` : (l.status === 'new' ? '<div class="small neg">🔔 لسه محدش رد عليه</div>' : '')}
    ${l.notes ? `<div class="sub small">${esc(l.notes)}</div>` : ''}
    ${fam ? `<div class="small pos">✓ بقت أسرة: ${esc(fam.name)}</div>` : ''}
    <div class="actions">
      ${next ? `<button class="btn btn-brand sm" onclick="leadStatus(${id}, '${next[0]}')">${next[1]}</button>` : ''}
      ${l.status === 'won' && !fam ? `<button class="btn btn-brand sm" onclick="leadToFamily(${id})">➕ سجّلها أسرة</button>` : ''}
      ${leadOpen(l) ? `<button class="btn btn-ghost sm" onclick="leadLost(${id})">✖ ماشتركش</button>` : ''}
      ${wa ? `<a class="btn btn-wa sm" href="https://wa.me/${wa}" target="_blank" rel="noopener">📲 واتساب</a>` : ''}
      <button class="btn btn-ghost sm" onclick="openLeadForm(${id})">✎ تعديل</button></div></div>`;
}
async function leadStatus(id, status, extra = {}) {
  const l = (state.leads || []).find(x => x.id === id); if (!l) return;
  const row = { status, status_at: new Date().toISOString(), ...extra };
  if (LEAD_STAGE[status] != null) row.stage = Math.max(l.stage || 0, LEAD_STAGE[status]);
  if (status === 'won' || status === 'lost') row.next_followup = null;
  try { await q(sb.from('leads').update(row).eq('id', id)); Object.assign(l, row); showToast(`${LEAD_ST[status].l} ✓`); renderFamSwitch(); renderLeads();
    if (status === 'won' && !l.family_id) leadToFamily(id); }
  catch (e) { showToast(dbError(e), true); }
}
function leadLost(id) {
  const l = state.leads.find(x => x.id === id);
  openModal(`ماشتركش — ${l.name}`, formHtml([
    { name: 'lost_reason', label: 'السبب', type: 'select', required: true, options: LEAD_LOST.map(x => ({ v: x, l: x })), placeholder: 'اختار…' },
    { name: 'notes', label: 'ملاحظات', type: 'textarea', value: l.notes },
    { name: 'later', label: 'ممكن نرجعله تاني؟ (تاريخ متابعة)', type: 'date', hint: 'لو حطيت تاريخ هيتسجّل "بعدين" بدل "ماشتركش"' },
  ], 'حفظ'));
  window._formSubmit = () => runSubmit(async () => {
    const later = fv('later');
    closeModal(); await leadStatus(id, later ? 'later' : 'lost', { lost_reason: fv('lost_reason'), notes: fv('notes') || null, next_followup: later || null });
  });
}
function leadToFamily(id) {
  const l = state.leads.find(x => x.id === id); if (!l) return;
  const c = COUNTRIES[l.country] ? l.country : 'الإمارات';
  const acq = l.source === 'referral' ? `إحالة${l.referred_by ? ' من ' + l.referred_by : ''}` : `${(LEAD_SRC[l.source] || l.source).replace(/^\S+\s/, '')}${l.campaign ? ' — ' + l.campaign : ''}`;
  openFamilyForm(null, { _leadId: l.id, name: /^(أسرة|عائلة)/.test(l.name) ? l.name : 'أسرة ' + l.name, country: c, currency: COUNTRIES[c].cur, whatsapp: (l.phone || '').replace(/[^0-9]/g, ''), acquisition: acq, notes: l.kids || '' });
}
function openLeadForm(id) {
  const l = id ? state.leads.find(x => x.id === id) : null;
  const fields = [
    { name: 'name', label: 'الاسم (ولي الأمر / الأسرة)', required: true, value: l?.name, placeholder: 'مثال: أم محمد' },
    [{ name: 'phone', label: 'رقم الواتساب', type: 'tel', value: l?.phone, placeholder: '9715xxxxxxxx' },
     { name: 'country', label: 'الدولة', type: 'select', value: l?.country || 'الإمارات', options: Object.keys(COUNTRIES).map(k => ({ v: k, l: `${COUNTRIES[k].flag} ${k}` })) }],
    [{ name: 'source', label: 'جه منين؟', type: 'select', required: true, value: l?.source || 'instagram', options: Object.entries(LEAD_SRC).map(([v, x]) => ({ v, l: x })) },
     { name: 'campaign', label: 'الحملة / الإعلان', value: l?.campaign, placeholder: 'مثال: إعلان الإمارات أكتوبر' }],
    { name: 'referred_by', label: 'لو ترشيح: مين رشّحه؟', value: l?.referred_by, list: state.families.map(f => f.name) },
    { name: 'kids', label: 'الأولاد والصفوف والمواد', type: 'textarea', value: l?.kids, placeholder: 'مثال: بنت الصف الخامس رياضيات وإنجليزي · منهج إماراتي' },
    [{ name: 'status', label: 'الحالة', type: 'select', value: l?.status || 'new', options: Object.entries(LEAD_ST).map(([v, x]) => ({ v, l: x.l })) },
     { name: 'next_followup', label: 'أكلمه تاني يوم', type: 'date', value: l?.next_followup || '' }],
    { name: 'lost_reason', label: 'لو ماشتركش: ليه؟', type: 'select', value: l?.lost_reason || '', options: LEAD_LOST.map(x => ({ v: x, l: x })), placeholder: '—' },
    { name: 'notes', label: 'ملاحظات', type: 'textarea', value: l?.notes },
  ];
  const del = l ? `<button type="button" class="btn btn-danger" style="margin-top:6px" onclick="closeModal(); confirmDelete(${jsq('الاستفسار ' + l.name)}, async () => { await q(sb.from('leads').delete().eq('id', ${jsq(l.id)})); state.leads = state.leads.filter(x => x.id !== ${jsq(l.id)}); renderLeads(); })">حذف</button>` : '';
  openModal(l ? 'تعديل استفسار' : 'استفسار جديد', formHtml(fields, 'حفظ', del));
  window._formSubmit = () => runSubmit(async () => {
    const status = fv('status');
    const row = { name: fv('name'), phone: fv('phone') || null, country: fv('country') || null, source: fv('source'), campaign: fv('campaign') || null, referred_by: fv('referred_by') || null,
      kids: fv('kids') || null, status, next_followup: fv('next_followup') || null, lost_reason: status === 'lost' || status === 'later' ? (fv('lost_reason') || null) : null, notes: fv('notes') || null };
    if (LEAD_STAGE[status] != null) row.stage = Math.max(l?.stage || 0, LEAD_STAGE[status]);
    if (!l || l.status !== status) row.status_at = new Date().toISOString();
    if (l) { await q(sb.from('leads').update(row).eq('id', l.id)); Object.assign(l, row); }
    else { const [n] = await q(sb.from('leads').insert(row).select()); (state.leads ||= []).unshift(n); }
    closeModal(); showToast('تم الحفظ ✓'); renderFamSwitch(); renderLeads();
    if (status === 'won' && !(l && l.family_id)) leadToFamily((l || state.leads[0]).id);
  });
}

/* ============================================================
   التحصيل: فلوس كل شهر اتحصّلت ولا لأ (بغض النظر عن يوم الدفع)
   الدفعات بتتوزع على أقدم شهر لسه عليه فلوس الأول
   ============================================================ */
async function loadCollect() {
  try {
    const [ss, tx] = await Promise.all([
      fetchAll(() => sb.from('sessions').select('student_id,scheduled_at,student_charge,revenue_egp,student_currency').eq('status', 'done').order('scheduled_at')),
      fetchAll(() => sb.from('family_transactions').select('family_id,amount,type,created_at').order('created_at')),
    ]);
    const byFam = {};
    ss.forEach(s => { const st = byId(state.students, s.student_id); if (!st) return; const c = Number(s.student_charge || 0); if (!c) return;
      const k = monthKey(new Date(s.scheduled_at)); const f = byFam[st.family_id] ||= { months: {}, credit: 0 };
      const m = f.months[k] ||= { billed: 0, egp: 0 }; m.billed += c; m.egp += Number(s.revenue_egp || 0); });
    tx.forEach(t => { const f = byFam[t.family_id] ||= { months: {}, credit: 0 }; f.credit += (t.type === 'refund' ? -1 : 1) * Number(t.amount); });
    Object.values(byFam).forEach(f => { let left = f.credit;
      Object.keys(f.months).sort().forEach(k => { const m = f.months[k]; const take = Math.max(0, Math.min(m.billed, left)); m.coll = take; m.rem = m.billed - take; left -= take; });
      f.advance = Math.max(0, left); });
    state.collect = { byFam, at: Date.now() };
    if (currentTab === 'fin' && state.finTab === 'collect') renderFinance();
  } catch (e) { showToast(dbError(e), true); }
}
function finCollectHtml() {
  if (!state.collect) { loadCollect(); return '<div class="card empty">بيحسب التحصيل…</div>'; }
  const r = state.fin.range, from = monthKey(r.fromD), to = monthKey(addMonths(r.toD, -1));
  const { byFam } = state.collect;
  const rows = [], byCur = {}; let bE = 0, cE = 0;
  state.families.forEach(f => { const x = byFam[f.id]; if (!x) return; let b = 0, c = 0, e = 0;
    Object.entries(x.months).forEach(([k, m]) => { if (k >= from && k <= to) { b += m.billed; c += m.coll; e += m.egp; } });
    if (!b) return; const cur = f.currency; const z = byCur[cur] ||= { b: 0, c: 0 }; z.b += b; z.c += c;
    bE += e; cE += b ? e * c / b : 0; rows.push({ f, b, c, rem: b - c, cur, adv: x.advance }); });
  rows.sort((a, b) => b.rem * fxRate(b.cur) - a.rem * fxRate(a.cur) || a.f.name.localeCompare(b.f.name, 'ar'));
  const rate = bE ? cE / bE : 0, open = rows.filter(x => x.rem > 0.01);
  // آخر 6 شهور
  const months = []; for (let i = 5; i >= 0; i--) months.push(monthKey(addMonths(new Date(), -i)));
  const mrows = months.map(k => { let b = 0, c = 0, n = 0, paidN = 0; Object.values(byFam).forEach(x => { const m = x.months[k]; if (!m) return; b += m.egp; c += m.billed ? m.egp * m.coll / m.billed : 0; n++; if (m.rem <= 0.01) paidN++; }); return { k, b, c, n, paidN }; }).filter(m => m.n);
  const curTxt = o => Object.entries(byCur).map(([cu, z]) => `<bdi>${fmt(o(z), 2)} ${cu}</bdi>`).join(' + ') || '—';
  return `<div class="card item mb fin-sum">📥 <b>فلوس ${esc(finPeriod().label)}</b>: كل أسرة كان عليها كام عن حصص الفترة دي، واتحصّل منها قد إيه لحد النهارده، حتى لو الدفع جه بعدها. الدفعات بتتحسب على أقدم شهر لسه عليه فلوس.</div>
    <div class="kpis">
      ${kpiCard('المفروض يتحصّل', isAdmin ? fmt(Math.round(bE)) + ' ج' : String(rows.length) + ' أسرة', curTxt(z => z.b))}
      ${kpiCard('اتحصّل', isAdmin ? fmt(Math.round(cE)) + ' ج' : String(rows.length - open.length) + ' أسرة', curTxt(z => z.c), '', { vcls: 'pos' })}
      ${kpiCard('لسه', isAdmin ? fmt(Math.round(bE - cE)) + ' ج' : String(open.length) + ' أسرة', curTxt(z => z.b - z.c), '', { vcls: open.length ? 'neg' : 'pos' })}
      ${kpiCard('نسبة التحصيل', Math.round(rate * 100) + '%', `${rows.length - open.length} من ${rows.length} أسرة خلّصت`, '', { vcls: rate >= .9 ? 'pos' : rate >= .6 ? 'warn-txt' : 'neg', cls: 'kpi-hero' })}
    </div>
    ${mrows.length > 1 ? `<div class="section-title"><h2>التحصيل شهر بشهر</h2></div>
    <div class="card item">${mrows.map(m => { const p = m.b ? m.c / m.b : 0; return `<div class="bar-row"><span class="bar-label">${new Date(m.k + '-15').toLocaleDateString('ar-EG-u-nu-latn', { month: 'short', year: '2-digit' })}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${Math.max(3, p * 100)}%;background:${p >= .9 ? 'var(--ok)' : p >= .6 ? 'var(--warn)' : 'var(--danger)'}"></span></span>
      <span class="num bar-val">${Math.round(p * 100)}%${isAdmin ? ` <span class="sub small">${fmtK(m.c)}/${fmtK(m.b)}</span>` : ''} <span class="sub small">· ${m.paidN}/${m.n} أسرة</span></span></div>`; }).join('')}</div>` : ''}
    <div class="section-title"><h2>الأسر (${rows.length})</h2></div>
    <input class="input search mb" placeholder="🔎 ابحث باسم الأسرة…" oninput="finSearch('coll', this.value)">
    <div class="list" id="fin-coll-list">${rows.map(x => `<div class="card item fin-row" data-q="${esc(normAr(x.f.name))}">
      <div class="item-head"><div class="item-title">${esc(x.f.name)}</div>
        <span class="badge ${x.rem > 0.01 ? (x.c > 0.01 ? 'b-pending' : 'b-cancel') : 'b-done'}">${x.rem > 0.01 ? (x.c > 0.01 ? 'دفعت جزء' : 'لسه مادفعتش') : 'اتحصّل ✓'}</span></div>
      <div class="meta"><span>عليها: <b class="num"><bdi>${fmt(x.b, 2)} ${x.cur}</bdi></b></span><span>اتحصّل: <b class="num pos"><bdi>${fmt(x.c, 2)} ${x.cur}</bdi></b></span>${x.rem > 0.01 ? `<span>لسه: <b class="num neg"><bdi>${fmt(x.rem, 2)} ${x.cur}</bdi></b></span>` : ''}${x.adv > 0.01 ? `<span class="sub">رصيد مقدّم: <bdi>${fmt(x.adv, 2)} ${x.cur}</bdi></span>` : ''}</div>
      ${x.rem > 0.01 ? `<div class="actions"><button class="btn btn-wa sm" onclick="openFamilyInvoice(${jsq(x.f.id)}, 'fin')">📄 فاتورة</button><button class="btn btn-brand sm" onclick="openPaymentForm(${jsq(x.f.id)})">+ دفعة</button></div>` : ''}</div>`).join('') || '<div class="card empty">مفيش حصص في الفترة دي</div>'}</div>`;
}
async function openHistoryDetail(id) {
  const h = (state.fin.history || []).find(x => x.id === id); if (!h) return;
  const d = { ...(h.details || {}) }, fx = +h.fx_aed || 13;
  if (!d.families) { const rows = await sb.from('family_history').select('*').eq('month', h.period_start).order('amount', { ascending: false }).then(x => x.data || []);
    if (rows.length) d.families = rows.map(r => ({ name: r.family_name, sessions: +r.hours, aed: +r.amount })); }
  openModal(`📚 ${new Date(h.period_start + 'T12:00').toLocaleDateString('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' })} — سجلات قديمة`, `
    <div class="kpis mb">${kpiCard('الإيراد', fmt(+h.revenue_egp), `ج${h.revenue_aed ? ` · ${fmt(+h.revenue_aed, 2)} درهم` : ''}`)}${kpiCard('المعلمين', fmt(+h.tutor_cost_egp), 'ج')}${kpiCard('المصاريف', fmt(+h.opex_egp), 'ج')}
      ${kpiCard('صافي الربح', fmt(+h.revenue_egp - +h.tutor_cost_egp - +h.opex_egp), `ج · ${Math.round((+h.revenue_egp - +h.tutor_cost_egp - +h.opex_egp) / +h.revenue_egp * 100)}%`, '', { vcls: 'pos' })}</div>
    ${d.families ? `<h3>الأسر (${d.families.length})</h3><div class="scrollx"><table><thead><tr><th>الأسرة</th><th>طلاب</th><th>حصص</th><th>درهم</th><th>جنيه</th></tr></thead><tbody>
      ${d.families.map(f => `<tr><td>${esc(f.name)}</td><td class="num">${f.students || '—'}</td><td class="num">${f.sessions ?? '—'}</td><td class="num">${fmt(f.aed, 2)}</td><td class="num">${fmt(f.aed * fx, 2)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${d.tutors ? `<h3 class="mt">المعلمين (${d.tutors.length})</h3><div class="scrollx"><table><thead><tr><th>المعلمة</th><th>المادة</th><th>حصص</th><th>جنيه</th></tr></thead><tbody>
      ${d.tutors.map(t => `<tr><td>${esc(t.name)}</td><td class="small">${esc(t.subject || '')}</td><td class="num">${t.sessions ?? '—'}</td><td class="num">${fmt(t.egp)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${d.gaps?.length ? `<h3 class="mt">⚠️ فجوات لسه مفتوحة (${d.gaps.length})</h3><div class="card item">${d.gaps.map(g => `<div class="small" style="padding:3px 0">• ${esc(typeof g === 'string' ? g : `${g.student}: ${g.subject} — الأسرة ${g.family_h} / المعلمات ${g.tutors_h}`)}</div>`).join('')}</div>` : ''}
    <p class="sub small mt">${esc(h.source || '')}${h.note ? ' · ' + esc(h.note) : ''}</p>`);
}
