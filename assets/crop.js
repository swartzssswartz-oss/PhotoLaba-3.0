
    // ──────────────────────────────────────────────────────────────────────
    // FilmEngine.Crop (SvemaCrop)
    // Полноэкранное окно кадрирования: показываем исходное фото целиком,
    // поверх — перетаскиваемая/растягиваемая рамка (box-shadow-спотлайт,
    // без пересчёта 4 отдельных "штор"). Ratio-кнопки задают/снимают
    // фиксацию пропорции. Результат — нормализованный (0..1) прямоугольник
    // в координатах исходного изображения, который затем использует
    // preparePreviewBuffer() в app.js.
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

      let overlay = null;
      let state = null; // внутреннее состояние текущей сессии кадрирования

      function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

      function buildOverlay() {
        const el = document.createElement('div');
        el.className = 'crop-overlay';
        el.innerHTML = `
          <div class="crop-toolbar">
            <span class="crop-title">Кадрирование</span>
            <button class="crop-close" aria-label="Закрыть">✕</button>
          </div>
          <div class="crop-stage">
            <div class="crop-image-wrap">
              <img class="crop-image" draggable="false" alt="">
              <div class="crop-box">
                <div class="crop-handle crop-handle-nw" data-corner="nw"></div>
                <div class="crop-handle crop-handle-ne" data-corner="ne"></div>
                <div class="crop-handle crop-handle-sw" data-corner="sw"></div>
                <div class="crop-handle crop-handle-se" data-corner="se"></div>
              </div>
            </div>
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

      // Наибольшая рамка заданного соотношения, вписанная и отцентрированная
      // в контейнере (с небольшим полем — 92% от предельного измерения).
      function ratioBoxCentered(ratioValue, containerW, containerH) {
        if (!ratioValue) return { left: 0, top: 0, w: containerW, h: containerH };
        let w = containerW * 0.92, h = w / ratioValue;
        if (h > containerH * 0.92) { h = containerH * 0.92; w = h * ratioValue; }
        return { left: (containerW - w) / 2, top: (containerH - h) / 2, w, h };
      }

      function applyRatioButtonStyles(activeKey) {
        overlay.querySelectorAll('.crop-ratio-btn').forEach(b => b.classList.toggle('active', b.dataset.ratio === activeKey));
      }

      function open(sourceImg, initialRectNormalized, onApply) {
        close(); // на всякий случай закрываем предыдущую сессию
        overlay = buildOverlay();

        const img = overlay.querySelector('.crop-image');
        const wrap = overlay.querySelector('.crop-image-wrap');
        const box = overlay.querySelector('.crop-box');

        img.src = sourceImg.src;

        state = { ratioKey: 'free', ratioValue: null, dragMode: null, dragStart: null, boxStart: null };

        function layout() {
          const stageRect = overlay.querySelector('.crop-stage').getBoundingClientRect();
          const maxW = stageRect.width - 24, maxH = stageRect.height - 24;
          const scale = Math.min(maxW / sourceImg.width, maxH / sourceImg.height, 1) || 1;
          const dispW = Math.round(sourceImg.width * scale), dispH = Math.round(sourceImg.height * scale);
          wrap.style.width = dispW + 'px';
          wrap.style.height = dispH + 'px';

          let rectPx;
          if (initialRectNormalized) {
            rectPx = {
              left: initialRectNormalized.x * dispW,
              top: initialRectNormalized.y * dispH,
              w: initialRectNormalized.w * dispW,
              h: initialRectNormalized.h * dispH
            };
          } else {
            rectPx = { left: 0, top: 0, w: dispW, h: dispH };
          }
          setBoxRectPx(rectPx);
        }

        // Ждём реальной отрисовки картинки, чтобы взять её natural-размеры
        // (они уже известны из sourceImg, но layout зависит от размеров стейджа в DOM).
        requestAnimationFrame(() => requestAnimationFrame(layout));
        window.addEventListener('resize', layout);

        // ── Ratio-кнопки ──────────────────────────────────────────────────
        overlay.querySelectorAll('.crop-ratio-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const spec = RATIOS.find(r => r.key === btn.dataset.ratio);
            state.ratioKey = spec.key;
            state.ratioValue = spec.value;
            applyRatioButtonStyles(spec.key);
            const dispW = wrap.offsetWidth, dispH = wrap.offsetHeight;
            setBoxRectPx(ratioBoxCentered(spec.value, dispW, dispH));
          });
        });
        applyRatioButtonStyles('free');

        // ── Перетаскивание рамки целиком ────────────────────────────────────
        box.addEventListener('pointerdown', (e) => {
          if (e.target.classList.contains('crop-handle')) return; // обработается отдельно ниже
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

        wrap.addEventListener('pointermove', (e) => onPointerMove(e, wrap));
        box.addEventListener('pointermove', (e) => onPointerMove(e, wrap));
        overlay.addEventListener('pointermove', (e) => onPointerMove(e, wrap));

        function endDrag(e) {
          state.dragMode = null;
        }
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
            // Точка-якорь — противоположный угол, он не двигается.
            const anchorX = corner.includes('w') ? s.left + s.w : s.left;
            const anchorY = corner.includes('n') ? s.top + s.h : s.top;
            let px = clamp((corner.includes('w') ? s.left : s.left + s.w) + dx, 0, dispW);
            let py = clamp((corner.includes('n') ? s.top : s.top + s.h) + dy, 0, dispH);

            let w = Math.abs(px - anchorX);
            let h = state.ratioValue ? w / state.ratioValue : Math.abs(py - anchorY);

            // не даём рамке выйти за пределы контейнера по высоте — если ratio
            // зафиксирован, при клампе пересчитываем и ширину, чтобы сохранить пропорцию.
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
          close();
          onApply(rectNormalized);
        });

        requestAnimationFrame(() => overlay.classList.add('visible'));
      }

      function close() {
        if (!overlay) return;
        overlay.remove();
        overlay = null;
        state = null;
      }

      root.SvemaCrop = { open, close };
    })(typeof window !== 'undefined' ? window : globalThis);
