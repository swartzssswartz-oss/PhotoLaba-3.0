
    const canvas = document.getElementById('filmCanvas');
    const ctx = canvas.getContext('2d');
    let sourceImg = null;
    let previewCanvas = document.createElement('canvas');
    let previewCtx = previewCanvas.getContext('2d');

    // Уменьшенный "черновой" буфер для отзывчивого рендера во время драга слайдеров.
    const FAST_PREVIEW_MAX_DIM = 420;
    let fastPreviewCanvas = document.createElement('canvas');
    let fastPreviewCtx = fastPreviewCanvas.getContext('2d');
    let lowResMode = false;

    // Mobile Tab Navigation Logic
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
            sec.classList.toggle('active-mobile-section', sec.dataset.mGroup === tabKey);
          });
        }
      });
    });

    // ────────────────────────────────────────────────────────────────────
    // Аккордеон панелей: критично для мобильного формата — иначе пришлось
    // бы листать десятки слайдеров, чтобы найти нужный модуль. На мобильном
    // по умолчанию раскрыта только первая панель в каждой группе вкладок,
    // на десктопе — открыто всё, как раньше.
    // ────────────────────────────────────────────────────────────────────
    (function initAccordion() {
      const isMobile = window.matchMedia('(max-width: 900px)').matches;
      document.querySelectorAll('.panel-block').forEach(block => {
        const header = block.querySelector('.panel-header');
        const title = header && header.querySelector('.panel-title');
        if (!header || !title) return;

        const chevron = document.createElement('span');
        chevron.className = 'panel-chevron';
        chevron.textContent = '▾';
        header.appendChild(chevron);
        header.addEventListener('click', () => block.classList.toggle('collapsed'));

        if (isMobile) {
          const group = block.closest('.mobile-section') || block.closest('#section-presets');
          const isFirstInGroup = group && group.querySelector('.panel-block') === block;
          if (!isFirstInGroup) block.classList.add('collapsed');
        }
      });
    })();

    // ────────────────────────────────────────────────────────────────────
    // Защита слайдеров от случайных тапов при скролле (мобильные).
    // Раньше касание ЛЮБОЙ точки трека слайдера пальцем — даже мимоходом,
    // когда человек просто листает страницу — сразу же прыгало значением
    // в точку тапа (стандартное поведение <input type="range">). Теперь
    // тач засчитывается только если он начался рядом с самим бегунком —
    // иначе это, скорее всего, просто скролл, и мы его не трогаем.
    // На мышь/трекпад (десктоп) это не влияет — там клик по треку
    // по-прежнему сразу переставляет значение, как и ожидается.
    // ────────────────────────────────────────────────────────────────────
    (function guardSlidersFromAccidentalTouch() {
      const THUMB_SIZE = window.matchMedia('(max-width: 900px)').matches ? 24 : 18;
      const HIT_PADDING = 18; // запас вокруг бегунка, px

      document.addEventListener('touchstart', (e) => {
        const input = e.target.closest && e.target.closest('input[type="range"]');
        if (!input) return;
        const touch = e.touches[0];
        if (!touch) return;

        const min = parseFloat(input.min || '0');
        const max = parseFloat(input.max || '100');
        const val = parseFloat(input.value || '0');
        const rect = input.getBoundingClientRect();
        const percent = max > min ? (val - min) / (max - min) : 0;
        const usable = Math.max(0, rect.width - THUMB_SIZE);
        const thumbCenterX = rect.left + THUMB_SIZE / 2 + percent * usable;

        if (Math.abs(touch.clientX - thumbCenterX) > (THUMB_SIZE / 2 + HIT_PADDING)) {
          e.preventDefault(); // мимо бегунка — считаем это скроллом, не хватаем слайдер
        }
      }, { passive: false });
    })();

    // Точки мастер-кривой крупнее на мобильном — легче попасть пальцем
    const CURVE_HANDLE = window.matchMedia('(max-width: 900px)').matches ? 20 : 12;

    // SVG Curve Setup & Touch Support (мастер-кривая, творческая часть Film Response)
    const svg = document.getElementById('curveSvg');
    const p1El = document.getElementById('p1');
    const p2El = document.getElementById('p2');
    const curvePath = document.getElementById('curvePath');
    let activePoint = null;

    function updateCurveSvg() {
      curvePath.setAttribute('d', `M 0 120 C ${state.p1.x} ${state.p1.y}, ${state.p2.x} ${state.p2.y}, 200 0`);
      const half = CURVE_HANDLE / 2;
      p1El.setAttribute('width', CURVE_HANDLE); p1El.setAttribute('height', CURVE_HANDLE);
      p2El.setAttribute('width', CURVE_HANDLE); p2El.setAttribute('height', CURVE_HANDLE);
      p1El.setAttribute('x', state.p1.x - half);
      p1El.setAttribute('y', state.p1.y - half);
      p2El.setAttribute('x', state.p2.x - half);
      p2El.setAttribute('y', state.p2.y - half);
      if (sourceImg) requestRenderLive();
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

    // Presets List
    function renderPresetsList() {
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
          selectPreset(film.id);
        });

        container.appendChild(row);
      });
    }

    // Ключи, которые пресет ВСЕГДА выставляет явно (даже если у плёнки нет
    // своего recipe — тогда берётся нейтральный набор). Так при переключении
    // пресетов не остаётся "хвостов" от предыдущей плёнки (например, зерно
    // СВЕМА 250 не залипает на ADOX 25 просто потому что не было в списке).
    const RECIPE_KEYS = ['contrast', 'grain', 'grainSize', 'grainContrast', 'devFog', 'frLiftR', 'frLiftG', 'frLiftB', 'halation', 'bloom'];
    const NEUTRAL_RECIPE = { contrast: 0, grain: 30, grainSize: 10, grainContrast: 50, devFog: 8, frLiftR: 0, frLiftG: 0, frLiftB: 0, halation: 15, bloom: 0 };

    function selectPreset(id) {
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

      // Применяем "паспорт" плёнки: контраст/зерно/туман/светочувствительность
      // тона — то, чем реально отличаются эмульсии друг от друга, а не только
      // текст описания.
      const recipe = film.recipe || NEUTRAL_RECIPE;
      RECIPE_KEYS.forEach(key => {
        state[key] = recipe[key];
        const el = document.getElementById('param' + key.charAt(0).toUpperCase() + key.slice(1));
        if (el) {
          el.value = recipe[key];
          el.dispatchEvent(new Event('input')); // подхватит форматирование значения и перерисовку
        }
      });

      if (sourceImg) requestRender();
    }

    document.querySelectorAll('.tab-item').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeFilter = btn.dataset.filter;
        renderPresetsList();
      });
    });

    function preparePreviewBuffer(maxDim = 900) {
      let scale = Math.min(1, maxDim / Math.max(sourceImg.width, sourceImg.height));
      let sw=sourceImg.width, sh=sourceImg.height, sx=0, sy=0;
      if (state.crop !== 'free') { const [a,b]=state.crop.split(':').map(Number), ratio=a/b, current=sw/sh; if(current>ratio){sw=Math.round(sh*ratio);sx=Math.round((sourceImg.width-sw)/2)}else{sh=Math.round(sw/ratio);sy=Math.round((sourceImg.height-sh)/2)} }
      const rot=Math.abs(state.rotation)%180===90;
      previewCanvas.width = Math.round((rot?sh:sw) * scale); previewCanvas.height = Math.round((rot?sw:sh) * scale);
      previewCtx.clearRect(0,0,previewCanvas.width,previewCanvas.height);previewCtx.save();previewCtx.translate(previewCanvas.width/2,previewCanvas.height/2);previewCtx.rotate(state.rotation*Math.PI/180);previewCtx.drawImage(sourceImg,sx,sy,sw,sh,-(sw*scale)/2,-(sh*scale)/2,sw*scale,sh*scale);previewCtx.restore();

      // Черновой уменьшенный буфер — используется, пока пользователь тащит
      // слайдер, чтобы пайплайн не считался на полном разрешении на каждый тик.
      const fastScale = Math.min(1, FAST_PREVIEW_MAX_DIM / Math.max(previewCanvas.width, previewCanvas.height));
      fastPreviewCanvas.width = Math.max(1, Math.round(previewCanvas.width * fastScale));
      fastPreviewCanvas.height = Math.max(1, Math.round(previewCanvas.height * fastScale));
      fastPreviewCtx.clearRect(0, 0, fastPreviewCanvas.width, fastPreviewCanvas.height);
      fastPreviewCtx.drawImage(previewCanvas, 0, 0, fastPreviewCanvas.width, fastPreviewCanvas.height);

      lowResMode = false;
      canvas.width = previewCanvas.width;
      canvas.height = previewCanvas.height;

      document.getElementById('uploadOverlay').classList.add('hidden');
      requestRender();
    }

    function requestRender() {
      if (!state.renderPending && sourceImg) {
        state.renderPending = true;
        requestAnimationFrame(renderFilmPipeline);
      }
    }

    // ────────────────────────────────────────────────────────────────────
    // "Живой" рендер для перетаскиваемых контролов (слайдеры): пока идёт
    // непрерывное движение, считаем на маленьком буфере (быстро, без
    // подвисаний на мобильных), а через короткую паузу после последнего
    // тика — один финальный рендер в полном качестве.
    // ────────────────────────────────────────────────────────────────────
    let settleTimer = null;
    function requestRenderLive() {
      if (fastPreviewCanvas.width) lowResMode = true;
      requestRender();
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        if (lowResMode) { lowResMode = false; requestRender(); }
      }, 140);
    }

    // ── Легаси-оптика объектива (не часть формального движка плёнки) ──────
    function applyLensDistortion(w, h) {
      if (state.distortion === 0) return;

      let tempCanvas = document.createElement('canvas');
      tempCanvas.width = w; tempCanvas.height = h;
      let tCtx = tempCanvas.getContext('2d');
      tCtx.drawImage(canvas, 0, 0);

      let srcData = tCtx.getImageData(0, 0, w, h);
      let dstData = ctx.createImageData(w, h);
      let src = srcData.data;
      let dst = dstData.data;

      let cx = w / 2;
      let cy = h / 2;
      let k = (state.distortion / 50) * 0.0000004;
      let normCoeff = Math.sqrt(cx * cx + cy * cy);

      for (let y = 0; y < h; y++) {
        let dy = y - cy;
        for (let x = 0; x < w; x++) {
          let dx = x - cx;
          let r2 = dx * dx + dy * dy;
          let factor = 1 + k * r2;

          let sx = Math.round(cx + dx * factor);
          let sy = Math.round(cy + dy * factor);

          let dstIdx = (y * w + x) * 4;

          if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
            let srcIdx = (sy * w + sx) * 4;
            dst[dstIdx]     = src[srcIdx];
            dst[dstIdx + 1] = src[srcIdx + 1];
            dst[dstIdx + 2] = src[srcIdx + 2];
            dst[dstIdx + 3] = src[srcIdx + 3];
          } else {
            dst[dstIdx] = dst[dstIdx + 1] = dst[dstIdx + 2] = 0;
            dst[dstIdx + 3] = 255;
          }
        }
      }
      ctx.putImageData(dstData, 0, 0);
    }

    function applyChroma(w, h) {
      if (state.chroma <= 0) return;
      let shift = Math.round(state.chroma);
      let tempCanvas = document.createElement('canvas');
      tempCanvas.width = w; tempCanvas.height = h;
      let tCtx = tempCanvas.getContext('2d');
      tCtx.drawImage(canvas, 0, 0);

      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(tempCanvas, -shift, 0);
      ctx.globalCompositeOperation = 'source-over';
    }

    // ── Точка входа рендера: делегирует весь пиксельный пайплайн движку ──
    function renderFilmPipeline() {
      state.renderPending = false;
      if (!previewCanvas.width) return;
      const src = (lowResMode && fastPreviewCanvas.width) ? fastPreviewCanvas : previewCanvas;
      const w = src.width;
      const h = src.height;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }

      FilmEngine.Core.render({ ctx, canvas, previewCanvas: src, state, filmDatabase, applyLensDistortion, applyChroma });

      if (state.frame !== 'none' || state.frameFormat !== '35') {
        renderFilmFrame(w, h);
      }
      if (state.imprint) {
        renderLabImprint(w, h);
      }
    }

    function renderFilmFrame(w, h) {
      if (state.frameFormat === 'anamorphic') {
        const target = 2.39, current = w / h, crop = current > target ? (w - h * target) / 2 : 0;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, crop, h); ctx.fillRect(w - crop, 0, crop, h);
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .38;
        const flare = ctx.createLinearGradient(0, h*.48, w, h*.52); flare.addColorStop(0,'rgba(0,0,0,0)'); flare.addColorStop(.46,'rgba(40,140,255,.7)'); flare.addColorStop(.54,'rgba(255,170,60,.7)'); flare.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=flare;ctx.fillRect(0,h*.47,w,h*.06);ctx.restore(); return;
      }
      if (state.frameFormat === '6x6' || state.frameFormat === '6x7' || state.frameFormat === '4x5') {
        const m = Math.round(Math.min(w,h)*.06); ctx.fillStyle='#080808'; ctx.fillRect(0,0,w,m);ctx.fillRect(0,h-m,w,m);ctx.fillRect(0,0,m,h);ctx.fillRect(w-m,0,m,h);
        if (state.frameFormat === '4x5') { ctx.fillStyle='#000'; const c=m*1.6; [[0,0],[w-c,0],[0,h-c],[w-c,h-c]].forEach(([x,y])=>{ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+c,y);ctx.lineTo(x,y+c);ctx.fill();}); }
        ctx.font=`${Math.round(m*.42)}px 'JetBrains Mono', monospace`;ctx.fillStyle='#aaa';ctx.fillText(state.frameFormat.toUpperCase()+' • ROLLFILM',m*1.4,m*.72); return;
      }
      render35mmFrame(w, h);
    }

    function render35mmFrame(w, h) {
      const margin = Math.round(Math.min(w, h) * 0.08);
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, w, margin);
      ctx.fillRect(0, h - margin, w, margin);

      ctx.fillStyle = '#111111';
      const holeW = Math.round(margin * 0.5);
      const holeH = Math.round(margin * 0.6);
      const holeGap = holeW * 1.8;

      for (let x = 10; x < w; x += holeGap) {
        ctx.fillRect(x, Math.round(margin * 0.2), holeW, holeH);
        ctx.fillRect(x, h - margin + Math.round(margin * 0.2), holeW, holeH);
      }

      ctx.font = `${Math.round(margin * 0.35)}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = 'rgba(230, 230, 230, 0.7)';
      ctx.fillText(`${state.frameText} :: ${state.frameNumber}`, Math.round(w * 0.15), Math.round(margin * 0.65));
      ctx.fillText("SAFETY FILM", Math.round(w * 0.7), h - Math.round(margin * 0.35));
    }

    function renderLabImprint(w, h) {
      let imprintText = state.imprintText;
      if (!imprintText || imprintText.trim() === '') {
        const film = filmDatabase.find(f => f.id === state.preset);
        const filmName = film ? film.name : 'UNKNOWN';
        const dateStr = new Date().toISOString().slice(0, 10);
        imprintText = `${filmName} | DEV: ${state.devType.toUpperCase()} | PAPER: ${state.paper.toUpperCase()} | ${dateStr}`;
      }

      ctx.font = `bold ${Math.max(10, Math.round(w * 0.018))}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = 'rgba(255, 180, 60, 0.85)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 4;

      const padding = Math.round(w * 0.03);
      ctx.fillText(imprintText, padding, h - padding);
      ctx.shadowBlur = 0;
    }

    // Upload Triggers
    document.getElementById('btnCenterUpload').addEventListener('click', () => {
      document.getElementById('fileUploader').click();
    });
    document.getElementById('btnHeaderUpload').addEventListener('click', () => {
      document.getElementById('fileUploader').click();
    });

    document.getElementById('fileUploader').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const img = new Image();
      img.onload = () => {
        sourceImg = img;
        preparePreviewBuffer();
      };
      img.src = URL.createObjectURL(file);
    });

    // ────────────────────────────────────────────────────────────────────
    // Универсальный байндер слайдеров: id="paramKey" ↔ state.key ↔ id="valKey"
    // ────────────────────────────────────────────────────────────────────
    const bindSlider = (id, key, formatFn) => {
      const el = document.getElementById(id);
      if(!el) return;
      el.addEventListener('input', (e) => {
        state[key] = parseFloat(e.target.value);
        const valElem = document.getElementById('val' + key.charAt(0).toUpperCase() + key.slice(1));
        if (valElem) valElem.innerText = formatFn(state[key]);
        requestRenderLive();
      });
    };

    // ---- Легаси / творческая тональность ----
    bindSlider('paramPush', 'pushPull', v => v === 0 ? 'NORMAL' : v > 0 ? `PUSH +${v}` : `PULL ${v}`);
    bindSlider('paramDyeFade', 'dyeFade', v => `${v}%`);
    bindSlider('paramExp', 'exp', v => (v / 50).toFixed(1));
    bindSlider('paramContrast', 'contrast', v => v > 0 ? `+${v}` : v);
    bindSlider('paramHighlights', 'highlights', v => v > 0 ? `+${v}` : v);
    bindSlider('paramShadows', 'shadows', v => v > 0 ? `+${v}` : v);
    bindSlider('paramFilterR', 'filterR', v => v > 0 ? `+${v}` : v);
    bindSlider('paramFilterG', 'filterG', v => v > 0 ? `+${v}` : v);
    bindSlider('paramFilterB', 'filterB', v => v > 0 ? `+${v}` : v);
    bindSlider('paramTemp', 'temp', v => v > 0 ? `+${v}` : v);
    bindSlider('paramSat', 'sat', v => `${v}%`);
    bindSlider('paramSplitShadow', 'splitShadow', v => `${v}%`);
    bindSlider('paramDistortion', 'distortion', v => v > 0 ? `+${v}` : v);
    bindSlider('paramChroma', 'chroma', v => `+${v}`);
    bindSlider('paramVignette', 'vignette', v => `${v}%`);
    bindSlider('paramSabattier', 'sabattier', v => `${v}%`);
    bindSlider('paramReticulation', 'reticulation', v => `${v}%`);
    bindSlider('paramBromide', 'bromide', v => `${v}%`);
    bindSlider('paramRotation','rotation',v=>`${v}°`);

    // ---- 1. Film Response ----
    bindSlider('paramFrBlackPoint', 'frBlackPoint', v => `${v}`);
    bindSlider('paramFrWhitePoint', 'frWhitePoint', v => `${v}`);
    bindSlider('paramFrMasterGamma', 'frMasterGamma', v => (v / 100).toFixed(2));
    bindSlider('paramFrLiftR', 'frLiftR', v => v > 0 ? `+${v}` : v);
    bindSlider('paramFrLiftG', 'frLiftG', v => v > 0 ? `+${v}` : v);
    bindSlider('paramFrLiftB', 'frLiftB', v => v > 0 ? `+${v}` : v);
    bindSlider('paramFrGammaR', 'frGammaR', v => (v / 100).toFixed(2));
    bindSlider('paramFrGammaG', 'frGammaG', v => (v / 100).toFixed(2));
    bindSlider('paramFrGammaB', 'frGammaB', v => (v / 100).toFixed(2));
    bindSlider('paramFrGainR', 'frGainR', v => (v / 100).toFixed(2));
    bindSlider('paramFrGainG', 'frGainG', v => (v / 100).toFixed(2));
    bindSlider('paramFrGainB', 'frGainB', v => (v / 100).toFixed(2));
    bindSlider('paramFrMixRG', 'frMixRG', v => v > 0 ? `+${v}` : v);
    bindSlider('paramFrMixRB', 'frMixRB', v => v > 0 ? `+${v}` : v);
    bindSlider('paramFrMixGB', 'frMixGB', v => v > 0 ? `+${v}` : v);

    // ---- 2. Grain Engine ----
    bindSlider('paramGrain', 'grain', v => `${v}%`);
    bindSlider('paramGrainSize', 'grainSize', v => `${(v/10).toFixed(1)}x`);
    bindSlider('paramGrainDensity', 'grainDensity', v => `${v}%`);
    bindSlider('paramGrainContrast', 'grainContrast', v => `${v}%`);
    bindSlider('paramGrainColor', 'grainColor', v => `${v}%`);
    bindSlider('paramGrainExposureDep', 'grainExposureDep', v => `${v}%`);
    document.getElementById('paramGrainLock').addEventListener('change', e => { state.grainLock = e.target.checked; state.grainSeed = Math.random() * 99999; requestRender(); });

    // ---- 3. Developer ----
    bindSlider('paramDevTemp', 'devTemp', v => `${v}°C`);
    bindSlider('paramDevTime', 'devTime', v => `${v}%`);
    bindSlider('paramDevDilution', 'devDilution', v => `${v}%`);
    bindSlider('paramDevAgitation', 'devAgitation', v => `${v}%`);
    bindSlider('paramDevContrast', 'devContrast', v => v > 0 ? `+${v}` : v);
    bindSlider('paramDevFog', 'devFog', v => `${v}%`);
    document.getElementById('paramDevType').addEventListener('change', (e) => {
      FilmEngine.Developer.applyRecipe(state, e.target.value);
      ['DevTemp','DevTime','DevDilution','DevAgitation','DevContrast','DevFog'].forEach(n => {
        const key = n.charAt(0).toLowerCase() + n.slice(1);
        const el = document.getElementById('param' + n);
        if (el) { el.value = state[key]; el.dispatchEvent(new Event('input')); }
      });
      requestRender();
    });

    // ---- 5. Halation ----
    bindSlider('paramHalation', 'halation', v => `${v}%`);
    bindSlider('paramHalationThreshold', 'halationThreshold', v => `${v}`);
    bindSlider('paramHalationRadius', 'halationRadius', v => `${v}px`);
    bindSlider('paramHalationDecay', 'halationDecay', v => `${v}%`);
    bindSlider('paramHalationR', 'halationR', v => `${v}%`);
    bindSlider('paramHalationG', 'halationG', v => `${v}%`);
    bindSlider('paramHalationB', 'halationB', v => `${v}%`);

    // ---- 6. Bloom ----
    bindSlider('paramBloom', 'bloom', v => `${v}%`);
    bindSlider('paramBloomThreshold', 'bloomThreshold', v => `${v}`);
    bindSlider('paramBloomRadius', 'bloomRadius', v => `${v}px`);

    // ---- 7. Emulsion Defects ----
    bindSlider('paramDust', 'dust', v => `${v}%`);
    bindSlider('paramScratches', 'scratches', v => `${v}%`);
    bindSlider('paramDamage', 'damage', v => `${v}%`);
    bindSlider('paramSpots', 'spots', v => `${v}%`);
    bindSlider('paramUnevenDensity', 'unevenDensity', v => `${v}%`);
    bindSlider('paramLeak', 'leak', v => `${v}%`);
    document.getElementById('paramDefectLock').addEventListener('change', e => { state.defectLock = e.target.checked; state.defectSeed = Math.random() * 99999; requestRender(); });

    // ---- 8. Exposure Uniformity ----
    bindSlider('paramUniformH', 'uniformH', v => v > 0 ? `+${v}` : v);
    bindSlider('paramUniformV', 'uniformV', v => v > 0 ? `+${v}` : v);
    bindSlider('paramUniformRadial', 'uniformRadial', v => v > 0 ? `+${v}` : v);
    bindSlider('paramUniformRandom', 'uniformRandom', v => `${v}%`);
    bindSlider('paramUniformScale', 'uniformScale', v => `${v}%`);

    // ---- FoundYear (эффективный ISO) ----
    bindSlider('paramFoundYear', 'foundYear', v => `${v}`);
    document.getElementById('paramFoundYear').addEventListener('input', () => {
      const film = filmDatabase.find(f => f.id === state.preset);
      const iso = (film && (film.gost.match(/\d+/) || [100]))[0];
      const effective = Math.max(1, Math.round(iso * (1 - (2026 - state.foundYear) / 70)));
      document.getElementById('hudGost').innerText = `ISO ${effective} (ном. ${iso})`;
    });

    // ---- Селекты и текстовые поля ----
    document.getElementById('paramPaper').addEventListener('change', (e) => { state.paper = e.target.value; requestRender(); });
    document.getElementById('paramToner').addEventListener('change', (e) => { state.toner = e.target.value; requestRender(); });
    document.getElementById('paramFrame').addEventListener('change', (e) => { state.frame = e.target.value; requestRender(); });
    document.getElementById('paramFrameText').addEventListener('input', (e) => { state.frameText = e.target.value; requestRender(); });
    document.getElementById('paramImprintText').addEventListener('input', (e) => { state.imprintText = e.target.value; requestRender(); });
    document.getElementById('paramImprint').addEventListener('change', (e) => { state.imprint = e.target.checked; requestRender(); });
    document.getElementById('paramFrameFormat').addEventListener('change', (e) => { state.frameFormat = e.target.value; requestRender(); });
    document.getElementById('paramCrop').addEventListener('change', e=>{state.crop=e.target.value;preparePreviewBuffer();});
    document.getElementById('paramRotation').addEventListener('change',()=>preparePreviewBuffer());
    document.getElementById('paramFrameNumber').addEventListener('input',e=>{state.frameNumber=e.target.value;requestRender();});
    document.getElementById('paramCondition').addEventListener('change',e=>{
      state.condition=e.target.value;
      const p={fresh:[2026,0,0],drawer:[1997,16,18],attic:[1985,40,50],camera:[1991,25,35]}[e.target.value];
      state.foundYear=p[0];state.dyeFade=p[1];state.dust=p[2];
      ['FoundYear','DyeFade','Dust'].forEach((n,i)=>{const el=document.getElementById('param'+n);el.value=p[i];el.dispatchEvent(new Event('input'));});
    });
    document.getElementById('paramRecipe').addEventListener('change',e=>{
      state.recipe=e.target.value;
      const r={d76:'st2',rodinal:'rodinal',stand:'rodinal'}[e.target.value];
      if(!r)return;
      document.getElementById('paramDevType').value = r;
      document.getElementById('paramDevType').dispatchEvent(new Event('change'));
      if (e.target.value === 'stand') {
        state.pushPull = -1; state.devAgitation = 4; state.devTime = 220;
        document.getElementById('paramPush').value = -1; document.getElementById('paramPush').dispatchEvent(new Event('input'));
        document.getElementById('paramDevAgitation').value = 4; document.getElementById('paramDevAgitation').dispatchEvent(new Event('input'));
        document.getElementById('paramDevTime').value = 220; document.getElementById('paramDevTime').dispatchEvent(new Event('input'));
      }
    });

    // ────────────────────────────────────────────────────────────────────
    // 9. МАСКИ: единый компонент, вставляется во все .mask-slot
    // ────────────────────────────────────────────────────────────────────
    function maskStateKey(dataKey) { return 'mask' + dataKey.charAt(0).toUpperCase() + dataKey.slice(1); }

    function installMaskControls() {
      document.querySelectorAll('.mask-slot').forEach(slot => {
        const dataKey = slot.dataset.key;
        const stateKey = maskStateKey(dataKey);
        const cfg = state[stateKey];
        if (!cfg) return;

        slot.innerHTML = `
          <div class="mask-block">
            <div class="mask-block-title">Маска эффекта</div>
            <select class="select-input mm-target">
              <option value="all">Весь кадр</option>
              <option value="shadows">Тени</option>
              <option value="midtones">Полутона</option>
              <option value="highlights">Света</option>
              <option value="custom">Своя маска</option>
            </select>
            <div class="mask-custom" hidden>
              <select class="select-input mm-shape">
                <option value="linear">Линейный градиент</option>
                <option value="radial">Радиальный градиент</option>
              </select>
              <div class="control-unit mask-row mm-row-angle"><div class="control-head"><span>Угол</span><span class="control-val mm-angle-val">0°</span></div><input type="range" class="mm-angle" min="0" max="360" value="0"></div>
              <div class="control-unit mask-row mm-row-radial"><div class="control-head"><span>Центр X</span><span class="control-val mm-cx-val">50%</span></div><input type="range" class="mm-cx" min="0" max="100" value="50"></div>
              <div class="control-unit mask-row mm-row-radial"><div class="control-head"><span>Центр Y</span><span class="control-val mm-cy-val">50%</span></div><input type="range" class="mm-cy" min="0" max="100" value="50"></div>
              <div class="control-unit mask-row mm-row-radial"><div class="control-head"><span>Радиус</span><span class="control-val mm-radius-val">60%</span></div><input type="range" class="mm-radius" min="5" max="150" value="60"></div>
              <div class="control-unit mask-row"><div class="control-head"><span>Растушёвка</span><span class="control-val mm-feather-val">40%</span></div><input type="range" class="mm-feather" min="1" max="100" value="40"></div>
              <label class="checkbox-label"><input type="checkbox" class="mm-invert"> Инвертировать</label>
            </div>
          </div>
        `;

        const targetSel = slot.querySelector('.mm-target');
        const customBlock = slot.querySelector('.mask-custom');
        const shapeSel = slot.querySelector('.mm-shape');
        const angleRow = slot.querySelector('.mm-row-angle');
        const radialRows = slot.querySelectorAll('.mm-row-radial');
        const angleInput = slot.querySelector('.mm-angle');
        const cxInput = slot.querySelector('.mm-cx');
        const cyInput = slot.querySelector('.mm-cy');
        const radiusInput = slot.querySelector('.mm-radius');
        const featherInput = slot.querySelector('.mm-feather');
        const invertInput = slot.querySelector('.mm-invert');

        // Начальные значения из state
        targetSel.value = cfg.target;
        shapeSel.value = cfg.custom.shape;
        angleInput.value = cfg.custom.angle;
        cxInput.value = cfg.custom.cx;
        cyInput.value = cfg.custom.cy;
        radiusInput.value = cfg.custom.radius;
        featherInput.value = cfg.custom.feather;
        invertInput.checked = cfg.custom.invert;

        function syncVisibility() {
          customBlock.hidden = targetSel.value !== 'custom';
          const isRadial = shapeSel.value === 'radial';
          angleRow.hidden = isRadial;
          radialRows.forEach(r => r.hidden = !isRadial);
        }
        function syncLabels() {
          slot.querySelector('.mm-angle-val').innerText = `${angleInput.value}°`;
          slot.querySelector('.mm-cx-val').innerText = `${cxInput.value}%`;
          slot.querySelector('.mm-cy-val').innerText = `${cyInput.value}%`;
          slot.querySelector('.mm-radius-val').innerText = `${radiusInput.value}%`;
          slot.querySelector('.mm-feather-val').innerText = `${featherInput.value}%`;
        }
        syncVisibility();
        syncLabels();

        targetSel.addEventListener('change', () => { cfg.target = targetSel.value; syncVisibility(); requestRender(); });
        shapeSel.addEventListener('change', () => { cfg.custom.shape = shapeSel.value; syncVisibility(); requestRender(); });
        angleInput.addEventListener('input', () => { cfg.custom.angle = parseFloat(angleInput.value); syncLabels(); requestRenderLive(); });
        cxInput.addEventListener('input', () => { cfg.custom.cx = parseFloat(cxInput.value); syncLabels(); requestRenderLive(); });
        cyInput.addEventListener('input', () => { cfg.custom.cy = parseFloat(cyInput.value); syncLabels(); requestRenderLive(); });
        radiusInput.addEventListener('input', () => { cfg.custom.radius = parseFloat(radiusInput.value); syncLabels(); requestRenderLive(); });
        featherInput.addEventListener('input', () => { cfg.custom.feather = parseFloat(featherInput.value); syncLabels(); requestRenderLive(); });
        invertInput.addEventListener('change', () => { cfg.custom.invert = invertInput.checked; requestRender(); });
      });
    }

    // ────────────────────────────────────────────────────────────────────
    // Легаси-инструменты: история, A/B
    // ────────────────────────────────────────────────────────────────────
    function saveHistory(){if(!sourceImg)return;state.history.unshift(canvas.toDataURL('image/jpeg',.45));state.history=state.history.slice(0,6);}
    document.getElementById('btnHistory').addEventListener('click',()=>{if(!state.history.length)saveHistory();const win=window.open('','history','width=760,height=500');if(win)win.document.write(`<body style="margin:0;background:#111;color:#fff;font:12px monospace;padding:16px"><h3>ИСТОРИЯ РЕНДЕРОВ</h3>${state.history.map((s,i)=>`<img title="Версия ${i+1}" src="${s}" style="width:30%;margin:1%;border:1px solid #555">`).join('')}</body>`);});
    let showOriginal=false;document.getElementById('btnAB').addEventListener('pointerdown',()=>{if(!sourceImg)return;showOriginal=true;ctx.drawImage(previewCanvas,0,0);});document.getElementById('btnAB').addEventListener('pointerup',()=>{showOriginal=false;requestRender();});document.getElementById('btnAB').addEventListener('pointerleave',()=>{if(showOriginal){showOriginal=false;requestRender();}});

    // ────────────────────────────────────────────────────────────────────
    // Reset All
    // ────────────────────────────────────────────────────────────────────
    document.getElementById('btnReset').addEventListener('click', () => {
      state = JSON.parse(JSON.stringify(defaultState));
      state.p1 = { ...defaultState.p1 };
      state.p2 = { ...defaultState.p2 };
      state.history = [];

      document.querySelectorAll('input[type="range"]').forEach(input => {
        const key = input.id.replace('param', '');
        const lowerKey = key.charAt(0).toLowerCase() + key.slice(1);
        if (state[lowerKey] !== undefined) {
          input.value = state[lowerKey];
          input.dispatchEvent(new Event('input'));
        }
      });
      document.getElementById('paramDevType').value = 'st2';
      document.getElementById('paramPaper').value = 'rc';
      document.getElementById('paramToner').value = 'none';
      document.getElementById('paramFrame').value = 'none';
      document.getElementById('paramFrameFormat').value = '35';
      document.getElementById('paramCondition').value = 'fresh';
      document.getElementById('paramCrop').value = 'free';
      document.getElementById('paramRotation').value = 0;
      document.getElementById('paramRecipe').value = 'manual';
      document.getElementById('paramGrainLock').checked = false;
      document.getElementById('paramDefectLock').checked = false;
      document.getElementById('paramFrameNumber').value = state.frameNumber;
      document.getElementById('paramFrameText').value = state.frameText;
      document.getElementById('paramImprint').checked = false;
      document.getElementById('paramImprintText').value = '';
      installMaskControls();
      updateCurveSvg();
    });

    // ────────────────────────────────────────────────────────────────────
    // Оверлей анимации экспорта — рендер в полном разрешении не мгновенный,
    // особенно на телефоне (halation/bloom считаются заново, целиком).
    // Показываем процесс явно, а не подвешиваем интерфейс молча.
    // ────────────────────────────────────────────────────────────────────
    let exportOverlay = null;
    function ensureExportOverlay() {
      if (exportOverlay) return exportOverlay;
      exportOverlay = document.createElement('div');
      exportOverlay.className = 'export-overlay';
      exportOverlay.innerHTML = `
        <div class="export-card">
          <div class="export-icon spin">◆</div>
          <div class="export-title">Рендер полного разрешения…</div>
          <div class="export-track"><div class="export-fill"></div></div>
        </div>
      `;
      document.body.appendChild(exportOverlay);
      return exportOverlay;
    }
    function setExportStatus(text, mode) {
      const el = ensureExportOverlay();
      el.classList.add('visible');
      const card = el.querySelector('.export-card');
      const icon = el.querySelector('.export-icon');
      card.className = 'export-card' + (mode ? ' ' + mode : '');
      el.querySelector('.export-title').textContent = text;
      icon.classList.toggle('spin', !mode);
      icon.textContent = mode === 'success' ? '✓' : mode === 'error' ? '✕' : '◆';
    }
    function hideExportOverlay(delay = 0) {
      setTimeout(() => { if (exportOverlay) exportOverlay.classList.remove('visible'); }, delay);
    }
    // Двойной rAF гарантирует, что оверлей реально отрисован на экране
    // ДО того, как мы заблокируем поток тяжёлым синхронным рендером.
    function nextPaint() {
      return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    function triggerDownload(blob, filename) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }

    // Export PNG
    document.getElementById('btnExport').addEventListener('click', async () => {
      if (!sourceImg) return;

      setExportStatus('Рендер полного разрешения…');
      await nextPaint();

      lowResMode = false;
      clearTimeout(settleTimer);
      preparePreviewBuffer(Infinity);
      renderFilmPipeline();
      saveHistory();

      setExportStatus('Кодирование PNG…');
      await nextPaint();

      canvas.toBlob(async (blob) => {
        preparePreviewBuffer();

        if (!blob) {
          setExportStatus('Не удалось сохранить кадр', 'error');
          hideExportOverlay(2200);
          return;
        }

        const filename = `SvemaLab_${state.preset}_${Date.now()}.png`;
        const file = new File([blob], filename, { type: 'image/png' });

        // На мобильных — системное меню "Поделиться", там реально есть
        // пункт "Сохранить изображение" (это фактически кладёт в галерею).
        // На десктопе такого меню нет — там просто скачиваем файл.
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          setExportStatus('Открываю меню «Поделиться»…');
          try {
            await navigator.share({ files: [file], title: 'СВЕМА LAB' });
            setExportStatus('Готово', 'success');
            hideExportOverlay(1400);
          } catch (err) {
            if (err && err.name === 'AbortError') {
              hideExportOverlay(0); // пользователь просто закрыл меню — ничего страшного
            } else {
              triggerDownload(blob, filename);
              setExportStatus('Файл сохранён в Загрузки', 'success');
              hideExportOverlay(1800);
            }
          }
        } else {
          triggerDownload(blob, filename);
          setExportStatus('Файл сохранён в Загрузки', 'success');
          hideExportOverlay(1800);
        }
      }, 'image/png');
    });

    // Initialization
    renderPresetsList();
    selectPreset('svema64');
    updateCurveSvg();
    installMaskControls();
