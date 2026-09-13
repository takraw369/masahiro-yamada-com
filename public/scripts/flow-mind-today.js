(() => {
  const todayPanel = document.querySelector('[data-panel="today"]');
  const toast = document.getElementById('ko-toast');
  const reader = document.getElementById('reader-article');
  if (!todayPanel || !reader) return;

  function notify(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 1900);
  }

  function tokyoDate() {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }

  function section(label) {
    return Array.from(todayPanel.querySelectorAll('.ko-section')).find((node) =>
      node.querySelector('h2')?.textContent?.trim().toLowerCase().startsWith(label.toLowerCase()),
    );
  }

  function clearCards(target) {
    target?.querySelectorAll('.ko-card').forEach((node) => node.remove());
  }

  function state(label, kind = '') {
    const span = document.createElement('span');
    span.className = 'ko-state';
    const dot = document.createElement('i');
    dot.className = `ko-dot ${kind}`.trim();
    span.append(dot, document.createTextNode(label));
    return span;
  }

  function card({ source, title, body, status, dot, meta, actions = [] }) {
    const article = document.createElement('article');
    article.className = 'ko-card';
    const top = document.createElement('div');
    top.className = 'ko-card-top';
    const src = document.createElement('span');
    src.className = 'ko-source';
    src.textContent = source || 'MASA OS';
    top.append(src, state(status || 'Live', dot || ''));
    const heading = document.createElement('h3');
    heading.textContent = title || 'Untitled';
    article.append(top, heading);
    if (body) {
      const p = document.createElement('p');
      p.textContent = body;
      article.appendChild(p);
    }
    if (meta) {
      const div = document.createElement('div');
      div.className = 'ko-meta';
      const span = document.createElement('span');
      span.textContent = meta;
      div.appendChild(span);
      article.appendChild(div);
    }
    if (actions.length) {
      const row = document.createElement('div');
      row.className = 'ko-row-actions';
      actions.forEach((action, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        if (index === 0) button.className = 'primary';
        button.textContent = action.label;
        button.addEventListener('click', action.onClick);
        row.appendChild(button);
      });
      article.appendChild(row);
    }
    return article;
  }

  async function openKnowledge(id) {
    if (!id) return;
    try {
      const response = await fetch(`/api/dashboard/knowledge?id=${encodeURIComponent(id)}`, {
        headers: { Accept: 'application/json' }, credentials: 'same-origin',
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok || !payload?.data?.item) throw new Error('item_unavailable');
      const item = payload.data.item;
      const title = reader.querySelector('.ko-reader-title');
      const meta = reader.querySelector('.ko-reader-meta');
      const article = reader.querySelector('.ko-article');
      if (title) title.textContent = item.title || 'Untitled knowledge';
      if (meta) {
        meta.textContent = '';
        [item.layer, item.item_type, item.domain, item.status].filter(Boolean).forEach((value) => {
          const span = document.createElement('span'); span.textContent = String(value); meta.appendChild(span);
        });
      }
      if (article) {
        article.textContent = '';
        if (item.summary) {
          const note = document.createElement('aside'); note.className = 'ko-note'; note.textContent = item.summary; article.appendChild(note);
        }
        const chunks = String(item.content || '').split(/\n\s*\n/).filter(Boolean);
        (chunks.length ? chunks : [item.summary || '本文はまだありません。']).forEach((chunk) => {
          const p = document.createElement('p'); p.textContent = chunk.trim(); article.appendChild(p);
        });
      }
      const readerNav = document.querySelector('[data-view="reader"]');
      if (readerNav instanceof HTMLElement) readerNav.click();
    } catch {
      notify('Knowledgeを開けませんでした');
    }
  }

  function render(data) {
    const eyebrow = todayPanel.querySelector('.ko-eyebrow');
    if (eyebrow) eyebrow.textContent = `${data.date || tokyoDate()} · LIVE`;

    const continueSection = section('Continue');
    clearCards(continueSection);
    const focus = data?.decision?.primary_focus;
    if (continueSection && focus) {
      continueSection.appendChild(card({
        source: `${focus.entity_type || 'ACTION'} · ${focus.priority || ''}`,
        title: focus.title,
        body: focus.next_action || (Array.isArray(focus.reasons) ? focus.reasons.join(' · ') : ''),
        status: focus.status || 'Focus',
        dot: 'insight',
        meta: [focus.project, `score ${focus.score ?? '-'}`].filter(Boolean).join(' · '),
        actions: [{ label: 'Open Dashboard', onClick: () => { window.location.href = '/dashboard'; } }],
      }));
    }

    const reviewSection = section('Review');
    clearCards(reviewSection);
    if (reviewSection && Array.isArray(data.review)) {
      data.review.forEach((item) => {
        reviewSection.appendChild(card({
          source: `${item.layer || 'KNOWLEDGE'} · ${item.item_type || ''}`,
          title: item.title,
          body: item.summary || '',
          status: item.status || 'Candidate',
          dot: item.status === 'verified' ? 'canonical' : 'insight',
          meta: [`${item.age_days || 0}d`, `${item.relation_count || 0} relations`, ...(item.reasons || [])].join(' · '),
          actions: [{ label: 'Revisit', onClick: () => openKnowledge(item.id) }],
        }));
      });
    }

    const promoteSection = section('Promote');
    clearCards(promoteSection);
    if (promoteSection && data.promote?.id) {
      const item = data.promote;
      promoteSection.appendChild(card({
        source: `${item.layer || 'KNOWLEDGE'} · PROMOTE CANDIDATE`,
        title: item.title,
        body: item.summary || '',
        status: item.status || 'Candidate',
        dot: 'canonical',
        meta: `${item.relation_count || 0} relations · promote score ${item.promote_score || 0}`,
        actions: [{ label: 'Review candidate', onClick: () => openKnowledge(item.id) }],
      }));
    }

    const publishSection = section('Publish');
    clearCards(publishSection);
    if (publishSection && data.publish?.title) {
      const item = data.publish;
      publishSection.appendChild(card({
        source: `${item.entity_type || 'CONTENT'} · ${item.project || ''}`,
        title: item.title,
        body: item.next_action || '',
        status: item.status || 'Content',
        dot: 'content',
        meta: [item.priority, item.category].filter(Boolean).join(' · '),
        actions: [{ label: 'Open Publish', onClick: () => {
          const nav = document.querySelector('[data-view="publish"]');
          if (nav instanceof HTMLElement) nav.click();
        }}],
      }));
    }
  }

  void fetch(`/api/dashboard/knowledge?view=today&date=${encodeURIComponent(tokyoDate())}`, {
    headers: { Accept: 'application/json' }, credentials: 'same-origin',
  })
    .then(async (response) => {
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error('today_unavailable');
      render(payload.data || {});
    })
    .catch(() => notify('Todayは一時的にサンプル表示です'));
})();
