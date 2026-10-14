/* FLOW LIFE | Inner Universe MVP. No external dependencies. */
(() => {
  'use strict';
  const planets = [
    {
      key: 'root', tag: '01 · THE ROOT', label: '身体の星', title: '身体の声を、聴く。',
      summary: '思考をほどいて、身体が発する小さな声に気づく。',
      narrative: 'この星には、急ぐ時計がありません。足の裏、肩の重さ、呼吸の深さ。いつも一緒にいる身体は、言葉のない手紙を送っています。',
      question: '今日の身体は、あなたに何を伝えようとしている？',
      choices: ['水を一杯飲んで、身体の感覚を確かめる', 'ゆっくり5回呼吸して、肩の力を抜く']
    },
    {
      key: 'tide', tag: '02 · THE TIDE', label: '心の星', title: '波は、やがて静まる。',
      summary: '変えようとする前に、今ある感情をそのまま観察する。',
      narrative: 'この星の海は、心と同じように満ち引きします。穏やかな日も、波立つ日も、どちらも自然なこと。波を止めるより、波の形を知る。',
      question: '今の気持ちを、どう扱ってあげたい？',
      choices: ['今の感情に、ひとつ名前をつける', '評価せず、いま感じていることを書き留める']
    },
    {
      key: 'light', tag: '03 · THE LIGHT', label: '未来の星', title: '未来は、小さな一歩から。',
      summary: '遠い目標から、今日できるひとつの行動を選ぶ。',
      narrative: 'この星では、道しるべが夜空に浮かびます。すべての道を照らす必要はありません。いま踏み出す一歩に、ちょうど足りる光があればいい。',
      question: '未来の自分へ渡すなら、どんな一歩にする？',
      choices: ['今日やらないことを、ひとつ決める', '大切な目標のために、5分だけ動く']
    }
  ];

  const $ = (id) => document.getElementById(id);
  const nodes = [...document.querySelectorAll('[data-planet]')];
  const dots = [...document.querySelectorAll('[data-dot]')];
  const storageKey = 'flow-life-world-v1';
  let selected = 0;
  let visit = null;
  let saved = { responses: {} };
  let fromFlow = {};
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (value && typeof value === 'object' && value.responses && typeof value.responses === 'object') saved = { responses: value.responses };
  } catch { /* private mode or invalid state */ }
  try {
    fromFlow = JSON.parse(localStorage.getItem('flow-life-v1') || '{}') || {};
  } catch { /* standalone mode */ }
  const completed = () => planets.filter((p) => saved.responses[p.key]).length;

  function updateHud() {
    const xp = Number(fromFlow.xp) || 0;
    $('level').textContent = `LV. ${String(Math.max(1, Math.floor(xp / 100) + 1)).padStart(2, '0')}`;
    const quests = Array.isArray(fromFlow.quests) ? fromFlow.quests : [];
    $('quest-info').textContent = quests.length ? `今日のQUEST · ${quests.filter((q) => q.done).length} / ${quests.length}` : '今日のQUEST · 未設定';
    $('visit-progress').textContent = `${completed()} STAR${completed() === 1 ? '' : 'S'} DISCOVERED`;
    nodes.forEach((el, i) => el.classList.toggle('discovered', Boolean(saved.responses[planets[i].key])));
    dots.forEach((el, i) => el.classList.toggle('done', Boolean(saved.responses[planets[i].key])));
  }

  function selectPlanet(index, focus = false) {
    selected = (index + planets.length) % planets.length;
    const planet = planets[selected];
    nodes.forEach((el, i) => {
      el.classList.toggle('is-selected', i === selected);
      el.setAttribute('aria-pressed', String(i === selected));
    });
    $('map-counter').textContent = `${String(selected + 1).padStart(2, '0')} / 03`;
    $('map-name').textContent = planet.label;
    $('map-summary').textContent = planet.summary;
    $('explore').firstChild.textContent = saved.responses[planet.key] ? 'もう一度、星を訪れる ' : 'この星を探検する ';
    if (focus) nodes[selected].focus();
  }

  function openPlanet(index) {
    selected = index;
    visit = planets[index];
    $('map-view').hidden = true;
    $('ending').hidden = true;
    $('scene-view').hidden = false;
    $('scene-art').dataset.scene = String(index);
    $('scene-index').textContent = `${String(index + 1).padStart(2, '0')} / ${visit.key.toUpperCase()}`;
    $('scene-kicker').textContent = visit.tag;
    $('scene-name').textContent = visit.title;
    $('scene-narrative').textContent = visit.narrative;
    $('scene-question').textContent = visit.question;
    const choices = $('choices');
    choices.querySelectorAll('button').forEach((button) => button.remove());
    visit.choices.forEach((choice, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice';
      button.setAttribute('aria-pressed', 'false');
      const marker = document.createElement('span');
      marker.className = 'choice-marker';
      marker.textContent = `0${i + 1}`;
      const content = document.createElement('span');
      content.textContent = choice;
      button.append(marker, content);
      button.addEventListener('click', () => {
        [...choices.querySelectorAll('button')].forEach((node) => node.setAttribute('aria-pressed', String(node === button)));
        $('record-choice').dataset.value = String(i);
        $('record-choice').disabled = false;
        $('saved-state').textContent = '';
      });
      choices.appendChild(button);
    });
    $('record-choice').disabled = true;
    delete $('record-choice').dataset.value;
    $('saved-state').textContent = '';
    $('back-to-map').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function returnToMap() {
    $('scene-view').hidden = true;
    $('ending').hidden = true;
    $('map-view').hidden = false;
    selectPlanet(selected);
    $('explore').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function recordChoice() {
    if (!visit || $('record-choice').disabled) return;
    const n = Number($('record-choice').dataset.value);
    if (!Number.isInteger(n) || !visit.choices[n]) return;
    saved.responses[visit.key] = { choice: visit.choices[n], at: new Date().toISOString() };
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); }
    catch { $('saved-state').textContent = '端末への保存が制限されています'; }
    updateHud();
    $('saved-state').textContent = '旅の記憶に刻みました';
    $('record-choice').disabled = true;
    if (completed() === 3) {
      $('scene-view').hidden = true;
      $('ending').hidden = false;
      $('revisit').focus({ preventScroll: true });
      return;
    }
    const next = planets.findIndex((planet) => !saved.responses[planet.key]);
    selected = next >= 0 ? next : selected;
    returnToMap();
  }

  nodes.forEach((node, i) => node.addEventListener('click', () => {
    if (selected === i) openPlanet(i);
    else selectPlanet(i);
  }));
  $('explore').addEventListener('click', () => openPlanet(selected));
  $('back-to-map').addEventListener('click', returnToMap);
  $('record-choice').addEventListener('click', recordChoice);
  $('revisit').addEventListener('click', returnToMap);
  $('begin').addEventListener('click', () => {
    $('intro').classList.add('is-leaving');
    $('intro').setAttribute('aria-hidden', 'true');
    $('intro').inert = true;
    $('explore').focus({ preventScroll: true });
  });
  document.addEventListener('keydown', (event) => {
    if (!$('intro').classList.contains('is-leaving')) return;
    if (event.key === 'Escape' && !$('scene-view').hidden) { event.preventDefault(); returnToMap(); }
    if ($('map-view').hidden || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); selectPlanet(selected - 1, true); }
    if (event.key === 'ArrowRight') { event.preventDefault(); selectPlanet(selected + 1, true); }
    if (event.key === 'Enter' && document.activeElement === $('explore')) openPlanet(selected);
  });

  // Low-cost canvas starfield: no WebGPU requirement, no external script or asset.
  const canvas = $('stars');
  const context = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (context) {
    let w = 0, h = 0, stars = [], rafId = 0;
    let pointerX = 0, pointerY = 0;
    function resize() {
      w = window.innerWidth;
      h = Math.max(document.documentElement.scrollHeight, window.innerHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = `${h}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(210, Math.round(w * h / 5500));
      stars = Array.from({ length: count }, () => ({ x: Math.random() * w, y: Math.random() * h, radius: .2 + Math.random() * 1.15, strength: .17 + Math.random() * .6, speed: .12 + Math.random() * .33 }));
    }
    function draw(time) {
      context.clearRect(0, 0, w, h);
      stars.forEach((star) => {
        const twinkle = reducedMotion ? 1 : .8 + .2 * Math.sin(time * .0005 * star.speed + star.x);
        context.beginPath();
        context.fillStyle = `rgba(231,209,174,${star.strength * twinkle})`;
        context.arc(star.x + pointerX * star.radius, star.y + pointerY * star.radius, star.radius, 0, Math.PI * 2);
        context.fill();
      });
      if (!reducedMotion && !document.hidden) rafId = requestAnimationFrame(draw);
    }
    const redraw = () => { if (reducedMotion || document.hidden) draw(0); };
    resize();
    draw(0);
    window.addEventListener('resize', () => { resize(); redraw(); }, { passive: true });
    window.addEventListener('pointermove', (event) => {
      if (reducedMotion) return;
      pointerX = (event.clientX / Math.max(1, w) - .5) * 5;
      pointerY = (event.clientY / Math.max(1, window.innerHeight) - .5) * 5;
    }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(rafId);
      else if (!reducedMotion) rafId = requestAnimationFrame(draw);
    });
  }

  selectPlanet(0);
  updateHud();
  $('begin').focus({ preventScroll: true });
})();
