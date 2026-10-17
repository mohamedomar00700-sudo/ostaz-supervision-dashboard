/* ============================================================
   بوابة ولي الأمر — مواعيد الأولاد + تأكيد التذكير + تقارير الحصص
   الدخول بلينك خاص بالأسرة (?p=…) من غير حساب ولا باسورد.
   مفيش أي أرقام أو وسيلة تواصل مع المعلمين.
   ============================================================ */
const PARENT_URL_TOKEN = (() => { try { const p = new URLSearchParams(location.search).get('p'); return p && /^[a-f0-9]{32,80}$/.test(p) ? p : null; } catch (e) { return null; } })();
const PARENT_TOKEN = (() => {
  try {
    if (PARENT_URL_TOKEN) { localStorage.setItem('ostaz_parent_token', PARENT_URL_TOKEN); return PARENT_URL_TOKEN; }
    return localStorage.getItem('ostaz_parent_token');
  } catch (e) { return PARENT_URL_TOKEN; }
})();
const P = { token: null, data: null, tz: 'Asia/Dubai' };

// المانيفست بلينك الأسرة نفسه: لما يتثبت على الشاشة الرئيسية يفتح على البوابة على طول
function parentManifest(token) {
  try {
    const base = new URL('./', location.href).href;
    const m = { name: 'أستاذ أونلاين — ولي الأمر', short_name: 'أستاذ أونلاين', start_url: base + '?p=' + token, scope: base, display: 'standalone', dir: 'rtl', lang: 'ar',
      background_color: '#f4f6f8', theme_color: '#1d4ed8', icons: [{ src: base + 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: base + 'icon-512.png', sizes: '512x512', type: 'image/png' }] };
    const link = document.querySelector('link[rel="manifest"]');
    if (link) link.href = 'data:application/manifest+json;charset=utf-8,' + encodeURIComponent(JSON.stringify(m));
  } catch (e) {}
}

async function enterParent(token) {
  window._parentMode = true;
  P.token = token;
  parentManifest(token);
  if (!PARENT_URL_TOKEN) history.replaceState(null, '', location.pathname + '?p=' + token);
  ['auth', 'pending', 'app', 'tutor'].forEach(v => document.getElementById('view-' + v)?.classList.add('hidden'));
  document.getElementById('view-parent').classList.remove('hidden');
  document.title = 'أستاذ أونلاين — ولي الأمر';
  await registerSW();
  await parentRefresh();
  parentAlertIcon();
  if (!window._ptick) window._ptick = setInterval(() => { if (!document.hidden) parentRender(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && P.token) parentRefresh(); });
}

async function parentRefresh() {
  const el = document.getElementById('parent-content');
  try {
    const { data, error } = await sb.rpc('parent_portal', { p_token: P.token });
    if (error) throw error;
    if (!data) {
      try { localStorage.removeItem('ostaz_parent_token'); } catch (e) {}
      el.innerHTML = `<div class="card empty">هذا الرابط لم يعد يعمل.<br>اطلبوا رابطاً جديداً من الإشراف على مجموعة الواتساب 🙏</div>`;
      document.getElementById('parent-family').textContent = '';
      return;
    }
    P.data = data;
    P.tz = (typeof COUNTRIES !== 'undefined' && COUNTRIES[data.family.country]?.tz) || 'Asia/Dubai';
    if (typeof CURRICULA === 'undefined') window.CURRICULA = {};
    document.getElementById('parent-family').textContent = data.family.name;
    parentRender();
  } catch (e) { el.innerHTML = `<div class="card empty">تعذر التحميل — تأكدوا من الإنترنت وحدّثوا الصفحة.<br><span class="sub small">${esc(e.message || String(e))}</span></div>`; }
}

