(() => {
  const input = document.getElementById('command-input');
  const list = document.querySelector('.ko-command-list');
  const commandModal = document.getElementById('command-modal');
  const toast = document.getElementById('ko-toast');
  if (!(input instanceof HTMLInputElement) || !(list instanceof HTMLElement)) return;

  let asking = false;
  let renderQueued = false;

  const notify = (message) => {
    if (!(toast instanceof HTMLElement)) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2200);
  };

  const queueAskAction = () => {
    if (renderQueued) return;
    renderQueued = true;
    queueMicrotask(() => {
      renderQueued = false;
      ensureAskAction();
    });
  };

  const makeRow = (primary, secondary = '') => {
    const row = document.createElement('div');
    row.className = 'ko-command-item';
    const left = document.createElement('span');
    left.textContent = primary;
    const right = document.createElement('span');
    right.textContent = secondary;
    row.append(left, right);
    return row;
  };

  const renderAnswer = (payload) => {
    list.textContent = '';

    const heading = document.createElement('div');
    heading.className = 'ko-eyebrow';
    heading.style.padding = '10px 12px 5px';
    heading.textContent = `Knowledge OS · v${payload?.version || '2'}`;
    list.appendChild(heading);

    const answer = document.createElement('div');
    answer.className = 'ko-command-item';
    answer.style.display = 'block';
    answer.style.whiteSpace = 'pre-wrap';
    answer.style.lineHeight = '1.65';
    answer.textContent = typeof payload?.answer === 'string' ? payload.answer : '回答を取得できませんでした。';
    list.appendChild(answer);

    const sources = Array.isArray(payload?.sources) ? payload.sources : [];
    if (sources.length) {
      const sourceHeading = document.createElement('div');
      sourceHeading.className = 'ko-eyebrow';
      sourceHeading.style.padding = '10px 12px 5px';
      sourceHeading.textContent = 'Sources';
      list.appendChild(sourceHeading);

      sources.slice(0, 6).forEach((source, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ko-command-item';
        button.style.width = '100%';
        button.style.border = '0';
        button.style.background = 'transparent';
        button.style.textAlign = 'left';
        button.style.cursor = source?.canonical_url ? 'pointer' : 'default';

        const title = document.createElement('span');
        title.textContent = `[S${index + 1}] ${String(source?.title || 'Source')}`;
        const meta = document.createElement('span');
        meta.textContent = [source?.grounding_level, source?.canonical_priority].filter(Boolean).join(' · ');
        button.append(title, meta);
        if (source?.canonical_url) {
          button.addEventListener('click', () => window.open(source.canonical_url, '_blank', 'noopener,noreferrer'));
        }
        list.appendChild(button);
      });
    }

    const receipt = payload?.retrieval_receipt;
    if (receipt) {
      const receiptRow = makeRow(
        `Grounded ${Number(receipt.full_grounded_count || 0)}/${Number(receipt.candidate_count || 0)}`,
        receipt.vector_used ? 'vector + graph' : 'lexical + graph',
      );
      receiptRow.style.opacity = '.72';
      list.appendChild(receiptRow);
    }
  };

  const ask = async (question) => {
    const trimmed = String(question || '').trim();
    if (asking || trimmed.length < 2) return;
    asking = true;
    list.textContent = '';
    list.appendChild(makeRow('Knowledge OSへ確認中…', 'v2'));

    try {
      const response = await fetch('/api/dashboard/knowledge-ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ question: trimmed, answerMode: 'ai' }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'knowledge_ask_failed');
      renderAnswer(payload);
    } catch (error) {
      console.error('flow-mind-ask-v2 failed', error);
      list.textContent = '';
      list.appendChild(makeRow('Knowledge OSへ接続できませんでした', '再試行'));
      notify('Knowledge Ask v2 を取得できませんでした');
    } finally {
      asking = false;
    }
  };

  function ensureAskAction() {
    if (asking) return;
    const question = input.value.trim();
    const existing = list.querySelector('[data-knowledge-ask-v2]');
    if (question.length < 2) {
      existing?.remove();
      return;
    }
    if (existing instanceof HTMLElement && existing.dataset.query === question) return;
    existing?.remove();

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ko-command-item';
    button.dataset.knowledgeAskV2 = 'true';
    button.dataset.query = question;
    button.style.width = '100%';
    button.style.border = '0';
    button.style.background = 'rgba(117, 74, 22, .06)';
    button.style.textAlign = 'left';
    button.style.cursor = 'pointer';

    const left = document.createElement('span');
    left.textContent = `Ask Knowledge OS: ${question}`;
    const right = document.createElement('span');
    right.textContent = '⌘↵';
    button.append(left, right);
    button.addEventListener('click', () => ask(question));
    list.prepend(button);
  }

  input.addEventListener('input', queueAskAction);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      ask(input.value);
    }
  });

  const observer = new MutationObserver(queueAskAction);
  observer.observe(list, { childList: true });
  commandModal?.addEventListener('transitionend', queueAskAction);
})();
