(() => {
  const saveButton = document.getElementById('save-capture');
  const textarea = document.getElementById('capture-text');
  const toast = document.getElementById('ko-toast');
  if (!(saveButton instanceof HTMLButtonElement) || !(textarea instanceof HTMLTextAreaElement)) return;

  const URL_ONLY_RE = /^https?:\/\/\S+$/i;

  function notify(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2200);
  }

  saveButton.addEventListener('click', (event) => {
    const text = textarea.value.trim();
    if (!text) return;

    if (URL_ONLY_RE.test(text)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      notify('URLはSource Intakeへ回します。外部Source導線を次に接続します。');
      return;
    }

    const captured = text;
    void fetch('/api/dashboard/knowledge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({ text: captured }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'capture_failed');
        notify('Seedをprivate Knowledgeへ保存しました');
      })
      .catch(() => {
        notify('一時保存のみ。Knowledge同期は再試行が必要です');
      });
  }, { capture: true });
})();
