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
  const tabs = [['home', '🏠', 'الرئيسية'], ['sess', '📅', 'الحصص'], ['kids', '🏆', 'الأبناء'], ...(pShowFin() ? [['money', '💳', 'الحساب']] : []), ['req', '✉️', 'الطلبات']];
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
  return `${r.topics ? `<div class="small mt">📚 <b>تم شرح:</b> ${esc(r.topics)}</div>` : ''}${r.homework ? `<div class="small">✏️ <b>الواجب:</b> ${esc(r.homework)}</div>` : ''}${r.level ? `<div class="small">⭐ <b>المشاركة:</b> ${esc(P_LEVEL[r.level] || r.level)}</div>` : ''}${r.hw_done && P_HW[r.hw_done] ? `<div class="small">${P_HW[r.hw_done]}</div>` : ''}`;
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
    ${(d.kids || []).map(k => pGameCard(k, true)).filter(Boolean).length ? `<div class="g-strip">${(d.kids || []).map(k => pGameCard(k, true)).join('')}</div>` : ''}
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
      ${pGameCard(k)}
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

/* ============================================================
   🏆 الإنجازات: مستوى ونقاط، سلسلة حضور، نجوم الواجب، شارات، وشهادة شهرية
   كل طالب بينافس نفسه بس — مفيش ترتيب بين الطلبة، ومحدش بيشوف غير ولاده.
   ============================================================ */
