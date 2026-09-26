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
  daySessions: [], relay: [], relayFilter: 'pending', dayFilter: 'all',
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
    await Promise.all([loadMasters(), loadDay(), loadRelay()]);
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
  renderDaily(); renderRelay(); renderFamilies(); renderTutors();
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
   الجدول اليومي
   ============================================================ */
function studentLabel(st) {
  if (!st) return '—';
  return `${st.name}`;
}
function sessionView(s) {
  const st = byId(state.students, s.student_id);
  const fam = st ? byId(state.families, st.family_id) : null;
  const tu = byId(state.tutors, s.tutor_id);
  return { st, fam, tu };
}
function isNow(s) {
  if (s.status === 'in_progress') return true;
  if (s.status !== 'scheduled') return false;
  const t = new Date(s.scheduled_at).getTime(), now = Date.now();
  return now >= t - 15 * 60e3 && now <= t + (s.duration_minutes || 60) * 60e3;
}
function needsReminder(s) {
  if (s.status !== 'scheduled') return false;
  const diff = new Date(s.scheduled_at).getTime() - Date.now();
  return diff > -5 * 60e3 && diff <= 3 * 3600e3;
}
const DAY_FILTERS = [
  { k: 'all', l: 'الكل', f: () => true },
  { k: 'now', l: 'تبدأ الآن', f: isNow },
  { k: 'remind', l: 'تحتاج تذكير', f: needsReminder },
  { k: 'scheduled', l: 'مجدولة', f: s => s.status === 'scheduled' },
  { k: 'done', l: 'تمت', f: s => s.status === 'done' },
  { k: 'cancel', l: 'ملغاة', f: s => s.status.startsWith('cancelled') },
];
function setDay(v) { if (!v) return; state.day = v; document.getElementById('day-input').value = v; loadDay().then(renderDaily).catch(e => showToast(dbError(e), true)); }
function shiftDay(n) { const d = parseDay(state.day); d.setDate(d.getDate() + n); setDay(dateStr(d)); }
function setDayFilter(k) { state.dayFilter = k; renderDaily(); }

function renderDaily() {
  document.getElementById('day-input').value = state.day;
  const all = state.daySessions;
  document.getElementById('filters').innerHTML = DAY_FILTERS.map(f => {
    const n = all.filter(f.f).length;
    return `<button class="chip ${state.dayFilter === f.k ? 'active' : ''}" onclick="setDayFilter('${f.k}')">${f.l} (${n})</button>`;
  }).join('');

  const done = all.filter(s => s.status === 'done');
  const active = all.filter(s => !s.status.startsWith('cancelled'));
  const estRev = active.reduce((a, s) => a + toEGP(s.student_price, s.student_currency), 0);
  const estCost = active.reduce((a, s) => a + Number(s.tutor_cost_egp || 0), 0);
  document.getElementById('day-stats').innerHTML = `
    <div class="card stat"><div class="v">${all.length}</div><div class="l">حصص اليوم</div></div>
    <div class="card stat"><div class="v">${done.length}</div><div class="l">تمت</div></div>
    <div class="card stat"><div class="v">${all.filter(s => s.status === 'scheduled').length}</div><div class="l">متبقية</div></div>
    <div class="card stat"><div class="v num">${fmt(estRev - estCost)}</div><div class="l">هامش متوقع (EGP)</div></div>`;

  const flt = DAY_FILTERS.find(f => f.k === state.dayFilter) || DAY_FILTERS[0];
  const list = all.filter(flt.f);
  const el = document.getElementById('daily-list');
  if (!all.length) {
    el.innerHTML = `<div class="card empty">مفيش حصص في اليوم ده.<br>
      ${state.students.length && state.tutors.length
        ? `<button class="btn btn-brand" onclick="openSessionForm()">+ أضف أول حصة</button>`
        : `<div class="small mt">ابدأ بإضافة <a href="javascript:void(0)" onclick="switchTab('families')">أسرة وطالب</a> و<a href="javascript:void(0)" onclick="switchTab('tutors')">معلم</a> الأول، وبعدها تقدر تضيف حصص.</div>`}
    </div>`;
    return;
  }
  if (!list.length) { el.innerHTML = `<div class="card empty">لا توجد حصص مطابقة للفلتر.</div>`; return; }
  el.innerHTML = list.map(sessionCard).join('');
}

