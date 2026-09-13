(() => {
  const journal = document.querySelector('[data-panel="journal"]');
  const editor = journal?.querySelector('h3[contenteditable="true"]');
  const toast = document.getElementById('ko-toast');
  if (!(editor instanceof HTMLElement)) return;

  const placeholder = 'ここをクリックして、そのまま考えを書く。';
  let saving = false;

  function notify(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2100);
  }

  const hint = document.createElement('div');
  hint.className = 'ko-meta';
  hint.style.marginTop = '10px';
  const hintText = document.createElement('span');
  hintText.textContent = '⌘/Ctrl + Enter でSeed保存';
  hint.appendChild(hintText);
  editor.parentElement?.appendChild(hint);

  async function saveBlock() {
    const text = (editor.textContent || '').trim();
    if (!text || text === placeholder || saving) return;
    if (editor.dataset.lastSaved === text) {
      notify('このBlockは保存済みです');
      return;
    }

    saving = true;
    try {
      const response = await fetch('/api/dashboard/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ text }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(body?.error || 'journal_save_failed');
      editor.dataset.lastSaved = text;
      hintText.textContent = `Saved · ${body.data?.status || 'draft'} · ${body.data?.layer || 'masa_lens'}`;
      notify('Journal BlockをSeedとして保存しました');
    } catch {
      notify('Journal Blockを保存できませんでした');
    } finally {
      saving = false;
    }
  }

  editor.addEventListener('focus', () => {
    if ((editor.textContent || '').trim() === placeholder) editor.textContent = '';
  });

  editor.addEventListener('blur', () => {
    if (!(editor.textContent || '').trim()) editor.textContent = placeholder;
  });

  editor.addEventListener('input', () => {
    hintText.textContent = '⌘/Ctrl + Enter でSeed保存';
  });

  editor.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void saveBlock();
    }
  });
})();
