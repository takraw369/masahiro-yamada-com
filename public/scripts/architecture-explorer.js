(() => {
  'use strict';

  const dataElement = document.getElementById('architecture-explorer-data');
  if (!dataElement?.textContent) return;

  let data;
  try {
    data = JSON.parse(dataElement.textContent);
  } catch (error) {
    console.error('[Architecture Explorer] Failed to parse graph data.', error);
    return;
  }

  const NS = 'http://www.w3.org/2000/svg';
  const viewport = document.getElementById('arch-viewport');
  const world = document.getElementById('arch-world');
  const detailPanel = document.getElementById('arch-detail');
  const detailScrim = document.getElementById('arch-detail-scrim');
  const searchInput = document.getElementById('arch-search');

  if (!viewport || !world || !detailPanel || !searchInput) return;

  const nodesById = new Map(data.nodes.map((node) => [node.id, node]));
  const nodeEls = new Map();
  const edgeEls = [];
  let selectedRoute = null;
  let activeKind = 'all';
  let activeStatus = 'all';
  let query = '';
  let selectedNode = null;

  function svgEl(name, attrs = {}, text = '') {
    const node = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    if (text) node.textContent = text;
    return node;
  }

  function center(node) {
    return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
  }

  function edgePath(from, to) {
    const a = center(from);
    const b = center(to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      const sx = dx > 0 ? from.x + from.w : from.x;
      const ex = dx > 0 ? to.x : to.x + to.w;
      const sy = a.y;
      const ey = b.y;
      const bend = Math.max(45, Math.abs(ex - sx) * 0.42);
      const c1x = sx + (dx > 0 ? bend : -bend);
      const c2x = ex - (dx > 0 ? bend : -bend);
      return `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ey}, ${ex} ${ey}`;
    }

    const sy = dy > 0 ? from.y + from.h : from.y;
    const ey = dy > 0 ? to.y : to.y + to.h;
    const sx = a.x;
    const ex = b.x;
    const bend = Math.max(45, Math.abs(ey - sy) * 0.42);
    const c1y = sy + (dy > 0 ? bend : -bend);
    const c2y = ey - (dy > 0 ? bend : -bend);
    return `M ${sx} ${sy} C ${sx} ${c1y}, ${ex} ${c2y}, ${ex} ${ey}`;
  }

  function openDetail(id) {
    const node = nodesById.get(id);
    const title = document.getElementById('arch-detail-title');
    const meta = document.getElementById('arch-detail-meta');
    const body = document.getElementById('arch-detail-body');
    const why = document.getElementById('arch-detail-why');
    const status = document.getElementById('arch-detail-status');
    const verify = document.getElementById('arch-detail-verify');
    if (!node || !title || !meta || !body || !why || !status || !verify) return;

    selectedNode = id;
    title.textContent = node.title;
    meta.textContent = `${node.meta} · ${node.kind}`;
    body.textContent = node.body;
    why.textContent = node.why;
    status.className = `arch-detail-status ${node.status}`;
    status.textContent = node.statusLabel;
    verify.replaceChildren(...node.verify.map((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      return li;
    }));

    detailPanel.classList.add('open');
    detailPanel.setAttribute('aria-hidden', 'false');
    if (window.matchMedia('(max-width:760px)').matches && detailScrim) detailScrim.hidden = false;
    applyFilters();
  }

  function closeDetail() {
    selectedNode = null;
    detailPanel.classList.remove('open');
    detailPanel.setAttribute('aria-hidden', 'true');
    if (detailScrim) detailScrim.hidden = true;
    applyFilters();
  }

  function renderGraph() {
    world.replaceChildren();

    for (const group of data.groups) {
      world.appendChild(svgEl('rect', {
        class: 'arch-lane', x: group.x, y: group.y, width: group.w, height: group.h, rx: 24,
      }));
      world.appendChild(svgEl('text', {
        class: 'arch-lane-title', x: group.x + 30, y: group.y + 38,
      }, group.label));
    }

    const edgeLayer = svgEl('g', { class: 'arch-edge-layer' });
    data.edges.forEach((edge, index) => {
      const from = nodesById.get(edge.from);
      const to = nodesById.get(edge.to);
      if (!from || !to) return;
      const path = svgEl('path', {
        class: `arch-edge ${edge.kind}${edge.style ? ` ${edge.style}` : ''}`,
        d: edgePath(from, to),
        'data-index': index,
        'data-from': edge.from,
        'data-to': edge.to,
      });
      edgeLayer.appendChild(path);
      edgeEls.push({ edge, el: path });
    });
    world.appendChild(edgeLayer);

    const nodeLayer = svgEl('g', { class: 'arch-node-layer' });
    data.nodes.forEach((node) => {
      const g = svgEl('g', {
        class: `arch-node status-${node.status} kind-${node.kind}`,
        transform: `translate(${node.x} ${node.y})`,
        tabindex: 0,
        role: 'button',
        'aria-label': `${node.title}: ${node.meta}`,
        'data-id': node.id,
      });
      g.appendChild(svgEl('rect', { width: node.w, height: node.h }));
      g.appendChild(svgEl('text', { class: 'arch-node-title', x: 20, y: 34 }, node.title));
      g.appendChild(svgEl('text', { class: 'arch-node-meta', x: 20, y: 58 }, node.meta));
      const statusY = node.h >= 110 ? node.h - 20 : node.h - 14;
      g.appendChild(svgEl('text', { class: 'arch-node-status', x: 20, y: statusY }, node.statusLabel));
      g.appendChild(svgEl('text', {
        class: 'arch-kind-pill', x: node.w - 18, y: statusY, 'text-anchor': 'end',
      }, node.kind.toUpperCase()));
      g.addEventListener('click', (event) => {
        event.stopPropagation();
        openDetail(node.id);
      });
      g.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openDetail(node.id);
        }
      });
      nodeLayer.appendChild(g);
      nodeEls.set(node.id, g);
    });
    world.appendChild(nodeLayer);

    for (const callout of data.callouts) {
      world.appendChild(svgEl('text', {
        class: 'arch-callout', x: callout.x, y: callout.y,
      }, callout.text));
    }
  }

  function markButtons(container, active, selector) {
    container?.querySelectorAll(selector).forEach((button) => {
      button.classList.toggle('active', button === active);
    });
  }

  function renderFilters() {
    const routeContainer = document.getElementById('arch-route-filters');
    const allRoutes = document.createElement('button');
    allRoutes.type = 'button';
    allRoutes.className = 'arch-route-button active';
    allRoutes.textContent = 'All flows';
    allRoutes.addEventListener('click', () => {
      selectedRoute = null;
      markButtons(routeContainer, allRoutes, '.arch-route-button');
      applyFilters();
    });
    routeContainer?.appendChild(allRoutes);

    data.routes.forEach((route) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'arch-route-button';
      button.textContent = route.label;
      button.addEventListener('click', () => {
        selectedRoute = route.id;
        markButtons(routeContainer, button, '.arch-route-button');
        applyFilters();
      });
      routeContainer?.appendChild(button);
    });

    const kindContainer = document.getElementById('arch-kind-filters');
    ['all', 'identity', 'upload', 'compute', 'chat', 'model'].forEach((kind) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `arch-chip${kind === 'all' ? ' active' : ''}`;
      button.textContent = kind === 'all' ? 'All' : kind;
      button.addEventListener('click', () => {
        activeKind = kind;
        markButtons(kindContainer, button, '.arch-chip');
        applyFilters();
      });
      kindContainer?.appendChild(button);
    });

    const statusContainer = document.getElementById('arch-status-filters');
    [['all', 'All'], ['confirmed', 'Brief'], ['inferred', 'Inferred'], ['unknown', 'Verify']]
      .forEach(([value, label]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `arch-chip${value === 'all' ? ' active' : ''}`;
        button.textContent = label;
        button.addEventListener('click', () => {
          activeStatus = value;
          markButtons(statusContainer, button, '.arch-chip');
          applyFilters();
        });
        statusContainer?.appendChild(button);
      });
  }

  function applyFilters() {
    const route = data.routes.find((item) => item.id === selectedRoute);
    const routeNodes = route ? new Set(route.nodes) : null;
    const matched = new Set();

    data.nodes.forEach((node) => {
      const haystack = `${node.title} ${node.meta} ${node.body} ${node.kind} ${node.status}`.toLowerCase();
      const visible = (!query || haystack.includes(query))
        && (activeKind === 'all' || node.kind === activeKind)
        && (activeStatus === 'all' || node.status === activeStatus)
        && (!routeNodes || routeNodes.has(node.id));

      if (visible) matched.add(node.id);
      const element = nodeEls.get(node.id);
      if (!element) return;
      element.classList.toggle('dimmed', !visible);
      element.classList.toggle('highlight', Boolean(routeNodes?.has(node.id)));
      element.classList.toggle('focused', selectedNode === node.id);
    });

    edgeEls.forEach(({ edge, el }) => {
      const routeHighlight = routeNodes && routeNodes.has(edge.from) && routeNodes.has(edge.to);
      const endpointsVisible = matched.has(edge.from) && matched.has(edge.to);
      el.classList.toggle('dimmed', !endpointsVisible);
      el.classList.toggle('highlight', Boolean(routeHighlight));
    });
  }

  renderGraph();
  renderFilters();
  applyFilters();

  let scale = 0.72;
  let tx = 0;
  let ty = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function applyTransform() {
    world.setAttribute('transform', `scale(${scale}) translate(${tx} ${ty})`);
  }

  function fit() {
    const rect = viewport.getBoundingClientRect();
    scale = Math.max(0.10, Math.min(1.4, Math.min(rect.width / 2650, rect.height / 1750) * 0.94));
    tx = (rect.width / scale - 2600) / 2;
    ty = (rect.height / scale - 1700) / 2;
    applyTransform();
  }

  function reset() {
    scale = 0.72;
    tx = 0;
    ty = 0;
    applyTransform();
  }

  function zoom(factor, clientX = null, clientY = null) {
    const oldScale = scale;
    scale = Math.max(0.10, Math.min(2.4, scale * factor));
    if (clientX !== null && clientY !== null) {
      const rect = viewport.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const worldX = px / oldScale - tx;
      const worldY = py / oldScale - ty;
      tx = px / scale - worldX;
      ty = py / scale - worldY;
    }
    applyTransform();
  }

  viewport.addEventListener('pointerdown', (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('.arch-node, .arch-detail, .arch-detail-scrim')) return;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    viewport.classList.add('dragging');
    try { viewport.setPointerCapture(event.pointerId); } catch (_) {}
  });

  viewport.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    tx += (event.clientX - lastX) / scale;
    ty += (event.clientY - lastY) / scale;
    lastX = event.clientX;
    lastY = event.clientY;
    applyTransform();
  });

  const endDrag = () => {
    dragging = false;
    viewport.classList.remove('dragging');
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
  viewport.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoom(event.deltaY < 0 ? 1.1 : 0.9, event.clientX, event.clientY);
  }, { passive: false });

  document.getElementById('arch-zoom-in')?.addEventListener('click', () => zoom(1.15));
  document.getElementById('arch-zoom-out')?.addEventListener('click', () => zoom(1 / 1.15));
  document.getElementById('arch-fit')?.addEventListener('click', fit);
  document.getElementById('arch-reset')?.addEventListener('click', reset);
  document.getElementById('arch-detail-close')?.addEventListener('click', closeDetail);
  detailScrim?.addEventListener('click', closeDetail);
  searchInput.addEventListener('input', () => {
    query = searchInput.value.trim().toLowerCase();
    applyFilters();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDetail();
  });
  window.addEventListener('resize', fit);

  fit();
})();