const pDayKey = (iso, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
function pDayLabel(iso) {
  const k = pDayKey(iso, P.tz), today = pDayKey(new Date().toISOString(), P.tz), tom = pDayKey(new Date(Date.now() + 864e5).toISOString(), P.tz);
  return k === today ? 'اليوم' : k === tom ? 'غداً' : new Date(iso).toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', timeZone: P.tz });
}
function pDur(min) { min = Number(min) || 60; return min === 60 ? 'ساعة' : min === 90 ? 'ساعة ونصف' : min === 120 ? 'ساعتين' : min === 30 ? 'نصف ساعة' : min === 45 ? '45 دقيقة' : `${min} دقيقة`; }

async function parentPushOn() {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  return !!(await currentPushSub().catch(() => null));
}
async function parentAlertIcon() { const on = await parentPushOn(); const b = document.getElementById('p-btn-alerts'); if (b) b.textContent = on ? '🔔' : '🔕'; P.pushOn = on; return on; }

const P_CUR = { AED: 'درهم', SAR: 'ريال', EGP: 'جنيه' };
const P_CAT = { postpone: '🗓️ تأجيل / تغيير موعد', cancel: '✖ إلغاء حصة', material: '📎 رسالة أو مواد للمعلم/ة', level: '📈 سؤال عن مستوى الطالب', billing: '💳 استفسار عن الحساب', complaint: '⚠️ ملاحظة أو شكوى', other: '💬 أخرى' };
const P_CAT_DB = { postpone: 'schedule', cancel: 'schedule', material: 'material', level: 'level', billing: 'other', complaint: 'complaint', other: 'other' };
const P_DB_LBL = { schedule: '🗓️ مواعيد', material: '📎 للمعلم/ة', level: '📈 المستوى', complaint: '⚠️ ملاحظة', other: '💬 استفسار' };
P.tab = 'home'; P.kid = 'all'; P.sessView = 'up';
const pMoney = (v, cur) => `${fmt(Math.abs(Number(v) || 0), 2)} ${P_CUR[cur] || cur || ''}`;
const pUnits = min => { const u = Math.round((Number(min) || 0) / 60 * 100) / 100; return u === 1 ? 'حصة واحدة' : u === 2 ? 'حصتان' : u === 0.5 ? 'نصف حصة' : `${fmt(u, 2)} ${u >= 3 && u <= 10 && Number.isInteger(u) ? 'حصص' : 'حصة'}`; };
const pDate = (iso, o) => new Date(iso).toLocaleDateString('ar-EG-u-nu-latn', { timeZone: P.tz, ...(o || { weekday: 'long', day: 'numeric', month: 'long' }) });
const pMonthKey = iso => pDayKey(iso, P.tz).slice(0, 7);
const pMonthLbl = k => new Date(k + '-15T12:00:00Z').toLocaleDateString('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' });
const pKidOk = s => P.kid === 'all' || s.student_id === P.kid;
const pShowFin = () => !!(P.data?.family?.show_finance && P.data.finance);
function parentTab(t) { P.tab = t; window.scrollTo(0, 0); parentRender(); }

function parentRender() {
  const el = document.getElementById('parent-content'); if (!P.data) return;
  const tabs = [['home', '🏠', 'الرئيسية'], ['sess', '📅', 'الحصص'], ['kids', '🎒', 'الأبناء'], ...(pShowFin() ? [['money', '💳', 'الحساب']] : []), ['req', '✉️', 'الطلبات']];
  if (!tabs.some(t => t[0] === P.tab)) P.tab = 'home';
  const nav = document.getElementById('parent-tabs');
  const openReq = (P.data.requests || []).filter(r => r.status !== 'done').length;
  if (nav) nav.innerHTML = tabs.map(([k, i, l]) => `<button class="tab ${P.tab === k ? 'active' : ''}" onclick="parentTab('${k}')"><span class="ti">${i}</span><span class="tl">${l}</span>${k === 'req' && openReq ? `<span class="count">${openReq}</span>` : ''}</button>`).join('');
  el.innerHTML = ({ home: pHome, sess: pSessions, kids: pKids, money: pMoneyTab, req: pRequests }[P.tab] || pHome)();
}

