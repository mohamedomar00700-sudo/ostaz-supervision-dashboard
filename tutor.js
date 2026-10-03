/* ============================================================
   بوابة المعلمات — جدولي وطلابي وحسابي
   (بيانات المعلمة بس، من غير أي بيانات أو أرقام للأسر)
   ============================================================ */
const T = { me: null, tab: 'today', sessions: [], week: [], students: [], payouts: [], month: 0, monthRows: [] };

async function enterTutor(me) {
  T.me = me;
  if (location.search || location.hash) history.replaceState(null, '', location.pathname);
  ['auth', 'pending', 'app'].forEach(v => document.getElementById('view-' + v).classList.add('hidden'));
  document.getElementById('view-tutor').classList.remove('hidden');
  document.getElementById('tutor-name').textContent = me.name;
  await registerSW();
  await tutorRefresh();
  tutorAlertIcon();
  if (!window._ttick) window._ttick = setInterval(() => { if (!document.hidden && T.tab === 'today') tutorRender(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && T.me) tutorRefresh(); });
  let asked = false; try { asked = localStorage.getItem('ostaz_tpush_asked') === '1'; } catch (e) {}
  if (!asked && !(await currentPushSub().catch(() => null))) { try { localStorage.setItem('ostaz_tpush_asked', '1'); } catch (e) {} tutorAlertsPanel(); }
}
const tMonthRange = k => { const n = new Date(); return { from: new Date(n.getFullYear(), n.getMonth() + k, 1), to: new Date(n.getFullYear(), n.getMonth() + k + 1, 1) }; };
/* ----- معاينة البوابة من حساب الإشراف (نفس اللي المعلمة بتشوفه) ----- */
function tutorPreview(tid) {
  const t = byId(state.tutors, tid); if (!t) return;
  closeModal();
  T.preview = tid; T.tab = 'today'; T.month = 0;
  T.me = { id: t.id, name: t.name, rate: t.default_rate_egp, pay: t.bank_account || t.vodafone_cash };
  document.getElementById('view-app').classList.add('hidden');
  document.getElementById('view-tutor').classList.remove('hidden');
  document.getElementById('tutor-name').textContent = t.name;
  document.getElementById('tutor-preview-bar').classList.remove('hidden');
  document.querySelectorAll('#tutor-tabs .tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'today'));
  window.scrollTo(0, 0);
  tutorRefresh();
}
function tutorPreviewExit() {
  T.preview = null; T.me = null;
  document.getElementById('tutor-preview-bar').classList.add('hidden');
  document.getElementById('view-tutor').classList.add('hidden');
  document.getElementById('view-app').classList.remove('hidden');
  switchTab('tutors');
}
async function tutorPreviewRows(from, to) { // نفس شكل tutor_sessions بس من صلاحيات المشرف
  const rows = await q(sb.from('sessions').select('*').eq('tutor_id', T.preview).gte('scheduled_at', from.toISOString()).lt('scheduled_at', to.toISOString()).order('scheduled_at'));
  return rows.map(s => { const st = byId(state.students, s.student_id) || {};
    const pl = state.plans.find(p => p.student_id === s.student_id && p.tutor_id === s.tutor_id && p.meeting_link);
    return { ...s, student_name: st.name, grade: st.grade_level, en: !!st.curriculum && st.curriculum !== 'arabic', meeting_link: s.meeting_link || pl?.meeting_link || null }; });
}
async function tutorRefresh() {
  if (T.preview) {
    try {
      const now = new Date(); const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const mr = tMonthRange(T.month);
      const [w, m, po] = await Promise.all([tutorPreviewRows(new Date(from.getTime() - 864e5), new Date(from.getTime() + 8 * 864e5)), tutorPreviewRows(mr.from, mr.to),
        q(sb.from('tutor_payouts').select('*').eq('tutor_id', T.preview).eq('paid', true).order('paid_at', { ascending: false }))]);
      T.week = w; T.monthRows = m;
      try { const rq = await q(sb.from('tutor_requests').select('*').eq('tutor_id', T.preview).order('created_at', { ascending: false }).limit(20));
        T.requests = rq.map(r => ({ ...r, student_name: byId(state.students, r.student_id)?.name, session_at: (w.concat(m).find(x => x.id === r.session_id) || {}).scheduled_at })); } catch (e) { T.requests = []; }
      T.payouts = po.map(p => ({ ...p, paid_at: p.paid_at || p.created_at }));
      T.students = state.plans.filter(p => p.tutor_id === T.preview).map(p => { const st = byId(state.students, p.student_id) || {};
        return { student_id: p.student_id, student_name: st.name, grade: st.grade_level, en: !!st.curriculum && st.curriculum !== 'arabic', subject: p.subject, meeting_link: p.meeting_link, rate: p.tutor_rate_egp ?? byId(state.tutors, T.preview)?.default_rate_egp, weekly: p.weekly_sessions }; })
        .sort((a, b) => (a.student_name || '').localeCompare(b.student_name || '', 'ar'));
      tutorRender();
    } catch (e) { showToast(dbError(e), true); }
    return;
  }
  try {
    const now = new Date(); const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const to = new Date(from.getTime() + 8 * 864e5);
    const mr = tMonthRange(T.month);
    const rq = await sb.rpc('tutor_requests_mine'); T.requests = rq.data || [];
    const [a, b, c, d] = await Promise.all([
      sb.rpc('tutor_sessions', { p_from: new Date(from.getTime() - 864e5).toISOString(), p_to: to.toISOString() }),
      sb.rpc('tutor_students'), sb.rpc('tutor_payout_list'),
      sb.rpc('tutor_sessions', { p_from: mr.from.toISOString(), p_to: mr.to.toISOString() }),
    ]);
    for (const r of [a, b, c, d]) if (r.error) throw r.error;
    const enfix = r => { const en = / · EN$/.test(r.grade || ''); return { ...r, en, grade: (r.grade || '').replace(/ · EN$/, '') }; };
    T.week = a.data.map(enfix); T.students = b.data.map(enfix); T.payouts = c.data; T.monthRows = d.data.map(enfix);
    tutorRender();
  } catch (e) { showToast(dbError(e), true); }
}
function tutorTab(t) { T.tab = t; document.querySelectorAll('#tutor-tabs .tab').forEach(b => b.classList.toggle('active', b.dataset.tab === t)); tutorRender(); }
async function tutorMonth(k) { T.month = k; await tutorRefresh(); }

// يدمج صفوف المجموعة في حصة واحدة
function tOcc(rows) {
  const out = [], idx = {};
  rows.forEach(r => { if (!r.group_key) return out.push({ ...r, names: [r.student_name] });
    if (idx[r.group_key]) { idx[r.group_key].names.push(r.student_name); idx[r.group_key].rows.push(r); return; }
    out.push(idx[r.group_key] = { ...r, names: [r.student_name], rows: [r] }); });
  return out;
}
const tMins = s => Number(s.actual_minutes || s.duration_minutes || 60);
const tCancelled = s => String(s.status).startsWith('cancelled');
const tTime = iso => fmtTime(iso, CAIRO_TZ);
const tEnd = s => new Date(new Date(s.scheduled_at).getTime() + (s.duration_minutes || 60) * 60e3).toISOString();

function tutorSessionCard(s, compact) {
  const start = new Date(s.scheduled_at).getTime(), end = start + (s.duration_minutes || 60) * 60e3, now = Date.now();
  const live = !tCancelled(s) && s.status !== 'done' && now >= start - 10 * 60e3 && now <= end;
  const soon = !tCancelled(s) && s.status === 'scheduled' && start > now && start - now < 60 * 60e3;
  const badge = tCancelled(s) ? '<span class="badge b-cancel">اتلغت</span>' : s.status === 'done' ? '<span class="badge b-done">تمت</span>'
    : live ? '<span class="badge b-now">دلوقتي</span>' : soon ? `<span class="badge b-pending">بعد ${Math.round((start - now) / 60e3)} د</span>` : '';
  const who = s.group_key ? `👥 ${esc(s.group_name || 'مجموعة')}: ${esc(s.names.join('، '))}` : `${esc(s.student_name)} <span class="sub small">${esc(s.grade || '')}</span>`;
  const kind = s.kind === 'trial' ? ' <span class="badge b-trial">🧪 تجريبية — طالب جديد</span>' : s.kind === 'revision' ? ' <span class="badge b-rev">مراجعة</span>' : '';
  return `<div class="card item session ${live ? 's-now' : ''}" style="${tCancelled(s) ? 'opacity:.55' : ''}">
    <div class="left"><div class="time">${tTime(s.scheduled_at)}</div><div class="sub small">حتى ${tTime(tEnd(s))}</div></div>
    <div><div class="item-head"><div class="item-title">${who}${kind}</div>${badge}</div>
      <div class="meta">${s.subject ? `<span>المادة: <b>${esc(s.subject)}</b>${s.en ? ' <span class="badge b-en">EN</span>' : ''}</span>` : ''}<span>المدة: <b>${durLabel(s.duration_minutes || 60)}</b></span></div>
      ${tPendingFor(s) ? `<div class="cancel-info mt" style="background:var(--warn-soft);color:var(--warn)">⏳ طلب ${esc(T_REQ[tPendingFor(s).kind].l)} مستني رد الإشراف</div>` : ''}
      ${!tCancelled(s) && s.status !== 'done' ? `<div class="actions">
        ${!tPendingFor(s) ? `<button class="btn btn-ghost sm" onclick="tutorRequest(${jsq(s.id)})">✏️ طلب تغيير</button>` : ''}
        ${s.meeting_link ? `<a class="btn ${live || soon ? 'btn-brand' : 'btn-ghost'} sm" href="${esc(linkHref(s.meeting_link))}" target="_blank" rel="noopener">🎥 دخول الحصة</a>`
          : `<button class="btn btn-ghost sm" onclick="tutorEditLink(${jsq(s.student_id)}, ${jsq(s.subject || null)}, '')">🔗 ضيفي لينك الحصة</button>`}
      </div>` : ''}
    </div></div>`;
}

function tutorRender() {
  const el = document.getElementById('tutor-content'); if (!el) return;
  if (T.tab === 'today') {
    const todayKey = dateStr(new Date());
    const occ = tOcc(T.week).filter(s => new Date(s.scheduled_at).getTime() >= Date.now() - 6 * 3600e3 || dateStr(new Date(s.scheduled_at)) === todayKey);
    const byDay = {}; occ.forEach(s => (byDay[dateStr(new Date(s.scheduled_at))] ||= []).push(s));
    const days = Object.keys(byDay).sort();
    const todayList = (byDay[todayKey] || []).filter(s => !tCancelled(s));
    const next = occ.find(s => !tCancelled(s) && s.status === 'scheduled' && new Date(s.scheduled_at).getTime() > Date.now());
    el.innerHTML = `
      <div class="stats">
        <div class="card stat"><div class="v">${todayList.length}</div><div class="l">حصص النهارده</div></div>
        <div class="card stat"><div class="v num">${fmtU(todayList.reduce((a, s) => a + (s.duration_minutes || 60), 0) / 60)}</div><div class="l">ساعة النهارده</div></div>
        <div class="card stat"><div class="v" style="font-size:17px">${next ? tTime(next.scheduled_at) : '—'}</div><div class="l">${next ? 'الحصة الجاية: ' + esc(next.group_key ? next.group_name || 'مجموعة' : next.student_name) : 'مفيش حصص جاية'}</div></div>
      </div>
      ${tutorRequestsHtml()}
      ${days.length ? days.map(k => `<div class="section-title"><h2>${k === todayKey ? 'النهارده' : esc(relDayLabel(byDay[k][0].scheduled_at, CAIRO_TZ))}</h2></div>
        <div class="list">${byDay[k].map(s => tutorSessionCard(s)).join('')}</div>`).join('')
        : '<div class="card empty">مفيش حصص في الأيام الجاية 👌<br><span class="small">أي حصة الإشراف يحجزها هتظهر هنا على طول، ويوصلك تذكير قبلها.</span></div>'}
      <p class="sub small mt">المواعيد بتوقيت القاهرة. لأي تعديل في المواعيد أو ملاحظة عن الطالب تواصلي مع الإشراف.</p>`;
  } else if (T.tab === 'students') {
    const rows = T.students;
    el.innerHTML = `<p class="sub small">حطي لينك الحصة الثابت (زوم / جوجل ميت) لكل طالب مرة واحدة، وهيظهر في كل حصصه الجاية وفي رسايل التذكير.</p>
      <div class="list">${rows.map(r => `<div class="card item"><div class="item-head"><div><div class="item-title">${esc(r.student_name)}</div>
          <div class="sub small">${esc(r.grade || '')} · ${esc(r.subject || '')}${r.en ? ' <span class="badge b-en">EN</span>' : ''}${r.weekly ? ` · ${r.weekly} حصص/أسبوع` : ''}</div></div>
          <span class="sub small">${r.rate != null ? fmt(r.rate) + ' ج/ساعة' : ''}</span></div>
        <div class="actions">${r.meeting_link ? `<a class="btn btn-ghost sm" href="${esc(linkHref(r.meeting_link))}" target="_blank" rel="noopener">🎥 اللينك</a>` : '<span class="neg small">مفيش لينك</span>'}
          <button class="btn btn-ghost sm" onclick="tutorEditLink(${jsq(r.student_id)}, ${jsq(r.subject)}, ${jsq(r.meeting_link || '')})">${r.meeting_link ? '✏️ تعديل اللينك' : '🔗 ضيفي لينك'}</button>
          <button class="btn btn-ghost sm" onclick="tutorRequest(null, ${jsq(r.student_id)})">📨 طلب بخصوص الطالب</button></div>
      </div>`).join('') || '<div class="card empty">لسه مفيش طلاب متسجلين معاكي.</div>'}</div>`;
  } else {
    const mr = tMonthRange(T.month);
    const done = T.monthRows.filter(s => s.status === 'done');
    const per = {};
    done.forEach(s => { const k = s.group_key ? 'g:' + (s.group_name || s.group_key) : s.student_id;
      const x = per[k] ||= { who: s.group_key ? '👥 ' + (s.group_name || 'مجموعة') : s.student_name, mins: 0, amt: 0, subj: new Set(), seen: new Set() };
      if (!s.group_key || !x.seen.has(s.group_key)) { x.mins += tMins(s); if (s.group_key) x.seen.add(s.group_key); }
      x.amt += Number(s.tutor_charge_egp || 0); if (s.subject) x.subj.add(s.subject); });
    const list = Object.values(per).sort((a, b) => b.mins - a.mins);
    const total = list.reduce((a, x) => a + x.amt, 0), mins = list.reduce((a, x) => a + x.mins, 0);
    const paidM = T.payouts.filter(p => p.period_start && new Date(p.period_start) >= new Date(mr.from.getTime() - 864e5) && new Date(p.period_start) < mr.to).reduce((a, p) => a + Number(p.total_egp), 0);
    const label = mr.from.toLocaleDateString('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' });
    el.innerHTML = `
      <div class="chips">${[0, -1, -2].map(k => `<button class="chip ${T.month === k ? 'active' : ''}" onclick="tutorMonth(${k})">${tMonthRange(k).from.toLocaleDateString('ar-EG-u-nu-latn', { month: 'long' })}</button>`).join('')}</div>
      <div class="kpis">
        <div class="card kpi"><div class="l">حصص ${label}</div><div class="v num">${fmtU(mins / 60)}</div><div class="s">${durLabel(mins)} · الساعة = حصة</div></div>
        <div class="card kpi"><div class="l">مستحقك عن الشهر</div><div class="v num">${fmt(total)}</div><div class="s">جنيه</div></div>
        <div class="card kpi"><div class="l">اتحوّل عن الشهر</div><div class="v num ${paidM >= total && total ? 'pos' : ''}">${fmt(paidM)}</div><div class="s">${total - paidM > 0.5 ? `باقي ${fmt(total - paidM)} ج` : total ? 'اتحوّل بالكامل ✅' : '—'}</div></div>
      </div>
      <div class="section-title"><h2>حصصك لكل طالب</h2></div>
      <div class="card scrollx"><table><thead><tr><th>الطالب</th><th>الحصص</th><th>المادة</th><th>المستحق</th></tr></thead><tbody>
        ${list.map(x => `<tr><td><b>${esc(x.who)}</b></td><td class="num"><b>${fmtU(x.mins / 60)}</b><div class="sub small">${durLabel(x.mins)}</div></td><td class="small">${esc([...x.subj].join('، '))}</td><td class="num">${fmt(x.amt, 2)} ج</td></tr>`).join('')
          || '<tr><td colspan="4" class="empty">لسه مفيش حصص متسجلة في الشهر ده</td></tr>'}
      </tbody></table></div>
      <p class="sub small">الحصة بتتسجل هنا بعد ما الإشراف يأكدها. لو فيه حصة ناقصة أو مدة مختلفة بلّغي الإشراف قبل التحويل.</p>
      <div class="section-title"><h2>التحويلات</h2></div>
      <div class="card item">${T.payouts.slice(0, 8).map(p => `<div class="item-head" style="padding:4px 0"><span>${fmtShortDate(p.paid_at)} · ${esc(p.method || '')}<div class="sub small">${esc(p.note || '')}</div></span><b class="num">${fmt(p.total_egp, 2)} ج</b></div>`).join('') || '<div class="sub small">لا توجد تحويلات بعد</div>'}
        ${T.me.pay ? `<p class="sub small" style="margin:8px 0 0">بيتحوّل على: <span dir="ltr">${esc(T.me.pay)}</span></p>` : ''}</div>`;
  }
}