const P_LEVEL = { excellent: 'ممتاز 🌟', good: 'جيد 👍', needs: 'يحتاج متابعة' };
const P_HW = { done: '✅ أنجز الواجب السابق', partial: '🟡 أنجز جزءاً من الواجب', not: '❌ لم يُنجز الواجب السابق' };
const G_LEVELS = [[0, 'مبتدئ', '🌱'], [100, 'مجتهد', '📘'], [300, 'متميز', '⭐'], [600, 'نجم', '🌟'], [1000, 'بطل', '🏆'], [1600, 'أسطورة', '👑'], [2500, 'عبقري', '💎']];
const G_BADGES = [
  { id: 's1', icon: '🌱', name: 'أول خطوة', desc: 'أول حصة مع الأكاديمية', test: g => g.units >= 0.5 },
  { id: 's10', icon: '🔟', name: '10 حصص', desc: 'أكمل 10 حصص', test: g => g.units >= 10, prog: g => [g.units, 10] },
  { id: 's25', icon: '🥉', name: '25 حصة', desc: 'أكمل 25 حصة', test: g => g.units >= 25, prog: g => [g.units, 25] },
  { id: 's50', icon: '🥈', name: '50 حصة', desc: 'أكمل 50 حصة', test: g => g.units >= 50, prog: g => [g.units, 50] },
  { id: 's100', icon: '🥇', name: '100 حصة', desc: 'أكمل 100 حصة', test: g => g.units >= 100, prog: g => [g.units, 100] },
  { id: 's200', icon: '💎', name: '200 حصة', desc: 'أكمل 200 حصة', test: g => g.units >= 200, prog: g => [g.units, 200] },
  { id: 'k5', icon: '🔥', name: 'التزام', desc: '5 حصص متتالية بدون غياب', test: g => g.streak >= 5, prog: g => [g.streak, 5] },
  { id: 'k10', icon: '⚡', name: 'بلا توقف', desc: '10 حصص متتالية بدون غياب', test: g => g.streak >= 10, prog: g => [g.streak, 10] },
  { id: 'k25', icon: '🚀', name: 'صاروخ', desc: '25 حصة متتالية بدون غياب', test: g => g.streak >= 25, prog: g => [g.streak, 25] },
  { id: 'h5', icon: '✏️', name: 'بطل الواجبات', desc: 'أنجز 5 واجبات', test: g => g.stars >= 5, prog: g => [g.stars, 5] },
  { id: 'h20', icon: '📒', name: 'الواجب دائماً جاهز', desc: 'أنجز 20 واجباً', test: g => g.stars >= 20, prog: g => [g.stars, 20] },
  { id: 'm1', icon: '📅', name: 'شهر ذهبي', desc: 'شهر كامل (6 حصص أو أكثر) بدون أي غياب', test: g => g.goldMonths >= 1 },
  { id: 'sub', icon: '🎯', name: 'تركيز', desc: '15 حصة في مادة واحدة', test: g => g.topSubj >= 15, prog: g => [g.topSubj, 15] },
];
function pGame(kidId, until) {
  const H = (P.data.history || []).filter(h => h[1] === kidId && (!until || h[0] < until));
  const g = { units: 0, n: 0, streak: 0, best: 0, stars: 0, xp: 0, subj: {}, months: {}, goldMonths: 0, topSubj: 0, earned: {} };
  const curK = pMonthKey(new Date().toISOString());
  for (const [at, , subj, min, att, hw] of H) {
    const u = (Number(min) || 60) / 60, mk = pMonthKey(at), m = g.months[mk] ||= { units: 0, n: 0, abs: 0, stars: 0 };
    if (att === false) { g.streak = 0; m.abs++; m.n++; continue; }
    g.units += u; g.n++; g.streak++; g.best = Math.max(g.best, g.streak); m.units += u; m.n++;
    g.subj[subj || 'حصة'] = (g.subj[subj || 'حصة'] || 0) + u;
    const st = hw === 'done' ? 1 : hw === 'partial' ? 0.5 : 0; g.stars += st; m.stars += st;
    g.xp += Math.round(u * 10) + st * 5;
    g.topSubj = Math.max(...Object.values(g.subj));
    g.goldMonths = Object.entries(g.months).filter(([k, x]) => k < curK && x.n >= 6 && !x.abs).length;
    for (const b of G_BADGES) if (!g.earned[b.id] && b.test(g)) { g.earned[b.id] = at; g.xp += 20; }
  }
  g.units = Math.round(g.units * 100) / 100;
  let li = 0; G_LEVELS.forEach((L, i) => { if (g.xp >= L[0]) li = i; });
  g.level = { i: li, name: G_LEVELS[li][1], icon: G_LEVELS[li][2], from: G_LEVELS[li][0], to: G_LEVELS[li + 1]?.[0] || null };
  return g;
}
function pGameCard(k, compact) {
  const g = pGame(k.id); if (!g.n && !Object.keys(g.months).length) return '';
  const L = g.level, pct = L.to ? Math.min(100, Math.round((g.xp - L.from) / (L.to - L.from) * 100)) : 100;
  const earned = G_BADGES.filter(b => g.earned[b.id]), next = G_BADGES.filter(b => !g.earned[b.id] && b.prog).map(b => ({ b, p: b.prog(g) })).sort((a, b) => b.p[0] / b.p[1] - a.p[0] / a.p[1]).slice(0, 2);
  if (compact) return `<div class="g-mini" onclick="parentTab('kids')"><span class="g-lv">${L.icon} ${esc(L.name)}</span> <b>${esc(k.name)}</b>${g.streak >= 2 ? ` <span class="g-fire">🔥 ${g.streak}</span>` : ''}${g.stars ? ` <span>⭐ ${fmt(g.stars, 1)}</span>` : ''} <span class="sub small">· ${earned.length} شارة</span></div>`;
  return `<div class="g-card">
    <div class="g-top"><div class="g-level"><div class="g-lvicon">${L.icon}</div><div><div class="small sub">المستوى ${L.i + 1}</div><b>${esc(L.name)}</b></div></div>
      <div class="g-pills"><span class="g-pill" title="سلسلة الحضور">🔥 ${g.streak}<small>متتالية</small></span><span class="g-pill" title="نجوم الواجب">⭐ ${fmt(g.stars, 1)}<small>واجب</small></span><span class="g-pill">🏅 ${earned.length}<small>شارة</small></span></div></div>
    <div class="p-bar mt"><span style="width:${pct}%"></span></div>
    <div class="small sub mt">${fmt(g.xp)} نقطة${L.to ? ` · باقي ${fmt(L.to - g.xp)} للوصول إلى «${esc(G_LEVELS[L.i + 1][1])}» ${G_LEVELS[L.i + 1][2]}` : ' · أعلى مستوى 👏'}${g.best > g.streak && g.best >= 5 ? ` · أفضل سلسلة: ${g.best}` : ''}</div>
    ${earned.length ? `<div class="g-badges mt">${earned.map(b => `<div class="g-badge" title="${esc(b.desc)}"><span>${b.icon}</span><small>${esc(b.name)}</small></div>`).join('')}</div>` : ''}
    ${next.length ? `<div class="mt">${next.map(({ b, p }) => `<div class="g-next"><span>${b.icon}</span><div style="flex:1"><div class="small"><b>${esc(b.name)}</b> <span class="sub">— ${esc(b.desc)}</span></div><div class="p-bar thin"><span style="width:${Math.round(Math.min(1, p[0] / p[1]) * 100)}%"></span></div></div><small class="sub">${fmt(Math.min(p[0], p[1]), 1)}/${p[1]}</small></div>`).join('')}</div>` : ''}
    <button class="btn btn-brand sm mt" onclick="parentCertificate(${jsq(k.id)})">📜 شهادة الشهر</button>
  </div>`;
}