function pUpcoming() { const now = Date.now(); return (P.data.upcoming || []).filter(s => new Date(s.scheduled_at).getTime() + (s.duration_minutes || 60) * 60e3 > now); }
function pSessCard(s, opts = {}) {
  const now = Date.now(), t = new Date(s.scheduled_at).getTime(), mins = Math.round((t - now) / 60e3), live = now >= t - 15 * 60e3 && now < t + (s.duration_minutes || 60) * 60e3;
  const soon = mins > 0 && mins <= 60, id = jsq(s.id);
  const link = s.meeting_link ? linkHref(s.meeting_link) : null;
  const when = mins > 0 && mins < 180 ? `بعد ${mins < 60 ? mins + ' دقيقة' : pDur(mins).replace('ساعة', 'ساعة')}` : '';
  return `<div class="card item p-sess${live ? ' s-now' : soon ? ' p-soon' : ''}${opts.hero ? ' p-hero' : ''}">
    <div class="item-head"><div>
      ${opts.hero ? `<div class="small sub">${live ? '🔴 الحصة الآن' : '⏭ الحصة القادمة'} · ${esc(pDayLabel(s.scheduled_at))}</div>` : ''}
      <div class="item-title">${esc(s.student_name)}${s.subject ? ' · ' + esc(s.subject) : ''}${s.kind === 'trial' ? ' <span class="badge b-trial">تجريبية</span>' : s.kind === 'revision' ? ' <span class="badge b-rev">مراجعة</span>' : ''}${s.is_makeup ? ' <span class="badge b-rev">تعويض</span>' : ''}</div>
      <div class="sub small">مع ${esc(s.tutor_name || 'المعلم/ة')} · ${pDur(s.duration_minutes)}${s.group_name ? ' · 👥 ' + esc(s.group_name) : ''}</div></div>
      <div class="p-time">${esc(fmtTime(s.scheduled_at, P.tz))}${live ? '<div class="small pos">الآن</div>' : when ? `<div class="small warn-txt">${when}</div>` : ''}</div></div>
    <div class="actions">
      ${link && live ? `<a class="btn btn-brand sm" href="${esc(link)}" target="_blank" rel="noopener" onclick="parentAck(${id}, 'join', true)">🎥 ادخلوا الحصة</a>` : ''}
      ${s.acked ? '<span class="pos small">✓ تم التأكيد</span>' : (t - now < 26 * 3600e3 ? `<button class="btn ${live || soon ? 'btn-brand' : 'btn-ghost'} sm" onclick="parentAck(${id})">✅ تم، سنحضر</button>` : '')}
      ${!live ? `<button class="btn btn-ghost sm" onclick="parentRequestForm({session:${id}, cat:'postpone'})">🗓️ طلب تغيير</button>` : ''}
    </div></div>`;
}
function pKidChips() {
  const kids = P.data.kids || []; if (kids.length < 2) return '';
  return `<div class="chips">${[['all', 'الكل'], ...kids.map(k => [k.id, k.name])].map(([v, l]) => `<button class="chip ${P.kid === v ? 'active' : ''}" onclick="P.kid=${jsq(v)}; parentRender()">${esc(l)}</button>`).join('')}</div>`;
}
function pBalance() {
  const f = P.data.finance; if (!f) return null;
  return Math.round((Number(f.paid) - Number(f.consumed)) * 100) / 100;
}
function pPkg() {
  const fam = P.data.family, f = P.data.finance;
  if (fam.billing_cycle !== 'prepaid' || !fam.package_size || f?.pkg_minutes == null) return null;
  const used = Math.round(f.pkg_minutes / 60 * 100) / 100, size = Number(fam.package_size);
  return { used, size, left: Math.max(0, Math.round((size - used) * 100) / 100), pct: Math.min(100, Math.round(used / size * 100)) };
}
function pReportHtml(r) {
  if (!r) return '';
  if (r.attended === false) return '<div class="small mt neg">لم يحضر الطالب هذه الحصة.</div>';
  return `${r.topics ? `<div class="small mt">📚 <b>تم شرح:</b> ${esc(r.topics)}</div>` : ''}${r.homework ? `<div class="small">✏️ <b>الواجب:</b> ${esc(r.homework)}</div>` : ''}${r.level ? `<div class="small">⭐ <b>المستوى:</b> ${esc(r.level)}</div>` : ''}`;
}
function pPastCard(s) {
  const cancelled = s.status !== 'done';
  const badge = cancelled ? `<span class="badge b-cancel">${s.status === 'cancelled_by_tutor' ? 'اعتذار المعلم/ة' : 'أُلغيت بطلبكم'}</span>`
    : s.report ? (s.report.attended === false ? '<span class="badge b-cancel">غياب</span>' : '<span class="badge b-done">تقرير ✓</span>') : '<span class="badge b-done">تمت</span>';
  return `<div class="card item${cancelled ? ' p-muted' : ''}">
    <div class="item-head"><div><div class="item-title">${esc(s.student_name)}${s.subject ? ' · ' + esc(s.subject) : ''}${s.kind === 'trial' ? ' <span class="badge b-trial">تجريبية</span>' : ''}</div>
      <div class="sub small">${esc(pDate(s.scheduled_at))} · ${esc(fmtTime(s.scheduled_at, P.tz))} · مع ${esc(s.tutor_name || '')}${cancelled ? '' : ' · ' + pDur(s.minutes)}</div></div>${badge}</div>
    ${cancelled ? `<div class="small sub mt">${s.cancel_reason ? 'السبب: ' + esc(s.cancel_reason) + ' · ' : ''}${s.made_up ? '✓ تم تحديد موعد تعويض' : s.status === 'cancelled_by_tutor' ? 'سيتم تحديد موعد تعويض' : ''}</div>` : pReportHtml(s.report)}
  </div>`;
}

