
    // ──────────────────────────────────────────────────────────────────────
    // FilmEngine.Uniformity
    // Строит карту множителей экспозиции (Float32Array, w×h), которая
    // применяется ДО отклика плёнки — как физическая неравномерность
    // засветки/протяжки, а не как декоративный оверлей.
    // ──────────────────────────────────────────────────────────────────────
    (function (root) {
      const FilmEngine = root.FilmEngine = root.FilmEngine || {};

      function hash01(n) {
        let h = n | 0;
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909) ^ (h >>> 16);
        return (h >>> 0) / 4294967295;
      }

      // Плавный value-noise на низком разрешении с билинейной интерполяцией.
      function buildRandomField(w, h, scalePercent, seed) {
        const cell = Math.max(4, Math.round((scalePercent / 100) * Math.max(w, h) * 0.18));
        const gw = Math.max(2, Math.ceil(w / cell) + 2);
        const gh = Math.max(2, Math.ceil(h / cell) + 2);
        const grid = new Float32Array(gw * gh);
        for (let i = 0; i < grid.length; i++) grid[i] = hash01(i + seed) * 2 - 1;

        return function sample(x, y) {
          const gx = x / cell, gy = y / cell;
          const x0 = Math.floor(gx), y0 = Math.floor(gy);
          const x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1);
          const tx = gx - x0, ty = gy - y0;
          const v00 = grid[y0 * gw + x0] || 0, v10 = grid[y0 * gw + x1] || 0;
          const v01 = grid[y1 * gw + x0] || 0, v11 = grid[y1 * gw + x1] || 0;
          const a = v00 * (1 - tx) + v10 * tx;
          const b = v01 * (1 - tx) + v11 * tx;
          return a * (1 - ty) + b * ty;
        };
      }

      function buildExposureMap(w, h, state) {
        const hAmt = state.uniformH / 100;
        const vAmt = state.uniformV / 100;
        const rAmt = state.uniformRadial / 100;
        const rndAmt = state.uniformRandom / 100;

        const anyActive = hAmt !== 0 || vAmt !== 0 || rAmt !== 0 || rndAmt !== 0;
        if (!anyActive) return null;

        const map = new Float32Array(w * h);
        const sampleRandom = rndAmt !== 0 ? buildRandomField(w, h, state.uniformScale, state.grainSeed || 1) : null;
        const cx = w / 2, cy = h / 2, maxR = Math.sqrt(cx * cx + cy * cy);

        for (let y = 0; y < h; y++) {
          const vTerm = vAmt * ((y / h) - 0.5) * 2; // -amt..+amt
          for (let x = 0; x < w; x++) {
            const hTerm = hAmt * ((x / w) - 0.5) * 2;
            const dx = x - cx, dy = y - cy;
            const rNorm = Math.sqrt(dx * dx + dy * dy) / maxR;
            const rTerm = rAmt * rNorm;
            const rndTerm = sampleRandom ? sampleRandom(x, y) * rndAmt : 0;
            const total = hTerm + vTerm - rTerm + rndTerm * 0.6;
            // множитель экспозиции: 1 ± ~0.5 при максимальных значениях
            map[y * w + x] = Math.max(0.15, 1 + total * 0.5);
          }
        }
        return map;
      }

      FilmEngine.Uniformity = { buildExposureMap };
    })(typeof window !== 'undefined' ? window : globalThis);
