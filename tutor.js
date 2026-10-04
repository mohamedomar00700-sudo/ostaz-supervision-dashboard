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
      const [w, m, po] = await Promise.all([tutorPreviewRows(new Date(from.getTime() - 7 * 864e5), new Date(from.getTime() + 8 * 864e5)), tutorPreviewRows(mr.from, mr.to),
        q(sb.from('tutor_payouts').select('*').eq('tutor_id', T.preview).eq('paid', true).order('paid_at', { ascending: false }))]);
      T.week = w; T.monthRows = m;
      try { const rq = await q(sb.from('tutor_requests').select('*').eq('tutor_id', T.preview).order('created_at', { ascending: false }).limit(20));
        T.requests = rq.map(r => ({ ...r, student_name: byId(state.students, r.student_id)?.name || r.new_value, session_at: (w.concat(m).find(x => x.id === r.session_id) || {}).scheduled_at })); } catch (e) { T.requests = []; }
      T.payouts = po.map(p => ({ ...p, paid_at: p.paid_at || p.created_at }));
      try { T.reports = await q(sb.from('session_reports').select('*').eq('tutor_id', T.preview).gte('created_at', new Date(Date.now() - 40 * 864e5).toISOString())); } catch (e) { T.reports = []; }
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
      sb.rpc('tutor_sessions', { p_from: new Date(from.getTime() - 7 * 864e5).toISOString(), p_to: to.toISOString() }),
      sb.rpc('tutor_students'), sb.rpc('tutor_payout_list'),
      sb.rpc('tutor_sessions', { p_from: mr.from.toISOString(), p_to: mr.to.toISOString() }),
    ]);
    for (const r of [a, b, c, d]) if (r.error) throw r.error;
    const enfix = r => { const en = / · EN$/.test(r.grade || ''); return { ...r, en, grade: (r.grade || '').replace(/ · EN$/, '') }; };
    T.week = a.data.map(enfix); T.students = b.data.map(enfix); T.payouts = c.data; T.monthRows = d.data.map(enfix);
    try { const rr = await sb.rpc('tutor_reports_mine', { p_from: new Date(from.getTime() - 40 * 864e5).toISOString(), p_to: to.toISOString() }); T.reports = rr.data || []; } catch (e) { T.reports = []; }
    tutorRender();
    tutorReportPrompt();
    tutorBadge();
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
const tDur = s => s.status === 'done' ? tMins(s) : Number(s.duration_minutes || 60); // اللي اتعمل فعلاً بعد التسجيل
const tEnd = s => new Date(new Date(s.scheduled_at).getTime() + tDur(s) * 60e3).toISOString();