/* ---------- الرئيسية ---------- */
function pHome() {
  const d = P.data, up = pUpcoming(), next = up[0];
  const monthK = pMonthKey(new Date().toISOString());
  const doneM = (d.past || []).filter(s => s.status === 'done' && pMonthKey(s.scheduled_at) === monthK);
  const minsM = doneM.reduce((a, s) => a + (Number(s.minutes) || 0), 0);
  const weekEnd = Date.now() + 7 * 864e5, weekN = up.filter(s => new Date(s.scheduled_at).getTime() < weekEnd).length;
  const lastRep = (d.past || []).find(s => s.report && s.report.attended !== false && (s.report.topics || s.report.homework));
  const bal = pBalance(), pkg = pPkg(), cur = d.family.currency;
  const banner = P.pushOn ? '' : `<div class="card item p-banner"><div class="item-head"><div><b>🔔 فعّلوا التنبيهات</b><div class="sub small">ليصلكم تذكير قبل كل حصة حتى والجوال مقفل.</div></div>
    <button class="btn btn-brand sm" onclick="parentAlertsPanel()">تفعيل</button></div></div>`;
  const todayK = pDayKey(new Date().toISOString(), P.tz);
  const today = up.filter(s => s !== next && pDayKey(s.scheduled_at, P.tz) === todayK);
  return `${banner}
    <div class="p-hello"><h2>أهلاً بكم 🌷</h2><div class="sub small">${esc((d.kids || []).map(k => k.name).join(' · '))}</div></div>
    ${next ? pSessCard(next, { hero: true }) : '<div class="card empty">لا توجد حصص قادمة مسجلة حالياً.</div>'}
    ${today.length ? `<h3 class="p-day">باقي حصص اليوم</h3><div class="list">${today.map(s => pSessCard(s)).join('')}</div>` : ''}
    <div class="p-stats">
      <div class="card p-stat" onclick="parentTab('sess')"><div class="p-num">${weekN}</div><div class="sub small">حصص في الأيام السبعة القادمة</div></div>
      <div class="card p-stat" onclick="P.sessView='past'; parentTab('sess')"><div class="p-num">${fmt(minsM / 60, 2)}</div><div class="sub small">حصة تمت هذا الشهر</div></div>
      ${bal != null ? `<div class="card p-stat" onclick="parentTab('money')"><div class="p-num ${bal < 0 ? 'neg' : 'pos'}">${fmt(Math.abs(bal), 2)}</div><div class="sub small">${pkg ? 'رصيد الباقة' : bal < 0 ? 'المستحق' : 'رصيدكم'} (${P_CUR[cur] || cur})</div></div>` : ''}
      ${pkg ? `<div class="card p-stat" onclick="parentTab('money')"><div class="p-num">${fmt(pkg.left, 2)}</div><div class="sub small">حصة متبقية من الباقة</div></div>` : ''}
    </div>
    ${lastRep ? `<div class="section-title"><h2>📝 آخر تقرير</h2></div>${pPastCard(lastRep)}` : ''}
    <div class="section-title"><h2>تحتاجون شيئاً؟</h2></div>
    <div class="p-quick">
      <button class="btn btn-ghost" onclick="parentRequestForm({cat:'postpone'})">🗓️ تأجيل أو تغيير موعد</button>
      <button class="btn btn-ghost" onclick="parentRequestForm({cat:'material'})">📎 رسالة للمعلم/ة</button>
      <button class="btn btn-ghost" onclick="parentRequestForm({cat:'level'})">📈 سؤال عن المستوى</button>
      ${pShowFin() ? `<button class="btn btn-ghost" onclick="parentRequestForm({cat:'billing'})">💳 استفسار عن الحساب</button>` : ''}
    </div>
    <p class="sub small mt">جميع المواعيد بتوقيت ${esc(d.family.country || '')}. الطلبات تصل مباشرة لفريق الإشراف ويتم الرد عليكم في أقرب وقت.</p>`;
}

/* ---------- الحصص ---------- */
function pSessions() {
  const d = P.data, seg = `<div class="chips"><button class="chip ${P.sessView === 'up' ? 'active' : ''}" onclick="P.sessView='up'; parentRender()">القادمة</button><button class="chip ${P.sessView === 'past' ? 'active' : ''}" onclick="P.sessView='past'; parentRender()">السابقة والتقارير</button></div>`;
  if (P.sessView === 'past') {
    const past = (d.past || []).filter(pKidOk), byM = {};
    past.forEach(s => (byM[pMonthKey(s.scheduled_at)] ||= []).push(s));
    return `${seg}${pKidChips()}${Object.keys(byM).length ? Object.entries(byM).map(([k, list]) => {
      const done = list.filter(s => s.status === 'done'), mins = done.reduce((a, s) => a + (Number(s.minutes) || 0), 0), abs = done.filter(s => s.report?.attended === false).length;
      return `<h3 class="p-day">${esc(pMonthLbl(k))} <span class="sub small">· ${pUnits(mins)}${abs ? ` · غياب ${abs}` : ''}${list.length - done.length ? ` · ملغاة ${list.length - done.length}` : ''}</span></h3><div class="list">${list.map(pPastCard).join('')}</div>`;
    }).join('') : '<div class="card empty">لا توجد حصص سابقة في آخر 6 أشهر</div>'}`;
  }
  const up = pUpcoming().filter(pKidOk), days = {};
  up.forEach(s => (days[pDayKey(s.scheduled_at, P.tz)] ||= []).push(s));
  return `${seg}${pKidChips()}${Object.keys(days).length ? Object.entries(days).map(([k, list]) => `<h3 class="p-day">${esc(pDayLabel(list[0].scheduled_at))}</h3><div class="list">${list.map(s => pSessCard(s)).join('')}</div>`).join('') : '<div class="card empty">لا توجد حصص مسجلة في الشهر القادم</div>'}
    <p class="sub small mt">المواعيد بتوقيت ${esc(d.family.country || '')}. لطلب تأجيل أو تغيير اضغطوا "🗓️ طلب تغيير" على الحصة.</p>`;
}

