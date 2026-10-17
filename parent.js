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

function parentRender() {
  const el = document.getElementById('parent-content'); if (!P.data) return;
  const d = P.data, now = Date.now();
  const up = (d.upcoming || []).filter(s => new Date(s.scheduled_at).getTime() + (s.duration_minutes || 60) * 60e3 > now);
  const days = {}; up.forEach(s => (days[pDayKey(s.scheduled_at, P.tz)] ||= []).push(s));
  const banner = P.pushOn ? '' : `<div class="card item p-banner"><div class="item-head"><div><b>🔔 فعّلوا التنبيهات</b><div class="sub small">ليصلكم تذكير قبل كل حصة حتى والجوال مقفل.</div></div>
    <button class="btn btn-brand sm" onclick="parentAlertsPanel()">تفعيل</button></div></div>`;
  const card = s => {
    const t = new Date(s.scheduled_at).getTime(), mins = Math.round((t - now) / 60e3), live = now >= t - 15 * 60e3 && now < t + (s.duration_minutes || 60) * 60e3;
    const soon = mins > 0 && mins <= 60, id = jsq(s.id);
    const link = s.meeting_link ? (/^https?:\/\//i.test(s.meeting_link) ? s.meeting_link : 'https://' + s.meeting_link) : null;
    return `<div class="card item p-sess${live ? ' s-now' : soon ? ' p-soon' : ''}">
      <div class="item-head"><div>
        <div class="item-title">${esc(s.student_name)}${s.subject ? ' · ' + esc(s.subject) : ''}${s.kind === 'trial' ? ' <span class="badge b-trial">تجريبية</span>' : s.kind === 'revision' ? ' <span class="badge b-rev">مراجعة</span>' : ''}</div>
        <div class="sub small">مع ${esc(s.tutor_name || 'المعلم/ة')} · ${pDur(s.duration_minutes)}${s.group_name ? ' · 👥 ' + esc(s.group_name) : ''}</div></div>
        <div class="p-time">${esc(fmtTime(s.scheduled_at, P.tz))}${live ? '<div class="small pos">الآن</div>' : soon ? `<div class="small warn-txt">بعد ${mins} د</div>` : ''}</div></div>
      <div class="actions">
        ${link && live ? `<a class="btn btn-brand sm" href="${esc(link)}" target="_blank" rel="noopener" onclick="parentAck(${id}, 'join', true)">🎥 ادخلوا الحصة</a>` : ''}
        ${s.acked ? '<span class="pos small">✓ تم التأكيد</span>' : (t - now < 26 * 3600e3 ? `<button class="btn ${live || soon ? 'btn-brand' : 'btn-ghost'} sm" onclick="parentAck(${id})">✅ تم، سنحضر</button>` : '')}
      </div></div>`;
  };
  const past = (d.past || []).slice(0, 20);
  el.innerHTML = `${banner}
    <div class="section-title"><h2>📅 الحصص القادمة</h2></div>
    ${Object.keys(days).length ? Object.entries(days).map(([k, list]) => `<h3 class="p-day">${esc(pDayLabel(list[0].scheduled_at))}</h3><div class="list">${list.map(card).join('')}</div>`).join('') : '<div class="card empty">لا توجد حصص مسجلة في الأسبوعين القادمين</div>'}
    <p class="sub small mt">المواعيد بتوقيت ${esc(d.family.country || '')}. لأي تغيير في المواعيد تواصلوا مع الإشراف على مجموعة الواتساب.</p>
    ${past.length ? `<div class="section-title"><h2>📝 الحصص السابقة</h2></div><div class="list">${past.map(s => `<div class="card item">
      <div class="item-head"><div><div class="item-title">${esc(s.student_name)}${s.subject ? ' · ' + esc(s.subject) : ''}</div>
        <div class="sub small">${esc(new Date(s.scheduled_at).toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', timeZone: P.tz }))} · مع ${esc(s.tutor_name || '')} · ${pDur(s.minutes)}</div></div>
        ${s.report ? (s.report.attended === false ? '<span class="badge b-cancel">غياب</span>' : '<span class="badge b-done">تقرير ✓</span>') : ''}</div>
      ${s.report && s.report.attended !== false ? `${s.report.topics ? `<div class="small mt">📚 <b>تم شرح:</b> ${esc(s.report.topics)}</div>` : ''}${s.report.homework ? `<div class="small">✏️ <b>الواجب:</b> ${esc(s.report.homework)}</div>` : ''}${s.report.level ? `<div class="small">⭐ <b>المستوى:</b> ${esc(s.report.level)}</div>` : ''}` : ''}
    </div>`).join('')}</div>` : ''}`;
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