/* ---------- الشهادة الشهرية (صورة يقدر ولي الأمر يحفظها أو يشاركها) ---------- */
function pCertMonths(kidId) {
  const ms = {}; (P.data.history || []).filter(h => h[1] === kidId && h[4] !== false).forEach(h => { const k = pMonthKey(h[0]); ms[k] = (ms[k] || 0) + (Number(h[3]) || 60) / 60; });
  return Object.entries(ms).filter(([, u]) => u >= 1).map(([k]) => k).sort().reverse().slice(0, 4);
}
async function parentCertificate(kidId, month) {
  const k = (P.data.kids || []).find(x => x.id === kidId); if (!k) return;
  const months = pCertMonths(kidId);
  if (!months.length) return showToast('لا توجد حصص كافية لإصدار شهادة بعد', true);
  const curK = pMonthKey(new Date().toISOString());
  if (!month) month = months[0] === curK && months[1] && new Date().getDate() <= 10 ? months[1] : months[0];
  openModal(`📜 شهادة ${k.name}`, `<div class="chips">${months.map(m => `<button class="chip ${m === month ? 'active' : ''}" onclick="parentCertificate(${jsq(kidId)}, '${m}')">${esc(pMonthLbl(m))}${m === curK ? ' (حتى الآن)' : ''}</button>`).join('')}</div>
    <div class="g-certwrap"><canvas id="g-cert" width="1080" height="1350"></canvas></div>
    <div class="modal-foot"><button class="btn btn-brand" onclick="parentCertShare(${jsq(k.name)}, '${month}')">📤 حفظ / مشاركة</button><button class="btn btn-ghost" onclick="closeModal()">إغلاق</button></div>`);
  await pDrawCert(document.getElementById('g-cert'), k, month);
}
async function pDrawCert(cv, k, month) {
  try { await Promise.race([Promise.all([document.fonts.load('800 80px Cairo'), document.fonts.load('600 40px Cairo')]), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
  const F = (w, s) => `${w} ${s}px Cairo, Tahoma, Arial, sans-serif`;
  const x = cv.getContext('2d'), W = cv.width, H = cv.height, cx = W / 2;
  const [y, mo] = month.split('-').map(Number), endIso = new Date(Date.UTC(y, mo, 1)).toISOString();
  const all = pGame(k.id, endIso), before = pGame(k.id, new Date(Date.UTC(y, mo - 1, 1)).toISOString());
  const M = all.months[month] || { units: 0, n: 0, abs: 0, stars: 0 };
  const subs = {}; (P.data.history || []).filter(h => h[1] === k.id && pMonthKey(h[0]) === month && h[4] !== false).forEach(h => { subs[h[2] || 'حصة'] = (subs[h[2] || 'حصة'] || 0) + (Number(h[3]) || 60) / 60; });
  const newBadges = G_BADGES.filter(b => all.earned[b.id] && !before.earned[b.id]);
  // الخلفية والإطار
  const bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#FFFDF7'); bg.addColorStop(1, '#F3F7FF');
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#16325C'; x.lineWidth = 14; x.strokeRect(36, 36, W - 72, H - 72);
  x.strokeStyle = '#F28C28'; x.lineWidth = 4; x.strokeRect(64, 64, W - 128, H - 128);
  for (const [px, py] of [[64, 64], [W - 64, 64], [64, H - 64], [W - 64, H - 64]]) { x.fillStyle = '#F28C28'; x.beginPath(); x.arc(px, py, 14, 0, 7); x.fill(); }
  x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  // اللوجو
  await new Promise(res => { const im = new Image(); im.onload = () => { x.save(); x.beginPath(); x.arc(cx, 205, 95, 0, 7); x.fillStyle = '#fff'; x.fill(); x.clip(); x.drawImage(im, cx - 85, 120, 170, 170); x.restore(); res(); }; im.onerror = res; im.src = 'logo.png'; });
  x.fillStyle = '#16325C'; x.font = F(700, 34); x.fillText('أكاديمية أستاذ أونلاين', cx, 345);
  x.fillStyle = '#C9671A'; x.font = F(800, 92); x.fillText('شهادة إنجاز', cx, 470);
  x.fillStyle = '#4A5568'; x.font = F(600, 36); x.fillText(`تُمنح بكل فخر إلى`, cx, 545);
  x.fillStyle = '#142238'; x.font = F(800, 104); x.fillText(k.name, cx, 670);
  x.strokeStyle = '#F28C28'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx - 240, 700); x.lineTo(cx + 240, 700); x.stroke();
  x.fillStyle = '#4A5568'; x.font = F(600, 36);
  const isCur = month === pMonthKey(new Date().toISOString());
  x.fillText(`تقديراً للاجتهاد والالتزام في شهر ${pMonthLbl(month)}${isCur ? ' (حتى الآن)' : ''}`, cx, 765);
  // الأرقام
  const att = M.n ? Math.round((M.n - M.abs) / M.n * 100) : 0;
  const stats = [[fmt(Math.round(M.units * 10) / 10, 1), 'حصة'], [att + '%', 'حضور'], ...(M.stars ? [[fmt(M.stars, 1), 'واجب ⭐']] : [[all.streak, 'سلسلة 🔥']])];
  const bw = 250, gap = 30, sx = cx + (stats.length * bw + (stats.length - 1) * gap) / 2 - bw / 2;
  stats.forEach(([v, l], i) => { const bx = sx - i * (bw + gap);
    x.fillStyle = '#EEF2F8'; pRound(x, bx - bw / 2, 820, bw, 170, 26); x.fill();
    x.fillStyle = '#16325C'; x.font = F(800, 68); x.fillText(String(v), bx, 915); x.fillStyle = '#4A5568'; x.font = F(600, 30); x.fillText(l, bx, 962); });
  x.fillStyle = '#142238'; x.font = F(600, 32);
  const sl = Object.entries(subs).sort((a, b) => b[1] - a[1]).map(([s]) => s).slice(0, 5).join(' · ');
  if (sl) x.fillText('المواد: ' + sl, cx, 1055);
  x.font = F(600, 30);
  x.fillText(newBadges.length ? 'شارات جديدة: ' + newBadges.map(b => b.icon + ' ' + b.name).slice(0, 3).join('   ') : `${all.level.icon} المستوى ${all.level.i + 1}: ${all.level.name}`, cx, 1115);
  x.fillStyle = '#6A7179'; x.font = F(600, 28); x.fillText('فريق الإشراف — أكاديمية أستاذ أونلاين', cx, 1225);
  x.fillStyle = '#16325C'; x.font = F(700, 30); x.fillText('عمل رائع.. نفخر بك 🌟', cx, 1270);
}
function pRound(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
async function parentCertShare(name, month) {
  const cv = document.getElementById('g-cert'); if (!cv) return;
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const file = new File([blob], `شهادة-${name}-${month}.png`, { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) return await navigator.share({ files: [file], title: `شهادة ${name}` }); } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  showToast('تم حفظ الشهادة ✓');
}