/* ---------- الأبناء ---------- */
function pKids() {
  const d = P.data, monthK = pMonthKey(new Date().toISOString());
  return (d.kids || []).map(k => {
    const mine = (d.past || []).filter(s => s.student_id === k.id), doneM = mine.filter(s => s.status === 'done' && pMonthKey(s.scheduled_at) === monthK);
    const withRep = mine.filter(s => s.status === 'done' && s.report), att = withRep.filter(s => s.report.attended !== false).length;
    const next = pUpcoming().find(s => s.student_id === k.id);
    const reps = mine.filter(s => s.report && s.report.attended !== false && (s.report.topics || s.report.homework || s.report.level));
    const open = P.openKid === k.id;
    return `<div class="card item p-kid">
      <div class="item-head"><div><div class="item-title">🎒 ${esc(k.name)}</div><div class="sub small">${esc(k.grade || '')}${k.curriculum && typeof CURRICULA !== 'undefined' ? ' · ' + esc(CURRICULA[k.curriculum] || '') : ''}</div></div></div>
      ${(k.subjects || []).length ? `<div class="p-subj">${k.subjects.map(x => `<div><b>${esc(x.subject || '')}</b><span class="sub small"> · ${esc(x.tutor_name || '')}${x.weekly ? ` · ${x.weekly === 1 ? 'حصة واحدة' : x.weekly === 2 ? 'حصتان' : x.weekly + ' حصص'} أسبوعياً` : ''}</span></div>`).join('')}</div>` : ''}
      <div class="meta mt"><span>هذا الشهر: <b>${pUnits(doneM.reduce((a, s) => a + (Number(s.minutes) || 0), 0))}</b></span>${withRep.length ? `<span>الحضور: <b>${att} من ${withRep.length}</b></span>` : ''}${next ? `<span>القادمة: <b>${esc(pDayLabel(next.scheduled_at))} ${esc(fmtTime(next.scheduled_at, P.tz))}</b></span>` : ''}</div>
      ${reps[0] ? `<div class="p-lastrep mt"><div class="small sub">آخر تقرير · ${esc(reps[0].subject || '')} · ${esc(pDate(reps[0].scheduled_at, { day: 'numeric', month: 'long' }))}</div>${pReportHtml(reps[0].report)}</div>` : ''}
      ${reps.length > 1 ? `<button class="btn btn-ghost sm mt" onclick="P.openKid=${open ? 'null' : jsq(k.id)}; parentRender()">${open ? 'إخفاء التقارير' : `📝 كل التقارير (${reps.length})`}</button>` : ''}
      ${open ? `<div class="list mt">${reps.slice(1).map(pPastCard).join('')}</div>` : ''}
    </div>`;
  }).join('') || '<div class="card empty">لا توجد بيانات</div>';
}