function tutorEditLink(studentId, subject, current) {
  if (T.preview) return showToast('ده عرض معاينة — المعلمة هي اللي بتحط اللينك من حسابها، أو عدّله إنت من خطة الطالب');
  const st = T.students.find(r => r.student_id === studentId) || T.week.find(r => r.student_id === studentId);
  openModal(`لينك حصص ${st?.student_name || ''}`, `
    <div class="field"><label>لينك الحصة الثابت</label><input id="t-link" class="input" dir="ltr" value="${esc(current)}" placeholder="https://zoom.us/j/…  أو  meet.google.com/…"></div>
    <p class="sub small">هيتحط في كل حصص ${esc(st?.student_name || 'الطالب')}${subject ? ` (${esc(subject)})` : ''} الجاية، والإشراف هيبعته للأسرة مع التذكير.</p>
    <div id="form-error" class="err hidden"></div>
    <div class="modal-foot"><button class="btn btn-brand" id="form-submit" onclick="_saveTLink()">حفظ</button><button class="btn btn-ghost" onclick="closeModal()">إلغاء</button></div>`);
  window._saveTLink = () => runSubmit(async () => {
    const v = document.getElementById('t-link').value.trim();
    if (v && !/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v)) return formError('اللينك مش مظبوط');
    const { data, error } = await sb.rpc('tutor_set_link', { p_student: studentId, p_subject: subject, p_link: v });
    if (error) throw error;
    closeModal(); showToast(v ? `تم الحفظ ✓${data ? ` واتحط في ${data} حصة جاية` : ''}` : 'اتشال اللينك'); tutorRefresh();
  });
}

