
    // ──────────────────────────────────────────────────────────────────────
    // FilmEngine.Crop (SvemaCrop)
    // Полноэкранное окно кадрирования+поворота: показываем исходное фото
    // (с учётом текущего поворота), поверх — перетаскиваемая/растягиваемая
    // рамка (box-shadow-спотлайт). Ratio-кнопки задают/снимают фиксацию
    // пропорции. Кнопки ↺90°/90°↻ и слайдер "выровнять" крутят кадр —
    // рамка кадрирования при этом всегда работает в координатах УЖЕ
    // повёрнутого изображения (что видишь — то и вырежется).
    //
    // Результат onApply(rectNormalized, rotationDeg):
    //   rectNormalized — прямоугольник 0..1 в координатах ПОВЁРНУТОГО кадра
    //   rotationDeg    — суммарный угол поворота, который нужно применить
    //                    к исходнику ПЕРЕД кадрированием (см. preparePreviewBuffer).
    // ──────────────────────────────────────────────────────────────────────
    (function (root) {
      const RATIOS = [
        { key: 'free', label: 'Свободно', value: null },
        { key: '3:2', label: '3:2', value: 3 / 2 },
        { key: '1:1', label: '1:1', value: 1 },
        { key: '4:5', label: '4:5', value: 4 / 5 },
        { key: '16:9', label: '16:9', value: 16 / 9 },
        { key: '9:16', label: '9:16', value: 9 / 16 },
        { key: '239:100', label: '2.39:1', value: 2.39 }
      ];
      const MIN_BOX = 32; // минимальный размер рамки на экране, px
      const WORKING_MAX_DIM = 1000; // рабочая копия для быстрого live-поворота в самом окне

      let overlay = null;
      let state = null;
      let resizeHandler = null;

      function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

      // Раскладывает суммарный угол на "шаг 90°" (0/90/180/270) и "точная
      // подстройка" (-45..45) — так слайдер "Выровнять" всегда показывает
      // разумное небольшое число, даже если общий угол больше 45°.
      function decomposeRotation(totalDeg) {
        let step = Math.round(totalDeg / 90) * 90;
        let fine = totalDeg - step;
        while (fine > 45) { fine -= 90; step += 90; }
        while (fine < -45) { fine += 90; step -= 90; }
        step = ((step % 360) + 360) % 360;
        return { step, fine };
      }

      // Масштаб, при котором прямоугольник w×h, повёрнутый на angleRad вокруг
      // своего центра, всё ещё полностью покрывает СВОЙ ЖЕ исходный контур
      // (иначе при точном повороте по углам появляются пустые треугольники).
      // Стандартная формула для "rotate + cover".
      function coverScale(w, h, angleRad) {
        const cos = Math.abs(Math.cos(angleRad));
        const sin = Math.abs(Math.sin(angleRad));
        const scaleX = (w * cos + h * sin) / w;
        const scaleY = (w * sin + h * cos) / h;
        return Math.max(scaleX, scaleY);
      }

      // Рисует image (Image/Canvas) повёрнутым на angleDeg в НОВЫЙ канвас.
      // Для кратных 90° — точная перестановка сторон без масштабирования.
      // Для произвольного угла — холст остаётся исходного размера, контент
      // покрывающе масштабируется, чтобы не было пустых уголков.
      function buildRotatedCanvas(image, angleDeg, srcW, srcH) {
        srcW = srcW || image.width; srcH = srcH || image.height;
        const norm = ((angleDeg % 360) + 360) % 360;
        const angleRad = angleDeg * Math.PI / 180;
        const c = document.createElement('canvas');

        if (norm === 0) {
          c.width = srcW; c.height = srcH;
          c.getContext('2d').drawImage(image, 0, 0, srcW, srcH);
          return c;
        }

        if (norm % 90 === 0) {
          const swap = norm === 90 || norm === 270;
          c.width = swap ? srcH : srcW;
          c.height = swap ? srcW : srcH;
          const ctx = c.getContext('2d');
          ctx.translate(c.width / 2, c.height / 2);
          ctx.rotate(angleRad);
          ctx.drawImage(image, -srcW / 2, -srcH / 2, srcW, srcH);
          return c;
        }

        c.width = srcW; c.height = srcH;
        const ctx = c.getContext('2d');
        const s = coverScale(srcW, srcH, angleRad);
        ctx.translate(c.width / 2, c.height / 2);
        ctx.rotate(angleRad);
        ctx.scale(s, s);
        ctx.drawImage(image, -srcW / 2, -srcH / 2, srcW, srcH);
        return c;
      }

      function buildOverlay() {
        const el = document.createElement('div');
        el.className = 'crop-overlay';
        el.innerHTML = `
          <div class="crop-toolbar">
            <span class="crop-title">Кадрирование и поворот</span>
            <button class="crop-close" aria-label="Закрыть">✕</button>
          </div>
          <div class="crop-stage">
            <div class="crop-image-wrap">
              <canvas class="crop-image-canvas"></canvas>
              <div class="crop-box">
                <div class="crop-handle crop-handle-nw" data-corner="nw"></div>
                <div class="crop-handle crop-handle-ne" data-corner="ne"></div>
                <div class="crop-handle crop-handle-sw" data-corner="sw"></div>
                <div class="crop-handle crop-handle-se" data-corner="se"></div>
              </div>
            </div>
          </div>
          <div class="crop-rotate-row">
            <button class="crop-rotate-btn" data-turn="-90" aria-label="Повернуть влево на 90°">⟲ 90°</button>
            <div class="crop-straighten">
              <div class="crop-straighten-head"><span>Выровнять</span><span class="crop-straighten-val">0°</span></div>
              <input type="range" class="crop-straighten-slider" min="-45" max="45" step="0.5" value="0">
            </div>
            <button class="crop-rotate-btn" data-turn="90" aria-label="Повернуть вправо на 90°">90° ⟳</button>
          </div>
          <div class="crop-ratios">
            ${RATIOS.map(r => `<button class="crop-ratio-btn" data-ratio="${r.key}">${r.label}</button>`).join('')}
          </div>
          <div class="crop-actions">
            <button class="btn crop-cancel">Отмена</button>
            <button class="btn btn-primary crop-apply">Применить</button>
          </div>
        `;
        document.body.appendChild(el);
        return el;
      }

      function boxRectPx() {
        const box = overlay.querySelector('.crop-box');
        return { left: parseFloat(box.style.left), top: parseFloat(box.style.top), w: parseFloat(box.style.width), h: parseFloat(box.style.height) };
      }
      function setBoxRectPx(r) {
        const box = overlay.querySelector('.crop-box');
        box.style.left = r.left + 'px';
        box.style.top = r.top + 'px';
        box.style.width = r.w + 'px';
        box.style.height = r.h + 'px';
      }

      function ratioBoxCentered(ratioValue, containerW, containerH) {
        if (!ratioValue) return { left: 0, top: 0, w: containerW, h: containerH };
        let w = containerW * 0.92, h = w / ratioValue;
        if (h > containerH * 0.92) { h = containerH * 0.92; w = h * ratioValue; }
        return { left: (containerW - w) / 2, top: (containerH - h) / 2, w, h };
      }

      function applyRatioButtonStyles(activeKey) {
        overlay.querySelectorAll('.crop-ratio-btn').forEach(b => b.classList.toggle('active', b.dataset.ratio === activeKey));
      }

      function open(sourceImg, initialRectNormalized, initialRotationDeg, onApply) {
        close();
        overlay = buildOverlay();

        const displayCanvas = overlay.querySelector('.crop-image-canvas');
        const wrap = overlay.querySelector('.crop-image-wrap');
        const box = overlay.querySelector('.crop-box');
        const straightenSlider = overlay.querySelector('.crop-straighten-slider');
        const straightenVal = overlay.querySelector('.crop-straighten-val');

        // Уменьшенная рабочая копия — быстрый live-поворот в самом окне не
        // должен пересчитывать полноразмерное фото на каждый тик слайдера.
        const workScale = Math.min(1, WORKING_MAX_DIM / Math.max(sourceImg.width, sourceImg.height));
        const workW = Math.round(sourceImg.width * workScale), workH = Math.round(sourceImg.height * workScale);
        const workCanvas = document.createElement('canvas');
        workCanvas.width = workW; workCanvas.height = workH;
        workCanvas.getContext('2d').drawImage(sourceImg, 0, 0, workW, workH);

        const decomposed = decomposeRotation(initialRotationDeg || 0);
        state = {
          ratioKey: 'free', ratioValue: null,
          rotStep: decomposed.step, rotFine: decomposed.fine,
          dragMode: null, dragStart: null, boxStart: null
        };
        straightenSlider.value = state.rotFine;
        straightenVal.textContent = `${state.rotFine.toFixed(1).replace(/\.0$/, '')}°`;

        function totalRotation() { return state.rotStep + state.rotFine; }

        // Перерисовывает канвас предпросмотра с учётом текущего поворота
        // и подгоняет размеры .crop-image-wrap под новый (возможно
        // перевёрнутый на 90°) кадр.
        function redraw(resetBox) {
          const stageRect = overlay.querySelector('.crop-stage').getBoundingClientRect();
          const maxW = stageRect.width - 24, maxH = stageRect.height - 24;

          const rotated = buildRotatedCanvas(workCanvas, totalRotation(), workW, workH);
          const scale = Math.min(maxW / rotated.width, maxH / rotated.height, 1) || 1;
          const dispW = Math.round(rotated.width * scale), dispH = Math.round(rotated.height * scale);

          displayCanvas.width = dispW; displayCanvas.height = dispH;
          displayCanvas.getContext('2d').drawImage(rotated, 0, 0, dispW, dispH);
          wrap.style.width = dispW + 'px';
          wrap.style.height = dispH + 'px';

          if (resetBox) {
            setBoxRectPx(ratioBoxCentered(state.ratioValue, dispW, dispH));
          } else {
            const r = boxRectPx();
            const w = Math.min(r.w, dispW), h = Math.min(r.h, dispH);
            setBoxRectPx({ left: clamp(r.left, 0, dispW - w), top: clamp(r.top, 0, dispH - h), w, h });
          }
        }

        function layout() {
          const dispW = wrap.offsetWidth, dispH = wrap.offsetHeight;
          if (initialRectNormalized && !layout.applied) {
            layout.applied = true;
            setBoxRectPx({
              left: initialRectNormalized.x * dispW, top: initialRectNormalized.y * dispH,
              w: initialRectNormalized.w * dispW, h: initialRectNormalized.h * dispH
            });
          } else if (!layout.applied) {
            layout.applied = true;
            setBoxRectPx({ left: 0, top: 0, w: dispW, h: dispH });
          }
        }

        redraw(false);
        requestAnimationFrame(() => requestAnimationFrame(layout));
        resizeHandler = () => redraw(false);
        window.addEventListener('resize', resizeHandler);

        // ── Поворот на 90° ───────────────────────────────────────────────
        overlay.querySelectorAll('.crop-rotate-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            state.rotStep = ((state.rotStep + parseInt(btn.dataset.turn, 10)) % 360 + 360) % 360;
            redraw(true); // размеры кадра могли перевернуться — рамку переcентровываем
          });
        });

        // ── Точное выравнивание горизонта ───────────────────────────────
        straightenSlider.addEventListener('input', () => {
          state.rotFine = parseFloat(straightenSlider.value);
          straightenVal.textContent = `${state.rotFine.toFixed(1).replace(/\.0$/, '')}°`;
          redraw(false); // размеры кадра НЕ меняются — рамку просто поджимаем к границам
        });

        // ── Ratio-кнопки ──────────────────────────────────────────────────
        overlay.querySelectorAll('.crop-ratio-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const spec = RATIOS.find(r => r.key === btn.dataset.ratio);
            state.ratioKey = spec.key;
            state.ratioValue = spec.value;
            applyRatioButtonStyles(spec.key);
            setBoxRectPx(ratioBoxCentered(spec.value, wrap.offsetWidth, wrap.offsetHeight));
          });
        });
        applyRatioButtonStyles('free');

        // ── Перетаскивание рамки целиком ────────────────────────────────────
        box.addEventListener('pointerdown', (e) => {
          if (e.target.classList.contains('crop-handle')) return;
          state.dragMode = 'move';
          state.dragStart = { x: e.clientX, y: e.clientY };
          state.boxStart = boxRectPx();
          box.setPointerCapture(e.pointerId);
          e.preventDefault();
        });

        // ── Растягивание за угловые хендлы ──────────────────────────────────
        overlay.querySelectorAll('.crop-handle').forEach(handle => {
          handle.addEventListener('pointerdown', (e) => {
            state.dragMode = 'resize-' + handle.dataset.corner;
            state.dragStart = { x: e.clientX, y: e.clientY };
            state.boxStart = boxRectPx();
            handle.setPointerCapture(e.pointerId);
            e.stopPropagation();
            e.preventDefault();
          });
        });

        overlay.addEventListener('pointermove', (e) => onPointerMove(e, wrap));

        function endDrag() { state.dragMode = null; }
        overlay.addEventListener('pointerup', endDrag);
        overlay.addEventListener('pointercancel', endDrag);

        function onPointerMove(e, wrapEl) {
          if (!state.dragMode) return;
          const dispW = wrapEl.offsetWidth, dispH = wrapEl.offsetHeight;
          const dx = e.clientX - state.dragStart.x;
          const dy = e.clientY - state.dragStart.y;

          if (state.dragMode === 'move') {
            let left = clamp(state.boxStart.left + dx, 0, dispW - state.boxStart.w);
            let top = clamp(state.boxStart.top + dy, 0, dispH - state.boxStart.h);
            setBoxRectPx({ left, top, w: state.boxStart.w, h: state.boxStart.h });
            return;
          }

          if (state.dragMode.startsWith('resize-')) {
            const corner = state.dragMode.slice(7);
            const s = state.boxStart;
            const anchorX = corner.includes('w') ? s.left + s.w : s.left;
            const anchorY = corner.includes('n') ? s.top + s.h : s.top;
            let px = clamp((corner.includes('w') ? s.left : s.left + s.w) + dx, 0, dispW);
            let py = clamp((corner.includes('n') ? s.top : s.top + s.h) + dy, 0, dispH);

            let w = Math.abs(px - anchorX);
            let h = state.ratioValue ? w / state.ratioValue : Math.abs(py - anchorY);

            const maxHFromAnchor = corner.includes('n') ? anchorY : dispH - anchorY;
            if (h > maxHFromAnchor) {
              h = maxHFromAnchor;
              if (state.ratioValue) w = h * state.ratioValue;
            }
            w = Math.max(MIN_BOX, w);
            h = Math.max(MIN_BOX, h);

            const left = corner.includes('w') ? anchorX - w : anchorX;
            const top = corner.includes('n') ? anchorY - h : anchorY;
            setBoxRectPx({
              left: clamp(left, 0, dispW - w),
              top: clamp(top, 0, dispH - h),
              w, h
            });
          }
        }

        // ── Кнопки ───────────────────────────────────────────────────────
        overlay.querySelector('.crop-close').addEventListener('click', close);
        overlay.querySelector('.crop-cancel').addEventListener('click', close);
        overlay.querySelector('.crop-apply').addEventListener('click', () => {
          const dispW = wrap.offsetWidth, dispH = wrap.offsetHeight;
          const r = boxRectPx();
          const isFullFrame = r.left <= 0.5 && r.top <= 0.5 && Math.abs(r.w - dispW) < 1 && Math.abs(r.h - dispH) < 1;
          const rectNormalized = isFullFrame ? null : {
            x: r.left / dispW, y: r.top / dispH, w: r.w / dispW, h: r.h / dispH
          };
          const rotationDeg = totalRotation();
          close();
          onApply(rectNormalized, rotationDeg);
        });

        requestAnimationFrame(() => overlay.classList.add('visible'));
      }

      function close() {
        if (resizeHandler) {
          window.removeEventListener('resize', resizeHandler);
          resizeHandler = null;
        }
        if (!overlay) return;
        overlay.remove();
        overlay = null;
        state = null;
      }

      root.SvemaCrop = { open, close, buildRotatedCanvas, decomposeRotation, coverScale };
    })(typeof window !== 'undefined' ? window : globalThis);