/* ---------- الحساب ---------- */
function pMoneyTab() {
  const d = P.data, f = d.finance, fam = d.family, cur = fam.currency; if (!f) return '';
  const bal = pBalance(), pkg = pPkg();
  const tx = f.transactions || [], done = (d.past || []).filter(s => s.status === 'done');
  const winK = pMonthKey(f.window_start);
  const sign = t => t.type === 'refund' ? -1 : 1;
  const paidIn = tx.filter(t => pMonthKey(t.at) >= winK).reduce((a, t) => a + sign(t) * Number(t.amount), 0);
  const consIn = done.reduce((a, s) => a + (Number(s.charge) || 0), 0);
  let run = bal - paidIn + consIn; // الرصيد في بداية الفترة
  const months = []; const now = new Date();
  for (let i = 5; i >= 0; i--) { const k = pMonthKey(new Date(now.getFullYear(), now.getMonth() - i, 15).toISOString()); months.push(k); }
  const rows = months.map(k => {
    const ss = done.filter(s => pMonthKey(s.scheduled_at) === k), tt = tx.filter(t => pMonthKey(t.at) === k);
    const charge = ss.reduce((a, s) => a + (Number(s.charge) || 0), 0), paid = tt.filter(t => t.type !== 'discount').reduce((a, t) => a + sign(t) * Number(t.amount), 0), disc = tt.filter(t => t.type === 'discount').reduce((a, t) => a + Number(t.amount), 0);
    run = run + paid + disc - charge;
    return { k, mins: ss.filter(s => Number(s.charge) > 0).reduce((a, s) => a + (Number(s.minutes) || 0), 0), charge, paid, disc, end: run, n: ss.length };
  }).filter(r => r.n || r.paid || r.disc).reverse();
  const CYC = { monthly: 'تُحسب الحصص المنفذة في نهاية كل شهر.', weekly: 'تُحسب الحصص المنفذة كل أسبوع.', prepaid: 'نظام الباقة المدفوعة مقدماً — يُخصم من الرصيد بعد كل حصة.' };
  return `<div class="card item p-balance ${bal < 0 ? 'p-owe' : ''}">
      <div class="sub small">${bal < -0.009 ? 'المبلغ المستحق حالياً' : 'رصيدكم الحالي'}</div>
      <div class="p-big ${bal < -0.009 ? 'neg' : 'pos'}">${pMoney(bal, cur)}</div>
      <div class="sub small">${esc(CYC[fam.billing_cycle] || CYC.monthly)} يشمل كل الحصص المنفذة حتى اليوم.</div>
      ${pkg ? `<div class="p-bar mt"><span style="width:${pkg.pct}%"></span></div><div class="small mt">استُخدم <b>${fmt(pkg.used, 2)}</b> من <b>${fmt(pkg.size)}</b> حصة · المتبقي <b>${fmt(pkg.left, 2)}</b>${pkg.left <= 2 ? ' — <span class="warn-txt">الباقة قاربت على الانتهاء</span>' : ''}</div>` : ''}
    </div>
    <div class="section-title"><h2>📊 كشف الحساب الشهري</h2></div>
    <div class="list">${rows.length ? rows.map(r => `<div class="card item">
      <div class="item-head"><div><div class="item-title">${esc(pMonthLbl(r.k))}</div>
        <div class="sub small">${pUnits(r.mins)} · قيمة الحصص ${pMoney(r.charge, cur)}${r.paid ? ` · المدفوع ${pMoney(r.paid, cur)}` : ''}${r.disc ? ` · خصم ${pMoney(r.disc, cur)} 🎁` : ''}</div></div>
        <button class="btn btn-ghost sm" onclick="parentMonthDetail('${r.k}')">التفاصيل</button></div>
      <div class="small mt">الرصيد في نهاية الشهر: <b class="${r.end < -0.009 ? 'neg' : 'pos'}">${r.end < -0.009 ? 'مستحق ' : 'لكم '}${pMoney(r.end, cur)}</b></div></div>`).join('') : '<div class="card empty">لا توجد حركات في آخر 6 أشهر</div>'}</div>
    <div class="section-title"><h2>💵 المدفوعات</h2></div>
    <div class="list">${tx.length ? tx.slice(0, 30).map(t => `<div class="card item"><div class="item-head"><div>
        <div class="item-title">${t.type === 'discount' ? '🎁 خصم' : t.type === 'refund' ? '↩️ استرداد' : '✓ دفعة'} — ${pMoney(t.amount, t.currency || cur)}</div>
        <div class="sub small">${esc(pDate(t.at, { day: 'numeric', month: 'long', year: 'numeric' }))}${t.method && t.type !== 'discount' ? ' · ' + esc(t.method) : ''}</div></div></div></div>`).join('') : '<div class="card empty">لا توجد مدفوعات مسجلة</div>'}</div>
    <p class="sub small mt">إذا لاحظتم أي اختلاف في الحساب، أرسلوا <a href="#" onclick="parentRequestForm({cat:'billing'}); return false">استفساراً</a> وسنراجعه معكم.</p>`;
}
function parentMonthDetail(k) {
  const d = P.data, cur = d.family.currency;
  const ss = (d.past || []).filter(s => pMonthKey(s.scheduled_at) === k).slice().reverse();
  const byKid = {}; ss.filter(s => s.status === 'done').forEach(s => { const x = byKid[s.student_name] ||= { mins: 0, amt: 0 }; if (Number(s.charge) > 0) x.mins += Number(s.minutes) || 0; x.amt += Number(s.charge) || 0; });
  openModal(`حصص ${pMonthLbl(k)}`, `
    <div class="list">${Object.entries(byKid).map(([n, x]) => `<div class="card item"><b>${esc(n)}</b>: ${pUnits(x.mins)} = ${pMoney(x.amt, cur)}</div>`).join('')}</div>
    <table class="rep-table mt"><thead><tr><th>التاريخ</th><th>الطالب</th><th>المادة</th><th>المدة</th><th>القيمة</th></tr></thead><tbody>
    ${ss.map(s => `<tr${s.status !== 'done' ? ' class="sub"' : ''}><td>${esc(pDate(s.scheduled_at, { day: 'numeric', month: 'numeric' }))}</td><td>${esc(s.student_name)}</td><td>${esc(s.subject || '')}</td>
      <td>${s.status === 'done' ? pDur(s.minutes) : 'ملغاة'}</td><td>${s.status !== 'done' ? '—' : Number(s.charge) > 0 ? fmt(s.charge, 2) : (s.kind === 'trial' ? 'مجانية' : '—')}</td></tr>`).join('')}
    </tbody></table><p class="sub small mt">القيم بـ${P_CUR[cur] || cur}. الحصة = ساعة، ونصف الساعة = نصف حصة.</p>`);
}