/* ----- إشعارات المعلمة ----- */
async function tutorAlertIcon() { const on = !!(await currentPushSub().catch(() => null)) && Notification.permission === 'granted'; document.getElementById('t-btn-alerts').textContent = on ? '🔔' : '🔕'; return on; }
async function tutorAlertsPanel() {
  if (T.preview) return showToast('في حساب المعلمة الزرار ده بيفعّل تذكير الحصص على موبايلها');
  const on = await tutorAlertIcon().catch(() => false);
  let body;
  if (isIOS && !isStandalone()) body = `<p><b>على الآيفون الإشعارات بتشتغل بس لو البوابة متثبتة على الشاشة الرئيسية:</b></p>
    <ol class="steps"><li>افتحي اللينك ده في <b>Safari</b>.</li><li>دوسي زرار المشاركة <b>⬆︎</b>.</li><li>اختاري <b>"إضافة إلى الشاشة الرئيسية"</b>.</li><li>افتحي من الأيقونة الجديدة وسجّلي دخول، وبعدين فعّلي الإشعارات من هنا.</li></ol>`;
  else if (!pushSupported()) body = '<p>المتصفح ده مش بيدعم الإشعارات. جرّبي Chrome على أندرويد، أو Safari على الآيفون بعد التثبيت على الشاشة الرئيسية.</p>';
  else if (Notification.permission === 'denied') body = '<p class="neg">الإشعارات مقفولة من إعدادات الموبايل أو المتصفح. فعّليها للموقع ده وحدّثي الصفحة.</p>';
  else if (on) body = `<p class="pos"><b>✓ الإشعارات شغالة.</b></p><p class="sub">هيوصلك تذكير قبل كل حصة بـ 15 دقيقة ومعاه لينك الحصة.</p>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="tutorTestPush()">إشعار تجريبي</button><button class="btn btn-ghost" onclick="disablePush().then(tutorAlertsPanel)">إيقاف</button></div>`;
  else body = `<p>فعّلي الإشعارات عشان يوصلك <b>تذكير قبل كل حصة بـ 15 دقيقة</b> حتى والموبايل مقفول.</p>
    <div class="modal-foot"><button class="btn btn-brand" id="push-enable" onclick="tutorEnablePush()">🔔 تفعيل الإشعارات</button></div>`;
  openModal('تذكير الحصص', body);
}
async function tutorEnablePush() { await enablePush(); await tutorAlertIcon(); tutorAlertsPanel(); }
async function tutorTestPush() {
  try { const { data, error } = await sb.functions.invoke('session-alerts', { body: { action: 'test' } }); if (error) throw error;
    showToast(data.sent ? 'اتبعت إشعار تجريبي ✓' : 'مفيش جهاز مفعّل', !data.sent); } catch (e) { showToast('فشل: ' + (e.message || e), true); }
}

