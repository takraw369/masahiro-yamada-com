(() => {
  "use strict";
  // 9/24以降は旧ダッシュを表示後に新しい合格スプリントへ置き換える。
  const boot = () => {
    if (window.__OTSU6_PASS_SPRINT_BOOT__) return;
    window.__OTSU6_PASS_SPRINT_BOOT__ = true;
    const script = document.createElement("script");
    script.src = "/otsu6/pass-sprint-shell.js?v=20260924c";
    document.body.appendChild(script);
  };
  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
