(() => {
  const button = document.getElementById('save-selection');
  const reader = document.getElementById('reader-article');
  const toast = document.getElementById('ko-toast');
  if (!(button instanceof HTMLButtonElement) || !(reader instanceof HTMLElement)) return;

  function notify(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2100);
  }

  button.addEventListener('click', () => {
    const selection = window.getSelection();
    const selected = selection?.toString().trim() || '';
    if (!selected || !selection?.anchorNode || !reader.contains(selection.anchorNode)) return;

    const sourceId = reader.dataset.knowledgeId || null;
    const payload = { kind: 'highlight', text: selected, sourceId };

    void fetch('/api/dashboard/knowledge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.ok) throw new Error(body?.error || 'highlight_failed');
        notify(sourceId ? 'HighlightをKnowledge化し、元Knowledgeへ接続しました' : 'HighlightをKnowledge化しました');
      })
      .catch(() => notify('Highlightは一時保存のみ。Knowledge同期は再試行が必要です'));
  }, { capture: true });
})();
