(() => {
  function boot() {
    const query = new URLSearchParams(window.location.search).get('q')?.trim();
    if (!query) return;

    const open = document.querySelector('[data-open-command]');
    if (open instanceof HTMLElement) open.click();

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const input = document.getElementById('command-input');
      if (input instanceof HTMLInputElement) {
        window.clearInterval(timer);
        input.value = query;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      } else if (attempts > 20) {
        window.clearInterval(timer);
      }
    }, 80);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
