
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

      // ---- HALATION ----------------------------------------------------
      function render(ctx, canvas, w, h, state, srcImageData) {
        const intensity = state.halation / 100;
        if (intensity <= 0) return;

        const threshold = state.halationThreshold;
        const radius = Math.max(1, state.halationRadius);
        const decay = state.halationDecay / 100; // 0..1, выше = резче спад (уже пятно)
        const rW = state.halationR / 100, gW = state.halationG / 100, bW = state.halationB / 100;

        // 1. Bright-pass: оставляем только то, что ярче threshold, тонируем по RGB-вкладу.
        const bpCanvas = document.createElement('canvas');
        bpCanvas.width = w; bpCanvas.height = h;
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

        // 2. Два блюр-прохода (резкое ядро + широкий растянутый ореол), баланс задаёт decay.
        const nearCanvas = document.createElement('canvas');
        nearCanvas.width = w; nearCanvas.height = h;
        const nctx = nearCanvas.getContext('2d');
        nctx.filter = `blur(${radius * (0.4 + (1 - decay) * 0.3)}px)`;
        nctx.drawImage(bpCanvas, 0, 0);

        const farCanvas = document.createElement('canvas');
        farCanvas.width = w; farCanvas.height = h;
        const fctx = farCanvas.getContext('2d');
        fctx.filter = `blur(${radius * (1.4 + (1 - decay) * 1.6)}px)`;
        fctx.globalAlpha = 0.55 - decay * 0.25;
        fctx.drawImage(bpCanvas, 0, 0);

        const glow = document.createElement('canvas');
        glow.width = w; glow.height = h;
        const gctx = glow.getContext('2d');
        gctx.drawImage(farCanvas, 0, 0);
        gctx.globalCompositeOperation = 'lighter';
        gctx.drawImage(nearCanvas, 0, 0);

        compositeMasked(ctx, glow, w, h, Math.min(1, intensity * 1.6), state.maskHalation, srcImageData);
      }

      FilmEngine.Halation = { render };

      // ---- BLOOM ---------------------------------------------------------
      function renderBloom(ctx, canvas, w, h, state, srcImageData) {
        const amount = state.bloom / 100;
        if (amount <= 0) return;

        const threshold = state.bloomThreshold;
        const radius = Math.max(1, state.bloomRadius);

        const bpCanvas = document.createElement('canvas');
        bpCanvas.width = w; bpCanvas.height = h;
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

        const glow = document.createElement('canvas');
        glow.width = w; glow.height = h;
        const gctx = glow.getContext('2d');
        gctx.filter = `blur(${radius}px)`;
        gctx.drawImage(bpCanvas, 0, 0);

        compositeMasked(ctx, glow, w, h, amount, state.maskBloom, srcImageData);
      }

      FilmEngine.Bloom = { render: renderBloom };
    })(typeof window !== 'undefined' ? window : globalThis);
