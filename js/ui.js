// ui.js
// Всё взаимодействие с DOM, кроме собственно пиксельного рендера:
// мобильные табы, список пресетов, кривая на SVG, слайдеры, реакция на инпуты.
// Дергает requestRender() (переданный из main.js), но не знает деталей пайплайна.



function initMobileTabs() {
  document.querySelectorAll('.m-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.m-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabKey = tab.dataset.tab;
      const leftSidebar = document.getElementById('section-presets');
      const rightSidebar = document.getElementById('section-right-controls');
      const mobileSections = document.querySelectorAll('.mobile-section');

      if (tabKey === 'presets') {
        leftSidebar.classList.add('mobile-active');
        rightSidebar.classList.remove('mobile-active');
      } else {
        leftSidebar.classList.remove('mobile-active');
        rightSidebar.classList.add('mobile-active');

        mobileSections.forEach(sec => {
          if (sec.dataset.mGroup === tabKey) {
            sec.classList.add('active-mobile-section');
          } else {
            sec.classList.remove('active-mobile-section');
          }
        });
      }
    });
  });
}

function initCurveEditor(requestRender) {
  const svg = document.getElementById('curveSvg');
  const p1El = document.getElementById('p1');
  const p2El = document.getElementById('p2');
  const curvePath = document.getElementById('curvePath');
  let activePoint = null;

  function updateCurveSvg() {
    curvePath.setAttribute('d', `M 0 120 C ${state.p1.x} ${state.p1.y}, ${state.p2.x} ${state.p2.y}, 200 0`);
    p1El.setAttribute('x', state.p1.x - 6);
    p1El.setAttribute('y', state.p1.y - 6);
    p2El.setAttribute('x', state.p2.x - 6);
    p2El.setAttribute('y', state.p2.y - 6);
    requestRender();
  }

  function getSvgCoords(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(200, (clientX - rect.left) * (200 / rect.width))),
      y: Math.max(0, Math.min(120, (clientY - rect.top) * (120 / rect.height)))
    };
  }

  [p1El, p2El].forEach((el, idx) => {
    el.addEventListener('mousedown', () => activePoint = idx === 0 ? state.p1 : state.p2);
    el.addEventListener('touchstart', (e) => {
      activePoint = idx === 0 ? state.p1 : state.p2;
      e.preventDefault();
    }, { passive: false });
  });

  window.addEventListener('mousemove', (e) => {
    if (!activePoint) return;
    const c = getSvgCoords(e.clientX, e.clientY);
    activePoint.x = c.x;
    activePoint.y = c.y;
    updateCurveSvg();
  });

  window.addEventListener('touchmove', (e) => {
    if (!activePoint) return;
    const touch = e.touches[0];
    const c = getSvgCoords(touch.clientX, touch.clientY);
    activePoint.x = c.x;
    activePoint.y = c.y;
    updateCurveSvg();
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('mouseup', () => activePoint = null);
  window.addEventListener('touchend', () => activePoint = null);

  return { updateCurveSvg };
}

function renderPresetsList(onSelect) {
  const container = document.getElementById('presetsList');
  container.innerHTML = '';

  filmDatabase.forEach(film => {
    if (state.activeFilter !== 'all' && film.type !== state.activeFilter) return;

    const row = document.createElement('div');
    row.className = `preset-row ${film.id === state.preset ? 'active' : ''}`;
    row.dataset.id = film.id;

    const tagLabel = film.type === 'color' ? 'ЦВЕТ' : film.type === 'aero' ? 'СПЕЦ' : 'Ч/Б';

    row.innerHTML = `
      <div class="preset-meta">
        <span class="preset-title">${film.name}</span>
        <span class="preset-tag">${tagLabel}</span>
      </div>
      <span class="preset-gost">${film.gost}</span>
    `;

    row.addEventListener('click', () => {
      document.querySelectorAll('.preset-row').forEach(r => r.classList.remove('active'));
      row.classList.add('active');
      onSelect(film.id);
    });

    container.appendChild(row);
  });
}

function selectPreset(id, requestRender, hasSourceImg) {
  state.preset = id;
  const film = filmDatabase.find(f => f.id === id);
  if (!film) return;

  document.getElementById('presetDesc').innerText = film.desc;
  document.getElementById('hudGost').innerText = film.gost;
  document.getElementById('hudRes').innerText = film.res;
  document.getElementById('hudDev').innerText = film.dev;

  const defText = `${film.name} :: ${film.gost} :: 24A`;
  state.frameText = defText;
  document.getElementById('paramFrameText').value = defText;

  if (hasSourceImg()) requestRender();
}

function initPresetFilterTabs(onFilterChange) {
  document.querySelectorAll('.tab-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeFilter = btn.dataset.filter;
      onFilterChange();
    });
  });
}

