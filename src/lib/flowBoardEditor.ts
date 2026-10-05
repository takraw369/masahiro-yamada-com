import {
  createFlowBoardSnapshot,
  type BoardEdge,
  type BoardNode,
  type BoardSnapshot,
} from './flowBoard';
import { getRevenueMission, getRevenueReadiness, REVENUE_NODE_ID } from './revenueMission';

type ConnectionMode = 'visual' | 'semantic' | null;

type BoardElements = {
  canvas: HTMLElement;
  world: HTMLElement;
  nodes: HTMLElement;
  edges: SVGSVGElement;
  status: HTMLElement;
  modeHint: HTMLElement;
  selectionLabel: HTMLElement;
  edit: HTMLButtonElement;
  duplicate: HTMLButtonElement;
  remove: HTMLButtonElement;
  mindmap: HTMLButtonElement;
  visualConnect: HTMLButtonElement;
  semanticConnect: HTMLButtonElement;
  undo: HTMLButtonElement;
  redo: HTMLButtonElement;
  save: HTMLButtonElement;
  marquee: HTMLElement;
};

const WORLD_W = 6000;
const WORLD_H = 4200;
const HISTORY_LIMIT = 60;
const DEFAULT_VIEWPORT = { x: 80, y: 60, zoom: .78 };

const kindColor: Record<string, string> = {
  CONTROL:'#59636e', KNOWLEDGE:'#7c5ce1', HUMAN:'#157a70', OUTPUT:'#2f6fb7',
  BUSINESS:'#a85b19', ACTION:'#b64444', LIFE:'#a64378', PRINCIPLE:'#7352a8',
  NOTE:'#c5963d', TEXT:'#58606a', FRAME:'#9a8d7c',
};

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;',
  }[char] || char));
}

function cloneSnapshot(snapshot: BoardSnapshot): BoardSnapshot {
  return structuredClone(snapshot);
}

function normalizeSnapshot(raw: BoardSnapshot): BoardSnapshot {
  const next = cloneSnapshot(raw);
  next.viewport ||= { ...DEFAULT_VIEWPORT };
  next.nodes = next.nodes.map(node => ({
    ...node,
    shape: node.shape || (node.kind === 'FRAME' ? 'frame' : node.kind === 'TEXT' ? 'text' : 'card'),
  }));
  next.edges = next.edges.map(edge => ({
    ...edge,
    edgeType: edge.edgeType || 'semantic',
  }));
  return next;
}

function isTypingTarget(target: EventTarget | null) {
  const el = target instanceof HTMLElement ? target : null;
  return Boolean(el?.closest('input, textarea, select, [contenteditable="true"]'));
}

