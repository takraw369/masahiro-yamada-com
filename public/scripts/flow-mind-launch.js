(() => {
  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');
  const view = params.get('view');

  const click = (selector) => {
    const node = document.querySelector(selector);
    if (node instanceof HTMLElement) node.click();
  };

  window.requestAnimationFrame(() => {
    if (action === 'capture') click('[data-open-capture]');
    if (view && /^[a-z-]+$/i.test(view)) click(`[data-view="${view}"]`);

    if ((action || view) && window.history?.replaceState) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  });
})();
