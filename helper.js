/* ============================================================
   صقّور 🦅 — مساعد أستاذ أونلاين
   مساعد جوه التطبيق للإشراف والمعلمات: بيجاوب على "إزاي أعمل…"،
   بيعرض أرقام النهارده، بيلاقي أي أسرة/معلم بالاسم، وبيعمل جولة تعريفية.
   (من غير ذكاء اصطناعي — كله محلي ومجاني ومن غير ما يطلّع أي بيانات)
   ============================================================ */
(function () {
  'use strict';
  const LS = k => { try { return localStorage.getItem('sq_' + k); } catch (e) { return null; } };
  const LSset = (k, v) => { try { localStorage.setItem('sq_' + k, v); } catch (e) {} };
  const e = v => (typeof esc === 'function' ? esc(v) : String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const N = s => (typeof normAr === 'function' ? normAr(s) : String(s || '').toLowerCase());
  const SQ = { open: false, mode: null, actions: {}, aid: 0, lastAtt: null, greeted: false, busy: false };
  window.SQ = SQ;

  /* ---------------- الكاركتر ---------------- */
  function mascot(size, extra = '') {
    return `<svg class="sq-svg ${extra}" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id="sqBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient>
        <linearGradient id="sqBelly" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dbeafe"/></linearGradient>
        <linearGradient id="sqGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset="1" stop-color="#f59e0b"/></linearGradient>
      </defs>
      <g class="sq-all">
        <ellipse cx="60" cy="113" rx="25" ry="4" fill="rgba(0,0,0,.13)" class="sq-shadow"/>
        <g class="sq-bodyg">
          <path class="sq-wing sq-wing-l" d="M31 66 C15 74 13 98 24 108 C30 96 35 80 31 66Z" fill="#1e3a8a"/>
          <path class="sq-wing sq-wing-r" d="M89 66 C105 74 107 98 96 108 C90 96 85 80 89 66Z" fill="#1e3a8a"/>
          <path d="M60 30 C84 30 93 50 93 72 C93 96 80 107 60 107 C40 107 27 96 27 72 C27 50 36 30 60 30Z" fill="url(#sqBody)"/>
          <path d="M60 64 C75 64 79 76 79 87 C79 99 70 104 60 104 C50 104 41 99 41 87 C41 76 45 64 60 64Z" fill="url(#sqBelly)"/>
          <path d="M51 80 l4 3.5 4-3.5 M61 80 l4 3.5 4-3.5 M46 90 l4 3.5 4-3.5 M56 90 l4 3.5 4-3.5 M66 90 l4 3.5 4-3.5" stroke="#93c5fd" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M33 54 C33 41 45 35 60 35 C75 35 87 41 87 54 C87 66 76 73 60 73 C44 73 33 66 33 54Z" fill="#f8fbff"/>
          <path d="M29 56 C27 36 42 26 60 26 C78 26 93 36 91 56 C86 46 76 42 60 42 C44 42 34 46 29 56Z" fill="#1e3a8a"/>
          <path d="M41 53 C38 61 40 68 45 72 C47 66 48 59 46 53Z" fill="#1e3a8a"/>
          <path d="M79 53 C82 61 80 68 75 72 C73 66 72 59 74 53Z" fill="#1e3a8a"/>
          <g class="sq-eyes">
            <circle cx="47" cy="51" r="9.5" fill="#fff" stroke="#fbbf24" stroke-width="2.6"/><circle cx="73" cy="51" r="9.5" fill="#fff" stroke="#fbbf24" stroke-width="2.6"/>
            <g class="sq-pupils"><circle cx="48" cy="52" r="5.6" fill="#0f172a"/><circle cx="74" cy="52" r="5.6" fill="#0f172a"/>
              <circle cx="50" cy="49.8" r="1.9" fill="#fff"/><circle cx="76" cy="49.8" r="1.9" fill="#fff"/></g>
            <rect class="sq-lid" x="36" y="40" width="48" height="22" fill="#1e3a8a"/>
          </g>
          <g class="sq-happy-eyes"><path d="M39 54 Q47 44 55 54" stroke="#0f172a" stroke-width="4" fill="none" stroke-linecap="round"/>
            <path d="M65 54 Q73 44 81 54" stroke="#0f172a" stroke-width="4" fill="none" stroke-linecap="round"/></g>
          <path d="M38 40 Q46 37 54 41 M66 41 Q74 37 82 40" stroke="#0f172a" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".55"/>
          <path d="M53 59 Q60 54 67 59 Q67 65 61 71 Q60 67 57 65 Q53 63 53 59Z" fill="url(#sqGold)"/>
          <path d="M61 71 Q60.5 67 58 65.5" stroke="#92400e" stroke-width="1.6" fill="none" stroke-linecap="round"/>
          <ellipse cx="38" cy="64" rx="4.5" ry="3" fill="#f9a8d4" opacity=".6"/><ellipse cx="82" cy="64" rx="4.5" ry="3" fill="#f9a8d4" opacity=".6"/>
          <path d="M50 105 l-3 6 M50 105 l0 7 M50 105 l3 6 M70 105 l-3 6 M70 105 l0 7 M70 105 l3 6" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
          <g class="sq-cap" transform="rotate(-9 60 22)">
            <path d="M48 24 L48 30 Q60 35 72 30 L72 24Z" fill="#1e293b"/>
            <path d="M36 22 L60 12 L84 22 L60 32Z" fill="#0f172a"/>
            <path class="sq-tassel" d="M60 22 L79 24 L80 33" stroke="url(#sqGold)" stroke-width="2" fill="none" stroke-linecap="round"/>
            <circle cx="80" cy="34" r="2.6" fill="#f59e0b"/><circle cx="60" cy="22" r="1.8" fill="#f59e0b"/>
          </g>
        </g>
      </g></svg>`;
  }

  /* ---------------- الستايل ---------------- */
  const css = `
  .sq-fab{position:fixed;left:16px;bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:45;width:66px;height:66px;border-radius:50%;
    border:none;padding:0;cursor:pointer;background:radial-gradient(circle at 30% 25%,#ffffff,#e0ecff 60%,#bfdbfe);box-shadow:0 8px 24px rgba(29,78,216,.35),0 2px 6px rgba(0,0,0,.12);
    display:flex;align-items:center;justify-content:center;transition:transform .25s cubic-bezier(.34,1.56,.64,1)}
  .sq-fab:hover{transform:scale(1.08) rotate(-4deg)} .sq-fab:active{transform:scale(.94)}
  .sq-fab.sq-hide{transform:scale(0);pointer-events:none}
  .sq-fab .sq-ring{position:absolute;inset:-4px;border-radius:50%;border:3px solid #f59e0b;opacity:0;pointer-events:none}
  .sq-fab.sq-attn .sq-ring{animation:sqRing 2.2s ease-out infinite}
  .sq-badge{position:absolute;top:-2px;right:-2px;min-width:22px;height:22px;border-radius:11px;background:#ef4444;color:#fff;font-size:12px;font-weight:700;
    display:flex;align-items:center;justify-content:center;padding:0 6px;border:2px solid var(--card,#fff);transform:scale(0);transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
  .sq-fab.sq-attn .sq-badge{transform:scale(1)}
  @media (max-width:700px){.sq-fab{bottom:calc(84px + env(safe-area-inset-bottom,0px));width:58px;height:58px;left:12px}}
  .sq-svg .sq-all{animation:sqFloat 3.2s ease-in-out infinite;transform-origin:60px 100px}
  .sq-svg .sq-shadow{animation:sqShadow 3.2s ease-in-out infinite;transform-origin:60px 112px}
  .sq-svg .sq-lid{transform:scaleY(0);transform-origin:60px 40px;animation:sqBlink 4.6s infinite}
  .sq-svg .sq-tassel{animation:sqTassel 2.4s ease-in-out infinite;transform-origin:60px 22px}
  @keyframes sqTassel{0%,100%{transform:rotate(0)}50%{transform:rotate(6deg)}}
  .sq-svg .sq-happy-eyes{opacity:0}
  .sq-svg.sq-happy .sq-eyes{opacity:0} .sq-svg.sq-happy .sq-happy-eyes{opacity:1}
  .sq-svg.sq-happy .sq-all{animation:sqHop .6s ease-in-out 3}
  .sq-svg .sq-wing-r{transform-origin:90px 66px} .sq-svg .sq-wing-l{transform-origin:30px 66px}
  .sq-svg.sq-wave .sq-wing-r{animation:sqWave .5s ease-in-out 4}
  .sq-svg.sq-think .sq-bodyg{animation:sqTilt 1.2s ease-in-out infinite;transform-origin:60px 90px}
  .sq-svg.sq-think .sq-pupils{transform:translate(2px,-3px);transition:transform .3s}
  .sq-svg .sq-pupils{transition:transform .3s}
  @keyframes sqFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
  @keyframes sqShadow{0%,100%{transform:scaleX(1);opacity:1}50%{transform:scaleX(.82);opacity:.6}}
  @keyframes sqBlink{0%,92%,100%{transform:scaleY(0)}95%{transform:scaleY(1)}}
  @keyframes sqWave{0%,100%{transform:rotate(0)}50%{transform:rotate(-38deg)}}
  @keyframes sqHop{0%,100%{transform:translateY(0)}40%{transform:translateY(-12px)}}
  @keyframes sqTilt{0%,100%{transform:rotate(0)}50%{transform:rotate(-6deg)}}
  @keyframes sqRing{0%{transform:scale(.9);opacity:.9}100%{transform:scale(1.35);opacity:0}}
  .sq-tip{position:fixed;left:92px;bottom:calc(30px + env(safe-area-inset-bottom,0px));z-index:45;max-width:min(300px,calc(100vw - 120px));background:var(--card,#fff);color:var(--text,#111);
    border:1px solid var(--border,#e5e7eb);border-radius:16px 16px 16px 4px;padding:12px 34px 12px 14px;box-shadow:0 10px 30px rgba(0,0,0,.15);font-size:14px;line-height:1.6;
    transform-origin:left bottom;animation:sqPop .45s cubic-bezier(.34,1.56,.64,1);cursor:pointer}
  .sq-tip .sq-x{position:absolute;top:6px;right:8px;border:none;background:none;color:var(--sub,#6b7280);font-size:16px;cursor:pointer}
  @media (max-width:700px){.sq-tip{left:78px;bottom:calc(92px + env(safe-area-inset-bottom,0px))}}
  @keyframes sqPop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
  .sq-panel{position:fixed;left:16px;bottom:calc(96px + env(safe-area-inset-bottom,0px));z-index:48;width:min(400px,calc(100vw - 32px));height:min(600px,calc(100vh - 140px));
    background:var(--card,#fff);color:var(--text,#111);border:1px solid var(--border,#e5e7eb);border-radius:22px;box-shadow:0 20px 60px rgba(0,0,0,.25);
    display:flex;flex-direction:column;overflow:hidden;transform-origin:left bottom;animation:sqPop .4s cubic-bezier(.34,1.56,.64,1)}
  @media (max-width:700px){.sq-panel{left:0;right:0;bottom:0;width:100%;height:min(86vh,680px);border-radius:22px 22px 0 0;transform-origin:center bottom;animation:sqUp .35s ease-out}}
  @keyframes sqUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
  .sq-head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(135deg,#1d4ed8,#3b82f6);color:#fff;position:relative}
  .sq-head .sq-av{width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.95);display:flex;align-items:center;justify-content:center;flex:none;box-shadow:0 2px 8px rgba(0,0,0,.15)}
  .sq-head b{font-size:17px} .sq-head .sq-st{font-size:12px;opacity:.9;display:flex;align-items:center;gap:5px}
  .sq-head .sq-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 3px rgba(74,222,128,.3)}
  .sq-head .sq-hb{margin-inline-start:auto;display:flex;gap:6px}
  .sq-head .sq-hb button{border:none;background:rgba(255,255,255,.18);color:#fff;width:34px;height:34px;border-radius:10px;cursor:pointer;font-size:16px}
  .sq-head .sq-hb button:hover{background:rgba(255,255,255,.3)}
  .sq-body{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--bg,#f4f6f8);scroll-behavior:smooth}
  .sq-msg{max-width:88%;padding:10px 13px;border-radius:16px;font-size:14px;line-height:1.7;animation:sqIn .3s ease-out;word-wrap:break-word}
  .sq-bot{align-self:flex-start;background:var(--card,#fff);border:1px solid var(--border,#e5e7eb);border-top-right-radius:4px}
  .sq-me{align-self:flex-end;background:var(--brand,#1d4ed8);color:#fff;border-top-left-radius:4px}
  @keyframes sqIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  .sq-row{display:flex;gap:8px;align-items:flex-end}
  .sq-row .sq-mini{width:30px;height:30px;flex:none;border-radius:50%;background:#e0ecff;display:flex;align-items:center;justify-content:center}
  .sq-steps{margin:6px 0 0;padding:0;list-style:none;counter-reset:s}
  .sq-steps li{counter-increment:s;position:relative;padding:4px 30px 4px 0;font-size:13.5px}
  .sq-steps li::before{content:counter(s);position:absolute;right:0;top:5px;width:20px;height:20px;border-radius:50%;background:var(--brand-soft,#dbeafe);color:var(--brand,#1d4ed8);
    font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
  .sq-go{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  .sq-go button{border:1px solid var(--brand,#1d4ed8);background:var(--brand,#1d4ed8);color:#fff;border-radius:999px;padding:6px 13px;font-size:13px;cursor:pointer;font-family:inherit}
  .sq-go button.sq-alt{background:transparent;color:var(--brand,#1d4ed8)}
  .sq-go button:hover{filter:brightness(1.08)}
  .sq-stat{display:grid;grid-template-columns:repeat(3,minmax(68px,1fr));gap:6px;margin-top:8px}
  .sq-stat div{background:var(--bg,#f4f6f8);border-radius:12px;padding:8px;text-align:center;font-size:12px;color:var(--sub,#6b7280)}
  .sq-stat b{display:block;font-size:20px;color:var(--text,#111)}
  .sq-list{margin-top:6px;display:flex;flex-direction:column;gap:5px}
  .sq-list button{text-align:right;border:1px solid var(--border,#e5e7eb);background:var(--bg,#f4f6f8);color:var(--text,#111);border-radius:12px;padding:8px 10px;font-size:13px;cursor:pointer;font-family:inherit}
  .sq-list button:hover{border-color:var(--brand,#1d4ed8)}
  .sq-typing{display:inline-flex;gap:4px;padding:12px 14px}
  .sq-typing i{width:7px;height:7px;border-radius:50%;background:var(--sub,#9ca3af);animation:sqDot 1s infinite}
  .sq-typing i:nth-child(2){animation-delay:.15s} .sq-typing i:nth-child(3){animation-delay:.3s}
  @keyframes sqDot{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-5px);opacity:1}}
  .sq-chips{display:flex;gap:6px;overflow-x:auto;padding:8px 12px 2px;scrollbar-width:none;background:var(--card,#fff)}
  .sq-chips::-webkit-scrollbar{display:none}
  .sq-chips button{flex:none;border:1px solid var(--border,#e5e7eb);background:var(--bg,#f4f6f8);color:var(--text,#111);border-radius:999px;padding:6px 12px;font-size:12.5px;cursor:pointer;font-family:inherit;white-space:nowrap}
  .sq-chips button:hover{border-color:var(--brand,#1d4ed8);color:var(--brand,#1d4ed8)}
  .sq-foot{display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));background:var(--card,#fff);border-top:1px solid var(--border,#e5e7eb)}
  .sq-foot textarea{flex:1;border:1px solid var(--border,#e5e7eb);background:var(--bg,#f4f6f8);color:var(--text,#111);border-radius:20px;padding:10px 16px;font-size:14px;font-family:inherit;outline:none;resize:none;max-height:140px;line-height:1.5}
  .sq-foot .sq-mic{background:var(--bg,#f4f6f8);color:var(--text,#111);border:1px solid var(--border,#e5e7eb);font-size:20px}
  .sq-foot .sq-mic.rec{background:#dc2626;color:#fff;border-color:#dc2626;animation:sqPulse 1s infinite;font-size:13px;font-weight:700}
  @keyframes sqPulse{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.5)}50%{box-shadow:0 0 0 8px rgba(220,38,38,0)}}
  .sq-foot textarea:focus{border-color:var(--brand,#1d4ed8)}
  .sq-foot button{width:44px;height:44px;border-radius:50%;border:none;background:var(--brand,#1d4ed8);color:#fff;font-size:18px;cursor:pointer;flex:none}
  .sq-tour-hole{position:fixed;z-index:70;border-radius:14px;box-shadow:0 0 0 9999px rgba(15,23,42,.62);transition:all .45s cubic-bezier(.4,0,.2,1);pointer-events:none;outline:3px solid #f59e0b;outline-offset:3px}
  .sq-tour-card{position:fixed;z-index:71;width:min(320px,calc(100vw - 24px));background:var(--card,#fff);color:var(--text,#111);border-radius:18px;padding:14px;box-shadow:0 20px 50px rgba(0,0,0,.35);
    transition:top .45s cubic-bezier(.4,0,.2,1),left .45s cubic-bezier(.4,0,.2,1);display:flex;gap:10px;align-items:flex-start}
  .sq-tour-card .sq-tt{font-size:14px;line-height:1.7;flex:1}
  .sq-tour-card .sq-tn{display:flex;gap:6px;margin-top:10px;align-items:center}
  .sq-tour-card .sq-tn span{font-size:12px;color:var(--sub,#6b7280);margin-inline-end:auto}
  .sq-tour-card button{border:none;border-radius:999px;padding:6px 14px;cursor:pointer;font-family:inherit;font-size:13px}
  .sq-tour-card .sq-n{background:var(--brand,#1d4ed8);color:#fff} .sq-tour-card .sq-s{background:transparent;color:var(--sub,#6b7280)}
  .sq-confetti{position:fixed;inset:0;pointer-events:none;z-index:80;overflow:hidden}
  .sq-confetti i{position:absolute;top:-12px;width:9px;height:14px;border-radius:2px;animation:sqFall linear forwards}
  @keyframes sqFall{to{transform:translateY(105vh) rotate(720deg);opacity:.9}}
  @media (prefers-reduced-motion: reduce){.sq-svg *, .sq-fab .sq-ring{animation:none!important}}
  `;

  /* ---------------- أدوات ---------------- */
  const vis = id => { const el = document.getElementById(id); return !!el && !el.classList.contains('hidden'); };
  function mode() { if (vis('view-tutor')) return 'tutor'; if (vis('view-app')) return 'sup'; return null; }
  function firstName() {
    let n = mode() === 'tutor' ? (window.T && T.me && T.me.name) : (typeof currentSupervisor !== 'undefined' && currentSupervisor && currentSupervisor.name);
    n = String(n || '').replace(/^(أ\.|د\.|مس|مستر|ميس)\s*/, '').trim().split(/\s+/)[0] || '';
    return n;
  }
  function hello() { const h = new Date().getHours(); return h < 12 ? 'صباح الخير' : h < 17 ? 'أهلاً' : 'مساء الخير'; }
  function act(label, fn, alt) { const id = 'a' + (++SQ.aid); SQ.actions[id] = fn; return `<button class="${alt ? 'sq-alt' : ''}" data-sq-act="${id}">${label}</button>`; }
  function go(fn) { closePanel(); setTimeout(() => { try { fn(); } catch (err) { console.warn(err); } }, 220); }
  function attItems() { return [...document.querySelectorAll('#attention .att')]; }
  function safe(fn, d) { try { return fn(); } catch (err) { return d; } }
  function todayCount() {
    if (mode() === 'tutor') {
      const td = new Date().toDateString();
      const rows = safe(() => (typeof tOcc === 'function' ? tOcc(T.week || []) : (T.week || T.sessions || [])).filter(s => new Date(s.scheduled_at).toDateString() === td && !String(s.status).startsWith('cancelled')), []);
      return { n: rows.length, done: rows.filter(s => s.status === 'done').length, rows };
    }
    if (typeof state === 'undefined' || state.day !== (typeof todayStr === 'function' ? todayStr() : '')) return null;
    let rows = (state.daySessions || []).filter(s => !String(s.status).startsWith('cancelled'));
    if (typeof occurrences === 'function') rows = occurrences(rows);
    return { n: rows.length, done: rows.filter(s => s.status === 'done').length, rows };
  }

  /* ---------------- قاعدة المعرفة ---------------- */
  const KB_SUP = [
    { id: 'today', t: '📅 حصص النهارده', k: ['حصص النهارده', 'النهارده', 'انهارده', 'حصص اليوم', 'جدول اليوم', 'عندي كام حصه', 'كام حصه'], live: liveToday },
    { id: 'att', t: '🔔 إيه اللي محتاج انتباهي؟', k: ['انتباه', 'المطلوب', 'مطلوب مني', 'اعمل ايه', 'محتاج ايه', 'متاخر', 'ناقص', 'تنبيهات', 'مهام'], live: liveAttention },
    { id: 'next', t: '⏰ الحصة الجاية', k: ['الحصه الجايه', 'الجايه', 'اللي بعدها', 'امتي الحصه'], live: liveNext },
    { id: 'tour', t: '🧭 لفّني في التطبيق', k: ['جوله', 'لفني', 'عرفني', 'اشرحلي التطبيق', 'ابدا منين', 'مش فاهم', 'تعليمات'], live: () => { go(startTour); return null; } },
    { id: 'done', t: '✅ أسجل إن الحصة تمت', ctx: ['daily'], k: ['تمت', 'خلصت', 'اتعملت', 'اسجل الحصه', 'اقفل الحصه', 'تسجيل حصه', 'خلصنا', 'ادت الحصه'],
      steps: ['من تبويب <b>📅 الجدول</b> اضغط على كارت الحصة', 'اختار <b>✅ تمت</b>', 'لو المدة اختلفت (ساعة ونص مثلاً) غيّرها قبل الحفظ — الحساب بيمشي على الوقت'], go: ['📅 افتح الجدول', () => switchTab('daily')], note: 'الحصة مش بتتحسب على الأسرة ولا للمعلم غير لما تتسجل "تمت".' },
    { id: 'cancel', t: '❌ ألغي حصة', ctx: ['daily'], k: ['الغي', 'الغاء', 'اتلغت', 'لغت', 'اعتذرت', 'اعتذر', 'غياب', 'محضرش', 'محضرتش', 'مش هتحضر'],
      steps: ['اضغط على كارت الحصة في <b>📅 الجدول</b>', 'اختار <b>❌ إلغاء</b>', 'حدد <b>مين اللي لغى</b>: الأسرة ولا المعلم ولا الأكاديمية — ده بيفرق في الحساب', 'اكتب السبب، ولو الإلغاء دايم اختار "كل الحصص الجاية"'], go: ['📅 افتح الجدول', () => switchTab('daily')] },
    { id: 'move', t: '🔁 أأجل أو أغير معاد حصة', ctx: ['daily'], k: ['اجل', 'تاجيل', 'اغير المعاد', 'غير المعاد', 'ميعاد تاني', 'معاد تاني', 'انقل الحصه', 'تعويض', 'بدل الحصه'],
      steps: ['اضغط على كارت الحصة', 'اختار <b>📆 تأجيل / تغيير معاد</b>', 'حدد المعاد الجديد — وقول هل التغيير مرة واحدة ولا دايم', 'المعلمة بيوصلها إشعار بالتغيير لوحدها لو على التطبيق'], go: ['📅 افتح الجدول', () => switchTab('daily')] },
    { id: 'add', t: '➕ أضيف حصة جديدة', k: ['اضيف حصه', 'حصه جديده', 'احجز', 'اضافه حصه', 'حصه زياده', 'اعمل حصه'],
      steps: ['اضغط <b>+ حصة</b> من الجدول', 'اختار الطالب والمعلم والمادة', 'حدد المعاد والمدة — السعر بيتملا لوحده من بيانات الطالب والمعلم', 'لو الحصة بتتكرر كل أسبوع فعّل التكرار'], go: ['➕ حصة جديدة', () => openSessionForm(null)] },
    { id: 'remind', t: '💬 أبعت تذكير واتساب', ctx: ['daily'], k: ['تذكير', 'فكر', 'ذكر', 'ابعت رساله', 'واتساب', 'رساله تذكير', 'لينك الحصه'],
      steps: ['في كارت الحصة اضغط <b>💬 تذكير</b>', 'هتلاقي رسالتين جاهزين: واحدة لولي الأمر وواحدة للمعلم — من غير أرقام الطرف التاني', 'اضغط نسخ وابعتها على الجروب'], go: ['📅 افتح الجدول', () => switchTab('daily')] },
    { id: 'reports', t: '📝 تقارير الحصص', k: ['تقرير', 'تقارير', 'اعتمد', 'ابعت التقرير', 'تقرير الحصه'],
      steps: ['افتح <b>📝 التقارير</b>', 'كل تقرير جنبه حالتين: الحصة اتسجلت؟ واتعتمد للأسرة؟', 'زرار <b>⚡ سجّل واعتمد الكل</b> بيخلص كله مرة واحدة'], go: ['📝 افتح التقارير', () => openReports()] },
    { id: 'missing', t: '⏳ حصص من غير تقرير', k: ['مالهاش تقرير', 'ناقص تقرير', 'من غير تقرير', 'مبعتتش تقرير'], go: ['⏳ اعرضها', () => openMissingReports()], steps: ['دي حصص عدّى معادها والمعلمة لسه ما كتبتش تقريرها', 'ابعتلها فكّرها من الجروب بتاعها'] },
    { id: 'unrec', t: '🕓 حصص عدّت ومتسجلتش', k: ['متسجلتش', 'عدت', 'مفتوحه', 'ما اتسجلتش', 'لسه مفتوحه'], go: ['🕓 اعرضها', () => openUnrecorded()], steps: ['دي حصص معادها عدّى ولسه ما اتقالش عليها تمت ولا اتلغت', 'سجّل كل واحدة: ✅ تمت أو ❌ اتلغت'] },
    { id: 'family', t: '👨‍👩‍👧 أضيف أسرة جديدة', k: ['اسره جديده', 'اضيف اسره', 'عميل جديد', 'عيله جديده', 'ولي امر جديد'],
      steps: ['اضغط <b>+ أسرة</b>', 'اكتب الاسم والدولة — العملة بتتحدد لوحدها (درهم/ريال/جنيه)', 'اختار طريقة الدفع: شهري أو أسبوعي أو باقة', 'بعد الحفظ ضيف الطلاب من كارت الأسرة'], go: ['👨‍👩‍👧 أسرة جديدة', () => openFamilyForm()] },
    { id: 'student', t: '🎒 أضيف طالب لأسرة', k: ['طالب جديد', 'اضيف طالب', 'ابن جديد', 'بنت جديده'],
      steps: ['من تبويب <b>👨‍👩‍👧 الأسر</b> افتح كارت الأسرة', 'اضغط <b>+ طالب</b>', 'اكتب الصف والمنهج و<b>سعر الساعة</b> بعملة الأسرة', 'ضيف المواد والمعلمين وسعر كل معلم'], go: ['👨‍👩‍👧 افتح الأسر', () => switchTab('families')] },
    { id: 'pay', t: '💵 أسجل دفعة من أسرة', k: ['دفع', 'دفعه', 'دفعت', 'فلوس وصلت', 'حولت', 'تحويل', 'استلمت', 'سداد', 'سددت'],
      steps: ['اضغط <b>+ دفعة</b>', 'اختار الأسرة واكتب المبلغ بعملتها', 'لو وصلت بالجنيه اكتب اللي وصل فعلاً عشان فرق العملة يتحسب صح'], go: ['💵 دفعة جديدة', () => openPaymentForm()] },
    { id: 'invoice', t: '📄 أطلع حساب أسرة', k: ['فاتوره', 'حساب الاسره', 'ابعت الحساب', 'كشف حساب', 'حسابهم', 'عليهم كام', 'مستحقات الاسره'], ent: 'family',
      steps: ['افتح الأسرة ← <b>📒 كشف حساب</b>', 'هتشوف كل شهر: الحصص واللي عليها واللي دفعته والرصيد', 'تحت فيه <b>🔍 تفصيل الحصص</b>: كل طالب خد كام ساعة في كل مادة ومع مين', 'زرار <b>📄 فاتورة</b> بيطلعلك رسالة جاهزة لولي الأمر'], go: ['👨‍👩‍👧 افتح الأسر', () => switchTab('families')] },
    { id: 'holiday', t: '🏖 أسجل إجازة لأسرة', k: ['اجازه', 'مسافرين', 'سفر', 'مسافره', 'العيد', 'اسبوع اجازه'], ent: 'family',
      steps: ['افتح كارت الأسرة ← <b>🏖 إجازة</b>', 'اختار من يوم لحد يوم والسبب', 'هتشوف الحصص اللي هتتلغي قبل التأكيد — ومش بتتحسب لا على الأسرة ولا للمعلم'], go: ['👨‍👩‍👧 افتح الأسر', () => switchTab('families')] },
    { id: 'portal', t: '🔗 لينك بوابة ولي الأمر', k: ['بوابه ولي الامر', 'لينك الاسره', 'رابط ولي الامر', 'بوابه الاسره', 'لينك ولي الامر'], ent: 'family',
      steps: ['افتح كارت الأسرة ← <b>🔗 بوابة ولي الأمر</b>', 'انسخ الرسالة الجاهزة اللي فيها اللينك وابعتها للأسرة', 'ولي الأمر بيشوف جدول ولاده وتقاريرهم وحساباتهم من غير ما يحتاج يعمل حساب'], go: ['👨‍👩‍👧 افتح الأسر', () => switchTab('families')] },
    { id: 'relay', t: '🔁 أرحّل رسالة أو ماتيريال', k: ['ترحيل', 'ماتيريال', 'ورقه', 'شيت', 'ملف', 'رساله للمعلم', 'رساله لولي الامر', 'طلب من الام', 'الام عايزه', 'الاب عايز'],
      steps: ['تبويب <b>🔁 الترحيل</b> ← <b>+ مهمة</b>', 'اكتب الطلب: مين طلبه، ولمين، وإيه المطلوب', 'لما تخلّصه اضغط <b>✓ اتسلم</b> — كده الطرفين ما بيتواصلوش مباشرة أبداً'], go: ['🔁 مهمة ترحيل', () => openRelayForm()] },
    { id: 'tutor', t: '🧑‍🏫 أضيف معلم جديد', k: ['معلم جديد', 'مدرس جديد', 'معلمه جديده', 'مدرسه جديده', 'اضيف معلم', 'اضيف مدرس'],
      steps: ['تبويب <b>🧑‍🏫 المعلمون</b> ← <b>+ معلم</b>', 'اكتب الاسم و<b>سعر الساعة</b> بالجنيه ورقم التحويل ولينك الجروب', 'لما تربطه بطالب تقدر تحدد سعر مختلف للطالب ده'], go: ['🧑‍🏫 معلم جديد', () => openTutorForm()] },
    { id: 'tpay', t: '💰 حساب معلم ومستحقاته', k: ['حساب المعلم', 'حساب المعلمه', 'مستحقات', 'ادفع للمعلم', 'صرف', 'اصرف', 'فلوس المدرس', 'فلوس المعلمه', 'كام للمعلمه'], ent: 'tutor',
      steps: ['افتح المعلم ← <b>كشف حساب</b>', 'هتشوف كل حصة اتعملت وكل صرف والمستحق دلوقتي', 'زرار <b>صرف المستحقات</b> بيسجل إنك دفعتله'], go: ['🧑‍🏫 افتح المعلمين', () => switchTab('tutors')] },
    { id: 'invite', t: '📲 أدخّل معلمة على التطبيق', k: ['دعوه', 'ادخل المعلمه', 'حساب للمعلمه', 'بوابه المعلمه', 'المعلمه تدخل', 'تفعيل المعلمه'], ent: 'tutor',
      steps: ['افتح المعلمة ← <b>📲 دعوة</b>', 'ابعتلها الرسالة الجاهزة باللينك', 'هتشوف حصصها بس وتكتب تقاريرها وتعرف حسابها — من غير أي بيانات للأسر'], go: ['🧑‍🏫 افتح المعلمين', () => switchTab('tutors')] },
    { id: 'treq', t: '📨 طلبات المعلمات', k: ['طلبات المعلمات', 'طلب من المعلمه', 'المعلمه طالبه', 'طلبات'], go: ['📨 اعرض الطلبات', () => openTutorRequests()], steps: ['المعلمات بيبعتوا من التطبيق: تغيير معاد، اعتذار، حصة زيادة، طالب حضر بدل التاني', 'وافق أو ارفض — والتعديل بيتنفذ لوحده'] },
    { id: 'trial', t: '🧪 الحصص التجريبية', k: ['تجريبيه', 'تجربه', 'حصه تجربه', 'نتيجه التجريبيه'], go: ['🧪 اللي مستنية نتيجة', () => openPendingTrials()], steps: ['الحصة التجريبية مجانية على الأسرة والمعلم بياخدها', 'بعدها سجّل النتيجة: كمّلت ولا لأ ولو لأ ليه'] },
    { id: 'group', t: '👥 حصة جماعية (إخوات مع بعض)', k: ['جروب', 'مجموعه', 'جماعي', 'جماعيه', 'اخوات مع بعض', 'توائم'], go: ['👥 مجموعة جديدة', () => openGroupForm(null)], steps: ['اضغط <b>+ مجموعة</b> واختار الطلاب', 'اكتب سعر الساعة للمعلم <b>للجروب كله</b> وسعر كل طالب', 'لو طالب غاب بيتخصم نصيبه من الحصة دي بس'] },
    { id: 'alerts', t: '🔔 التنبيهات والمنبه', k: ['اشعار', 'اشعارات', 'منبه', 'تنبيه', 'صوت', 'رن', 'يرن', 'نوتيفيكيشن'], go: ['🔔 إعدادات التنبيه', () => openAlertsPanel()], steps: ['فعّل الإشعارات عشان يوصلك تنبيه قبل كل حصة بربع ساعة', 'على الآيفون: من إعدادات ntfy فعّل <b>Time Sensitive</b> عشان التنبيه يعدي حتى في وضع التركيز'] },
    { id: 'search', t: '🔍 أدوّر على أي حاجة', k: ['ابحث', 'دور', 'بحث', 'الاقي'], go: ['🔍 افتح البحث', () => openGlobalSearch()], steps: ['اكتب اسم أسرة أو طالب أو معلم', 'البحث مش بيفرق بين أ وإ وا ولا ة وه', 'أو اكتب الاسم هنا لصقّور وأنا أجيبهولك 😉'] },
    { id: 'week', t: '🗓 جدول الأسبوع', k: ['الاسبوع', 'جدول الاسبوع', 'الاسبوع ده', 'الايام الجايه'], go: ['🗓 اعرض الأسبوع', () => { switchTab('daily'); setDayMode('week'); }], steps: ['من الجدول اختار <b>أسبوع</b> بدل <b>يوم</b>'] },
    { id: 'scheds', t: '📋 جداول الأسر والمعلمين', k: ['جدول الاسره', 'جدول المعلم', 'جدول المعلمه', 'مواعيد ثابته', 'جداول'], go: ['📋 جداول الأسر', () => openFamilySchedules()], go2: ['📋 جداول المعلمين', () => openTutorSchedules()], steps: ['كل أسرة وكل معلم ليه جدول أسبوعي تقدر تنسخه وتبعته'] },
    { id: 'lead', t: '🌱 عميل جديد من الإعلان', k: ['عميل محتمل', 'ليد', 'ليدز', 'اعلان', 'متابعه', 'كلمني من الاعلان'], go: ['🌱 عميل محتمل جديد', () => openLeadForm()], steps: ['سجّله أول ما يكلمك: الاسم والبلد وعدد الأولاد ومنين عرفنا', 'حدّث حالته: اتكلمنا ← تجريبية ← اشترك', 'التطبيق بيفكرك بالمتابعة'] },
    { id: 'owe', t: '💸 مين عليه فلوس؟', k: ['عليه فلوس', 'عليهم فلوس', 'متاخرين في الدفع', 'مدفعوش', 'مدفعتش', 'مستحقات الاسر'], live: liveOwing },
  ];
  const KB_TUT = [
    { id: 'ttoday', t: '📅 حصصي النهارده', k: ['النهارده', 'حصصي', 'عندي كام حصه', 'حصص اليوم', 'جدولي'], live: liveToday },
    { id: 'ttour', t: '🧭 لفّني في البوابة', k: ['جوله', 'لفني', 'عرفني', 'اشرحلي', 'ابدا منين', 'مش فاهمه'], live: () => { go(startTour); return null; } },
    { id: 'trep', t: '📝 أكتب تقرير الحصة', k: ['تقرير', 'اكتب التقرير', 'التقرير'], steps: ['من <b>📅 حصصي</b> اضغط <b>📝 التقرير</b> تحت الحصة بعد ما تخلص', 'اكتب اللي اتشرح والواجب ومستوى الطالب', 'جاوبي: الطالب عمل واجب الحصة اللي فاتت؟', 'الإشراف بيراجعه ويبعته لولي الأمر'], go: ['📅 حصصي', () => tutorTab('today')] },
    { id: 'tjoin', t: '🎥 أدخل الحصة', k: ['ادخل الحصه', 'لينك', 'زووم', 'zoom', 'الدخول'], steps: ['قبل الحصة بشوية هيظهر زرار <b>🎥 دخول الحصة</b> في كارتها', 'الضغط عليه بيأكد كمان إنك جاية — فمش هيوصلك تذكير تاني'], go: ['📅 حصصي', () => tutorTab('today')] },
    { id: 'tlink', t: '🔗 أغير لينك الزووم', k: ['اغير اللينك', 'لينك جديد', 'تغيير اللينك', 'لينك الزووم'], steps: ['من <b>🎒 طلابي</b> اختاري الطالب', 'اضغطي ✏️ جنب اللينك واكتبي الجديد'], go: ['🎒 طلابي', () => tutorTab('students')] },
    { id: 'tmoney', t: '💰 حسابي ومستحقاتي', k: ['حسابي', 'فلوسي', 'مستحقاتي', 'كشف', 'كام ليا', 'اتدفعلي'], go: ['💰 كشف حسابي', () => tutorStatement(false)], go2: ['📋 بالتفصيل', () => tutorStatement(true)], steps: ['تبويب <b>💰 حسابي</b> فيه حصص الشهر والمدفوع والباقي', '"كشف حسابي" بيطلعلك رسالة جاهزة تنسخيها'] },
    { id: 'tpayreq', t: '💸 أطلب صرف مستحقاتي', k: ['اطلب فلوسي', 'صرف', 'عايزه فلوسي', 'تحويل', 'ادفعولي'], go: ['💸 طلب صرف', () => tutorPaymentRequest()] },
    { id: 'treq', t: '📆 أغير معاد أو أعتذر عن حصة', k: ['اعتذر', 'الغي', 'اغير المعاد', 'تاجيل', 'اجل', 'مش هقدر', 'حصه زياده', 'تعويض'], steps: ['في كارت الحصة اضغطي <b>طلب تغيير</b>', 'اختاري: تأجيل، اعتذار، أو الطالب ما حضرش', 'الإشراف بيوافق ويبلغ الأسرة — من غير ما تكلميهم مباشرة'], go: ['📅 حصصي', () => tutorTab('today')] },
    { id: 'talerts', t: '🔔 تنبيه قبل الحصة', k: ['تنبيه', 'منبه', 'اشعار', 'صوت', 'يرن', 'تذكير'], go: ['🔔 فعّلي التنبيه', () => tutorAlertsPanel()], steps: ['فعّلي الإشعارات عشان يوصلك تذكير قبل كل حصة', 'لو عايزاه يرن بصوت عالي فعّلي "المنبه" من نفس الشاشة'] },
    { id: 'tperf', t: '📊 أدائي الشهر ده', k: ['اداء', 'ادائي', 'تقييم', 'نقاط', 'معلمه الشهر'], go: ['💰 افتح حسابي', () => tutorTab('money')], steps: ['في <b>💰 حسابي</b> هتلاقي كارت "أداءك الشهر ده": الحصص، الالتزام بالتقارير، والطلاب'] },
  ];
  const TALK = [
    { k: ['شكرا', 'تسلم', 'متشكر', 'مرسي', 'thanks', 'جزاك الله'], r: ['العفو 🦅 ده شغلي!', 'تحت أمرك دايماً 💙', 'ولا يهمك، أنا موجود هنا لو احتجت أي حاجة'] },
    { k: ['انت مين', 'اسمك', 'مين صقور', 'مين انت'], r: ['أنا <b>صقّور</b> 🦅 مساعد أستاذ أونلاين — نظري حاد ومش بفوّت حصة! اسألني عن أي حاجة في التطبيق.'] },
    { k: ['السلام عليكم', 'سلام عليكم'], r: ['وعليكم السلام ورحمة الله 🌹 أقدر أساعدك في إيه؟'] },
    { k: ['ازيك', 'عامل ايه', 'اخبارك', 'هاي', 'hello', 'hi'], r: ['الحمد لله تمام 🦅 وانت؟ قولّي محتاج إيه وأنا معاك.'] },
    { k: ['برافو', 'شاطر', 'جامد', 'حلو'], r: ['🥹 ده من ذوقك! يلا نكمل؟'] },
  ];
  const STOP = new Set(['ازاي', 'ازاى', 'عايز', 'عايزه', 'عاوز', 'اعمل', 'ممكن', 'فين', 'هل', 'انا', 'يا', 'في', 'من', 'على', 'علي', 'ده', 'دي', 'اللي', 'ايه', 'اي', 'لو', 'و', 'او', 'عن', 'مع', 'لي', 'ليا', 'هو', 'هي', 'صقور', 'ابغي', 'اريد', 'كيف', 'محتاج', 'محتاجه', 'بتاع', 'بتاعه', 'بتاعت', 'حساب', 'كام', 'اسره', 'المعلمه', 'المعلم', 'مس', 'مستر', 'استاذ', 'ميس']);

  function kb() { return mode() === 'tutor' ? KB_TUT : KB_SUP; }
  function scoreEntry(q, it) {
    let s = 0; const qn = ' ' + q + ' ';
    it.k.forEach(k => { const kn = N(k); if (kn && qn.includes(kn)) s += 2 + kn.length / 4; });
    N(it.t).replace(/[^؀-ۿa-z ]/g, '').split(' ').filter(w => w.length > 2 && !STOP.has(w)).forEach(w => { if (qn.includes(' ' + w) || qn.includes(w + ' ')) s += 1; });
    if (it.ctx && typeof currentTab !== 'undefined' && it.ctx.includes(currentTab)) s += .3;
    return s;
  }
  function findEntities(q) {
    if (mode() !== 'sup' || typeof state === 'undefined') return [];
    const words = q.split(' ').filter(w => w.length >= 3 && !STOP.has(w));
    if (!words.length) return [];
    const strip = s => N(s).replace(/^(اسره|عائله|عيله)\s+/, '').replace(/^(ا\.|د\.)\s*/, '');
    const hit = name => { const n = strip(name); return words.some(w => n.split(/[\s()]+/).some(p => p.length >= 3 && (p === w || (w.length >= 4 && p.startsWith(w))))); };
    const out = [];
    (state.families || []).forEach(f => { if (hit(f.name)) out.push({ type: 'family', f }); });
    (state.tutors || []).forEach(t => { if (hit(t.name)) out.push({ type: 'tutor', t }); });
    (state.students || []).forEach(s => { if (hit(s.name) && !s.name.includes('مكررة')) out.push({ type: 'student', s, f: byId(state.families, s.family_id) }); });
    return out.slice(0, 8);
  }
  function entityHtml(x, focus) {
    if (x.type === 'family') {
      const f = x.f, kids = (state.students || []).filter(s => s.family_id === f.id).map(s => s.name).join('، ');
      const bal = safe(() => famBalance(f).balance, null);
      return `<div class="sq-ent"><b>👨‍👩‍👧 ${e(f.name)}</b><div class="small sub">${e(kids)}${bal != null ? ` · ${bal < -0.01 ? 'عليها ' : 'ليها '}${fmt(Math.abs(bal), 2)} ${e(f.currency)}` : ''}</div>
        <div class="sq-go">${act('📒 كشف حساب', () => go(() => openFamilyStatement(f.id)), focus !== 'invoice')}${act('📄 فاتورة', () => go(() => openFamilyInvoice(f.id)), focus !== 'invoice')}${act('📋 الجدول', () => go(() => openSchedule('family', f.id)), true)}
        ${act('🏖 إجازة', () => go(() => openFamilyHoliday(f.id)), focus !== 'holiday')}${act('🔗 بوابة ولي الأمر', () => go(() => openParentLink(f.id)), focus !== 'portal')}${act('💵 دفعة', () => go(() => openPaymentForm(f.id)), true)}</div></div>`;
    }
    if (x.type === 'tutor') {
      const t = x.t;
      return `<div class="sq-ent"><b>🧑‍🏫 ${e(t.name)}</b><div class="small sub">${t.default_rate_egp ? fmt(t.default_rate_egp) + ' ج للساعة' : ''}${t.vodafone_cash || t.bank_account ? ' · 💰 ' + e(t.vodafone_cash || t.bank_account) : ''}</div>
        <div class="sq-go">${act('💰 كشف حسابه', () => go(() => openTutorStatement(t.id)), focus !== 'tpay')}${act('📋 جدوله', () => go(() => openSchedule('tutor', t.id)), true)}${act('👁 بوابته', () => go(() => tutorPreview(t.id)), true)}${act('📲 دعوة', () => go(() => openTutorInvite(t.id)), focus !== 'invite')}</div></div>`;
    }
    const s = x.s, f = x.f;
    return `<div class="sq-ent"><b>🎒 ${e(s.name)}</b> <span class="small sub">${e(s.grade_level || '')}${f ? ' · ' + e(f.name) : ''}</span>
      <div class="sq-go">${act('👤 ملفه', () => go(() => openStudentProfile(s.id)))}${f ? act('📒 حساب الأسرة', () => go(() => openFamilyStatement(f.id)), true) : ''}</div></div>`;
  }

  /* ---------------- إجابات حيّة ---------------- */
  function liveToday() {
    const c = todayCount();
    if (!c) return { html: 'الجدول مفتوح على يوم تاني دلوقتي — خليني أرجعك للنهارده 👇', go: act('📅 حصص النهارده', () => go(() => { switchTab('daily'); setDayMode('day'); setDay(todayStr()); })) };
    const left = c.n - c.done;
    const mood = c.n === 0 ? 'النهارده مفيش حصص — يوم هادي 😌' : left === 0 ? 'كل حصص النهارده خلصت ومتسجلة 🎉 برافو!' : `فاضل <b>${left}</b> ${left === 1 ? 'حصة' : 'حصص'} — يلا بينا 💪`;
    return { html: `${mood}<div class="sq-stat"><div><b>${c.n}</b>حصة النهارده</div><div><b>${c.done}</b>اتسجلت ✅</div><div><b>${left}</b>فاضل</div></div>`,
      go: mode() === 'tutor' ? act('📅 حصصي', () => go(() => tutorTab('today'))) : act('📅 افتح الجدول', () => go(() => { switchTab('daily'); setDayMode('day'); })), happy: c.n > 0 && left === 0 };
  }
  function liveAttention() {
    const items = attItems();
    if (!items.length) return { html: 'مفيش ولا حاجة مستنياك دلوقتي 🎉<br>كل التقارير والحصص والطلبات متظبطة — نَفَس عميق واشرب شاي ☕', happy: true, confetti: true };
    return { html: `فيه <b>${items.length}</b> ${items.length === 1 ? 'حاجة' : 'حاجات'} محتاجين انتباهك — اضغط على أي واحدة:<div class="sq-list">${items.map(b => act(e(b.textContent.trim()), () => go(() => b.click()))).join('')}</div>` };
  }
  function liveNext() {
    const ns = typeof state !== 'undefined' && state.nextSession;
    if (!ns) return { html: 'مفيش حصص جاية متسجلة النهارده ⏰' };
    const v = safe(() => sessionView(ns), {}); const d = new Date(ns.scheduled_at), mins = Math.round((d - Date.now()) / 60e3);
    return { html: `الحصة الجاية: <b>${e(ns.group_key ? (ns.group_name || 'مجموعة') : (v.st && v.st.name) || '')}</b> ${e(ns.subject || '')} مع <b>${e((v.tu && v.tu.name) || (byId(state.tutors, ns.tutor_id) || {}).name || '')}</b><br>⏰ ${d.toLocaleTimeString('ar-EG-u-nu-latn', { hour: 'numeric', minute: '2-digit' })} ${mins > 0 ? `(بعد ${mins < 60 ? mins + ' دقيقة' : Math.floor(mins / 60) + ' ساعة و' + (mins % 60) + ' دقيقة'})` : '(دلوقتي!)'}`,
      go: act('💬 تذكير', () => go(() => openReminder(ns.id)), false) };
  }
  function liveOwing() {
    if (typeof state === 'undefined') return { html: '—' };
    const rows = (state.families || []).map(f => ({ f, b: safe(() => famBalance(f).balance, 0) })).filter(x => x.b < -0.01).sort((a, b) => a.b - b.b);
    if (!rows.length) return { html: 'كل الأسر مسددة 👌 مفيش حد عليه فلوس.', happy: true };
    return { html: `فيه <b>${rows.length}</b> ${rows.length === 1 ? 'أسرة عليها' : 'أسر عليهم'} مستحقات:<div class="sq-list">${rows.slice(0, 8).map(x => act(`${e(x.f.name)} — ${fmt(-x.b, 2)} ${e(x.f.currency)}`, () => go(() => openFamilyStatement(x.f.id)))).join('')}</div>`,
      go: act('💰 افتح المالية', () => go(() => switchTab('fin')), true) };
  }

  /* ---------------- الواجهة ---------------- */
  let fab, panel, body, chips, input, tipEl;
  function build() {
    if (fab) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    fab = document.createElement('button'); fab.className = 'sq-fab sq-hide'; fab.title = 'صقّور — مساعدك';
    fab.innerHTML = `${mascot(56)}<span class="sq-ring"></span><span class="sq-badge">0</span>`;
    fab.onclick = () => (SQ.open ? closePanel() : openPanel());
    document.body.appendChild(fab);
    document.addEventListener('click', ev => { const b = ev.target.closest('[data-sq-act]'); if (b && SQ.actions[b.dataset.sqAct]) { ev.preventDefault(); SQ.actions[b.dataset.sqAct](); } });
    setInterval(tick, 1500); tick();
  }
  function tick() {
    const m = mode();
    if (m !== SQ.mode) { SQ.mode = m; if (SQ.open) closePanel(); if (body) body.innerHTML = ''; SQ.greeted = false; }
    fab.classList.toggle('sq-hide', !m || !!document.querySelector('.sq-tour-hole'));
    if (!m) { hideTip(); return; }
    const n = m === 'sup' ? attItems().length : safe(() => (typeof tNeedReports === 'function' ? tNeedReports().length : 0), 0);
    fab.classList.toggle('sq-attn', n > 0 && !SQ.open);
    fab.querySelector('.sq-badge').textContent = n > 9 ? '9+' : n;
    if (SQ.lastAtt != null && SQ.lastAtt > 0 && n === 0 && m === 'sup') celebrate('برافو! خلّصت كل المطلوب 🎉 كل حاجة متظبطة.');
    SQ.lastAtt = n;
    if (!SQ.greeted && firstName() !== '' && document.readyState === 'complete') { SQ.greeted = true; setTimeout(autoGreet, 2200); }
  }
  function autoGreet() {
    if (!mode() || SQ.open || document.querySelector('.modal')) return;
    const day = new Date().toDateString();
    if (!LS('tour_' + mode())) { showTip(`${hello()} يا ${e(firstName())} 👋 أنا <b>صقّور</b> 🦅 مساعدك الجديد!<br>تحب ألفّك لفة سريعة في التطبيق؟ <b>(دقيقة واحدة)</b>`, () => { hideTip(); startTour(); }, 'wave'); return; }
    if (LS('greet_' + mode()) === day) return;
    LSset('greet_' + mode(), day);
    const c = todayCount(), n = mode() === 'sup' ? attItems().length : 0;
    const parts = [];
    if (c) parts.push(c.n ? `النهارده عندك <b>${c.n}</b> ${c.n === 1 ? 'حصة' : 'حصص'}` : 'النهارده مفيش حصص');
    if (n) parts.push(`و<b>${n}</b> ${n === 1 ? 'حاجة محتاجة' : 'حاجات محتاجين'} انتباهك`);
    showTip(`${hello()} يا ${e(firstName())} 👋 ${parts.join(' ')}${parts.length ? '.' : 'أقدر أساعدك في إيه؟'}`, () => { hideTip(); openPanel(n ? 'att' : null); }, 'wave');
  }
  function showTip(html, onclick, anim) {
    hideTip(); tipEl = document.createElement('div'); tipEl.className = 'sq-tip';
    tipEl.innerHTML = `<button class="sq-x" aria-label="إغلاق">×</button>${html}`;
    tipEl.onclick = ev => { if (ev.target.classList.contains('sq-x')) { hideTip(); return; } onclick && onclick(); };
    document.body.appendChild(tipEl);
    if (anim) mood(fab.querySelector('.sq-svg'), anim, 2200);
    clearTimeout(SQ.tipT); SQ.tipT = setTimeout(hideTip, 14000);
  }
  function hideTip() { if (tipEl) { tipEl.remove(); tipEl = null; } }
  function mood(svg, m, ms) { if (!svg) return; svg.classList.add('sq-' + m); setTimeout(() => svg.classList.remove('sq-' + m), ms || 1800); }

  function openPanel(autoId) {
    hideTip(); SQ.open = true; fab.classList.remove('sq-attn');
    if (!panel) {
      panel = document.createElement('div'); panel.className = 'sq-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'صقّور');
      panel.innerHTML = `<div class="sq-head"><div class="sq-av">${mascot(44, 'sq-headsvg')}</div><div><b>صقّور</b><div class="sq-st"><span class="sq-dot"></span>مساعدك في أستاذ أونلاين</div></div>
        <div class="sq-hb"><button data-x="tour" title="جولة في التطبيق">🧭</button><button data-x="close" title="إغلاق">✕</button></div></div>
        <div class="sq-body"></div><div class="sq-chips"></div>
        <form class="sq-foot"><textarea rows="1" placeholder="${mode() === 'sup' ? 'اكتبلي زي الواتساب: جدول بكرة، تقرير النهارده، إلغاء، سؤال…' : 'اسألني أي حاجة…'}" autocomplete="off"></textarea>${mode() === 'sup' && navigator.mediaDevices && window.MediaRecorder ? '<button type="button" class="sq-mic" aria-label="فويس" title="اتكلم بدل ما تكتب">🎙️</button>' : ''}<button type="submit" aria-label="إرسال">➤</button></form>`;
      document.body.appendChild(panel);
      body = panel.querySelector('.sq-body'); chips = panel.querySelector('.sq-chips'); input = panel.querySelector('textarea');
      const grow = () => { input.style.height = 'auto'; input.style.height = Math.min(140, input.scrollHeight) + 'px'; };
      input.addEventListener('input', grow);
      input.addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.shiftKey && window.innerWidth > 700) { ev.preventDefault(); panel.querySelector('form').requestSubmit(); } });
      panel.querySelector('[data-x=close]').onclick = closePanel;
      panel.querySelector('[data-x=tour]').onclick = () => { closePanel(); setTimeout(startTour, 250); };
      const mic = panel.querySelector('.sq-mic'); if (mic) mic.onclick = () => voiceToggle(mic);
      panel.querySelector('form').onsubmit = ev => { ev.preventDefault(); const v = input.value.trim(); if (!v) return; input.value = ''; input.style.height = 'auto'; ask(v); };
    } else panel.style.display = '';
    renderChips();
    if (!body.children.length) {
      const c = todayCount();
      botSay(`${hello()} يا ${e(firstName())} 👋 أنا <b>صقّور</b> 🦅<br>اسألني "إزاي أعمل…" أو اكتب اسم أي ${mode() === 'tutor' ? 'حاجة' : 'أسرة أو معلم'} وأنا أجيبهولك.${c && c.n ? `<br>النهارده عندك <b>${c.n}</b> ${c.n === 1 ? 'حصة' : 'حصص'} 📅` : ''}`, 'wave');
    }
    if (autoId) setTimeout(() => runIntent(kb().find(x => x.id === autoId)), 500);
    setTimeout(() => window.innerWidth > 700 && input.focus(), 350);
    document.addEventListener('keydown', escClose);
  }
  function escClose(ev) { if (ev.key === 'Escape') closePanel(); }
  function closePanel() { SQ.open = false; if (panel) panel.style.display = 'none'; document.removeEventListener('keydown', escClose); }
  function renderChips() {
    const ctx = typeof currentTab !== 'undefined' ? currentTab : '';
    let list = kb().slice();
    if (mode() === 'sup') {
      const pri = { daily: ['today', 'att', 'done', 'cancel', 'move', 'remind'], families: ['invoice', 'pay', 'family', 'student', 'holiday', 'portal'], tutors: ['tpay', 'tutor', 'invite', 'treq'], relay: ['relay', 'att'], fin: ['owe', 'pay', 'invoice', 'tpay'], reports: ['owe', 'today'] }[ctx] || ['today', 'att'];
      list.sort((a, b) => (pri.includes(b.id) ? 10 - pri.indexOf(b.id) : 0) - (pri.includes(a.id) ? 10 - pri.indexOf(a.id) : 0));
    }
    chips.innerHTML = list.slice(0, 9).map(it => `<button data-q="${it.id}">${e(it.t)}</button>`).join('');
    chips.querySelectorAll('button').forEach(b => b.onclick = () => { const it = kb().find(x => x.id === b.dataset.q); meSay(it.t); runIntent(it); });
  }
  function scroll() { body.scrollTop = body.scrollHeight; }
  function meSay(t) { body.insertAdjacentHTML('beforeend', `<div class="sq-msg sq-me">${e(t)}</div>`); scroll(); }
  function botSay(html, anim) {
    const row = document.createElement('div'); row.className = 'sq-row';
    row.innerHTML = `<div class="sq-mini">${mascot(26)}</div><div class="sq-msg sq-bot">${html}</div>`;
    body.appendChild(row); scroll();
    if (anim) mood(panel.querySelector('.sq-headsvg'), anim, 2000);
  }
  function typing(ms) {
    return new Promise(res => {
      const row = document.createElement('div'); row.className = 'sq-row';
      row.innerHTML = `<div class="sq-mini">${mascot(26)}</div><div class="sq-msg sq-bot sq-typing"><i></i><i></i><i></i></div>`;
      body.appendChild(row); scroll();
      const hs = panel.querySelector('.sq-headsvg'); hs && hs.classList.add('sq-think');
      setTimeout(() => { row.remove(); hs && hs.classList.remove('sq-think'); res(); }, ms);
    });
  }
  async function runIntent(it, ents) {
    if (!it) return;
    await typing(450 + Math.random() * 350);
    if (it.live) {
      const r = it.live(); if (!r) return;
      botSay(r.html + (r.go ? `<div class="sq-go">${r.go}</div>` : ''), r.happy ? 'happy' : null);
      if (r.confetti) confetti();
      return;
    }
    let html = it.steps ? `<b>${e(it.t.replace(/^[^؀-ۿ]+/, ''))}</b><ol class="sq-steps">${it.steps.map(s => `<li>${s}</li>`).join('')}</ol>` : '';
    if (it.note) html += `<div class="small sub" style="margin-top:6px">💡 ${it.note}</div>`;
    const gos = [];
    if (ents && ents.length && it.ent) ents.filter(x => x.type === it.ent || (it.ent === 'family' && x.type === 'student')).slice(0, 3).forEach(x => html += `<div style="margin-top:8px">${entityHtml(x.type === 'student' && x.f ? { type: 'family', f: x.f } : x, it.id)}</div>`);
    else { if (it.go) gos.push(act(it.go[0], () => go(it.go[1]))); if (it.go2) gos.push(act(it.go2[0], () => go(it.go2[1]), true)); }
    botSay(html + (gos.length ? `<div class="sq-go">${gos.join('')}</div>` : ''));
  }
  /* ---------------- صقّور الذكي (Gemini): كلام عادي → عمليات على الحصص بعد التأكيد ---------------- */
  const AI = { hist: [], pending: {}, n: 0 };
  const STATUS_AR = { done: 'تمت ✅', cancelled_by_student: 'اتلغت من الطالب ❌', cancelled_by_tutor: 'اتلغت من المعلم ❌', cancelled_by_academy: 'اتلغت (الأكاديمية) ❌', scheduled: 'مجدولة' };
  function aiWanted(text, ranked, talk) {
    if (mode() !== 'sup') return false;
    const t = String(text);
    if (/\n/.test(t) || t.length > 45) return true;                                   // جدول أو تقرير
    if (/(سجل|سجّل|ضيف|أضف|اضف|الغي|ألغي|لغي|اتلغ|اتأجل|أجّل|اجل|تمت|اتعمل|دخل|دخلت|بكرة|بكره|النهارده|امبارح|كله تمام|الساعة|الساعه|مين بيدرس|مين بتدرس|مدرس|مدرسة|عندنا)/.test(t)) return true;
    if (/\d/.test(t) && t.length > 12) return true;
    return !(talk || (ranked[0] && ranked[0].s >= 2));                               // مافهمش محلياً → نسأل الذكاء
  }
  function cairoDate(d) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(d); }
  function dayLbl(date) {
    const today = cairoDate(new Date()), tm = cairoDate(new Date(Date.now() + 864e5)), ys = cairoDate(new Date(Date.now() - 864e5));
    if (date === today) return 'النهارده'; if (date === tm) return 'بكرة'; if (date === ys) return 'امبارح';
    const d = new Date(date + 'T12:00:00'); return d.toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'numeric' });
  }
  function t12(hm) { if (!hm) return ''; let [h, m] = hm.split(':').map(Number); const ap = h < 12 ? 'ص' : 'م'; h = h % 12 || 12; return `${h}${m ? ':' + String(m).padStart(2, '0') : ''} ${ap}`; }
  const dl = m => (typeof durLabel === 'function' ? durLabel(m) : m + ' د');
  function actHtml(a, i, k) {
    const who = `<b>${e(a.student_name)}</b>${a.subject ? ' · ' + e(a.subject) : ''} · ${e(a.tutor_name)}`;
    let h = '';
    if (a.op === 'add_session') {
      const tags = [a.kind === 'trial' ? '🧪 تجريبية' : a.kind === 'revision' ? '📝 مراجعة' : '', a.family_block ? '👨‍👩‍👧 حصة أسرة' : '', a.status === 'done' ? '✅ تمت' : ''].filter(Boolean).join(' · ');
      h = `➕ ${who}<div class="small">${dayLbl(a.date)} ${t12(a.time)} · ${dl(a.duration_minutes)}${a.status === 'done' && a.actual_minutes !== a.duration_minutes ? ` (فعلي ${dl(a.actual_minutes)})` : ''}${tags ? ' · ' + tags : ''}</div>
        <div class="small sub">${a.kind === 'trial' ? 'مجانية للأسرة والمعلم' : `${a.student_price} ${e(a.student_currency)}/ساعة للأسرة · ${a.tutor_cost_egp} ج/ساعة للمعلم`}</div>
        ${a.duplicate_of ? `<div class="small" style="color:#b45309">⚠️ فيه حصة للطالب ده متسجلة ${t12(a.duplicate_of.time)} (${STATUS_AR[a.duplicate_of.status] || ''}) — اتأكد إنها مش مكررة</div>` : ''}`;
    } else if (a.op === 'set_status') {
      h = `${a.status === 'done' ? '✅' : '❌'} ${who}<div class="small">${dayLbl(a.date)} ${t12(a.time)} ← <b>${STATUS_AR[a.status] || a.status}</b>${a.status === 'done' && a.actual_minutes && a.actual_minutes !== (a.old?.actual_minutes || a.old?.duration_minutes) ? ` · المدة ${dl(a.actual_minutes)}` : ''}${a.cancel_reason ? ' · ' + e(a.cancel_reason) : ''}</div>`;
    } else if (a.op === 'update_session') {
      const ch = [a.new_date || a.new_time ? `الميعاد ← ${dayLbl(a.new_date)} ${t12(a.new_time)}` : '', a.patch?.duration_minutes ? `المدة ← ${dl(a.patch.duration_minutes)}` : '', a.new_tutor_name ? `المعلم ← ${e(a.new_tutor_name)}` : '', a.patch?.subject ? `المادة ← ${e(a.patch.subject)}` : ''].filter(Boolean).join(' · ');
      h = `✏️ ${who}<div class="small">${dayLbl(a.date)} ${t12(a.time)} · ${ch}</div>`;
    }
    if (a.note) h += `<div class="small sub">📝 ${e(a.note)}</div>`;
    return `<label style="display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-top:1px solid rgba(0,0,0,.07);cursor:pointer"><input type="checkbox" data-ai="${k}" data-i="${i}" checked style="margin-top:5px"><div style="flex:1;min-width:0">${h}</div></label>`;
  }
  async function aiAsk(text) {
    const row = document.createElement('div'); row.className = 'sq-row';
    row.innerHTML = `<div class="sq-mini">${mascot(26)}</div><div class="sq-msg sq-bot sq-typing"><i></i><i></i><i></i></div>`;
    body.appendChild(row); scroll();
    const hs = panel.querySelector('.sq-headsvg'); hs && hs.classList.add('sq-think');
    let data, error;
    try { ({ data, error } = await sb.functions.invoke('saqqour-ai', { body: { text, history: AI.hist } })); } catch (err) { error = err; }
    row.remove(); hs && hs.classList.remove('sq-think');
    if (error || !data || data.error) {
      let msg = data?.error || error?.message || 'حصلت مشكلة';
      try { const j = await error?.context?.json?.(); if (j?.error) msg = j.error; } catch (_) {}
      botSay(`معلش 😅 ${e(msg)}`); return;
    }
    AI.hist.push({ role: 'user', text }, { role: 'model', text: data.reply || '' }); AI.hist = AI.hist.slice(-6);
    const acts = data.actions || [];
    let html = e(data.reply || '');
    if (data.questions?.length) html += `<div style="margin-top:6px">${data.questions.map(q => `❓ ${e(q)}`).join('<br>')}</div>`;
    if (data.warnings?.length) html += `<div class="small" style="margin-top:6px;color:#b45309">${data.warnings.map(w => '⚠️ ' + e(w)).join('<br>')}</div>`;
    if (acts.length) {
      const k = 'p' + (++AI.n); AI.pending[k] = { acts, text, reply: data.reply };
      html += `<div style="margin-top:8px">${acts.map((a, i) => actHtml(a, i, k)).join('')}</div>
        <div class="sq-go">${act(`✅ نفّذ (${acts.length})`, () => aiExec(k))}${act('إلغاء', () => { delete AI.pending[k]; botSay('تمام، ما عملتش حاجة 👍'); }, true)}</div>
        <div class="small sub" style="margin-top:4px">شيل علامة ✓ من أي سطر مش عايزه — أو اكتبلي التعديل وأنا أعيد.</div>`;
    }
    botSay(html, acts.length ? 'happy' : null);
  }
  async function aiExec(k) {
    const P = AI.pending[k]; if (!P) return; delete AI.pending[k];
    const sel = [...document.querySelectorAll(`input[data-ai="${k}"]`)].filter(x => x.checked).map(x => P.acts[+x.dataset.i]);
    document.querySelectorAll(`input[data-ai="${k}"]`).forEach(x => x.disabled = true);
    if (!sel.length) { botSay('ما اخترتش حاجة، فما عملتش حاجة 👍'); return; }
    const uid = (typeof currentSupervisor !== 'undefined' && currentSupervisor) ? currentSupervisor.id : null;
    const results = []; let ok = 0;
    for (const a of sel) {
      try {
        if (a.op === 'add_session') {
          const row = { student_id: a.student_id, tutor_id: a.tutor_id, scheduled_at: a.scheduled_at, duration_minutes: a.duration_minutes, actual_minutes: a.actual_minutes, status: a.status,
            subject: a.subject, kind: a.kind, family_block: !!a.family_block, student_price: a.student_price, student_currency: a.student_currency, tutor_cost_egp: a.tutor_cost_egp,
            notes: '🦅 صقّور' + (a.note ? ': ' + a.note : ''), created_by: uid };
          const { data, error } = await sb.from('sessions').insert(row).select('id').single(); if (error) throw error;
          results.push({ op: a.op, id: data.id, ok: true });
        } else if (a.op === 'set_status') {
          const patch = { status: a.status };
          if (a.status === 'done') patch.actual_minutes = a.actual_minutes;
          if (a.status.startsWith('cancelled')) Object.assign(patch, { cancel_reason: a.cancel_reason, cancel_note: a.note || null, cancelled_at: new Date().toISOString(), cancelled_by_user: uid, actual_minutes: null });
          const { error } = await sb.from('sessions').update(patch).eq('id', a.session_id); if (error) throw error;
          results.push({ op: a.op, id: a.session_id, ok: true, old: a.old });
        } else if (a.op === 'update_session') {
          const { error } = await sb.from('sessions').update(a.patch).eq('id', a.session_id); if (error) throw error;
          results.push({ op: a.op, id: a.session_id, ok: true, old: a.old });
        }
        ok++;
      } catch (err) { results.push({ op: a.op, ok: false, err: String(err?.message || err).slice(0, 200), who: a.student_name }); }
    }
    let logId = null;
    try { const { data } = await sb.from('saqqour_log').insert({ input: P.text, reply: P.reply, actions: sel, results, executed_at: new Date().toISOString() }).select('id').single(); logId = data?.id; } catch (_) {}
    try { if (typeof refreshAll === 'function') await refreshAll(); } catch (_) {}
    const bad = results.filter(r => !r.ok);
    botSay(`${ok ? `اتنفّذ ${ok} ${ok === 1 ? 'حاجة' : 'حاجات'} ✓` : ''}${bad.length ? `<div class="small" style="color:#b91c1c">${bad.map(b => `ما اتنفّذش (${e(b.who || '')}): ${e(b.err)}`).join('<br>')}</div>` : ''}
      ${ok && logId ? `<div class="sq-go">${act('↩️ تراجع', () => aiUndo(logId, results))}</div>` : ''}`, ok ? 'happy' : null);
  }
  async function aiUndo(logId, results) {
    let n = 0;
    for (const r of results.filter(x => x.ok).reverse()) {
      try {
        if (r.op === 'add_session') await sb.from('sessions').update({ status: 'cancelled_by_academy', cancel_reason: 'اتسجلت بالغلط', cancel_note: 'تراجع من صقّور', actual_minutes: null }).eq('id', r.id);
        else if (r.old) {
          const back = { status: r.old.status, scheduled_at: r.old.scheduled_at, duration_minutes: r.old.duration_minutes, actual_minutes: r.old.actual_minutes, tutor_id: r.old.tutor_id, subject: r.old.subject };
          if (!String(r.old.status).startsWith('cancelled')) Object.assign(back, { cancel_reason: null, cancel_note: null, cancelled_at: null });
          await sb.from('sessions').update(back).eq('id', r.id);
        }
        n++;
      } catch (_) {}
    }
    try { await sb.from('saqqour_log').update({ undone_at: new Date().toISOString() }).eq('id', logId); } catch (_) {}
    try { if (typeof refreshAll === 'function') await refreshAll(); } catch (_) {}
    botSay(`رجّعت ${n} ${n === 1 ? 'حاجة' : 'حاجات'} زي ما كانت ↩️`);
  }

  /* ---------------- الفويس: المشرفة تتكلم بدل ما تكتب → Gemini يكتب الكلام → صقّور يكمّل عادي ---------------- */
  const VOICE = { rec: null, chunks: [], t0: 0, timer: null, stream: null };
  function pickMime() {
    const c = ['audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm'];
    return c.find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (_) { return false; } }) || '';
  }
  async function voiceToggle(btn) {
    if (VOICE.rec && VOICE.rec.state === 'recording') { VOICE.rec.stop(); return; }
    try { VOICE.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (err) { botSay('محتاج إذن الميكروفون 🎙️ — اسمح للتطبيق يستخدم المايك من إعدادات المتصفح وجرّب تاني.'); return; }
    const mime = pickMime();
    VOICE.chunks = []; VOICE.rec = new MediaRecorder(VOICE.stream, mime ? { mimeType: mime } : undefined);
    VOICE.rec.ondataavailable = ev => { if (ev.data && ev.data.size) VOICE.chunks.push(ev.data); };
    VOICE.rec.onstop = () => voiceDone(btn);
    VOICE.rec.start(); VOICE.t0 = Date.now();
    btn.classList.add('rec');
    const tick = () => { const s = Math.floor((Date.now() - VOICE.t0) / 1000); btn.textContent = `⏹ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; if (s >= 180) VOICE.rec.stop(); };
    tick(); VOICE.timer = setInterval(tick, 500);
    if (navigator.vibrate) navigator.vibrate(30);
  }
  async function voiceDone(btn) {
    clearInterval(VOICE.timer); btn.classList.remove('rec'); btn.textContent = '🎙️';
    try { VOICE.stream && VOICE.stream.getTracks().forEach(t => t.stop()); } catch (_) {}
    const type = (VOICE.rec && VOICE.rec.mimeType) || 'audio/webm';
    const blob = new Blob(VOICE.chunks, { type });
    if (Date.now() - VOICE.t0 < 800 || blob.size < 1500) { botSay('الفويس كان قصير قوي 😅 اضغط 🎙️ واتكلم، واضغط تاني لما تخلص.'); return; }
    const row = document.createElement('div'); row.className = 'sq-row';
    row.innerHTML = `<div class="sq-mini">${mascot(26)}</div><div class="sq-msg sq-bot sq-typing"><i></i><i></i><i></i></div>`;
    body.appendChild(row); scroll();
    let data, error;
    try {
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
      ({ data, error } = await sb.functions.invoke('saqqour-voice', { body: { audio: b64, mime: type } }));
    } catch (err) { error = err; }
    row.remove();
    if (error || !data || data.error || !data.text) {
      let msg = data?.error || error?.message || 'ما قدرتش أسمع الفويس';
      try { const j = await error?.context?.json?.(); if (j?.error) msg = j.error; } catch (_) {}
      botSay(`معلش 😅 ${e(msg)} — جرّب تاني أو اكتبها.`); return;
    }
    ask('🎙️ ' + data.text);
  }

  async function ask(text) {
    meSay(text);
    const voice = /^🎙️ /.test(text); if (voice) text = text.replace(/^🎙️ /, '');
    const q = N(text).replace(/[؟?!.,،]/g, ' ').replace(/\s+/g, ' ').trim();
    const talk = TALK.find(t => t.k.some(k => (' ' + q + ' ').includes(' ' + N(k))));
    const ranked = kb().map(it => ({ it, s: scoreEntry(q, it) })).sort((a, b) => b.s - a.s);
    if (voice || aiWanted(text, ranked, talk)) { await aiAsk(text); return; }
    const ents = findEntities(q);
    if (talk && (!ranked[0] || ranked[0].s < 2.5)) { await typing(500); botSay(talk.r[Math.floor(Math.random() * talk.r.length)], 'happy'); return; }
    if (ranked[0] && ranked[0].s >= 2) { await runIntent(ranked[0].it, ents); return; }
    if (ents.length) {
      await typing(600);
      botSay(`لقيت ${ents.length === 1 ? 'ده' : 'دول'} 👇${ents.map(x => `<div style="margin-top:8px">${entityHtml(x)}</div>`).join('')}`, 'happy'); return;
    }
    await typing(650);
    const sug = ranked.filter(r => r.s > 0).slice(0, 3).map(r => r.it);
    const fallback = sug.length ? sug : kb().slice(0, 4);
    botSay(`مش متأكد فهمتك 🤔 تقصد حاجة من دول؟<div class="sq-list">${fallback.map(it => act(e(it.t), () => { meSay(it.t); runIntent(it); })).join('')}</div>
      <div class="small sub" style="margin-top:6px">جرّب تكتب بكلمات بسيطة زي: "إلغاء حصة" أو "فاتورة أبو معروف".</div>`);
  }

  /* ---------------- الجولة ---------------- */
  const TOUR = {
    sup: [
      { sel: '.topbar .brand', t: 'أهلاً بيك في <b>لوحة الإشراف</b> 👋 أنا هلفّك لفّة سريعة في أهم الحاجات.' },
      { sel: '[data-tab=daily]', t: '<b>📅 الجدول</b>: حصص النهارده والأسبوع. اضغط على أي حصة عشان تسجّلها <b>تمت</b> أو <b>اتلغت</b> أو تبعت <b>تذكير واتساب</b>.' },
      { sel: '#attention', t: 'هنا <b>اللي محتاج انتباهك</b>: تقارير جديدة، حصص ما اتسجلتش، طلبات المعلمات… لو فاضي يبقى كله تمام 🎉', opt: true },
      { sel: '[data-tab=relay]', t: '<b>🔁 الترحيل</b>: أي رسالة أو ماتيريال بين ولي الأمر والمعلم بيعدّي من هنا — عشان محدش يتواصل مباشرة.' },
      { sel: '[data-tab=families]', t: '<b>👨‍👩‍👧 الأسر</b>: كل أسرة وولادها، كشف حسابها وفاتورتها، إجازاتها، ولينك بوابة ولي الأمر.' },
      { sel: '[data-tab=tutors]', t: '<b>🧑‍🏫 المعلمون</b>: بيانات كل معلم، أسعاره، حسابه ومستحقاته، ودعوته للتطبيق.' },
      { sel: '[data-tab=fin]', t: '<b>💰 المالية</b>: الدفعات اللي وصلت، المستحقات، وحسابات آخر الشهر.' },
      { sel: '.top-actions', t: '<b>🔍 البحث</b> عن أي اسم، و<b>🔕 التنبيهات</b> عشان يوصلك إشعار قبل كل حصة.' },
      { sel: '.sq-fab', t: 'وأنا <b>صقّور</b> 🦅 موجود هنا دايماً — اسألني "إزاي…" أو اكتب اسم أي أسرة وأنا أجيبهالك. يلا بينا! 🚀', fab: true },
    ],
    tutor: [
      { sel: '#view-tutor .topbar .brand', t: 'أهلاً بيكي في <b>بوابة المعلمات</b> 👋 لفّة سريعة في ٥ حاجات.' },
      { sel: '#tutor-tabs [data-tab=today]', t: '<b>📅 حصصي</b>: مواعيدك وزرار <b>🎥 دخول الحصة</b>، وبعد الحصة اكتبي <b>📝 التقرير</b> من هنا.' },
      { sel: '#tutor-tabs [data-tab=students]', t: '<b>🎒 طلابي</b>: طلابك ومستواهم ولينك الزووم لكل طالب.' },
      { sel: '#tutor-tabs [data-tab=money]', t: '<b>💰 حسابي</b>: حصص الشهر، اللي اتدفع، واللي ليكي — وكشف جاهز تنسخيه.' },
      { sel: '#t-btn-alerts', t: '<b>🔔 التنبيه</b>: فعّليه عشان يوصلك تذكير قبل كل حصة.' },
      { sel: '.sq-fab', t: 'وأنا <b>صقّور</b> 🦅 هنا لو احتجتي أي حاجة. بالتوفيق! 💙', fab: true },
    ],
  };
  let tourI = 0, tourSteps = [], hole, card;
  function startTour() {
    closePanel(); hideTip();
    const m = mode(); if (!m) return;
    tourSteps = TOUR[m].filter(s => { const el = document.querySelector(s.sel); return el && (s.fab || (el.offsetParent !== null && !(s.opt && el.classList.contains('hidden')))); });
    tourI = 0;
    hole = document.createElement('div'); hole.className = 'sq-tour-hole';
    card = document.createElement('div'); card.className = 'sq-tour-card';
    document.body.append(hole, card);
    showStep();
    window.addEventListener('resize', showStep);
  }
  function showStep() {
    const s = tourSteps[tourI]; if (!s) return endTour();
    if (s.fab) fab.classList.remove('sq-hide');
    const el = document.querySelector(s.sel); if (!el) { tourI++; return showStep(); }
    el.scrollIntoView({ block: 'nearest' });
    const r = el.getBoundingClientRect(), pad = 6;
    Object.assign(hole.style, { top: r.top - pad + 'px', left: r.left - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    const last = tourI === tourSteps.length - 1;
    card.innerHTML = `<div>${mascot(48, last ? 'sq-happy' : (tourI === 0 ? 'sq-wave' : ''))}</div><div class="sq-tt">${s.t}
      <div class="sq-tn"><span>${tourI + 1} / ${tourSteps.length}</span>${last ? '' : '<button class="sq-s">تخطي</button>'}<button class="sq-n">${last ? 'يلا نبدأ 🚀' : 'التالي ←'}</button></div></div>`;
    const cw = card.offsetWidth, ch = card.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    let top = r.bottom + 16; if (top + ch > vh - 10) top = Math.max(10, r.top - ch - 16);
    let left = Math.min(Math.max(10, r.left + r.width / 2 - cw / 2), vw - cw - 10);
    Object.assign(card.style, { top: top + 'px', left: left + 'px' });
    card.querySelector('.sq-n').onclick = () => { tourI++; showStep(); };
    const sk = card.querySelector('.sq-s'); if (sk) sk.onclick = endTour;
  }
  function endTour() {
    const done = tourI >= tourSteps.length - 1;
    hole && hole.remove(); card && card.remove(); hole = card = null;
    window.removeEventListener('resize', showStep);
    LSset('tour_' + mode(), '1');
    if (done) { confetti(); setTimeout(() => showTip(`تمام كده 🎉 لو احتجت أي حاجة دوس عليّا 🦅`, () => { hideTip(); openPanel(); }, 'happy'), 600); }
  }

  /* ---------------- احتفال ---------------- */
  function confetti() {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div'); box.className = 'sq-confetti';
    const colors = ['#1d4ed8', '#3b82f6', '#f59e0b', '#fcd34d', '#10b981', '#ec4899'];
    for (let i = 0; i < 90; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + 'vw'; p.style.background = colors[i % colors.length];
      p.style.animationDuration = 1.8 + Math.random() * 1.8 + 's'; p.style.animationDelay = Math.random() * .5 + 's';
      p.style.transform = `rotate(${Math.random() * 360}deg)`; if (i % 3 === 0) p.style.borderRadius = '50%';
      box.appendChild(p);
    }
    document.body.appendChild(box); setTimeout(() => box.remove(), 4200);
  }
  function celebrate(msg) { confetti(); if (!SQ.open) showTip(msg, () => { hideTip(); openPanel(); }, 'happy'); }
  SQ.openPanel = openPanel; SQ.tour = startTour; SQ.confetti = confetti;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