/* ---------- الطلبات ---------- */
function pRequests() {
  const rs = P.data.requests || [];
  return `<div class="card item"><div class="item-head"><div><b>✉️ أرسلوا طلباً للإشراف</b><div class="sub small">تأجيل حصة، رسالة أو مواد للمعلم/ة، سؤال عن المستوى أو الحساب.</div></div>
    <button class="btn btn-brand sm" onclick="parentRequestForm({})">+ طلب جديد</button></div></div>
    <div class="section-title"><h2>طلباتكم</h2></div>
    <div class="list">${rs.length ? rs.map(r => `<div class="card item"><div class="item-head"><div>
        <div class="item-title">${esc(P_DB_LBL[r.category] || '💬 طلب')}${r.student_name ? ' · ' + esc(r.student_name) : ''}</div>
        <div class="sub small">${esc(pDate(r.at, { day: 'numeric', month: 'long' }))} · ${esc(fmtTime(r.at, P.tz))}</div></div>
        <span class="badge ${r.status === 'done' ? 'b-done' : 'b-pending'}">${r.status === 'done' ? 'تم ✓' : 'قيد المتابعة'}</span></div>
      <div class="small mt" style="white-space:pre-wrap">${esc(r.text)}</div></div>`).join('') : '<div class="card empty">لا توجد طلبات سابقة</div>'}</div>`;
}
function parentRequestForm(o = {}) {
  const d = P.data, kids = d.kids || [], ses = o.session ? (d.upcoming || []).find(s => s.id === o.session) : null;
  const kid = ses?.student_id || (P.kid !== 'all' ? P.kid : kids[0]?.id);
  const upOpts = k => pUpcoming().filter(s => s.student_id === k).slice(0, 25).map(s => `<option value="${s.id}" ${ses && s.id === ses.id ? 'selected' : ''}>${esc(pDayLabel(s.scheduled_at))} ${esc(fmtTime(s.scheduled_at, P.tz))} — ${esc(s.subject || '')}</option>`).join('');
  window._pUpOpts = upOpts;
  openModal('طلب جديد للإشراف', `
    <div class="field"><label>نوع الطلب</label><select id="pr-cat" class="input" onchange="document.getElementById('pr-sesswrap').classList.toggle('hidden', !['postpone','cancel'].includes(this.value))">
      ${Object.entries(P_CAT).filter(([k]) => k !== 'billing' || pShowFin()).map(([k, l]) => `<option value="${k}" ${o.cat === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    ${kids.length > 1 ? `<div class="field"><label>الطالب</label><select id="pr-kid" class="input" onchange="document.getElementById('pr-sess').innerHTML='<option value=\\'\\'>— بدون تحديد —</option>'+window._pUpOpts(this.value)">${kids.map(k => `<option value="${k.id}" ${k.id === kid ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select></div>` : `<input type="hidden" id="pr-kid" value="${kid || ''}">`}
    <div class="field ${['postpone', 'cancel'].includes(o.cat) ? '' : 'hidden'}" id="pr-sesswrap"><label>الحصة</label><select id="pr-sess" class="input"><option value="">— بدون تحديد —</option>${upOpts(kid)}</select></div>
    <div class="field"><label>التفاصيل</label><textarea id="pr-text" class="input" rows="4" placeholder="${o.cat === 'postpone' ? 'مثال: نرجو تأجيل الحصة إلى يوم الأحد بعد العصر' : o.cat === 'material' ? 'اكتبوا الرسالة، ويمكنكم إضافة رابط لملف (Google Drive مثلاً)' : 'اكتبوا طلبكم هنا'}"></textarea></div>
    <div class="modal-foot"><button class="btn btn-brand" id="pr-send" onclick="parentSendRequest()">إرسال</button><button class="btn btn-ghost" onclick="closeModal()">إلغاء</button></div>`);
}
async function parentSendRequest() {
  const cat = document.getElementById('pr-cat').value, text = document.getElementById('pr-text').value.trim();
  if (!text) return showToast('اكتبوا تفاصيل الطلب', true);
  const sess = ['postpone', 'cancel'].includes(cat) ? document.getElementById('pr-sess').value || null : null;
  const prefix = { postpone: '[طلب تأجيل / تغيير موعد]', cancel: '[طلب إلغاء حصة]', billing: '[استفسار عن الحساب]' }[cat];
  const b = document.getElementById('pr-send'); b.disabled = true;
  try {
    const { data, error } = await sb.rpc('parent_request', { p_token: P.token, p_student: document.getElementById('pr-kid').value || null, p_session: sess, p_category: P_CAT_DB[cat], p_text: (prefix ? prefix + '\n' : '') + text });
    if (error) throw error; if (!data) throw new Error('تعذر الإرسال');
    sb.functions.invoke('parent-notify', { body: { token: P.token, id: data } }).catch(() => {});
    closeModal(); showToast('تم إرسال طلبكم ✓ — سيتواصل معكم الإشراف');
    P.tab = 'req'; await parentRefresh();
  } catch (e) { b.disabled = false; showToast(e.message || String(e), true); }
}

async function parentAck(sid, via = 'portal', silent = false) {
  try {
    const { data, error } = await sb.rpc('parent_ack', { p_token: P.token, p_session: sid, p_via: via });
    if (error) throw error;
    const s = (P.data?.upcoming || []).find(x => x.id === sid); if (s && data) s.acked = true;
    if (!silent) showToast('تم ✓ — شكراً لكم');
    parentRender();
  } catch (e) { if (!silent) showToast('تعذر التأكيد: ' + (e.message || e), true); }
}

async function parentAlertsPanel() {
  const on = await parentAlertIcon();
  let body;
  if (isIOS && !isStandalone()) body = `<p><b>على الآيفون تعمل التنبيهات فقط بعد إضافة البوابة إلى الشاشة الرئيسية:</b></p>
    <ol class="steps"><li>افتحوا هذا الرابط في <b>Safari</b>.</li><li>اضغطوا زر المشاركة <b>⬆︎</b> في الأسفل.</li><li>اختاروا <b>"إضافة إلى الشاشة الرئيسية"</b>.</li><li>افتحوا البوابة من الأيقونة الجديدة، ثم اضغطوا 🔕 في الأعلى وفعّلوا التنبيهات.</li></ol>`;
  else if (!pushSupported()) body = '<p>هذا المتصفح لا يدعم التنبيهات. استخدموا Chrome على أندرويد، أو Safari على الآيفون بعد الإضافة إلى الشاشة الرئيسية.</p>';
  else if (Notification.permission === 'denied') body = '<p class="neg">التنبيهات مقفلة من إعدادات الجوال. فعّلوها لهذا الموقع من الإعدادات ثم حدّثوا الصفحة.</p>';
  else if (on) body = `<p class="pos"><b>✓ التنبيهات تعمل على هذا الجوال.</b></p>
    <p class="sub">سيصلكم تذكير قبل الحصة بساعة، ثم قبلها بربع ساعة. وإذا لم تضغطوا "✅ تم" سيتكرر التذكير كل بضع دقائق حتى تؤكدوا.</p>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="parentTestPush()">تنبيه تجريبي</button><button class="btn btn-ghost" onclick="parentDisablePush()">إيقاف</button></div>`;
  else body = `<p>فعّلوا التنبيهات ليصلكم <b>تذكير قبل كل حصة</b> حتى والجوال مقفل.</p>
    <div class="modal-foot"><button class="btn btn-brand" id="push-enable" onclick="parentEnablePush()">🔔 تفعيل التنبيهات</button></div>`;
  openModal('تنبيهات الحصص', body);
}
async function parentEnablePush() {
  const btn = document.getElementById('push-enable'); if (btn) btn.disabled = true;
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { showToast('يجب السماح بالتنبيهات', true); return parentAlertsPanel(); }
    const reg = swReg || await registerSW(); await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToUint8(VAPID_PUBLIC) });
    const j = sub.toJSON();
    const { data, error } = await sb.rpc('parent_push_save', { p_token: P.token, p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: navigator.userAgent });
    if (error) throw error; if (!data) throw new Error('الرابط لا يعمل');
    showToast('تم تفعيل التنبيهات ✓');
    await parentTestPush(true);
  } catch (e) { showToast('تعذر التفعيل: ' + (e.message || e), true); }
  finally { await parentAlertIcon(); parentRender(); parentAlertsPanel(); }
}
async function parentDisablePush() {
  try { const sub = await currentPushSub(); if (sub) { await sb.rpc('parent_push_remove', { p_token: P.token, p_endpoint: sub.endpoint }); await sub.unsubscribe(); } showToast('تم الإيقاف'); }
  catch (e) { showToast(e.message || String(e), true); }
  await parentAlertIcon(); parentRender(); parentAlertsPanel();
}
async function parentTestPush(quiet) {
  try { const { data, error } = await sb.functions.invoke('session-alerts', { body: { action: 'parent_test', token: P.token } }); if (error) throw error;
    if (!quiet || !data.sent) showToast(data.sent ? 'تم إرسال تنبيه تجريبي ✓' : 'لا يوجد جوال مفعّل', !data.sent); } catch (e) { showToast('فشل: ' + (e.message || e), true); }
}
function parentExit() {
  if (!confirm('الخروج من البوابة على هذا الجوال؟')) return;
  try { localStorage.removeItem('ostaz_parent_token'); } catch (e) {}
  location.href = location.pathname;
}