function tutorSessionCard(s, compact) {
  const start = new Date(s.scheduled_at).getTime(), end = start + tDur(s) * 60e3, now = Date.now();
  const live = !tCancelled(s) && s.status !== 'done' && now >= start - 10 * 60e3 && now <= end;
  const soon = !tCancelled(s) && s.status === 'scheduled' && start > now && start - now < 60 * 60e3;
  const badge = tCancelled(s) ? '<span class="badge b-cancel">اتلغت</span>' : s.status === 'done' ? '<span class="badge b-done">تمت ✓</span>'
    : now > end ? '<span class="badge b-pending">⏳ مستنية تأكيد الإشراف</span>'
    : live ? '<span class="badge b-now">دلوقتي</span>' : soon ? `<span class="badge b-pending">بعد ${Math.round((start - now) / 60e3)} د</span>` : '';
  const who = s.group_key ? `👥 ${esc(s.group_name || 'مجموعة')}: ${esc(s.names.join('، '))}` : `${esc(s.student_name)} <span class="sub small">${esc(s.grade || '')}</span>`;
  const kind = s.kind === 'trial' ? ' <span class="badge b-trial">🧪 تجريبية — طالب جديد</span>' : s.kind === 'revision' ? ' <span class="badge b-rev">مراجعة</span>' : '';
  return `<div class="card item session ${live ? 's-now' : ''}" style="${tCancelled(s) ? 'opacity:.55' : ''}">
    <div class="left"><div class="time">${tTime(s.scheduled_at)}</div><div class="sub small">حتى ${tTime(tEnd(s))}</div></div>
    <div><div class="item-head"><div class="item-title">${who}${kind}</div>${badge}</div>
      <div class="meta">${s.subject ? `<span>المادة: <b>${esc(s.subject)}</b>${s.en ? ' <span class="badge b-en">EN</span>' : ''}</span>` : ''}<span>المدة: <b>${durLabel(tDur(s))}</b>${tDur(s) !== Number(s.duration_minutes || 60) ? ` <span class="${tDur(s) > (s.duration_minutes || 60) ? 'pos' : 'neg'}">(بدل ${durLabel(s.duration_minutes || 60)})</span>` : ''}</span>${s.status === 'done' ? `<span>بتتحسب: <b>${fmtU(tDur(s) / 60)} حصة</b></span>` : ''}</div>
      ${tPendingFor(s) ? `<div class="cancel-info mt" style="background:var(--warn-soft);color:var(--warn)">⏳ طلب ${esc(T_REQ[tPendingFor(s).kind].l)} مستني رد الإشراف</div>` : ''}
      ${tRepLine(s)}
      ${!tCancelled(s) && s.status !== 'done' ? `<div class="actions">
        ${tRepBtn(s)}
        ${!tPendingFor(s) ? `<button class="btn btn-ghost sm" onclick="tutorRequest(${jsq(s.id)})">✏️ طلب تغيير</button>` : ''}
        ${s.meeting_link ? `<a class="btn ${live || soon ? 'btn-brand' : 'btn-ghost'} sm" href="${esc(linkHref(s.meeting_link))}" target="_blank" rel="noopener">🎥 دخول الحصة</a>`
          : `<button class="btn btn-ghost sm" onclick="tutorEditLink(${jsq(s.student_id)}, ${jsq(s.subject || null)}, '')">🔗 ضيفي لينك الحصة</button>`}
      </div>` : !tCancelled(s) && s.status === 'done' ? `<div class="actions">${tRepBtn(s)}${!s.group_key && !tPendingFor(s) && Date.now() - new Date(s.scheduled_at) < 14 * 864e5 ? `<button class="btn btn-ghost sm" onclick="tutorRequest(${jsq(s.id)})">👥 حضر أخ/أخت بداله؟</button>` : ''}</div>` : ''}
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
    const needRep = tOcc(T.week).filter(s => !tCancelled(s) && tStarted(s) && !tRepFor(s) && new Date(s.scheduled_at).getTime() > Date.now() - 7 * 864e5);
    el.innerHTML = `
      <div class="stats">
        <div class="card stat"><div class="v num">${fmtU(todayList.reduce((a, s) => a + tDur(s), 0) / 60)}</div><div class="l">حصص النهارده${todayList.length ? ` <span class="small">(${todayList.length} ${todayList.length === 1 ? 'لقاء' : 'لقاءات'})</span>` : ''}</div></div>
        <div class="card stat"><div class="v num">${fmtU(todayList.filter(s => s.status === 'done').reduce((a, s) => a + tDur(s), 0) / 60)}</div><div class="l">اتسجلت تمت</div></div>
        <div class="card stat"><div class="v" style="font-size:17px">${next ? tTime(next.scheduled_at) : '—'}</div><div class="l">${next ? 'الحصة الجاية: ' + esc(next.group_key ? next.group_name || 'مجموعة' : next.student_name) : 'مفيش حصص جاية'}</div></div>
      </div>
      ${T.pushOff ? `<div class="card item" style="border-color:var(--danger)"><b>🔕 الإشعارات مقفولة على الموبايل ده</b><div class="sub small">فعّليها عشان يوصلك تذكير قبل كل حصة وتذكير بتقرير الحصة.</div><button class="btn btn-brand sm mt" onclick="tutorAlertsPanel()">🔔 فعّلي الإشعارات</button></div>` : ''}
      ${needRep.length ? `<div class="card item rep-nudge"><b>📝 ${needRep.length === 1 ? 'فيه حصة محتاجة تقرير' : `فيه ${needRep.length} حصص محتاجة تقرير`}</b>
        <div class="sub small">اكتبي تقرير قصير بعد كل حصة (المدة واللي اتشرح والواجب) — الإشراف بيبعته لولي الأمر، وكده حسابك بيتأكد أول بأول.</div>
        ${needRep.filter(s => !occ.some(o => o.id === s.id)).map(s => `<div class="item-head mt" style="gap:8px"><span>${esc(s.group_key ? '👥 ' + (s.group_name || 'مجموعة') : s.student_name)} <span class="sub small">${esc(relDayLabel(s.scheduled_at, CAIRO_TZ))} ${tTime(s.scheduled_at)}</span></span>${tRepBtn(s)}</div>`).join('')}</div>` : ''}
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
          <button class="btn btn-ghost sm" onclick="tutorRequest(null, ${jsq(r.student_id)}, ${jsq(r.subject || '')}, 'add_session')">➕ حصة إضافية</button>
          <button class="btn btn-ghost sm" onclick="tutorRequest(null, ${jsq(r.student_id)}, ${jsq(r.subject || '')})">📨 طلب بخصوص الطالب</button></div>
      </div>`).join('') || '<div class="card empty">لسه مفيش طلاب متسجلين معاكي.</div>'}</div>`;
  } else {
    const mr = tMonthRange(T.month);
    const done = T.monthRows.filter(s => s.status === 'done');
    // حصص عدّت ولسه الإشراف ماأكدهاش: بتظهر لوحدها عشان المعلمة متقلقش إنها اتنست
    const pend = T.monthRows.filter(s => (s.status === 'scheduled' || s.status === 'in_progress') && Date.now() >= new Date(s.scheduled_at).getTime() + (s.duration_minutes || 60) * 60e3);
    const per = {};
    const slot = s => { const k = s.group_key ? 'g:' + (s.group_name || s.group_key) : s.student_id;
      return per[k] ||= { who: s.group_key ? '👥 ' + (s.group_name || 'مجموعة') : s.student_name, mins: 0, amt: 0, pmins: 0, pamt: 0, subj: new Set(), seen: new Set(), pseen: new Set() }; };
    done.forEach(s => { const x = slot(s);
      if (!s.group_key || !x.seen.has(s.group_key)) { x.mins += tMins(s); if (s.group_key) x.seen.add(s.group_key); }
      x.amt += Number(s.tutor_charge_egp || 0); if (s.subject) x.subj.add(s.subject); });
    pend.forEach(s => { const x = slot(s), r = tRepFor(s);
      if (r && !r.attended) return; // التقرير بيقول الطالب ماحضرش
      const m = r?.minutes || s.duration_minutes || 60;
      if (!s.group_key || !x.pseen.has(s.group_key)) { x.pmins += m; if (s.group_key) x.pseen.add(s.group_key); }
      x.pamt += Number(s.tutor_cost_egp || 0) * m / 60; if (s.subject) x.subj.add(s.subject); });
    const list = Object.values(per).sort((a, b) => (b.mins + b.pmins) - (a.mins + a.pmins));
    const total = list.reduce((a, x) => a + x.amt, 0), mins = list.reduce((a, x) => a + x.mins, 0);
    const pMins = list.reduce((a, x) => a + x.pmins, 0), pAmt = list.reduce((a, x) => a + x.pamt, 0);
    const paidM = T.payouts.filter(p => p.period_start && new Date(p.period_start) >= new Date(mr.from.getTime() - 864e5) && new Date(p.period_start) < mr.to).reduce((a, p) => a + Number(p.total_egp), 0);
    const label = mr.from.toLocaleDateString('ar-EG-u-nu-latn', { month: 'long', year: 'numeric' });
    el.innerHTML = `
      <div class="chips">${[0, -1, -2].map(k => `<button class="chip ${T.month === k ? 'active' : ''}" onclick="tutorMonth(${k})">${tMonthRange(k).from.toLocaleDateString('ar-EG-u-nu-latn', { month: 'long' })}</button>`).join('')}</div>
      <div class="kpis">
        <div class="card kpi"><div class="l">حصص ${label} المؤكدة</div><div class="v num">${fmtU(mins / 60)}</div><div class="s">${durLabel(mins)} · الساعة = حصة${pMins ? `<br><span class="warn-txt">⏳ + ${fmtU(pMins / 60)} مستنية تأكيد الإشراف</span>` : ''}</div></div>
        <div class="card kpi"><div class="l">مستحقك عن الشهر</div><div class="v num">${fmt(total)}</div><div class="s">جنيه${pAmt ? `<br><span class="warn-txt">⏳ + حوالي ${fmt(pAmt)} ج أول ما تتأكد</span>` : ''}</div></div>
        <div class="card kpi"><div class="l">اتحوّل عن الشهر</div><div class="v num ${paidM >= total && total ? 'pos' : ''}">${fmt(paidM)}</div><div class="s">${total - paidM > 0.5 ? `باقي ${fmt(total - paidM)} ج` : paidM - total > 0.5 ? `💚 منهم ${fmt(paidM - total)} ج مقدّم للحصص الجاية` : total ? 'اتحوّل بالكامل ✅' : '—'}</div></div>
      </div>
      <div class="section-title"><h2>حصصك لكل طالب</h2></div>
      <div class="card scrollx"><table><thead><tr><th>الطالب</th><th>الحصص</th><th>المادة</th><th>المستحق</th></tr></thead><tbody>
        ${list.map(x => `<tr><td><b>${esc(x.who)}</b></td><td class="num"><b>${fmtU(x.mins / 60)}</b><div class="sub small">${durLabel(x.mins)}</div>${x.pmins ? `<div class="small warn-txt">⏳ + ${fmtU(x.pmins / 60)} مستنية تأكيد</div>` : ''}</td><td class="small">${esc([...x.subj].join('، '))}</td><td class="num">${fmt(x.amt, 2)} ج${x.pamt ? `<div class="small warn-txt">+ ≈ ${fmt(x.pamt)}</div>` : ''}</td></tr>`).join('')
          || '<tr><td colspan="4" class="empty">لسه مفيش حصص متسجلة في الشهر ده</td></tr>'}
      </tbody></table></div>
      <p class="sub small">✅ المؤكد = الإشراف سجّله "تمت" وبيتحسب في التحويل. ⏳ مستني تأكيد = حصص عدّت (بالمدة اللي في تقريرك) والإشراف هيأكدها — مش هتضيع. لو فيه حصة ناقصة خالص بلّغي الإشراف أو اطلبي "حصة إضافية".</p>
      <div class="section-title"><h2>التحويلات</h2></div>
      <div class="card item">${T.payouts.slice(0, 8).map(p => `<div class="item-head" style="padding:4px 0"><span>${fmtShortDate(p.paid_at)} · ${esc(p.method || '')}<div class="sub small">${esc(p.note || '')}</div></span><b class="num">${fmt(p.total_egp, 2)} ج</b></div>`).join('') || '<div class="sub small">لا توجد تحويلات بعد</div>'}
        <p class="sub small" style="margin:8px 0 0">بيتحوّل على: ${T.me.pay ? `<b>${esc(T.me.pay)}</b>` : '<b>لسه مش متسجل</b>'}</p>
        ${(T.requests || []).some(r => r.kind === 'payment_info' && r.status === 'pending') ? '<div class="cancel-info mt" style="background:var(--warn-soft);color:var(--warn)">⏳ طلب تغيير رقم التحويل مستني الإشراف يتأكد منك</div>'
          : `<button class="btn btn-ghost btn-sm mt" onclick="tutorPaymentRequest()">✏️ طلب تغيير رقم التحويل</button>`}</div>
      ${tutorRequestsHtml()}`;
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
  payment_info: { l: 'تغيير رقم التحويل', icon: '💳' },
  add_session: { l: 'حصة إضافية / تعويض', icon: '➕' },
  swap_student: { l: 'اللي حضر أخ/أخت تاني', icon: '👥' },
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
function tutorRequest(sessionId, studentId, subject, preset) {
  if (T.preview) return showToast('ده عرض معاينة — المعلمة هي اللي بتبعت الطلبات من حسابها');
  const s = sessionId ? T.week.find(x => x.id === sessionId) : null;
  const st = s ? { name: s.group_key ? s.group_name || 'المجموعة' : s.student_name } : (T.students.find(x => x.student_id === studentId) ? { name: T.students.find(x => x.student_id === studentId).student_name } : { name: '' });
  const started = s && Date.now() >= new Date(s.scheduled_at).getTime();
  const swap = s && !s.group_key ? ['swap_student'] : [];
  const kinds = s ? (s.status === 'done' ? swap : (started ? ['cancel', 'reschedule'] : ['reschedule', 'cancel']).concat(swap)) : ['add_session', 'remove_student', 'other']; // الحضور والمدة بقوا في تقرير الحصة
  const lastOf = !s && (T.week || []).filter(x => x.student_id === studentId && (!subject || x.subject === subject)).sort((a, b) => b.scheduled_at < a.scheduled_at ? -1 : 1)[0];
  const rq = { kind: preset && kinds.includes(preset) ? preset : kinds[0], reason: '', scope: 'once', mins: s ? (s.duration_minutes || 60) + 30 : (lastOf?.duration_minutes || 60) };
  const d0 = s ? new Date(new Date(s.scheduled_at).getTime() + 864e5) : new Date(Date.now() + 864e5);
  const t0 = s ? timeStr(new Date(s.scheduled_at)) : lastOf ? timeStr(new Date(lastOf.scheduled_at)) : '17:00';
  window._rq = rq;
  const render = () => {
    const K = T_REQ[rq.kind];
    document.getElementById('modal-body').innerHTML = `
      <div class="sub small mb">${esc(st.name)}${!s && subject ? ` · ${esc(subject)}` : ''}${s ? ` · ${esc(s.subject || '')} · ${esc(relDayLabel(s.scheduled_at, CAIRO_TZ))} ${tTime(s.scheduled_at)}` : ''}</div>
      <div class="field"><label>نوع الطلب</label><div class="seg-wrap">${kinds.map(k => `<button type="button" class="chip ${rq.kind === k ? 'active' : ''}" onclick="_rq.kind='${k}'; _rqRender()">${T_REQ[k].icon} ${T_REQ[k].l}</button>`).join('')}</div></div>
      ${rq.kind === 'reschedule' ? `<div class="field-row"><div class="field"><label>المعاد الجديد المقترح</label><input id="rq-date" type="date" class="input" value="${dateStr(d0)}"></div>
        <div class="field"><label>الساعة (بتوقيت القاهرة)</label><input id="rq-time" type="time" class="input" value="${timeStr(new Date(s.scheduled_at))}"></div></div>
        <div class="field"><label>التغيير ده</label><div class="seg-wrap"><button type="button" class="chip ${rq.scope === 'once' ? 'active' : ''}" onclick="_rq.scope='once'; _rqRender()">الحصة دي بس</button>
          <button type="button" class="chip ${rq.scope === 'permanent' ? 'active' : ''}" onclick="_rq.scope='permanent'; _rqRender()">♾ دايم (كل الأسابيع الجاية)</button></div></div>` : ''}
      ${rq.kind === 'add_session' ? `<div class="field-row"><div class="field"><label>${rq.scope === 'permanent' ? 'أول حصة' : 'يوم الحصة'}</label><input id="rq-date" type="date" class="input" value="${esc(rq.date || dateStr(d0))}" onchange="_rq.date=this.value"></div>
        <div class="field"><label>الساعة (بتوقيت القاهرة)</label><input id="rq-time" type="time" class="input" value="${esc(rq.time || t0)}" onchange="_rq.time=this.value"></div></div>
        <div class="field"><label>المدة</label><div class="chips" style="margin:0">${[30, 45, 60, 90, 120, 150, 180, 240].map(m => `<button type="button" class="chip ${rq.mins === m ? 'active' : ''}" onclick="_rq.mins=${m}; _rqRender()">${durLabel(m)}</button>`).join('')}</div></div>
        ${hmHtml('rq_hm', rq.mins)}
        <div class="sub small mb">💡 لو الحصة اتعملت خلاص ومتسجلتش على البوابة، اختاري تاريخها وساعتها اللي فاتوا (لحد أسبوعين).</div>
        <div class="field"><label>الحصة دي</label><div class="seg-wrap"><button type="button" class="chip ${rq.scope === 'once' ? 'active' : ''}" onclick="_rq.scope='once'; _rqRender()">مرة واحدة (زيادة / تعويض)</button>
          <button type="button" class="chip ${rq.scope === 'permanent' ? 'active' : ''}" onclick="_rq.scope='permanent'; _rqRender()">🔁 ميعاد ثابت كل أسبوع</button></div></div>` : ''}
      ${rq.kind === 'swap_student' ? `<div class="field"><label>مين اللي حضر الحصة فعلاً بدل ${esc(st.name)}؟</label>
        <div class="seg-wrap">${rq.sibs == null ? '<span class="sub small">بيحمّل…</span>' : rq.sibs.length ? rq.sibs.map(x => `<button type="button" class="chip ${rq.swapTo === x.student_id ? 'active' : ''}" onclick="_rq.swapTo='${x.student_id}'; _rqRender()">${esc(x.name)}</button>`).join('') : '<span class="sub small">مالوش إخوات متسجلين عندنا — ابعتي للإشراف على الجروب</span>'}</div>
        <div class="sub small mt">💡 الحصة هتتحسب على الأخ/الأخت اللي حضر بعد ما الإشراف يوافق. حسابك مش هيتغير.</div></div>` : ''}
      ${rq.kind === 'extend' ? `<div class="field"><label>المدة الفعلية للحصة</label><div class="chips" style="margin:0">${[15, 30, 45, 60, 90].map(x => (s.duration_minutes || 60) + x).map(m => `<button type="button" class="chip ${rq.mins === m ? 'active' : ''}" onclick="_rq.mins=${m}; _rqRender()">${durLabel(m)}</button>`).join('')}</div></div>${hmHtml('rq_hm', rq.mins)}` : ''}
      <div class="field"><label>${K.need ? 'السبب' : rq.kind === 'add_session' ? 'السبب (تعويض؟ امتحان؟) — اختياري' : 'ملاحظة (اختياري)'}</label><textarea id="rq-reason" class="input" placeholder="${rq.kind === 'add_session' ? 'مثال: تعويض حصة الأحد اللي اتلغت / الطالب عنده امتحان' : rq.kind === 'remove_student' ? 'مثال: الطالب مش ملتزم / مش مناسب لمستوايا' : rq.kind === 'cancel' ? 'مثال: ظرف طارئ' : 'اكتبي التفاصيل'}" oninput="_rq.reason=this.value">${esc(rq.reason)}</textarea></div>
      <div id="form-error" class="err hidden"></div>
      <div class="modal-foot"><button class="btn btn-brand" id="form-submit" onclick="_rqSend()">إرسال للإشراف</button><button class="btn btn-ghost" onclick="closeModal()">إلغاء</button></div>
      <p class="sub small">الطلب بيروح للإشراف يوافق عليه، وبعدها التغيير بيتنفذ ويتبلغ لولي الأمر. ⚠️ أي تغيير مهم لازم كمان تبلّغي بيه الإشراف على الجروب.</p>`;
  };
  if (swap.length && !T.preview) sb.rpc('tutor_siblings', { p_session: s.id }).then(({ data }) => { rq.sibs = data || []; if (document.getElementById('rq-reason')) window._rqRender(); });
  window._rqRender = () => { render(); hmWire('rq_hm', v => { rq.mins = v; document.querySelectorAll('#modal-body .chips .chip').forEach(c => c.classList.remove('active')); }); };
  openModal(sessionId ? 'طلب تغيير في الحصة' : rq.kind === 'add_session' ? '➕ طلب حصة إضافية' : 'طلب بخصوص الطالب', ''); window._rqRender();
  window._rqSend = () => runSubmit(async () => {
    const K = T_REQ[rq.kind];
    if (K.need && !rq.reason.trim()) return formError('اكتبي السبب عشان الإشراف يقدر يتصرف');
    if (rq.kind === 'swap_student') {
      if (!rq.swapTo) return formError('اختاري مين اللي حضر');
      const { error } = await sb.rpc('tutor_request_swap', { p_session: s.id, p_student: rq.swapTo, p_reason: rq.reason });
      if (error) throw /duplicate/.test(error.message || '') ? new Error('فيه طلب زي ده مستني رد الإشراف') : error;
    }
    let at = null;
    if (rq.kind === 'add_session' && !(rq.mins >= 15 && rq.mins <= 240)) return formError('المدة لازم تكون بين ربع ساعة و4 ساعات');
    if (rq.kind === 'extend' && !(rq.mins >= 5 && rq.mins <= 720)) return formError('اكتبي المدة الفعلية صح');
    if (rq.kind === 'add_session') {
      const d = new Date(`${document.getElementById('rq-date').value}T${document.getElementById('rq-time').value}`);
      if (isNaN(d)) return formError('اختاري اليوم والساعة');
      if (rq.scope === 'permanent' && d.getTime() < Date.now() - 864e5) return formError('الميعاد الثابت لازم يبدأ من النهارده أو بعد كده');
      if (d.getTime() < Date.now() - 14 * 864e5) return formError('الحصة دي قديمة أوي — ابعتي تفاصيلها للإشراف على الجروب');
      const { error } = await sb.rpc('tutor_request_add_session', { p_student: studentId, p_subject: subject || null, p_at: d.toISOString(), p_minutes: rq.mins, p_weekly: rq.scope === 'permanent', p_reason: rq.reason });
      if (error) throw error;
      at = d.toISOString();
    } else if (rq.kind === 'reschedule') { const d = new Date(`${document.getElementById('rq-date').value}T${document.getElementById('rq-time').value}`); if (isNaN(d)) return formError('اختاري المعاد الجديد'); at = d.toISOString(); }
    const { error } = rq.kind === 'add_session' || rq.kind === 'swap_student' ? { error: null } : await sb.rpc('tutor_request_create', { p_kind: rq.kind, p_session: s?.id || null, p_student: s ? null : studentId, p_proposed_at: at, p_minutes: rq.kind === 'extend' ? rq.mins : null, p_reason: rq.reason, p_scope: rq.kind === 'reschedule' ? rq.scope : 'once' });
    if (error) throw error;
    const text = `السلام عليكم 👋 — ${T.me.name}
📨 طلب ${K.l}${rq.kind === 'reschedule' && rq.scope === 'permanent' ? ' (دايم)' : rq.kind === 'add_session' && rq.scope === 'permanent' ? ' (ميعاد ثابت كل أسبوع)' : ''}: ${st.name}${!s && subject ? ' — ' + subject : ''}${s ? `\n📅 الحصة: ${relDayLabel(s.scheduled_at, CAIRO_TZ)} الساعة ${tTime(s.scheduled_at)}${s.subject ? ' — ' + s.subject : ''}` : ''}${at ? `\n➡️ ${rq.kind === 'add_session' ? (rq.scope === 'permanent' ? 'من' : 'المعاد') : 'المعاد المقترح'}: ${relDayLabel(at, CAIRO_TZ)} الساعة ${tTime(at)}${rq.kind === 'add_session' ? ' — ' + durLabel(rq.mins) : ''}` : ''}${rq.kind === 'extend' ? `\n⏱ المدة الفعلية: ${durLabel(rq.mins)}` : ''}${rq.reason ? `\n📝 ${rq.reason}` : ''}
${rq.kind === 'swap_student' ? `👥 اللي حضر فعلاً: ${(rq.sibs || []).find(x => x.student_id === rq.swapTo)?.name || ''}\n` : ''}(الطلب متسجل على بوابة المعلمات)`;
    window._rqText = text;
    openModal('✅ الطلب اتبعت للإشراف', `<p>الإشراف هيراجع الطلب، وهيوصلك إشعار بالرد.</p>
      <div class="card item" style="background:var(--warn-soft);border-color:var(--warn)"><b>⚠️ مهم:</b> بلّغي الإشراف كمان على الجروب عشان يتصرفوا بسرعة.</div>
      <div class="msg-preview mt">${esc(text)}</div>
      <div class="modal-foot" style="flex-wrap:wrap">${T.me.group ? `<button class="btn btn-wa" onclick="copyAndOpen(window._rqText, ${jsq(T.me.group)}); closeModal()">💬 انسخي وافتحي جروب الإشراف</button>` : ''}
        <button class="btn btn-ghost" onclick="copyText(window._rqText,'اتنسخ ✓ الصقيه في جروب الإشراف')">📋 نسخ الرسالة</button></div>`);
    tutorRefresh();
  });
}

/* ----- طلب تغيير رقم التحويل (الإشراف بيتأكد منها قبل ما يعتمده) ----- */
const T_PAY_METHODS = ['InstaPay', 'محفظة', 'فودافون كاش', 'حساب بنكي'];
function tutorPaymentRequest() {
  if (T.preview) return showToast('ده عرض معاينة — المعلمة هي اللي بتبعت الطلب من حسابها');
  const pr = window._pr = { method: /insta/i.test(T.me.pay || '') ? 'InstaPay' : 'محفظة', number: '', number2: '', name: '' };
  const render = () => {
    document.getElementById('modal-body').innerHTML = `
      <div class="sub small mb">الرقم الحالي: <b>${esc(T.me.pay || "—")}</b></div>
      <div class="field"><label>طريقة التحويل</label><div class="seg-wrap">${T_PAY_METHODS.map(m => `<button type="button" class="chip ${pr.method === m ? 'active' : ''}" onclick="_pr.method=${jsq(m)}; _prRender()">${m}</button>`).join('')}</div></div>
      <div class="field"><label>${pr.method === 'حساب بنكي' ? 'رقم الحساب / IBAN' : pr.method === 'InstaPay' ? 'رقم الموبايل أو عنوان InstaPay' : 'رقم المحفظة'}</label>
        <input id="pr-n1" class="input" dir="ltr" inputmode="${pr.method === 'InstaPay' || pr.method === 'حساب بنكي' ? 'text' : 'tel'}" value="${esc(pr.number)}" oninput="_pr.number=this.value" placeholder="${pr.method === 'InstaPay' ? '01xxxxxxxxx أو name@instapay' : '01xxxxxxxxx'}"></div>
      <div class="field"><label>اكتبيه تاني للتأكيد</label><input id="pr-n2" class="input" dir="ltr" value="${esc(pr.number2)}" oninput="_pr.number2=this.value" autocomplete="off"></div>
      <div class="field"><label>اسم صاحب الحساب (لو مش باسمك)</label><input id="pr-name" class="input" value="${esc(pr.name)}" oninput="_pr.name=this.value" placeholder="مثال: أحمد سيد"></div>
      <div id="form-error" class="err hidden"></div>
      <div class="modal-foot"><button class="btn btn-brand" id="form-submit" onclick="_prSend()">إرسال للإشراف</button><button class="btn btn-ghost" onclick="closeModal()">إلغاء</button></div>
      <p class="sub small">🔒 الرقم مش هيتغير غير بعد ما الإشراف يتواصل معاكي ويتأكد إنك انتي اللي طلبتي التغيير. لحد كده التحويل بيفضل على الرقم القديم.</p>`;
  };
  window._prRender = render;
  openModal('💳 طلب تغيير رقم التحويل', ''); render();
  window._prSend = () => runSubmit(async () => {
    const norm = v => v.replace(/[\s-]/g, '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/^\+?20(?=1\d{9}$)/, '0');
    const n1 = norm(pr.number), n2 = norm(pr.number2);
    if (!n1) return formError('اكتبي الرقم الجديد');
    if (n1 !== n2) return formError('الرقمين مش زي بعض — راجعيهم');
    if ((pr.method === 'محفظة' || pr.method === 'فودافون كاش') && !/^01\d{9}$/.test(n1)) return formError('رقم المحفظة لازم يكون 11 رقم ويبدأ بـ 01');
    if (pr.method === 'InstaPay' && !/^01\d{9}$/.test(n1) && !/^[\w.-]+@[\w.-]+$/.test(n1)) return formError('اكتبي رقم موبايل (11 رقم) أو عنوان InstaPay زي name@instapay');
    const { data, error } = await sb.rpc('tutor_request_payment', { p_method: pr.method, p_number: n1, p_name: pr.name.trim() || null });
    if (error) throw error;
    const val = `${pr.method}: ${n1}${pr.name.trim() ? ' · اسم الحساب: ' + pr.name.trim() : ''}`;
    const text = `السلام عليكم 👋 — ${T.me.name}
💳 طلب تغيير رقم التحويل
القديم: ${T.me.pay || '—'}
الجديد: ${val}
برجاء التأكيد معايا قبل الاعتماد.
(الطلب متسجل على بوابة المعلمات)`;
    window._rqText = text;
    openModal('✅ الطلب اتبعت للإشراف', `<p>الإشراف هيتواصل معاكي يتأكد، وبعدها الرقم الجديد يتعتمد ويوصلك إشعار.</p>
      <div class="card item" style="background:var(--warn-soft);border-color:var(--warn)"><b>⚠️ مهم:</b> بلّغي الإشراف كمان على الجروب.</div>
      <div class="msg-preview mt">${esc(text)}</div>
      <div class="modal-foot" style="flex-wrap:wrap">${T.me.group ? `<button class="btn btn-wa" onclick="copyAndOpen(window._rqText, ${jsq(T.me.group)}); closeModal()">💬 انسخي وافتحي جروب الإشراف</button>` : ''}
        <button class="btn btn-ghost" onclick="copyText(window._rqText,'اتنسخ ✓ الصقيه في جروب الإشراف')">📋 نسخ الرسالة</button></div>`);
    tutorRefresh();
  });
}

/* ----- تقرير الحصة (المعلمة بتكتبه بعد الحصة ← الإشراف ← ولي الأمر) ----- */
const T_LEVEL = { excellent: 'ممتاز 🌟', good: 'كويس 👍', needs: 'محتاج متابعة ⚠️' };
const tStarted = s => Date.now() >= new Date(s.scheduled_at).getTime() - 5 * 60e3;
const tRepFor = s => (T.reports || []).find(r => r.session_id === s.id || (s.group_key && r.group_key === s.group_key) || (s.rows || []).some(x => x.id === r.session_id));
function tRepLine(s) {
  const r = tRepFor(s); if (!r) return '';
  return `<div class="rep-line mt">📝 التقرير: ${r.attended ? `<b>${durLabel(r.minutes)}</b>${r.topics ? ' · ' + esc(r.topics.slice(0, 60)) + (r.topics.length > 60 ? '…' : '') : ''}` : '<b class="neg">الطالب ماحضرش</b>'}
    · ${r.sent_at ? '<span class="pos">وصل لولي الأمر ✓</span>' : '<span class="sub">عند الإشراف</span>'}</div>`;
}
function tRepBtn(s) {
  if (tCancelled(s) || !tStarted(s)) return '';
  const r = tRepFor(s);
  if (r && r.sent_at) return '';
  const ended = Date.now() >= new Date(s.scheduled_at).getTime() + (s.duration_minutes || 60) * 60e3 - 10 * 60e3;
  return `<button class="btn ${r ? 'btn-ghost' : ended ? 'btn-brand' : 'btn-ghost'} sm" onclick="tutorReport(${jsq(s.id)})">📝 ${r ? 'تعديل التقرير' : 'اكتبي تقرير الحصة'}</button>`;
}
function tutorReport(sessionId) {
  if (T.preview) return showToast('ده عرض معاينة — المعلمة هي اللي بتكتب التقرير من حسابها');
  const s = tOcc(T.week).find(x => x.id === sessionId || (x.rows || []).some(r => r.id === sessionId)); if (!s) return;
  const old = tRepFor(s);
  const members = s.group_key ? (s.rows || [s]).map(r => ({ id: r.student_id, name: r.student_name })) : [];
  const planned = s.duration_minutes || 60;
  const R = window._tr = { attended: old ? old.attended : true, absent: new Set(old?.absent_ids || []), mins: old?.minutes || tMins(s) || planned, durChanged: !!(old?.minutes && old.minutes !== planned),
    topics: old?.topics || '', homework: old?.homework || '', level: old?.level || '', note: old?.tutor_note || '' };
  const render = () => {
    const opts = [...new Set([planned, planned + 15, planned + 30, planned + 60, Math.max(15, planned - 15)])].sort((a, b) => a - b);
    document.getElementById('modal-body').innerHTML = `
      <div class="sub small mb">${esc(s.group_key ? '👥 ' + (s.group_name || 'مجموعة') : s.student_name)} · ${esc(s.subject || '')} · ${esc(relDayLabel(s.scheduled_at, CAIRO_TZ))} ${tTime(s.scheduled_at)}</div>
      ${s.group_key ? `<div class="field"><label>مين حضر؟</label><div class="gm-list">${members.map(m => `<label class="gm-row gm-check"><input type="checkbox" ${R.absent.has(m.id) ? '' : 'checked'} onchange="_tr.absent[this.checked ? 'delete' : 'add'](${jsq(m.id)})"> <b>${esc(m.name)}</b></label>`).join('')}</div></div>`
        : `<div class="field"><label>الطالب حضر؟</label><div class="seg-wrap"><button type="button" class="chip ${R.attended ? 'active' : ''}" onclick="_tr.attended=true; _trRender()">✅ حضر</button><button type="button" class="chip ${!R.attended ? 'active' : ''}" onclick="_tr.attended=false; _trRender()">🚫 ماحضرش</button></div></div>`}
      ${R.attended ? `<div class="field"><label>الحصة خدت وقتها؟</label><div class="seg-wrap">
          <button type="button" class="chip ${!R.durChanged ? 'active' : ''}" onclick="_tr.durChanged=false; _tr.mins=${planned}; _trRender()">✅ آه (${durLabel(planned)})</button>
          <button type="button" class="chip ${R.durChanged ? 'active' : ''}" onclick="_tr.durChanged=true; _trRender()">⏱ لأ، المدة اختلفت</button></div></div>
        ${R.durChanged ? `<div class="field"><label>المدة الفعلية</label><div class="chips" style="margin:0">${opts.filter(m => m !== planned).map(m => `<button type="button" class="chip ${R.mins === m ? 'active' : ''}" onclick="_tr.mins=${m}; _trRender()">${durLabel(m)}</button>`).join('')}</div></div>
        ${hmHtml('tr_hm', R.mins)}` : ''}
        <div class="field"><label>اتشرح إيه في الحصة؟</label><textarea id="tr-topics" class="input" rows="3" placeholder="مثال: الدرس التاني في الوحدة الأولى — حل تمارين صفحة 20" oninput="_tr.topics=this.value">${esc(R.topics)}</textarea></div>
        <div class="field"><label>الواجب (اختياري)</label><textarea id="tr-hw" class="input" rows="2" placeholder="مثال: تمارين 1 لـ 5 صفحة 22" oninput="_tr.homework=this.value">${esc(R.homework)}</textarea></div>
        <div class="field"><label>مشاركة الطالب (اختياري)</label><div class="seg-wrap">${Object.entries(T_LEVEL).map(([k, l]) => `<button type="button" class="chip ${R.level === k ? 'active' : ''}" onclick="_tr.level=_tr.level==='${k}'?'':'${k}'; _trRender()">${l}</button>`).join('')}</div></div>` : ''}
      <div class="field"><label>🔒 ملاحظة للإشراف بس (مش هتوصل لولي الأمر)</label><textarea id="tr-note" class="input" rows="2" oninput="_tr.note=this.value">${esc(R.note)}</textarea></div>
      <div id="form-error" class="err hidden"></div>
      <div class="modal-foot"><button class="btn btn-brand" id="form-submit" onclick="_trSend()">${old ? 'حفظ التعديل' : 'إرسال التقرير للإشراف'}</button><button class="btn btn-ghost" onclick="closeModal()">إلغاء</button></div>
      <p class="sub small">الإشراف بيراجع التقرير ويبعته لولي الأمر. المدة اللي بتكتبيها هي اللي بتتسجل في حسابك بعد ما الإشراف يأكدها.</p>`;
  };
  window._trRender = () => { render(); hmWire('tr_hm', v => { R.mins = v; document.querySelectorAll('#modal-body .chips .chip').forEach(c => c.classList.remove('active')); }); };
  openModal(old ? '✏️ تعديل تقرير الحصة' : '📝 تقرير الحصة', ''); window._trRender();
  window._trSend = () => runSubmit(async () => {
    const attended = s.group_key ? R.absent.size < members.length : R.attended;
    if (!R.durChanged) R.mins = planned;
    if (attended && !(R.mins >= 5 && R.mins <= 720)) return formError('اكتبي مدة الحصة صح');
    if (attended && !R.topics.trim()) return formError('اكتبي اتشرح إيه في الحصة — ده اللي بيوصل لولي الأمر');
    const { error } = await sb.rpc('tutor_report_submit', { p_session: s.id, p_attended: attended, p_absent: [...R.absent], p_minutes: attended ? R.mins : null,
      p_topics: attended ? R.topics : null, p_homework: attended ? R.homework : null, p_level: attended ? R.level || null : null, p_note: R.note || null });
    if (error && /already sent/.test(error.message)) return formError('التقرير اتبعت لولي الأمر خلاص ومينفعش يتعدل — لو فيه تصحيح كلّمي الإشراف');
    if (error && /not started/.test(error.message)) return formError('الحصة لسه مابدأتش');
    if (error && /too old/.test(error.message)) return formError('الحصة دي قديمة — ابعتي التفاصيل للإشراف على الجروب');
    if (error) throw error;
    const who = s.group_key ? `👥 ${s.group_name || 'مجموعة'}` : s.student_name;
    const q = attended && !s.group_key ? await sessionSeq(s.id) : null;
    const absentNames = members.filter(m => R.absent.has(m.id)).map(m => m.name);
    window._trText = `📝 تقرير حصة ${who}${s.subject ? ' — ' + s.subject : ''} (${T.me.name})
📅 ${relDayLabel(s.scheduled_at, CAIRO_TZ)} الساعة ${tTime(s.scheduled_at)}
${attended ? `⏱ ${durLabel(R.mins)}${R.mins !== planned ? ` ⚠️ (المعاد ${durLabel(planned)})` : ''}${q && q.seq ? `\n${seqLine(q)}` : ''}${absentNames.length ? `\n🚫 غاب: ${absentNames.join('، ')}` : ''}\n📚 ${R.topics.trim()}${R.homework.trim() ? `\n✍️ الواجب: ${R.homework.trim()}` : ''}` : '🚫 الطالب ماحضرش'}`;
    openModal(old ? '✅ اتعدل التقرير' : '✅ التقرير وصل للإشراف', `<p>شكراً 🌷 الإشراف هيراجعه ويبعته لولي الأمر.</p>
      <div class="msg-preview mt">${esc(window._trText)}</div>
      <div class="modal-foot" style="flex-wrap:wrap">${T.me.group ? `<button class="btn btn-wa" onclick="copyAndOpen(window._trText, ${jsq(T.me.group)}); closeModal()">💬 انسخيه وابعتيه على جروب الإشراف</button>` : ''}
        <button class="btn btn-ghost" onclick="copyText(window._trText,'اتنسخ ✓')">📋 نسخ</button><button class="btn btn-ghost" onclick="closeModal()">تمام</button></div>`);
    tutorRefresh();
  });
}

// تذكير التقرير أول ما تفتح البوابة (مرة واحدة في كل فتحة) + فتح التقرير مباشرة من الإشعار (?rep=…)
const T_URL_REP = new URLSearchParams(location.search).get('rep');
function tNeedReports() {
  return tOcc(T.week).filter(s => !tCancelled(s) && !tRepFor(s) && new Date(s.scheduled_at).getTime() > Date.now() - 7 * 864e5
    && Date.now() >= new Date(s.scheduled_at).getTime() + (s.duration_minutes || 60) * 60e3 - 5 * 60e3);
}
function tutorReportPrompt() {
  if (T.preview || T._repPrompted) return;
  if (T_URL_REP && !T._urlRepDone) { T._urlRepDone = true; const s = tOcc(T.week).find(x => x.id === T_URL_REP || (x.rows || []).some(r => r.id === T_URL_REP)); if (s && !tRepFor(s)) { T._repPrompted = true; return tutorReport(s.id); } }
  const need = tNeedReports(); if (!need.length) return;
  T._repPrompted = true;
  const modalOpen = () => !document.getElementById('modal').classList.contains('hidden');
  if (modalOpen()) { // فيه نافذة تانية مفتوحة (زي تفعيل الإشعارات) → استنى لما تتقفل
    let tries = 0; const t = setInterval(() => { if (++tries > 180) return clearInterval(t); if (!modalOpen()) { clearInterval(t); tShowReportPrompt(); } }, 1000);
    return;
  }
  tShowReportPrompt();
}
function tShowReportPrompt() {
  const need = tNeedReports(); if (!need.length) return;
  openModal('📝 متنسيش تقرير الحصة', `<p>${need.length === 1 ? 'فيه حصة خلصت ولسه مالهاش تقرير' : `فيه ${need.length} حصص خلصت ولسه مالهاش تقرير`}. التقرير بياخد دقيقة، والإشراف بيبعته لولي الأمر — وكده حسابك بيتأكد أول بأول ومفيش لخبطة آخر الشهر.</p>
    <div class="list">${need.map(s => `<div class="card item"><div class="item-head" style="gap:8px"><span><b>${esc(s.group_key ? '👥 ' + (s.group_name || 'مجموعة') : s.student_name)}</b> <span class="sub small">${esc(s.subject || '')} · ${esc(relDayLabel(s.scheduled_at, CAIRO_TZ))} ${tTime(s.scheduled_at)}</span></span>
      <button class="btn btn-brand sm" onclick="tutorReport(${jsq(s.id)})">📝 اكتبي التقرير</button></div></div>`).join('')}</div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">بعدين</button></div>`);
}

// عدد التقارير الناقصة على أيقونة التطبيق + عنوان الصفحة، وتنبيه لو الإشعارات مقفولة
async function tutorBadge() {
  if (T.preview) return;
  const n = tNeedReports().length;
  try { if (n && navigator.setAppBadge) await navigator.setAppBadge(n); else if (navigator.clearAppBadge) await navigator.clearAppBadge(); } catch (e) {}
  document.title = (n ? `(${n}) ` : '') + 'بوابة المعلمات — أستاذ أونلاين';
  let off = false;
  try { off = typeof Notification === 'undefined' || Notification.permission !== 'granted' || !(await currentPushSub()); } catch (e) { off = true; }
  if (off !== !!T.pushOff) { T.pushOff = off; if (T.tab === 'today') tutorRender(); }
}
