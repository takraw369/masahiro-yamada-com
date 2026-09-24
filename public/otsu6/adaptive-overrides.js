/* 2026-09-24: rebuilt 3-day pass sprint bootloader. */
(() => {
  "use strict";
  const boot = () => {
    if (window.__OTSU6_PASS_SPRINT_BOOT__) return;
    window.__OTSU6_PASS_SPRINT_BOOT__ = true;
    const script = document.createElement("script");
    script.src = "/otsu6/pass-sprint-shell.js?v=20260924b";
    document.body.appendChild(script);
  };
  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