function bindSlider(id, key, formatFn, requestRender) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', (e) => {
    state[key] = parseFloat(e.target.value);
    const valElem = document.getElementById('val' + key.charAt(0).toUpperCase() + key.slice(1));
    if (valElem) valElem.innerText = formatFn(state[key]);
    requestRender();
  });
}

function bindAllSliders(requestRender) {
  bindSlider('paramPush', 'pushPull', v => v === 0 ? 'NORMAL' : v > 0 ? `PUSH +${v}` : `PULL ${v}`, requestRender);
  bindSlider('paramDyeFade', 'dyeFade', v => `${v}%`, requestRender);
  bindSlider('paramExp', 'exp', v => (v / 50).toFixed(1), requestRender);
  bindSlider('paramContrast', 'contrast', v => v > 0 ? `+${v}` : v, requestRender);
  bindSlider('paramHighlights', 'highlights', v => v > 0 ? `+${v}` : v, requestRender);
  bindSlider('paramShadows', 'shadows', v => v > 0 ? `+${v}` : v, requestRender);
  bindSlider('paramFade', 'fade', v => `${v}%`, requestRender);
  bindSlider('paramGrain', 'grain', v => `${v}%`, requestRender);
  bindSlider('paramGrainSize', 'grainSize', v => `${(v / 10).toFixed(1)}x`, requestRender);
  bindSlider('paramClarity', 'clarity', v => v > 0 ? `+${v}` : v, requestRender);
  bindSlider('paramFilterR', 'filterR', v => v > 0 ? `+${v}` : v, requestRender);
  bindSlider('paramFilterG', 'filterG', v => v > 0 ? `+${v}` : v, requestRender);
  bindSlider('paramFilterB', 'filterB', v => v > 0 ? `+${v}` : v, requestRender);
  bindSlider('paramTemp', 'temp', v => v > 0 ? `+${v}` : v, requestRender);
  bindSlider('paramSat', 'sat', v => `${v}%`, requestRender);
  bindSlider('paramSplitShadow', 'splitShadow', v => `${v}%`, requestRender);
  bindSlider('paramHalation', 'halation', v => `${v}%`, requestRender);
  bindSlider('paramBloom', 'bloom', v => `${v}%`, requestRender);
  bindSlider('paramChroma', 'chroma', v => `+${v}`, requestRender);
  bindSlider('paramVignette', 'vignette', v => `${v}%`, requestRender);
  bindSlider('paramLeak', 'leak', v => `${v}%`, requestRender);
  bindSlider('paramSpots', 'spots', v => `${v}%`, requestRender);
  bindSlider('paramDust', 'dust', v => `${v}%`, requestRender);
}

function bindSelectsAndText(requestRender) {
  document.getElementById('paramDevType').addEventListener('change', (e) => { state.devType = e.target.value; requestRender(); });
  document.getElementById('paramPaper').addEventListener('change', (e) => { state.paper = e.target.value; requestRender(); });
  document.getElementById('paramToner').addEventListener('change', (e) => { state.toner = e.target.value; requestRender(); });
  document.getElementById('paramFrame').addEventListener('change', (e) => { state.frame = e.target.value; requestRender(); });
  document.getElementById('paramFrameText').addEventListener('input', (e) => { state.frameText = e.target.value; requestRender(); });
  document.getElementById('paramImprintText').addEventListener('input', (e) => { state.imprintText = e.target.value; requestRender(); });
  document.getElementById('paramImprint').addEventListener('change', (e) => { state.imprint = e.target.checked; requestRender(); });
}