function sessionCard(s) {
  const { st, fam, tu } = sessionView(s);
  const now = isNow(s);
  const badge = now && s.status === 'scheduled' ? { label: 'تبدأ الآن', cls: 'b-now' } : STATUS[s.status];
  const revEgp = s.status === 'done' ? Number(s.revenue_egp) : toEGP(s.student_price, s.student_currency);
  const margin = s.status === 'done' ? Number(s.margin_egp) : revEgp - Number(s.tutor_cost_egp);
  const cancelled = s.status.startsWith('cancelled');
  const end = new Date(new Date(s.scheduled_at).getTime() + (s.duration_minutes || 60) * 60e3);
  const famTz = fam && COUNTRIES[fam.country] && fam.country !== 'مصر' ? COUNTRIES[fam.country] : null;
  const id = jsq(s.id);
  return `<div class="card item session ${now ? 's-now' : ''}">
    <div class="left">
      <div class="time">${esc(timeStr(new Date(s.scheduled_at)))}</div>
      <div class="sub small">حتى ${esc(timeStr(end))}</div>
      ${famTz ? `<div class="sub small" title="بتوقيت ${famTz.tzName}">${famTz.flag} ${esc(fmtTime(s.scheduled_at, famTz.tz))}</div>` : ''}
    </div>
    <div>
      <div class="item-head">
        <div>
          <div class="item-title">${esc(st?.name || 'طالب محذوف')}</div>
          <div class="sub small">${esc(fam?.name || '')}${st ? ` · ${esc(st.grade_level)} · ${esc(CURRICULA[st.curriculum] || '')}` : ''}</div>
        </div>
        <span class="badge ${badge.cls}">${badge.label}</span>
      </div>
      <div class="meta">
        <span>المعلم: <b>${esc(tu?.name || '—')}</b></span>
        ${s.subject ? `<span>المادة: <b>${esc(s.subject)}</b></span>` : ''}
        ${s.meeting_link ? `<span><a href="${esc(linkHref(s.meeting_link))}" target="_blank" rel="noopener">رابط الحصة ↗</a></span>` : '<span class="neg">لا يوجد رابط</span>'}
      </div>
      ${s.notes ? `<div class="sub small mt">📝 ${esc(s.notes)}</div>` : ''}
      ${cancelled ? '' : `<div class="money">
        <span class="pill">الأسرة: ${money(s.student_price, s.student_currency)}</span>
        <span class="pill">المعلم: ${money(s.tutor_cost_egp, 'EGP')}</span>
        <span class="pill ${margin >= 0 ? 'ok' : 'bad'}">الهامش: ${fmt(margin)} EGP${s.status === 'done' ? '' : ' (تقديري)'}</span>
      </div>`}
      <div class="actions">
        ${s.status === 'scheduled' || s.status === 'in_progress' ? `
          <button class="btn btn-wa sm" onclick="openReminder(${id},'parent')">📲 تذكير ولي الأمر</button>
          <button class="btn btn-wa sm" onclick="openReminder(${id},'tutor')">📲 تذكير المعلم</button>` : ''}
        ${s.status === 'scheduled' ? `<button class="btn btn-ghost sm" onclick="setStatus(${id},'in_progress')">▶ بدأت</button>` : ''}
        ${s.status !== 'done' && !cancelled ? `<button class="btn btn-ok sm" onclick="setStatus(${id},'done')">✓ تمت</button>` : ''}
        ${!cancelled && s.status !== 'done' ? `<button class="btn btn-ghost sm" onclick="openCancel(${id})">إلغاء…</button>` : ''}
        ${s.status === 'done' || cancelled ? `<button class="btn btn-ghost sm" onclick="setStatus(${id},'scheduled')">↺ إرجاع لمجدولة</button>` : ''}
        <button class="btn btn-ghost sm" onclick="openSessionForm(${id})">تعديل</button>
        <button class="btn btn-ghost sm" onclick="openRelayForm({student_id:${jsq(s.student_id)}, session_id:${id}})">+ ترحيل</button>
        ${isAdmin ? `<button class="btn btn-danger sm" onclick="deleteSession(${id})">حذف</button>` : ''}
      </div>
    </div>
  </div>`;
}
function linkHref(l) { return /^https?:\/\//i.test(l) ? l : 'https://' + l; }

async function setStatus(id, status) {
  try {
    await q(sb.from('sessions').update({ status }).eq('id', id));
    showToast(status === 'done' ? 'تم تسجيل الحصة ✓' : 'تم تحديث الحالة');
    await refreshAll();
  } catch (e) { showToast(dbError(e), true); }
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
  if (who === 'parent') {
    const c = COUNTRIES[fam?.country] || COUNTRIES['مصر'];
    return `السلام عليكم ورحمة الله 🌷
تذكير بحصة ${st?.name || ''} ${relDayLabel(s.scheduled_at, c.tz)}
⏰ الساعة ${fmtTime(s.scheduled_at, c.tz)} بتوقيت ${c.tzName}${s.subject ? `\n📚 المادة: ${s.subject}` : ''}
🔗 رابط الحصة: ${link}

برجاء الدخول قبل الموعد بدقيقتين. لأي تعديل في الموعد أو ملاحظات تواصلوا معنا هنا مباشرة.
فريق الإشراف – أكاديمية أستاذ أونلاين`;
  }
  const tn = tu?.name || '';
  return `أهلاً ${/^(أ\.|أ\/|أستاذ|م\.|د\.)/.test(tn) ? tn : 'أ/ ' + tn} 👋
تذكير بحصة ${relDayLabel(s.scheduled_at, CAIRO_TZ)} مع الطالب/ة ${st?.name || ''} (${st?.grade_level || ''} – ${CURRICULA[st?.curriculum] || ''})
⏰ الساعة ${fmtTime(s.scheduled_at, CAIRO_TZ)} بتوقيت القاهرة${s.subject ? `\n📚 المادة: ${s.subject}` : ''}
🔗 رابط الحصة: ${link}

برجاء الالتزام بالموعد. أي مواد أو ملاحظات للطالب ابعتها لنا هنا وإحنا نوصّلها.
فريق الإشراف – أستاذ أونلاين`;
}
function openReminder(id, who) {
  const s = state.daySessions.find(x => x.id === id) || (state.alertSessions || []).find(x => x.id === id);
  if (!s) return;
  const { fam, tu } = sessionView(s);
  const text = buildReminder(s, who);
  const num = who === 'parent' ? waNumber(fam?.whatsapp, fam?.country) : waNumber(tu?.phone, 'مصر');
  const group = who === 'parent' ? fam?.whatsapp_group : null;
  window._reminderText = text;
  openModal(who === 'parent' ? 'تذكير ولي الأمر' : 'تذكير المعلم', `
    <div class="msg-preview">${esc(text)}</div>
    <div class="modal-foot" style="flex-wrap:wrap">
      ${group ? `<button class="btn btn-wa" onclick="copyAndOpen(window._reminderText, ${jsq(group)}); closeModal()">نسخ وفتح جروب الأسرة</button>` : ''}
      ${num ? `<a class="btn ${group ? 'btn-ghost' : 'btn-wa'}" href="https://wa.me/${num}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener" onclick="closeModal()">إرسال على الرقم الخاص</a>` : ''}
      <button class="btn btn-ghost" onclick="copyText(window._reminderText,'تم نسخ الرسالة ✓')">نسخ النص</button>
      ${!group && !num ? `<span class="sub small">مفيش جروب ولا رقم مسجّل — <a href="javascript:void(0)" onclick="closeModal(); openFamilyForm(${jsq(fam?.id)})">أضفهم</a></span>` : ''}
    </div>`);
}

/* ----- نموذج الحصة ----- */
function studentOptions() {
  return state.families.map(f => ({
    group: `${f.name} (${f.currency})`,
    items: state.students.filter(s => s.family_id === f.id).map(s => ({ v: s.id, l: `${s.name} — ${s.grade_level}` })),
  })).filter(g => g.items.length);
}
async function openSessionForm(id) {
  if (!state.students.length || !state.tutors.length) {
    showToast('لازم تضيف طالب ومعلم الأول', true);
    switchTab(!state.students.length ? 'families' : 'tutors');
    return;
  }
  const s = id ? state.daySessions.find(x => x.id === id) : null;
  const when = s ? new Date(s.scheduled_at) : (() => { const d = parseDay(state.day); const n = new Date(); d.setHours(n.getHours() + 1, 0, 0, 0); return d; })();
  const fields = [
    { name: 'student_id', label: 'الطالب', type: 'select', required: true, placeholder: 'اختر الطالب…', options: studentOptions(), value: s?.student_id },
    { name: 'tutor_id', label: 'المعلم', type: 'select', required: true, placeholder: 'اختر المعلم…', options: state.tutors.map(t => ({ v: t.id, l: t.name })), value: s?.tutor_id },
    { name: 'subject', label: 'المادة', value: s?.subject, placeholder: 'مثال: رياضيات', list: [...new Set(state.subjects.map(x => x.subject))] },
    [{ name: 'date', label: 'التاريخ', type: 'date', required: true, value: dateStr(when) },
     { name: 'time', label: 'الوقت (بتوقيتك)', type: 'time', required: true, value: timeStr(when) }],
    [{ name: 'duration_minutes', label: 'المدة (دقيقة)', type: 'number', required: true, value: s?.duration_minutes ?? 60, step: 5 },
     { name: 'meeting_link', label: 'رابط الحصة', value: s?.meeting_link, placeholder: 'meet.google.com/…' }],
    [{ name: 'student_price', label: 'سعر الحصة للأسرة', type: 'number', required: true, value: s?.student_price, hint: 'بعملة الأسرة' },
     { name: 'tutor_cost_egp', label: 'أجر المعلم (EGP)', type: 'number', required: true, value: s?.tutor_cost_egp }],
    { name: 'notes', label: 'ملاحظات', type: 'textarea', value: s?.notes },
  ];
  if (!s) fields.push({ name: 'repeat', label: 'تكرار أسبوعي', type: 'select', value: '1',
    options: [1, 2, 4, 8, 12, 16].map(n => ({ v: n, l: n === 1 ? 'بدون تكرار (حصة واحدة)' : `نفس الموعد لمدة ${n} أسابيع` })) });
  openModal(s ? 'تعديل حصة' : 'حصة جديدة', formHtml(fields, s ? 'حفظ التعديل' : 'إضافة الحصة'));

  const stSel = document.getElementById('f_student_id'), tuSel = document.getElementById('f_tutor_id');
  document.getElementById('wrap_student_id').insertAdjacentHTML('beforeend', '<div id="plan-picks" class="students"></div>');
  const applyPlan = (p) => {
    document.getElementById('f_subject').value = p.subject;
    if (p.tutor_id) {
      tuSel.value = p.tutor_id;
      const t = byId(state.tutors, p.tutor_id);
      if (t && t.default_rate_egp != null) document.getElementById('f_tutor_cost_egp').value = t.default_rate_egp;
    }
    document.querySelectorAll('#plan-picks .stu').forEach(b => b.classList.toggle('picked', b.dataset.pid === p.id));
  };
  window._applyPlan = (pid) => applyPlan(state.plans.find(x => x.id === pid));
  const renderPicks = (auto) => {
    const ps = plansOf(stSel.value);
    document.getElementById('plan-picks').innerHTML = ps.length
      ? '<span class="sub small" style="align-self:center">اختار المادة:</span>' + ps.map(p => `<button type="button" class="stu" data-pid="${esc(p.id)}" onclick="_applyPlan(${jsq(p.id)})">${esc(planLabel(p))}</button>`).join('')
      : '';
    if (auto && ps.length === 1) applyPlan(ps[0]);
  };
  stSel.addEventListener('change', () => renderPicks(true));
  renderPicks(false);
  const updateHints = (fill) => {
    const st = byId(state.students, stSel.value);
    const fam = st ? byId(state.families, st.family_id) : null;
    const h = document.getElementById('hint_student_price');
    h.textContent = fam ? `بعملة الأسرة: ${fam.currency}` : 'بعملة الأسرة';
    if (fill && st && st.default_price != null) document.getElementById('f_student_price').value = st.default_price;
  };
  stSel.addEventListener('change', () => updateHints(true));
  tuSel.addEventListener('change', () => {
    const t = byId(state.tutors, tuSel.value);
    if (t && t.default_rate_egp != null) document.getElementById('f_tutor_cost_egp').value = t.default_rate_egp;
  });
  updateHints(false);

  window._formSubmit = () => runSubmit(async () => {
    const st = byId(state.students, fv('student_id'));
    const fam = byId(state.families, st.family_id);
    const start = new Date(`${fv('date')}T${fv('time')}`);
    if (isNaN(start)) return formError('التاريخ أو الوقت غير صحيح');
    const row = {
      student_id: st.id, tutor_id: fv('tutor_id'), subject: fv('subject') || null,
      scheduled_at: start.toISOString(), duration_minutes: fnum('duration_minutes') || 60,
      meeting_link: fv('meeting_link') || null, student_price: fnum('student_price'),
      student_currency: fam.currency, tutor_cost_egp: fnum('tutor_cost_egp'), notes: fv('notes') || null,
    };
    if (s) {
      await q(sb.from('sessions').update(row).eq('id', s.id));
      showToast('تم حفظ التعديل ✓');
    } else {
      const n = Number(fv('repeat') || 1);
      const rows = Array.from({ length: n }, (_, i) => ({ ...row, scheduled_at: new Date(start.getTime() + i * 7 * 864e5).toISOString() }));
      await q(sb.from('sessions').insert(rows));
      if (st.default_price == null) await sb.from('students').update({ default_price: row.student_price }).eq('id', st.id);
      showToast(n > 1 ? `تمت إضافة ${n} حصص ✓` : 'تمت إضافة الحصة ✓');
      if (fv('date') !== state.day) { state.day = fv('date'); }
    }
    closeModal();
    await refreshAll();
  });
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
          <div class="stu-top"><b>${esc(s.name)}</b><span class="num">${s.default_price != null ? `${fmt(s.default_price)} ${esc(f.currency)}` : '<span class="neg">بدون سعر</span>'}</span></div>
          <div class="sub small">${esc(s.grade_level)} · ${esc(CURRICULA[s.curriculum])}</div>
          ${plansOf(s.id).length ? `<div class="plan-lines">${plansOf(s.id).map(p => `<span class="plan ${p.tutor_id ? '' : 'no-tutor'}">${esc(planLabel(p))}</span>`).join('')}</div>` : ''}
          ${s.notes ? `<div class="small warn-note">⚠️ ${esc(s.notes)}</div>` : ''}
        </button>`).join('')}
        <button class="stu" style="background:transparent;border:1px dashed var(--brand)" onclick="openStudentForm(${fid})">+ طالب</button>
      </div>
      <div class="actions">
        <button class="btn btn-brand sm" onclick="openPaymentForm(${fid})">+ دفعة</button>
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
    { name: 'st_price', label: 'سعر الحصة الافتراضي (بعملة الأسرة)', type: 'number' },
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
    { name: 'default_price', label: `سعر الحصة الافتراضي (${fam.currency})`, type: 'number', value: s?.default_price, hint: 'بيتملى تلقائي لما تضيف حصة للطالب ده، وتقدر تغيّره في كل حصة' },
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
      ...ss.map(s => ({ at: s.scheduled_at, desc: `حصة ${byId(state.students, s.student_id)?.name || ''}${s.subject ? ' — ' + s.subject : ''}`, amt: -Number(s.student_price), kind: 'session' })),
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
      <div class="meta">
        ${t.default_rate_egp != null ? `<span>سعره الافتراضي: <b>${fmt(t.default_rate_egp)} EGP</b></span>` : ''}
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
        ${b.due > 0 ? `<button class="btn btn-brand sm" onclick="openPayoutForm(${tid})">صرف مستحقات</button>` : ''}
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
    [{ name: 'phone', label: 'رقم الموبايل / واتساب', type: 'tel', value: t?.phone, placeholder: '01xxxxxxxxx', hint: 'داخلي فقط — لا يظهر لولي الأمر' },
     { name: 'default_rate_egp', label: 'سعر الحصة الافتراضي (EGP)', type: 'number', value: t?.default_rate_egp }],
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
    const row = { name: fv('name'), phone: fv('phone') || null, default_rate_egp: fnum('default_rate_egp'),
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
      ...ss.map(s => ({ at: s.scheduled_at, desc: `حصة ${byId(state.students, s.student_id)?.name || ''}${s.subject ? ' — ' + s.subject : ''}`, amt: Number(s.tutor_cost_egp) })),
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
      ${run > 0 ? `<div class="modal-foot"><button class="btn btn-brand" onclick="openPayoutForm(${jsq(tutorId)})">صرف المستحقات</button></div>` : ''}`);
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
  const cost = done.reduce((a, s) => a + Number(s.tutor_cost_egp || 0), 0);
  const margin = rev - cost;
  const byCur = {};
  done.forEach(s => { const c = byCur[s.student_currency] ||= { amt: 0, egp: 0, n: 0 }; c.amt += Number(s.student_price); c.egp += Number(s.revenue_egp || 0); c.n++; });
  const collected = {};
  tx.forEach(t => { collected[t.currency] = (collected[t.currency] || 0) + (t.type === 'refund' ? -1 : 1) * Number(t.amount); });
  const collectedEgp = Object.entries(collected).reduce((a, [c, v]) => a + toEGP(v, c), 0);
  const paidOut = payouts.filter(p => p.paid).reduce((a, p) => a + Number(p.total_egp), 0);

  // مستحقات المعلمين في الفترة
  const perTutor = {};
  done.forEach(s => { const x = perTutor[s.tutor_id] ||= { n: 0, egp: 0 }; x.n++; x.egp += Number(s.tutor_cost_egp); });
  const tutorRows = state.tutors.map(t => ({ t, p: perTutor[t.id] || { n: 0, egp: 0 }, b: tutBalance(t) }))
    .filter(x => x.p.n || x.b.due > 0).sort((a, b) => b.b.due - a.b.due);

  const owing = state.families.map(f => ({ f, b: famBalance(f) })).filter(x => x.b.balance < 0).sort((a, b) => a.b.balance - b.b.balance);

  document.getElementById('fin-content').innerHTML = `
    <div class="kpis">
      <div class="card kpi"><div class="l">إيراد الحصص اللي تمت</div><div class="v num">${fmt(rev)}</div><div class="s">EGP · ${done.length} حصة</div></div>
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
    <div class="card scrollx"><table><thead><tr><th>المعلم</th><th>حصص الفترة</th><th>مستحق عن الفترة</th><th>إجمالي غير مصروف</th><th></th></tr></thead><tbody>
      ${tutorRows.map(x => `<tr><td>${esc(x.t.name)}</td><td class="num">${x.p.n}</td><td class="num">${fmt(x.p.egp)} EGP</td>
        <td class="num ${x.b.due > 0 ? 'neg' : ''}">${fmt(x.b.due)} EGP</td>
        <td>${x.b.due > 0 ? `<button class="btn btn-brand sm" onclick="openPayoutForm(${jsq(x.t.id)})">صرف</button>` : '<span class="pill ok">مصروف</span>'}</td></tr>`).join('')
        || '<tr><td colspan="5" class="empty">لا توجد مستحقات</td></tr>'}
    </tbody></table></div>

    <div class="section-title"><h2>أسر عليها مستحقات</h2></div>
    <div class="card scrollx"><table><thead><tr><th>الأسرة</th><th>المستحق</th><th></th></tr></thead><tbody>
      ${owing.map(x => `<tr><td>${esc(x.f.name)}</td><td class="num neg">${money(-x.b.balance, x.f.currency)}</td>
        <td class="row-gap"><button class="btn btn-brand sm" onclick="openPaymentForm(${jsq(x.f.id)})">+ دفعة</button>
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
async function toggleAlerts() {
  alertsOn = !alertsOn;
  document.getElementById('btn-alerts').textContent = alertsOn ? '🔔' : '🔕';
  try { localStorage.setItem('ostaz_alerts', alertsOn ? '1' : '0'); } catch (e) {}
  if (alertsOn) {
    if ('Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) {} }
    beep();
    showToast('التنبيهات شغالة: قبل الحصة بـ 15 دقيقة وعند موعدها (طول ما الصفحة مفتوحة)');
    startAlerts();
  } else { clearInterval(alertTimer); showToast('تم إيقاف التنبيهات'); }
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
        if ('Notification' in window && Notification.permission === 'granted') {
          try { new Notification('أستاذ أونلاين — تنبيه حصة', { body: msg, icon: 'logo.png', tag: key, requireInteraction: true }); } catch (e) {}
        }
      }
    });
  });
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
  // مسح بقايا رابط جوجل (?code=… / #…) من شريط العنوان
  if (location.search || location.hash) history.replaceState(null, '', location.pathname);
  showView('app');
  await refreshAll();
  subscribeRealtime();
  let savedAlerts = false; try { savedAlerts = localStorage.getItem('ostaz_alerts') === '1'; } catch (e) {}
  if (savedAlerts && !alertsOn) { alertsOn = true; document.getElementById('btn-alerts').textContent = '🔔'; startAlerts(); }
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
