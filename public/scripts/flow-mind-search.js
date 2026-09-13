(() => {
  const input = document.getElementById('command-input');
  const list = document.querySelector('.ko-command-list');
  const commandModal = document.getElementById('command-modal');
  const toast = document.getElementById('ko-toast');
  const reader = document.getElementById('reader-article');
  if (!input || !list || !reader) return;

  const initialCommands = list.innerHTML;
  let timer = 0;
  let controller = null;

  const notify = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 1800);
  };

  const text = (value) => typeof value === 'string' ? value : '';

  function resultButton(primary, secondary, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ko-command-item';
    button.style.width = '100%';
    button.style.border = '0';
    button.style.background = 'transparent';
    button.style.textAlign = 'left';
    button.style.cursor = 'pointer';

    const left = document.createElement('span');
    left.textContent = primary;
    const right = document.createElement('span');
    right.textContent = secondary;
    button.append(left, right);
    button.addEventListener('click', onClick);
    return button;
  }

  function heading(label) {
    const div = document.createElement('div');
    div.className = 'ko-eyebrow';
    div.style.padding = '10px 12px 5px';
    div.textContent = label;
    return div;
  }

  function setReaderView(item, sources, related) {
    if (item?.id) reader.dataset.knowledgeId = String(item.id);
    const title = reader.querySelector('.ko-reader-title');
    const meta = reader.querySelector('.ko-reader-meta');
    const article = reader.querySelector('.ko-article');
    if (title) title.textContent = text(item.title) || 'Untitled knowledge';

    if (meta) {
      meta.textContent = '';
      [item.layer, item.item_type, item.domain, item.status].filter(Boolean).forEach((value) => {
        const span = document.createElement('span');
        span.textContent = String(value);
        meta.appendChild(span);
      });
    }

    if (article) {
      article.textContent = '';
      if (item.summary) {
        const summary = document.createElement('aside');
        summary.className = 'ko-note';
        summary.textContent = item.summary;
        article.appendChild(summary);
      }
      const body = text(item.content).trim();
      const chunks = body ? body.split(/\n\s*\n/).filter(Boolean) : [];
      if (!chunks.length) {
        const p = document.createElement('p');
        p.textContent = item.summary || '本文はまだありません。';
        article.appendChild(p);
      } else {
        chunks.forEach((chunk) => {
          const p = document.createElement('p');
          p.textContent = chunk.trim();
          article.appendChild(p);
        });
      }
    }

    renderRelated(related || []);
    renderProvenance(sources || []);

    const readerNav = document.querySelector('[data-view="reader"]');
    if (readerNav instanceof HTMLElement) readerNav.click();
    commandModal?.classList.remove('open');
  }

  function renderRelated(items) {
    const container = document.querySelector('.ko-context section:first-child .ko-related');
    if (!container) return;
    container.textContent = '';
    if (!items.length) {
      const empty = document.createElement('small');
      empty.textContent = 'No explicit relations yet.';
      container.appendChild(empty);
      return;
    }
    items.slice(0, 8).forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text(item.title) || 'Related knowledge';
      const small = document.createElement('small');
      const relation = [item.relation, item.direction, item.domain].filter(Boolean).join(' · ');
      small.textContent = relation;
      button.appendChild(small);
      button.addEventListener('click', () => openItem(item.id));
      container.appendChild(button);
    });
  }

  function renderProvenance(sources) {
    const sections = Array.from(document.querySelectorAll('.ko-context section'));
    const provenance = sections.find((section) => section.querySelector('h3')?.textContent?.trim() === 'Provenance');
    if (!provenance) return;
    const old = provenance.querySelector('p');
    if (old) old.remove();
    const wrapper = document.createElement('div');
    wrapper.className = 'ko-related';
    if (!sources.length) {
      const p = document.createElement('p');
      p.style.fontSize = '.68rem';
      p.style.color = '#81786d';
      p.textContent = 'Linked source has not been attached yet.';
      wrapper.appendChild(p);
    } else {
      sources.slice(0, 6).forEach((source) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = text(source.title) || text(source.domain) || 'Source';
        const small = document.createElement('small');
        small.textContent = [source.document_type, source.relation, source.canonical ? 'canonical' : ''].filter(Boolean).join(' · ');
        button.appendChild(small);
        if (source.source_url) {
          button.addEventListener('click', () => window.open(source.source_url, '_blank', 'noopener,noreferrer'));
        } else {
          button.disabled = true;
        }
        wrapper.appendChild(button);
      });
    }
    provenance.appendChild(wrapper);
  }

  async function openItem(id) {
    if (!id) return;
    try {
      const response = await fetch(`/api/dashboard/knowledge?id=${encodeURIComponent(id)}`, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok || !payload?.data?.item) throw new Error('item_unavailable');
      setReaderView(payload.data.item, payload.data.sources, payload.data.related);
    } catch {
      notify('Knowledge itemを開けませんでした');
    }
  }

  function renderSearch(data) {
    list.textContent = '';
    const knowledge = Array.isArray(data?.knowledge) ? data.knowledge : [];
    const osItems = Array.isArray(data?.osItems) ? data.osItems : [];

    if (knowledge.length) {
      list.appendChild(heading('Knowledge'));
      knowledge.slice(0, 10).forEach((item) => {
        list.appendChild(resultButton(
          text(item.title) || 'Untitled',
          [item.layer, item.item_type, item.domain].filter(Boolean).join(' · '),
          () => openItem(item.id),
        ));
      });
    }

    if (osItems.length) {
      list.appendChild(heading('MASA OS'));
      osItems.slice(0, 8).forEach((item) => {
        list.appendChild(resultButton(
          text(item.title) || 'Untitled',
          [item.entity_type, item.project, item.status].filter(Boolean).join(' · '),
          () => {
            commandModal?.classList.remove('open');
            notify(item.next_action ? `Next: ${item.next_action}` : `${item.entity_type || 'OS'} item`);
          },
        ));
      });
    }

    if (!knowledge.length && !osItems.length) {
      const empty = document.createElement('div');
      empty.className = 'ko-command-item';
      empty.textContent = '一致するKnowledgeはありません';
      list.appendChild(empty);
    }
  }

  async function search(query) {
    controller?.abort();
    controller = new AbortController();
    try {
      const response = await fetch(`/api/dashboard/knowledge?q=${encodeURIComponent(query)}&limit=12`, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error('search_unavailable');
      renderSearch(payload.data);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      list.textContent = '';
      const failed = document.createElement('div');
      failed.className = 'ko-command-item';
      failed.textContent = 'Search unavailable';
      list.appendChild(failed);
    }
  }

  input.addEventListener('input', () => {
    const query = input.value.trim();
    window.clearTimeout(timer);
    if (!query) {
      list.innerHTML = initialCommands;
      return;
    }
    timer = window.setTimeout(() => search(query), 180);
  });
})();