/* ----- طلبات التغيير (بتروح للإشراف يوافق عليها) ----- */
const T_REQ = {
  reschedule: { l: 'تأجيل / تغيير المعاد', icon: '🔁', need: 'reason' },
  cancel: { l: 'إلغاء الحصة', icon: '✖', need: 'reason' },
  absent: { l: 'الطالب ماحضرش', icon: '🚫' },
  extend: { l: 'الحصة اتمدت', icon: '⏱' },
  remove_student: { l: 'إيقاف الطالب', icon: '⛔', need: 'reason' },
  other: { l: 'طلب تاني', icon: '💬', need: 'reason' },
};
const T_REQ_ST = { pending: ['⏳ مستني الرد', 'b-pending'], approved: ['✅ اتوافق', 'b-done'], rejected: ['❌ اترفض', 'b-cancel'] };
const tPendingFor = s => (T.requests || []).find(r => r.session_id === s.id && r.status === 'pending');
function tutorRequestsHtml() {
  const list = (T.requests || []).filter(r => r.status === 'pending' || (r.decided_at && Date.now() - new Date(r.decided_at) < 3 * 864e5));
  if (!list.length) return '';
  return `<div class="section-title"><h2>طلباتي</h2></div><div class="list">${list.map(r => `<div class="card item"><div class="item-head">
      <div><b>${T_REQ[r.kind].icon} ${esc(T_REQ[r.kind].l)}</b> — ${esc(r.student_name || '')}
        <div class="sub small">${r.session_at ? `حصة ${esc(relDayLabel(r.session_at, CAIRO_TZ))} ${tTime(r.session_at)}` : ''}${r.proposed_at ? ` ← ${esc(relDayLabel(r.proposed_at, CAIRO_TZ))} ${tTime(r.proposed_at)}` : ''}${r.proposed_minutes ? ` · ${durLabel(r.proposed_minutes)}` : ''}</div>
        ${r.decision_note ? `<div class="small mt">📝 الإشراف: ${esc(r.decision_note)}</div>` : ''}</div>
      <span class="badge ${T_REQ_ST[r.status][1]}">${T_REQ_ST[r.status][0]}</span></div></div>`).join('')}</div>`;
}
function tutorRequest(sessionId, studentId) {
  if (T.preview) return showToast('ده عرض معاينة — المعلمة هي اللي بتبعت الطلبات من حسابها');
  const s = sessionId ? T.week.find(x => x.id === sessionId) : null;
  const st = s ? { name: s.group_key ? s.group_name || 'المجموعة' : s.student_name } : (T.students.find(x => x.student_id === studentId) ? { name: T.students.find(x => x.student_id === studentId).student_name } : { name: '' });
  const started = s && Date.now() >= new Date(s.scheduled_at).getTime();
  const kinds = s ? ['reschedule', 'cancel', ...(started ? ['absent', 'extend'] : [])] : ['remove_student', 'other'];
  const rq = { kind: kinds[0], reason: '', mins: s ? (s.duration_minutes || 60) + 30 : null };
  const d0 = s ? new Date(new Date(s.scheduled_at).getTime() + 864e5) : null;
  window._rq = rq;
  const render = () => {
    const K = T_REQ[rq.kind];
    document.getElementById('modal-body').innerHTML = `
      <div class="sub small mb">${esc(st.name)}${s ? ` · ${esc(s.subject || '')} · ${esc(relDayLabel(s.scheduled_at, CAIRO_TZ))} ${tTime(s.scheduled_at)}` : ''}</div>
      <div class="field"><label>نوع الطلب</label><div class="seg-wrap">${kinds.map(k => `<button type="button" class="chip ${rq.kind === k ? 'active' : ''}" onclick="_rq.kind='${k}'; _rqRender()">${T_REQ[k].icon} ${T_REQ[k].l}</button>`).join('')}</div></div>
      ${rq.kind === 'reschedule' ? `<div class="field-row"><div class="field"><label>المعاد الجديد المقترح</label><input id="rq-date" type="date" class="input" value="${dateStr(d0)}"></div>
        <div class="field"><label>الساعة (بتوقيت القاهرة)</label><input id="rq-time" type="time" class="input" value="${timeStr(new Date(s.scheduled_at))}"></div></div>` : ''}
      ${rq.kind === 'extend' ? `<div class="field"><label>المدة الفعلية للحصة</label><div class="chips" style="margin:0">${[15, 30, 45, 60, 90].map(x => (s.duration_minutes || 60) + x).map(m => `<button type="button" class="chip ${rq.mins === m ? 'active' : ''}" onclick="_rq.mins=${m}; _rqRender()">${durLabel(m)}</button>`).join('')}</div></div>` : ''}
      <div class="field"><label>${K.need ? 'السبب' : 'ملاحظة (اختياري)'}</label><textarea id="rq-reason" class="input" placeholder="${rq.kind === 'remove_student' ? 'مثال: الطالب مش ملتزم / مش مناسب لمستوايا' : rq.kind === 'cancel' ? 'مثال: ظرف طارئ' : 'اكتبي التفاصيل'}" oninput="_rq.reason=this.value">${esc(rq.reason)}</textarea></div>
      <div id="form-error" class="err hidden"></div>
      <div class="modal-foot"><button class="btn btn-brand" id="form-submit" onclick="_rqSend()">إرسال للإشراف</button><button class="btn btn-ghost" onclick="closeModal()">إلغاء</button></div>
      <p class="sub small">الطلب بيروح للإشراف يوافق عليه، وبعدها التغيير بيتنفذ ويتبلغ لولي الأمر. ⚠️ أي تغيير مهم لازم كمان تبلّغي بيه الإشراف على الجروب.</p>`;
  };
  window._rqRender = render;
  openModal(sessionId ? 'طلب تغيير في الحصة' : 'طلب بخصوص الطالب', ''); render();
  window._rqSend = () => runSubmit(async () => {
    const K = T_REQ[rq.kind];
    if (K.need && !rq.reason.trim()) return formError('اكتبي السبب عشان الإشراف يقدر يتصرف');
    let at = null;
    if (rq.kind === 'reschedule') { const d = new Date(`${document.getElementById('rq-date').value}T${document.getElementById('rq-time').value}`); if (isNaN(d)) return formError('اختاري المعاد الجديد'); at = d.toISOString(); }
    const { error } = await sb.rpc('tutor_request_create', { p_kind: rq.kind, p_session: s?.id || null, p_student: s ? null : studentId, p_proposed_at: at, p_minutes: rq.kind === 'extend' ? rq.mins : null, p_reason: rq.reason });
    if (error) throw error;
    const text = `السلام عليكم 👋 — ${T.me.name}
📨 طلب ${K.l}: ${st.name}${s ? `\n📅 الحصة: ${relDayLabel(s.scheduled_at, CAIRO_TZ)} الساعة ${tTime(s.scheduled_at)}${s.subject ? ' — ' + s.subject : ''}` : ''}${at ? `\n➡️ المعاد المقترح: ${relDayLabel(at, CAIRO_TZ)} الساعة ${tTime(at)}` : ''}${rq.kind === 'extend' ? `\n⏱ المدة الفعلية: ${durLabel(rq.mins)}` : ''}${rq.reason ? `\n📝 ${rq.reason}` : ''}
(الطلب متسجل على بوابة المعلمات)`;
    window._rqText = text;
    openModal('✅ الطلب اتبعت للإشراف', `<p>الإشراف هيراجع الطلب، وهيوصلك إشعار بالرد.</p>
      <div class="card item" style="background:var(--warn-soft);border-color:var(--warn)"><b>⚠️ مهم:</b> بلّغي الإشراف كمان على الجروب عشان يتصرفوا بسرعة.</div>
      <div class="msg-preview mt">${esc(text)}</div>
      <div class="modal-foot" style="flex-wrap:wrap">${T.me.group ? `<button class="btn btn-wa" onclick="copyAndOpen(window._rqText, ${jsq(T.me.group)}); closeModal()">💬 انسخي وافتحي جروب الإشراف</button>` : ''}
        <button class="btn btn-ghost" onclick="copyText(window._rqText,'اتنسخ ✓ الصقيه في جروب الإشراف')">📋 نسخ الرسالة</button></div>`);
    tutorRefresh();
  });
}
