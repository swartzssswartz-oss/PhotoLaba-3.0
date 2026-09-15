
    // ──────────────────────────────────────────────────────────────────────
    // FilmEngine.Masks
    // Единая система масок для всех модулей. Любой эффект может работать:
    //   all       — по всему кадру
    //   shadows   — только по теням
    //   midtones  — только по средним тонам
    //   highlights— только по светам
    //   custom    — по собственной маске (градиент linear/radial + позиция/угол/растушёвка)
    // ──────────────────────────────────────────────────────────────────────
    (function (root) {
      const FilmEngine = root.FilmEngine = root.FilmEngine || {};

      function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
      function smoothstep(a, b, x) { const t = clamp01((x - a) / Math.max(1e-6, (b - a))); return t * t * (3 - 2 * t); }

      // Треугольная весовая функция вокруг 0.5 — вес средних тонов.
      function midtoneWeight(lumaNorm) {
        const rise = smoothstep(0.12, 0.5, lumaNorm);
        const fall = 1 - smoothstep(0.5, 0.88, lumaNorm);
        return Math.min(rise, fall);
      }

      function getZoneWeight(target, lumaNorm) {
        if (target === 'shadows') return 1 - smoothstep(0.02, 0.45, lumaNorm);
        if (target === 'highlights') return smoothstep(0.55, 0.98, lumaNorm);
        if (target === 'midtones') return midtoneWeight(lumaNorm);
        return 1;
      }

      // Вес собственной маски по координатам (0..1)
      function customWeight(cfg, x, y, w, h) {
        const c = cfg.custom || {};
        const nx = x / w, ny = y / h;
        let t;
        if (c.shape === 'radial') {
          const cx = (c.cx ?? 50) / 100, cy = (c.cy ?? 50) / 100;
          const r = Math.max(0.001, (c.radius ?? 60) / 100);
          const dx = (nx - cx) * (w / Math.max(w, h));
          const dy = (ny - cy) * (h / Math.max(w, h));
          const dist = Math.sqrt(dx * dx + dy * dy);
          t = 1 - clamp01(dist / r);
        } else {
          const angle = ((c.angle ?? 0) * Math.PI) / 180;
          const dx = nx - 0.5, dy = ny - 0.5;
          const proj = dx * Math.cos(angle) + dy * Math.sin(angle); // -0.5..0.5 вдоль оси
          t = 1 - clamp01(proj + 0.5);
        }
        const feather = Math.max(0.01, (c.feather ?? 40) / 100);
        t = smoothstep(0.5 - feather, 0.5 + feather, t);
        t = clamp01(t);
        return c.invert ? 1 - t : t;
      }

      // Основная функция: вес эффекта в точке (0..1). lumaNorm нужен для зональных масок.
      function getWeight(cfg, lumaNorm, x, y, w, h) {
        if (!cfg || cfg.target === 'all') return 1;
        if (cfg.target === 'custom') return customWeight(cfg, x, y, w, h);
        return getZoneWeight(cfg.target, lumaNorm);
      }

      // Строит offscreen-канвас (grayscale альфа-маска) для композитных canvas-эффектов
      // (halation/bloom), чтобы применить composite 'destination-in'.
      function buildMaskCanvas(cfg, w, h, srcImageData) {
        if (!cfg || cfg.target === 'all') return null;
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = w; maskCanvas.height = h;
        const mctx = maskCanvas.getContext('2d');

        if (cfg.target === 'custom') {
          const c = cfg.custom || {};
          let grad;
          if (c.shape === 'radial') {
            const cx = (c.cx ?? 50) / 100 * w, cy = (c.cy ?? 50) / 100 * h;
            const r = Math.max(1, (c.radius ?? 60) / 100 * Math.max(w, h));
            const feather = Math.max(0.02, (c.feather ?? 40) / 100);
            grad = mctx.createRadialGradient(cx, cy, r * (1 - feather), cx, cy, r);
          } else {
            const angle = ((c.angle ?? 0) * Math.PI) / 180;
            const cx = w / 2, cy = h / 2;
            const len = Math.max(w, h);
            const dx = Math.cos(angle) * len, dy = Math.sin(angle) * len;
            grad = mctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
          }
          const stops = c.invert ? ['#000', '#fff'] : ['#fff', '#000'];
          grad.addColorStop(0, stops[0]);
          grad.addColorStop(1, stops[1]);
          mctx.fillStyle = grad;
          mctx.fillRect(0, 0, w, h);
          return maskCanvas;
        }

        // Зональные маски строятся по исходным данным (luma).
        const out = mctx.createImageData(w, h);
        const src = srcImageData.data;
        for (let i = 0; i < src.length; i += 4) {
          const luma = (0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]) / 255;
          const wgt = Math.round(getZoneWeight(cfg.target, luma) * 255);
          out.data[i] = out.data[i + 1] = out.data[i + 2] = wgt;
          out.data[i + 3] = 255;
        }
        mctx.putImageData(out, 0, 0);
        return maskCanvas;
      }

      FilmEngine.Masks = { getWeight, buildMaskCanvas, getZoneWeight, customWeight };
    })(typeof window !== 'undefined' ? window : globalThis);
