
    // ──────────────────────────────────────────────────────────────────────
    // FilmEngine.Noise
    // Общая библиотека процедурных текстур для "натуральных" дефектов —
    // вместо идеальных кругов/эллипсов/линий (которые выдают себя как явную
    // геометрию) даёт фрактальный (многооктавный) value-noise, из которого
    // строятся органичные разводы (uneven density) и трещины эмульсии
    // (reticulation) — похоже на грубую 2D reaction-diffusion текстуру, но
    // считается многократно быстрее honest-симуляции и достаточно для стиля.
    // ──────────────────────────────────────────────────────────────────────
    (function (root) {
      const FilmEngine = root.FilmEngine = root.FilmEngine || {};

      function hash01(n) {
        let h = n | 0;
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909) ^ (h >>> 16);
        return (h >>> 0) / 4294967295;
      }

      // Value-noise сетка с билинейной интерполяцией на клетках cellPx пикселей.
      // Возвращает sample(x, y) -> -1..1.
      function makeField(w, h, cellPx, seed) {
        const cell = Math.max(2, cellPx);
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

      // Фрактальная сумма нескольких октав value-noise — органичная, не геометрическая
      // текстура (аналог fBm), без стоимости честной reaction-diffusion симуляции.
      function makeFractalField(w, h, basePx, seed, octaves) {
        octaves = octaves || 3;
        const layers = [];
        let amp = 1, totalAmp = 0, px = basePx;
        for (let o = 0; o < octaves; o++) {
          layers.push({ sample: makeField(w, h, px, seed + o * 7919), amp });
          totalAmp += amp;
          amp *= 0.55;
          px = Math.max(2, px * 0.42);
        }
        return function sample(x, y) {
          let v = 0;
          for (let o = 0; o < layers.length; o++) v += layers[o].sample(x, y) * layers[o].amp;
          return v / totalAmp; // -1..1
        };
      }

      FilmEngine.Noise = { hash01, makeField, makeFractalField };
    })(typeof window !== 'undefined' ? window : globalThis);
