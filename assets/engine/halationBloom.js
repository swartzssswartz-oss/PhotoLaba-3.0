
    // ──────────────────────────────────────────────────────────────────────
    // FilmEngine.Halation / FilmEngine.Bloom
    // Halation — ореол от переотражения света от подложки плёнки: яркие
    // участки выше threshold размываются на radius, тонируются по RGB
    // (обычно красный доминирует), затухают по decay, и составляются экраном.
    // Bloom — отдельный, более общий алгоритм мягкого свечения светов,
    // намеренно НЕ смешан с halation (свой threshold/radius/intensity).
    // ──────────────────────────────────────────────────────────────────────
    (function (root) {
      const FilmEngine = root.FilmEngine = root.FilmEngine || {};
      const Masks = () => FilmEngine.Masks;

      // Пул переиспользуемых offscreen-канвасов. Раньше на каждый кадр
      // создавалось 4 новых <canvas> для halation + 2 для bloom — на
      // мобильных это лишняя нагрузка на аллокатор/GC при каждом движении
      // слайдера. Теперь канвасы создаются один раз и просто переиспользуются
      // (пересоздаются только если реально поменялся размер кадра).
      const pool = {};
      function getCanvas(key, w, h) {
        let c = pool[key];
        if (!c) { c = document.createElement('canvas'); pool[key] = c; }
        if (c.width !== w || c.height !== h) {
          c.width = w; c.height = h; // resize сам чистит канвас
        } else {
          c.getContext('2d').clearRect(0, 0, w, h);
        }
        return c;
      }

      function compositeMasked(ctx, glowCanvas, w, h, alpha, maskCfg, srcImageData) {
        if (maskCfg && maskCfg.target !== 'all') {
          const maskCanvas = Masks().buildMaskCanvas(maskCfg, w, h, srcImageData);
          if (maskCanvas) {
            const gctx = glowCanvas.getContext('2d');
            gctx.globalCompositeOperation = 'destination-in';
            gctx.drawImage(maskCanvas, 0, 0);
            gctx.globalCompositeOperation = 'source-over';
          }
        }
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = alpha;
        ctx.drawImage(glowCanvas, 0, 0, w, h);
        ctx.restore();
      }

      // Направленный блюр «via squash»: сжимаем картинку по X в streakW раз, блюрим
      // обычным (изотропным) canvas-filter blur, потом растягиваем обратно на полную
      // ширину — в реальных координатах это даёт растянутый по X и узкий по Y блюр —
      // тот самый настоящий горизонтальный потёк вдоль транспорта/перфорации плёнки,
      // а не равномерный круглый ореол. При streak=0 (streakW=w) это просто обычный изотропный blur.
      function directionalBlur(w, h, srcCanvas, blurPx, alpha, streakW, keyPrefix) {
        const squashed = getCanvas(keyPrefix + '_sq', streakW, h);
        const sctx = squashed.getContext('2d');
        sctx.clearRect(0, 0, streakW, h);
        sctx.drawImage(srcCanvas, 0, 0, w, h, 0, 0, streakW, h);

        const blurred = getCanvas(keyPrefix + '_bl', streakW, h);
        const bctx2 = blurred.getContext('2d');
        bctx2.clearRect(0, 0, streakW, h);
        bctx2.filter = `blur(${blurPx}px)`;
        bctx2.drawImage(squashed, 0, 0);
        bctx2.filter = 'none';

        const stretched = getCanvas(keyPrefix + '_st', w, h);
        const tctx = stretched.getContext('2d');
        tctx.clearRect(0, 0, w, h);
        tctx.globalAlpha = alpha;
        tctx.drawImage(blurred, 0, 0, streakW, h, 0, 0, w, h);
        tctx.globalAlpha = 1;
        return stretched;
      }

      // ---- HALATION ----------------------------------------------------
      function render(ctx, canvas, w, h, state, srcImageData) {
        const intensity = state.halation / 100;
        if (intensity <= 0) return;

        const threshold = state.halationThreshold;
        const radius = Math.max(1, state.halationRadius);
        const decay = state.halationDecay / 100; // 0..1, выше = резче спад (уже пятно)
        const streak = Math.max(0, Math.min(1, (state.halationStreak || 0) / 100));
        const rW = state.halationR / 100, gW = state.halationG / 100, bW = state.halationB / 100;

        // 1. Bright-pass: оставляем только то, что ярче threshold, тонируем по RGB-вкладу.
        const bpCanvas = getCanvas('hal_bp', w, h);
        const bctx = bpCanvas.getContext('2d');
        const bpData = bctx.createImageData(w, h);
        const src = srcImageData.data;
        for (let i = 0; i < src.length; i += 4) {
          const r = src[i], g = src[i + 1], b = src[i + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const over = Math.max(0, lum - threshold) / Math.max(1, 255 - threshold);
          bpData.data[i] = Math.min(255, over * 255 * rW * 2);
          bpData.data[i + 1] = Math.min(255, over * 255 * gW * 2);
          bpData.data[i + 2] = Math.min(255, over * 255 * bW * 2);
          bpData.data[i + 3] = 255;
        }
        bctx.putImageData(bpData, 0, 0);

        // 2. Два блюр-прохода (резкое ядро + широкий растянутый ореол), баланс задаёт decay,
        //    оба через directionalBlur — при halationStreak=0 это просто изотропный блюр, как раньше.
        const streakW = Math.max(1, Math.round(w * (1 - streak * 0.88)));
        const nearCanvas = directionalBlur(w, h, bpCanvas, radius * (0.4 + (1 - decay) * 0.3), 1, streakW, 'hal_n');
        const farCanvas = directionalBlur(w, h, bpCanvas, radius * (1.4 + (1 - decay) * 1.6), 0.55 - decay * 0.25, streakW, 'hal_f');

        const glow = getCanvas('hal_glow', w, h);
        const gctx = glow.getContext('2d');
        gctx.clearRect(0, 0, w, h);
        gctx.drawImage(farCanvas, 0, 0);
        gctx.globalCompositeOperation = 'lighter';
        gctx.drawImage(nearCanvas, 0, 0);
        gctx.globalCompositeOperation = 'source-over';

        compositeMasked(ctx, glow, w, h, Math.min(1, intensity * 1.6), state.maskHalation, srcImageData);
      }

      FilmEngine.Halation = { render };

      // ---- BLOOM ---------------------------------------------------------
      function renderBloom(ctx, canvas, w, h, state, srcImageData) {
        const amount = state.bloom / 100;
        if (amount <= 0) return;

        const threshold = state.bloomThreshold;
        const radius = Math.max(1, state.bloomRadius);

        const bpCanvas = getCanvas('bloom_bp', w, h);
        const bctx = bpCanvas.getContext('2d');
        const bpData = bctx.createImageData(w, h);
        const src = srcImageData.data;
        for (let i = 0; i < src.length; i += 4) {
          const lum = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
          const over = Math.max(0, lum - threshold) / Math.max(1, 255 - threshold);
          bpData.data[i] = src[i] * over;
          bpData.data[i + 1] = src[i + 1] * over;
          bpData.data[i + 2] = src[i + 2] * over;
          bpData.data[i + 3] = 255;
        }
        bctx.putImageData(bpData, 0, 0);

        const glow = getCanvas('bloom_glow', w, h);
        const gctx = glow.getContext('2d');
        gctx.filter = `blur(${radius}px)`;
        gctx.drawImage(bpCanvas, 0, 0);
        gctx.filter = 'none';

        compositeMasked(ctx, glow, w, h, amount, state.maskBloom, srcImageData);
      }

      FilmEngine.Bloom = { render: renderBloom };
    })(typeof window !== 'undefined' ? window : globalThis);
