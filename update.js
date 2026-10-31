// تحديث تلقائي: التطبيق بيشيك على version.json (لما يتفتح، ولما المستخدم يرجعله، وكل 5 دقايق).
// لو فيه نسخة جديدة: بيعمل ريفرش لوحده لو مفيش شاشة/فورم مفتوحة، وإلا بيظهر شريط صغير "اضغط للتحديث".
(function () {
  const meta = document.querySelector('meta[name="app-version"]');
  const CUR = meta ? meta.content : '';
  if (!CUR) return;
  let pending = null, bar = null;

  const busy = () => {
    const m = document.getElementById('modal');
    if (m && !m.classList.contains('hidden')) return true;            // شاشة أو فورم مفتوح
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return true;  // بيكتب حاجة
    const sp = document.querySelector('.sq-panel');
    if ((sp && sp.style.display !== 'none') || document.querySelector('.sq-tour-card')) return true; // شات صقّور أو الجولة
    return false;
  };
  const go = v => {
    try { sessionStorage.setItem('upd_from', CUR); sessionStorage.setItem('upd_try', JSON.stringify({ v, at: Date.now() })); } catch (_) {}
    const u = new URL(location.href); u.searchParams.set('u', v);
    location.replace(u.toString());
  };
  const showBar = v => {
    if (bar) return;
    bar = document.createElement('button');
    bar.type = 'button';
    bar.textContent = '✨ فيه تحديث جديد للتطبيق — اضغط هنا';
    bar.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:99999;background:#1e40af;color:#fff;border:0;border-radius:999px;padding:10px 18px;font:inherit;font-size:14px;font-weight:700;box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer;max-width:calc(100vw - 32px)';
    bar.onclick = () => go(v);
    document.body.appendChild(bar);
  };
  const apply = v => {
    // حماية من اللف: لو لسه عاملين ريفرش للنسخة دي من أقل من دقيقتين (السيرفر لسه بيوزّعها) نستنى
    try { const t = JSON.parse(sessionStorage.getItem('upd_try') || '{}'); if (t.v === v && Date.now() - t.at < 120e3) return; } catch (_) {}
    pending = v; if (busy()) showBar(v); else go(v);
  };

  async function check() {
    if (document.hidden && pending) return;
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      const { v } = await r.json();
      if (v && v !== CUR) apply(v);
    } catch (_) {}
  }

  // لما يرجع للتطبيق (من الخلفية أو بعد ما يقفل الشاشة)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  window.addEventListener('focus', check);
  window.addEventListener('pageshow', e => { if (e.persisted) check(); });
  setInterval(check, 5 * 60e3);
  // لو فيه تحديث مستني وقفل الشاشة/الفورم — نحدّث على طول
  setInterval(() => { if (pending && !busy()) { const v = pending; pending = null; go(v); } }, 3000);
  setTimeout(check, 4000);

  // بعد التحديث: نشيل ?u= من اللينك ونقول "اتحدث"
  try {
    const u = new URL(location.href);
    if (u.searchParams.has('u')) { u.searchParams.delete('u'); history.replaceState(null, '', u.toString()); }
    if (sessionStorage.getItem('upd_from')) {
      sessionStorage.removeItem('upd_from');
      setTimeout(() => { if (typeof showToast === 'function') showToast('✨ التطبيق اتحدّث لآخر نسخة'); }, 1500);
    }
  } catch (_) {}
})();