export function initFlowBoardEditor() {
  const elements: BoardElements = {
    canvas: document.querySelector<HTMLElement>('#canvas')!,
    world: document.querySelector<HTMLElement>('#world')!,
    nodes: document.querySelector<HTMLElement>('#nodes')!,
    edges: document.querySelector<SVGSVGElement>('#edges')!,
    status: document.querySelector<HTMLElement>('#sync-status')!,
    modeHint: document.querySelector<HTMLElement>('#mode-hint')!,
    selectionLabel: document.querySelector<HTMLElement>('#selection-label')!,
    edit: document.querySelector<HTMLButtonElement>('#edit-selected')!,
    duplicate: document.querySelector<HTMLButtonElement>('#duplicate-selected')!,
    remove: document.querySelector<HTMLButtonElement>('#delete-selected')!,
    mindmap: document.querySelector<HTMLButtonElement>('#mindmap-layout')!,
    visualConnect: document.querySelector<HTMLButtonElement>('#visual-connect')!,
    semanticConnect: document.querySelector<HTMLButtonElement>('#semantic-connect')!,
    undo: document.querySelector<HTMLButtonElement>('#undo')!,
    redo: document.querySelector<HTMLButtonElement>('#redo')!,
    save: document.querySelector<HTMLButtonElement>('#save')!,
    marquee: document.querySelector<HTMLElement>('#marquee')!,
  };

  let snapshot: BoardSnapshot = createFlowBoardSnapshot();
  let revision = 0;
  let selectedIds = new Set<string>();
  let primaryId: string | null = null;
  let connectionMode: ConnectionMode = null;
  let connectSource: string | null = null;
  let dirty = false;
  let loaded = false;
  let saving = false;
  let saveTimer: number | null = null;
  const undoStack: string[] = [];
  const redoStack: string[] = [];

  const serial = () => JSON.stringify(snapshot);
  const nodeById = (id: string) => snapshot.nodes.find(node => node.id === id);

  function setStatus(text: string, state = '') {
    elements.status.textContent = text;
    elements.status.dataset.state = state;
  }

  function applyViewport() {
    const v = snapshot.viewport;
    elements.world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;
  }

  function updateToolbar() {
    const count = selectedIds.size;
    const only = count === 1 ? nodeById(primaryId || '') : null;
    elements.edit.disabled = count !== 1;
    elements.duplicate.disabled = count === 0 || (count === 1 && primaryId === REVENUE_NODE_ID);
    elements.remove.disabled = count === 0 || [...selectedIds].every(id => id === REVENUE_NODE_ID);
    elements.mindmap.disabled = !only || only.shape === 'frame';
    elements.undo.disabled = undoStack.length === 0;
    elements.redo.disabled = redoStack.length === 0;
    elements.selectionLabel.textContent = count ? `${count}個選択` : '未選択';
  }

  function markDirty() {
    if (!loaded) return;
    dirty = true;
    setStatus('未保存', 'dirty');
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveBoard(), 850);
  }

  function pushUndo(before: string) {
    if (before === serial()) return;
    if (undoStack.at(-1) !== before) undoStack.push(before);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack.length = 0;
    updateToolbar();
  }

  function restore(serialized: string) {
    snapshot = normalizeSnapshot(JSON.parse(serialized) as BoardSnapshot);
    selectedIds.clear();
    primaryId = null;
    connectSource = null;
    applyViewport();
    render();
    markDirty();
  }

  function undo() {
    const previous = undoStack.pop();
    if (!previous) return;
    redoStack.push(serial());
    restore(previous);
    updateToolbar();
  }

  function redo() {
    const next = redoStack.pop();
    if (!next) return;
    undoStack.push(serial());
    restore(next);
    updateToolbar();
  }

  function nodeCenter(node: BoardNode) {
    return { x: node.x + (node.w || 210) / 2, y: node.y + (node.h || 100) / 2 };
  }

  function renderEdges() {
    elements.edges.innerHTML = `
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill="#8b929a"></path>
        </marker>
      </defs>`;

    for (const edge of snapshot.edges) {
      const source = nodeById(edge.source);
      const target = nodeById(edge.target);
      if (!source || !target) continue;
      const p1 = nodeCenter(source);
      const p2 = nodeCenter(target);
      const midX = (p1.x + p2.x) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const edgeType = edge.edgeType || 'semantic';
      path.setAttribute('d', edgeType === 'visual'
        ? `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`
        : `M ${p1.x} ${p1.y} C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`);
      path.setAttribute('class', `edge-path edge-${edgeType}`);
      if (edgeType !== 'visual') path.setAttribute('marker-end', 'url(#arrow)');
      elements.edges.appendChild(path);

      if (edgeType !== 'visual' && edge.relation) {
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', String(midX));
        label.setAttribute('y', String((p1.y + p2.y) / 2 - 8));
        label.setAttribute('class', `edge-label edge-label-${edgeType}`);
        label.textContent = edge.relation;
        elements.edges.appendChild(label);
      }
    }
  }

  function displayNode(node: BoardNode) {
    let label = node.label;
    let note = node.note || '';
    if (node.id === REVENUE_NODE_ID) {
      const mission = getRevenueMission(snapshot);
      if (mission) {
        const ready = getRevenueReadiness(mission);
        label = `REVENUE MISSION · ${mission.state}`;
        note = `${mission.title} · READY ${ready.complete}/${ready.total} · 次: ${ready.nextAction}`;
      }
    }
    return { label, note };
  }

  function renderNodes() {
    elements.nodes.innerHTML = '';
    const ordered = [...snapshot.nodes].sort((a, b) => Number(a.shape !== 'frame') - Number(b.shape !== 'frame'));
    for (const node of ordered) {
      const el = document.createElement('button');
      const shape = node.shape || 'card';
      const selected = selectedIds.has(node.id);
      el.type = 'button';
      el.className = `node-card shape-${shape}${selected ? ' selected' : ''}${connectSource === node.id ? ' connect-source' : ''}`;
      el.dataset.id = node.id;
      el.style.left = `${node.x}px`;
      el.style.top = `${node.y}px`;
      el.style.width = `${node.w || (shape === 'frame' ? 520 : shape === 'text' ? 260 : 210)}px`;
      el.style.height = `${node.h || (shape === 'frame' ? 320 : shape === 'text' ? 72 : 100)}px`;
      el.style.setProperty('--node-color', kindColor[node.kind || 'NOTE'] || kindColor.NOTE);
      if (node.fontSize) el.style.setProperty('--node-font-size', `${node.fontSize}px`);
      const { label, note } = displayNode(node);
      el.innerHTML = shape === 'text'
        ? `<strong class="free-text">${escapeHtml(label)}</strong><span class="resize-handle" aria-hidden="true"></span>`
        : `<span class="node-kind">${escapeHtml(node.kind || (shape === 'frame' ? 'FRAME' : 'NOTE'))}</span><strong>${escapeHtml(label)}</strong>${note ? `<small>${escapeHtml(note)}</small>` : ''}<span class="resize-handle" aria-hidden="true"></span>`;
      bindNodeEvents(el, node);
      elements.nodes.appendChild(el);
    }
    updateToolbar();
    renderEdges();
  }

  function render() {
    renderNodes();
    applyViewport();
  }

  function clearSelection() {
    selectedIds.clear();
    primaryId = null;
    renderNodes();
  }

  function selectOnly(id: string) {
    selectedIds = new Set([id]);
    primaryId = id;
    renderNodes();
  }

  function toggleSelection(id: string) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    primaryId = selectedIds.has(id) ? id : [...selectedIds].at(-1) || null;
    renderNodes();
  }

  function worldPoint(clientX: number, clientY: number) {
    const rect = elements.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - snapshot.viewport.x) / snapshot.viewport.zoom,
      y: (clientY - rect.top - snapshot.viewport.y) / snapshot.viewport.zoom,
    };
  }

  function visibleCenter() {
    const rect = elements.canvas.getBoundingClientRect();
    return worldPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function movingIdsForSelection() {
    const ids = new Set(selectedIds);
    const selectedFrames = snapshot.nodes.filter(node => ids.has(node.id) && node.shape === 'frame').map(node => node.id);
    for (const node of snapshot.nodes) {
      if (node.frameId && selectedFrames.includes(node.frameId)) ids.add(node.id);
    }
    return ids;
  }

  function bindResize(el: HTMLButtonElement, node: BoardNode) {
    const handle = el.querySelector<HTMLElement>('.resize-handle');
    handle?.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      const before = serial();
      const startX = event.clientX;
      const startY = event.clientY;
      const startW = node.w || (node.shape === 'frame' ? 520 : node.shape === 'text' ? 260 : 210);
      const startH = node.h || (node.shape === 'frame' ? 320 : node.shape === 'text' ? 72 : 100);
      const minW = node.shape === 'frame' ? 240 : node.shape === 'text' ? 120 : 150;
      const minH = node.shape === 'frame' ? 160 : node.shape === 'text' ? 44 : 72;
      let changed = false;
      handle.setPointerCapture(event.pointerId);

      const move = (moveEvent: PointerEvent) => {
        changed = true;
        node.w = Math.max(minW, Math.round(startW + (moveEvent.clientX - startX) / snapshot.viewport.zoom));
        node.h = Math.max(minH, Math.round(startH + (moveEvent.clientY - startY) / snapshot.viewport.zoom));
        el.style.width = `${node.w}px`;
        el.style.height = `${node.h}px`;
        renderEdges();
      };
      const up = (upEvent: PointerEvent) => {
        handle.releasePointerCapture(upEvent.pointerId);
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        if (changed) {
          pushUndo(before);
          markDirty();
        }
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });
  }

  function bindNodeEvents(el: HTMLButtonElement, node: BoardNode) {
    bindResize(el, node);

    el.addEventListener('pointerdown', event => {
      event.stopPropagation();
      if (connectionMode) return;
      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      if (additive) {
        toggleSelection(node.id);
        return;
      }
      if (!selectedIds.has(node.id)) {
        selectedIds = new Set([node.id]);
        primaryId = node.id;
        renderNodes();
      }

      const before = serial();
      const startX = event.clientX;
      const startY = event.clientY;
      const moveIds = movingIdsForSelection();
      const origins = new Map<string, { x: number; y: number }>();
      for (const id of moveIds) {
        const movingNode = nodeById(id);
        if (movingNode) origins.set(id, { x: movingNode.x, y: movingNode.y });
      }
      let moved = false;
      el.setPointerCapture(event.pointerId);

      const move = (moveEvent: PointerEvent) => {
        const dx = (moveEvent.clientX - startX) / snapshot.viewport.zoom;
        const dy = (moveEvent.clientY - startY) / snapshot.viewport.zoom;
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
        for (const [id, origin] of origins) {
          const movingNode = nodeById(id);
          if (!movingNode) continue;
          movingNode.x = Math.round(origin.x + dx);
          movingNode.y = Math.round(origin.y + dy);
          const movingEl = elements.nodes.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);
          if (movingEl) {
            movingEl.style.left = `${movingNode.x}px`;
            movingEl.style.top = `${movingNode.y}px`;
          }
        }
        renderEdges();
      };
      const up = (upEvent: PointerEvent) => {
        el.releasePointerCapture(upEvent.pointerId);
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        if (moved) {
          pushUndo(before);
          markDirty();
        }
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
    });

    el.addEventListener('click', event => {
      event.stopPropagation();
      if (!connectionMode) return;
      if (!connectSource) {
        connectSource = node.id;
        elements.modeHint.textContent = `${node.label} → 接続先を選択`;
        renderNodes();
        return;
      }
      if (connectSource === node.id) return;
      const before = serial();
      if (connectionMode === 'visual') {
        snapshot.edges.push({
          id: uid('E'), source: connectSource, target: node.id, relation:'', edgeType:'visual', state:'HUMAN_CONFIRMED',
        });
      } else {
        const relation = window.prompt('関係名（例: supports / feeds / monetizes / next_step_of）', 'supports')?.trim();
        if (!relation) return;
        snapshot.edges.push({
          id: uid('E'), source: connectSource, target: node.id, relation, edgeType:'semantic', state:'HUMAN_CONFIRMED',
        });
      }
      pushUndo(before);
      markDirty();
      setConnectionMode(null);
      renderNodes();
    });

    el.addEventListener('dblclick', event => {
      event.stopPropagation();
      editNode(node);
    });
  }

  function editNode(node: BoardNode) {
    if (node.id === REVENUE_NODE_ID) {
      window.location.href = '/dashboard#revenue-mission';
      return;
    }
    const before = serial();
    if (node.shape === 'text') {
      const label = window.prompt('テキスト', node.label);
      if (label === null) return;
      node.label = label.trim() || node.label;
    } else {
      const label = window.prompt(node.shape === 'frame' ? 'Frame名' : 'タイトル', node.label);
      if (label === null) return;
      const note = window.prompt('メモ', node.note || '');
      if (note === null) return;
      node.label = label.trim() || node.label;
      node.note = note.trim();
      if (node.shape !== 'frame') {
        const kind = window.prompt('種類', node.kind || 'NOTE');
        if (kind === null) return;
        node.kind = kind.trim().toUpperCase() || 'NOTE';
      }
    }
    pushUndo(before);
    renderNodes();
    markDirty();
  }

  function addCardAt(x: number, y: number, parentId: string | null = null, frameId: string | null = null) {
    const label = window.prompt('新しい項目');
    if (!label?.trim()) return null;
    const before = serial();
    const node: BoardNode = {
      id: uid('N'), label: label.trim(), note:'', kind:'NOTE', shape:'card',
      x:Math.round(x), y:Math.round(y), w:210, h:100, parentId, frameId, provenance:'human',
    };
    snapshot.nodes.push(node);
    if (parentId) {
      snapshot.edges.push({
        id:uid('E'), source:parentId, target:node.id, relation:'branch', edgeType:'mindmap', state:'HUMAN_CONFIRMED',
      });
    }
    pushUndo(before);
    selectedIds = new Set([node.id]);
    primaryId = node.id;
    renderNodes();
    markDirty();
    return node;
  }

  function addTextAt(x: number, y: number) {
    const text = window.prompt('テキスト');
    if (!text?.trim()) return;
    const before = serial();
    const node: BoardNode = {
      id:uid('T'), label:text.trim(), note:'', kind:'TEXT', shape:'text',
      x:Math.round(x), y:Math.round(y), w:260, h:72, provenance:'human',
    };
    snapshot.nodes.push(node);
    pushUndo(before);
    selectedIds = new Set([node.id]);
    primaryId = node.id;
    renderNodes();
    markDirty();
  }

  function addFrame() {
    const title = window.prompt('Frame名', 'FRAME');
    if (title === null) return;
    const before = serial();
    const chosen = snapshot.nodes.filter(node => selectedIds.has(node.id) && node.id !== REVENUE_NODE_ID);
    let x: number, y: number, w: number, h: number;
    if (chosen.length) {
      const left = Math.min(...chosen.map(node => node.x));
      const top = Math.min(...chosen.map(node => node.y));
      const right = Math.max(...chosen.map(node => node.x + (node.w || 210)));
      const bottom = Math.max(...chosen.map(node => node.y + (node.h || 100)));
      x = left - 42; y = top - 62; w = right - left + 84; h = bottom - top + 104;
    } else {
      const center = visibleCenter();
      x = center.x - 260; y = center.y - 160; w = 520; h = 320;
    }
    const frame: BoardNode = {
      id:uid('F'), label:title.trim() || 'FRAME', note:'', kind:'FRAME', shape:'frame',
      x:Math.round(x), y:Math.round(y), w:Math.round(w), h:Math.round(h), provenance:'human',
    };
    snapshot.nodes.push(frame);
    for (const node of chosen) node.frameId = frame.id;
    pushUndo(before);
    selectedIds = new Set([frame.id]);
    primaryId = frame.id;
    renderNodes();
    markDirty();
  }

  function duplicateSelection() {
    const originals = snapshot.nodes.filter(node => selectedIds.has(node.id) && node.id !== REVENUE_NODE_ID);
    if (!originals.length) return;
    const before = serial();
    const idMap = new Map<string, string>();
    for (const node of originals) idMap.set(node.id, uid(node.shape === 'frame' ? 'F' : node.shape === 'text' ? 'T' : 'N'));
    const copies = originals.map(node => {
      const copy = structuredClone(node);
      copy.id = idMap.get(node.id)!;
      copy.x += 36; copy.y += 36;
      copy.knowledgeId = null;
      copy.provenance = 'human-copy';
      delete copy.revenueMission;
      if (copy.parentId && idMap.has(copy.parentId)) copy.parentId = idMap.get(copy.parentId)!;
      if (copy.frameId && idMap.has(copy.frameId)) copy.frameId = idMap.get(copy.frameId)!;
      return copy;
    });
    snapshot.nodes.push(...copies);
    for (const edge of [...snapshot.edges]) {
      if (!idMap.has(edge.source) || !idMap.has(edge.target)) continue;
      snapshot.edges.push({ ...structuredClone(edge), id:uid('E'), source:idMap.get(edge.source)!, target:idMap.get(edge.target)! });
    }
    pushUndo(before);
    selectedIds = new Set(copies.map(node => node.id));
    primaryId = copies.at(-1)?.id || null;
    renderNodes();
    markDirty();
  }

  function deleteSelection() {
    const deletable = new Set([...selectedIds].filter(id => id !== REVENUE_NODE_ID));
    if (!deletable.size) return;
    const labels = snapshot.nodes.filter(node => deletable.has(node.id)).map(node => node.label).slice(0, 3).join(' / ');
    if (!window.confirm(`${deletable.size}個を削除しますか？${labels ? `\n${labels}` : ''}`)) return;
    const before = serial();
    snapshot.nodes = snapshot.nodes.filter(node => !deletable.has(node.id));
    snapshot.edges = snapshot.edges.filter(edge => !deletable.has(edge.source) && !deletable.has(edge.target));
    for (const node of snapshot.nodes) {
      if (node.parentId && deletable.has(node.parentId)) node.parentId = null;
      if (node.frameId && deletable.has(node.frameId)) node.frameId = null;
    }
    pushUndo(before);
    selectedIds.clear();
    primaryId = null;
    renderNodes();
    markDirty();
  }

  function createChild() {
    if (!primaryId) return;
    const parent = nodeById(primaryId);
    if (!parent || parent.shape === 'frame') return;
    const siblings = snapshot.nodes.filter(node => node.parentId === parent.id);
    addCardAt(parent.x + (parent.w || 210) + 90, parent.y + siblings.length * 120, parent.id, parent.frameId || null);
  }

  function createSibling() {
    if (!primaryId) return;
    const current = nodeById(primaryId);
    if (!current || current.shape === 'frame') return;
    const parent = current.parentId ? nodeById(current.parentId) : null;
    if (parent) {
      const siblings = snapshot.nodes.filter(node => node.parentId === parent.id);
      addCardAt(current.x, current.y + Math.max(120, (current.h || 100) + 24), parent.id, current.frameId || parent.frameId || null);
    } else {
      addCardAt(current.x, current.y + Math.max(120, (current.h || 100) + 24), null, current.frameId || null);
    }
  }

  function layoutMindmap() {
    if (!primaryId) return;
    const root = nodeById(primaryId);
    if (!root || root.shape === 'frame') return;
    const descendants = new Set<string>();
    const childrenOf = (id: string) => snapshot.nodes.filter(node => node.parentId === id && node.shape !== 'frame');
    const collect = (id: string) => {
      for (const child of childrenOf(id)) {
        descendants.add(child.id);
        collect(child.id);
      }
    };
    collect(root.id);
    if (!descendants.size) {
      elements.modeHint.textContent = 'このノードにはTabで作った子ノードがまだありません';
      return;
    }
    const before = serial();
    const rootX = root.x;
    const rootY = root.y;
    let cursorY = rootY;
    const gapX = 300;
    const gapY = 128;
    const place = (id: string, depth: number): number => {
      const node = nodeById(id)!;
      node.x = Math.round(rootX + depth * gapX);
      const children = childrenOf(id);
      if (!children.length) {
        node.y = Math.round(cursorY);
        cursorY += gapY;
        return node.y;
      }
      const ys = children.map(child => place(child.id, depth + 1));
      node.y = Math.round((ys[0] + ys[ys.length - 1]) / 2);
      return node.y;
    };
    place(root.id, 0);
    const offsetY = rootY - root.y;
    for (const id of [root.id, ...descendants]) {
      const node = nodeById(id);
      if (node) node.y += offsetY;
    }
    root.x = rootX;
    root.y = rootY;
    pushUndo(before);
    renderNodes();
    markDirty();
    elements.modeHint.textContent = `${descendants.size + 1}ノードをMind Map整列`;
  }

  function setConnectionMode(mode: ConnectionMode) {
    connectionMode = mode;
    connectSource = null;
    elements.visualConnect.classList.toggle('active', mode === 'visual');
    elements.semanticConnect.classList.toggle('active', mode === 'semantic');
    elements.modeHint.textContent = mode === 'visual' ? '自由線：接続元を選択' : mode === 'semantic' ? '意味線：接続元を選択' : '通常モード';
    renderNodes();
  }

  function zoomAt(clientX: number, clientY: number, multiplier: number, persist = true) {
    const rect = elements.canvas.getBoundingClientRect();
    const oldZoom = snapshot.viewport.zoom;
    const newZoom = Math.max(.2, Math.min(2.5, oldZoom * multiplier));
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const worldX = (localX - snapshot.viewport.x) / oldZoom;
    const worldY = (localY - snapshot.viewport.y) / oldZoom;
    snapshot.viewport.zoom = newZoom;
    snapshot.viewport.x = localX - worldX * newZoom;
    snapshot.viewport.y = localY - worldY * newZoom;
    applyViewport();
    if (persist) markDirty();
  }

  async function loadBoard() {
    setStatus('読み込み中…');
    loaded = false;
    elements.save.disabled = true;
    try {
      const res = await fetch('/api/dashboard/board?scene=main', { headers:{ Accept:'application/json' } });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload.error || 'read_failed');
      const data = payload.data || {};
      if (!Number.isSafeInteger(data.revision) || data.revision < 0 || !Array.isArray(data.snapshot?.nodes) || !Array.isArray(data.snapshot?.edges)) throw new Error('invalid_board_read');
      revision = data.revision;
      snapshot = normalizeSnapshot(revision > 0 ? data.snapshot : createFlowBoardSnapshot());
      dirty = false;
      selectedIds.clear();
      primaryId = null;
      undoStack.length = 0;
      redoStack.length = 0;
      getRevenueMission(snapshot);
      if (new URLSearchParams(window.location.search).get('mission') === 'revenue') {
        const node = nodeById(REVENUE_NODE_ID);
        if (node) {
          selectedIds = new Set([node.id]);
          primaryId = node.id;
          const zoom = Math.min(1, elements.canvas.clientWidth / 420);
          snapshot.viewport = {
            x:elements.canvas.clientWidth / 2 - (node.x + (node.w || 270) / 2) * zoom,
            y:90 - node.y * zoom,
            zoom,
          };
          elements.modeHint.textContent = 'Revenue の準備・証跡は「商品準備」で編集';
        }
      }
      render();
      loaded = true;
      elements.save.disabled = false;
      setStatus(revision ? `同期済 · r${revision}` : '初期ボード · 未保存', revision ? 'ok' : 'dirty');
    } catch (error) {
      console.error(error);
      snapshot = normalizeSnapshot(createFlowBoardSnapshot());
      render();
      setStatus('読み込み失敗', 'error');
    }
  }

  async function saveBoard() {
    if (!loaded || saving) return;
    if (!dirty && revision > 0) return;
    if (saveTimer) { window.clearTimeout(saveTimer); saveTimer = null; }
    setStatus('保存中…');
    saving = true;
    elements.save.disabled = true;
    const sentSnapshot = serial();
    try {
      const res = await fetch('/api/dashboard/board', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Accept:'application/json' },
        body:JSON.stringify({ sceneKey:'main', snapshot, expectedRevision:revision, actor:'human' }),
      });
      const payload = await res.json();
      if (res.status === 409) {
        loaded = false;
        setStatus('競合あり · 再読込', 'error');
        return;
      }
      if (!res.ok || !payload.ok) throw new Error(payload.error || 'save_failed');
      if (!Number.isSafeInteger(payload.data?.revision) || payload.data.revision <= revision) throw new Error('invalid_save_receipt');
      revision = payload.data.revision;
      dirty = serial() !== sentSnapshot;
      if (dirty) markDirty();
      else setStatus(`同期済 · r${revision}`, 'ok');
    } catch (error) {
      console.error(error);
      setStatus('保存失敗', 'error');
    } finally {
      saving = false;
      elements.save.disabled = !loaded;
    }
  }

  document.querySelector('#save')?.addEventListener('click', () => saveBoard());
  document.querySelector('#add-node')?.addEventListener('click', () => {
    const center = visibleCenter();
    addCardAt(center.x - 105, center.y - 50);
  });
  document.querySelector('#add-text')?.addEventListener('click', () => {
    const center = visibleCenter();
    addTextAt(center.x - 130, center.y - 36);
  });
  document.querySelector('#add-frame')?.addEventListener('click', addFrame);
  elements.visualConnect.addEventListener('click', () => setConnectionMode(connectionMode === 'visual' ? null : 'visual'));
  elements.semanticConnect.addEventListener('click', () => setConnectionMode(connectionMode === 'semantic' ? null : 'semantic'));
  elements.edit.addEventListener('click', () => {
    if (primaryId) {
      const node = nodeById(primaryId);
      if (node) editNode(node);
    }
  });
  elements.duplicate.addEventListener('click', duplicateSelection);
  elements.remove.addEventListener('click', deleteSelection);
  elements.mindmap.addEventListener('click', layoutMindmap);
  elements.undo.addEventListener('click', undo);
  elements.redo.addEventListener('click', redo);

  document.querySelector('#zoom-in')?.addEventListener('click', () => {
    const rect = elements.canvas.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.15);
  });
  document.querySelector('#zoom-out')?.addEventListener('click', () => {
    const rect = elements.canvas.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1 / 1.15);
  });
  document.querySelector('#reset-view')?.addEventListener('click', () => {
    snapshot.viewport = { ...DEFAULT_VIEWPORT };
    applyViewport();
    markDirty();
  });

  elements.canvas.addEventListener('dblclick', event => {
    if ((event.target as HTMLElement).closest('.node-card')) return;
    const point = worldPoint(event.clientX, event.clientY);
    addTextAt(point.x - 20, point.y - 24);
  });

  let panning = false;
  let panStartX = 0;
  let panStartY = 0;
  let panBaseX = 0;
  let panBaseY = 0;
  let marqueeActive = false;
  let marqueeStartX = 0;
  let marqueeStartY = 0;

  elements.canvas.addEventListener('pointerdown', event => {
    if ((event.target as HTMLElement).closest('.node-card')) return;
    if (event.shiftKey) {
      marqueeActive = true;
      const rect = elements.canvas.getBoundingClientRect();
      marqueeStartX = event.clientX - rect.left;
      marqueeStartY = event.clientY - rect.top;
      elements.marquee.hidden = false;
      elements.marquee.style.left = `${marqueeStartX}px`;
      elements.marquee.style.top = `${marqueeStartY}px`;
      elements.marquee.style.width = '0px';
      elements.marquee.style.height = '0px';
      elements.canvas.setPointerCapture(event.pointerId);
      return;
    }
    panning = true;
    panStartX = event.clientX;
    panStartY = event.clientY;
    panBaseX = snapshot.viewport.x;
    panBaseY = snapshot.viewport.y;
    elements.canvas.setPointerCapture(event.pointerId);
    selectedIds.clear();
    primaryId = null;
    renderNodes();
  });

  elements.canvas.addEventListener('pointermove', event => {
    if (marqueeActive) {
      const rect = elements.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      elements.marquee.style.left = `${Math.min(x, marqueeStartX)}px`;
      elements.marquee.style.top = `${Math.min(y, marqueeStartY)}px`;
      elements.marquee.style.width = `${Math.abs(x - marqueeStartX)}px`;
      elements.marquee.style.height = `${Math.abs(y - marqueeStartY)}px`;
      return;
    }
    if (!panning) return;
    snapshot.viewport.x = panBaseX + event.clientX - panStartX;
    snapshot.viewport.y = panBaseY + event.clientY - panStartY;
    applyViewport();
  });

  elements.canvas.addEventListener('pointerup', event => {
    if (marqueeActive) {
      const rect = elements.canvas.getBoundingClientRect();
      const endX = event.clientX - rect.left;
      const endY = event.clientY - rect.top;
      const left = Math.min(marqueeStartX, endX);
      const right = Math.max(marqueeStartX, endX);
      const top = Math.min(marqueeStartY, endY);
      const bottom = Math.max(marqueeStartY, endY);
      selectedIds.clear();
      for (const node of snapshot.nodes) {
        const sx = snapshot.viewport.x + node.x * snapshot.viewport.zoom;
        const sy = snapshot.viewport.y + node.y * snapshot.viewport.zoom;
        const sw = (node.w || 210) * snapshot.viewport.zoom;
        const sh = (node.h || 100) * snapshot.viewport.zoom;
        if (sx < right && sx + sw > left && sy < bottom && sy + sh > top) selectedIds.add(node.id);
      }
      primaryId = [...selectedIds].at(-1) || null;
      marqueeActive = false;
      elements.marquee.hidden = true;
      renderNodes();
      return;
    }
    if (!panning) return;
    panning = false;
    markDirty();
  });

  elements.canvas.addEventListener('wheel', event => {
    event.preventDefault();
    zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.08 : 1 / 1.08);
  }, { passive:false });

  document.addEventListener('keydown', event => {
    if (isTypingTarget(event.target)) return;
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
      return;
    }
    if ((mod && event.key.toLowerCase() === 'y')) {
      event.preventDefault();
      redo();
      return;
    }
    if (mod && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      duplicateSelection();
      return;
    }
    if (event.key === 'Tab' && primaryId) {
      event.preventDefault();
      createChild();
      return;
    }
    if (event.key === 'Enter' && primaryId && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      createSibling();
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedIds.size) {
      event.preventDefault();
      deleteSelection();
      return;
    }
    if (event.key === 'Escape') {
      if (connectionMode) setConnectionMode(null);
      else clearSelection();
    }
  });

  window.addEventListener('beforeunload', event => {
    if (!dirty) return;
    event.preventDefault();
  });

  elements.world.style.width = `${WORLD_W}px`;
  elements.world.style.height = `${WORLD_H}px`;
  elements.nodes.style.width = `${WORLD_W}px`;
  elements.nodes.style.height = `${WORLD_H}px`;
  elements.edges.setAttribute('width', String(WORLD_W));
  elements.edges.setAttribute('height', String(WORLD_H));
  elements.edges.setAttribute('viewBox', `0 0 ${WORLD_W} ${WORLD_H}`);

  loadBoard();
}
