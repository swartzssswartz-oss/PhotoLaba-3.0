/* СВЕМА ЛАБ — гистограмма кадра.
   Считает по тому, что реально получилось после движка (до рамки и штампа),
   рисует поверх сцены. Включение: кнопка «ГИСТ.» или клавиша H. Режимы: RGB / ЯРКОСТЬ. */
(function () {
  const KEY = 'svema-hist';
  const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } })();
  const st = { on: saved.on !== undefined ? saved.on : window.innerWidth > 900, mode: saved.mode || 'rgb' };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };

  const box = document.getElementById('canvasContainer');
  if (!box) return;
  const root = document.createElement('div');
  root.className = 'hist';
  root.innerHTML =
    '<div class="hist-hd"><span>Гистограмма</span><span class="hist-modes">' +
    '<button type="button" data-m="rgb">RGB</button><button type="button" data-m="luma">Яркость</button>' +
    '<button type="button" data-x aria-label="Скрыть гистограмму">✕</button></span></div>' +
    '<canvas width="480" height="220" aria-label="Гистограмма кадра"></canvas>' +
    '<div class="hist-ft"><span data-s="sh"></span><span data-s="mean"></span><span data-s="hi"></span></div>';
  const tog = document.createElement('button');
  tog.type = 'button';
  tog.className = 'hist-toggle';
  tog.textContent = 'Гист.';
  tog.title = 'Гистограмма (H)';
  box.append(root, tog);

  const cv = root.querySelector('canvas'), g = cv.getContext('2d');
  const off = document.createElement('canvas'), octx = off.getContext('2d', { willReadFrequently: true });
  let timer = 0, last = null;

  function apply() {
    root.hidden = !st.on;
    tog.classList.toggle('on', st.on);
    root.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    if (st.on) update(last, true);
  }

  function compute(src) {
    const k = Math.min(1, 320 / Math.max(src.width, src.height));
    off.width = Math.max(1, Math.round(src.width * k));
    off.height = Math.max(1, Math.round(src.height * k));
    octx.drawImage(src, 0, 0, off.width, off.height);
    const d = octx.getImageData(0, 0, off.width, off.height).data;
    const R = new Uint32Array(256), G = new Uint32Array(256), B = new Uint32Array(256), L = new Uint32Array(256);
    let sum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      const y = Math.round(0.2126 * r + 0.7152 * gg + 0.0722 * b);
      R[r]++; G[gg]++; B[b]++; L[y]++; sum += y; n++;
    }
    return { R, G, B, L, n, mean: n ? sum / n : 0 };
  }

  // опорная высота: 99,5-й перцентиль, чтобы один «столб» (чистый чёрный) не сплющил остальное
  function peak(arrs) {
    const all = [];
    arrs.forEach(a => { for (let i = 1; i < 255; i++) all.push(a[i]); });
    all.sort((x, y) => x - y);
    return Math.max(1, all[Math.floor(all.length * 0.995)] || 1);
  }

  function draw(h) {
    const W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#242424'; g.lineWidth = 1;
    for (let i = 1; i < 4; i++) { const x = Math.round(W * i / 4) + 0.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    const series = st.mode === 'rgb'
      ? [[h.R, '#ff3b30'], [h.G, '#34c759'], [h.B, '#2f7bff']]
      : [[h.L, '#e5e3dd']];
    const top = peak(series.map(s => s[0]));
    g.globalCompositeOperation = st.mode === 'rgb' ? 'lighter' : 'source-over';
    series.forEach(([a, col]) => {
      g.fillStyle = col; g.globalAlpha = st.mode === 'rgb' ? 0.75 : 1;
      for (let i = 0; i < 256; i++) {
        const v = Math.min(1, Math.sqrt(a[i] / top));       // sqrt: видны и редкие тона
        const x0 = Math.floor(i * W / 256), x1 = Math.floor((i + 1) * W / 256);
        const bh = Math.round(v * (H - 6));
        g.fillRect(x0, H - bh, Math.max(1, x1 - x0), bh);
      }
    });
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // маркеры обрезки по краям
    const sh = h.n ? h.L[0] / h.n : 0, hi = h.n ? h.L[255] / h.n : 0;
    g.fillStyle = '#1557c8'; if (sh > 0.005) g.fillRect(0, 0, 6, H);
    g.fillStyle = '#ffffff'; if (hi > 0.005) g.fillRect(W - 6, 0, 6, H);
    const q = s => root.querySelector('[data-s=' + s + ']');
    q('sh').textContent = 'Тени ' + (sh * 100).toFixed(1) + '%';
    q('mean').textContent = 'Ср. ' + Math.round(h.mean);
    q('hi').textContent = 'Света ' + (hi * 100).toFixed(1) + '%';
    q('sh').classList.toggle('warn', sh > 0.005);
    q('hi').classList.toggle('warn', hi > 0.005);
  }

  function update(src, now) {
    if (src) last = src;
    if (!st.on || !last || !last.width) return;
    clearTimeout(timer);
    const run = () => { try { draw(compute(last)); } catch (e) { /* canvas может быть недоступен — не ломаем рендер */ } };
    if (now) run(); else timer = setTimeout(run, 70);
  }

  root.addEventListener('click', e => {
    const m = e.target.closest('[data-m]');
    if (m) { st.mode = m.dataset.m; save(); apply(); return; }
    if (e.target.closest('[data-x]')) { st.on = false; save(); apply(); }
  });
  tog.addEventListener('click', () => { st.on = !st.on; save(); apply(); });
  document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() !== 'h' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || ''))) return;
    st.on = !st.on; save(); apply();
  });

  window.SvemaHist = { update, toggle: () => { st.on = !st.on; save(); apply(); } };
  apply();
})();
