
    // ──────────────────────────────────────────────────────────────────────
    // FilmEngine.Grain
    // Двухслойный хэш-шум (мелкий + крупный, смешиваются по density),
    // формируется через grainContrast (степенная кривая), может быть
    // цветным (grainColor: 0 = моно, 100 = независимый шум на канал),
    // и модулируется по локальной экспозиции (больше зерна в тенях —
    // grainExposureDep), плюс маска (зоны/своя маска).
    // ──────────────────────────────────────────────────────────────────────
    (function (root) {
      const FilmEngine = root.FilmEngine = root.FilmEngine || {};
      const Masks = () => FilmEngine.Masks;

      function hash01(n) {
        let h = n | 0;
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909) ^ (h >>> 16);
        return (h >>> 0) / 4294967295;
      }

      // Формат кадра был чисто декоративной рамкой — теперь он влияет на видимость зерна:
      // больший негатив требует меньше увеличения для того же разрешения оттиска,
      // поэтому зерно заметно слабее (и крупицы относительно мельче), чем у 35mm.
      const FORMAT_GRAIN_MULT = { '35': 1, '6x6': 0.55, '6x7': 0.48, '4x5': 0.28 };

      // Применяет зерно поверх уже проявленного изображения (data — ImageData.data).
      // grainMultFromDeveloper приходит из FilmEngine.Developer.
      function apply(data, w, h, state, grainMultFromDeveloper, pushGrainBonus) {
        const formatMult = FORMAT_GRAIN_MULT[state.frameFormat] ?? 1;
        const baseAmount = (state.grain + (pushGrainBonus || 0)) * 0.6 * (grainMultFromDeveloper || 1) * formatMult;
        if (baseAmount <= 0) return;

        // Больший негатив — меньше увеличение, каждое зерно в кадре занимает меньше пикселей оттиска.
        const sizeScaleFine = Math.max(0.4, state.grainSize / 10) * (0.55 + 0.45 * formatMult);
        const sizeScaleCoarse = sizeScaleFine * 2.6;
        const density = state.grainDensity / 100;     // 0 = чисто мелкое, 1 = чисто крупное
        const contrastAmt = state.grainContrast / 100; // степенная форма шума
        const colorAmt = state.grainColor / 100;        // 0..1
        const expDep = state.grainExposureDep / 100;    // 0..1
        const seed = state.grainLock ? state.grainSeed : Math.floor(performance.now() / 250);
        const maskCfg = state.maskGrain;

        for (let i = 0; i < data.length; i += 4) {
          const px = i / 4;
          const x = px % w, y = (px / w) | 0;

          const idxFine = Math.floor(px / sizeScaleFine);
          const idxCoarse = Math.floor(px / sizeScaleCoarse);

          const nFine = hash01((idxFine + seed) | 0) - 0.5;
          const nCoarse = hash01((idxCoarse + seed * 7 + 91) | 0) - 0.5;
          let n = nFine * (1 - density) + nCoarse * density;

          // Контраст зерна: степенная кривая вокруг нуля, сохраняя знак.
          if (contrastAmt > 0) {
            const sign = n < 0 ? -1 : 1;
            n = sign * Math.pow(Math.abs(n) * 2, 1 + contrastAmt * 1.5) / 2;
          }

          const r0 = data[i], g0 = data[i + 1], b0 = data[i + 2];
          const luma = (0.299 * r0 + 0.587 * g0 + 0.114 * b0) / 255;

          // Зависимость от экспозиции: чем темнее пиксель, тем сильнее зерно (реальный silver halide).
          const expWeight = 1 + (1 - luma) * expDep * 1.6;

          const maskWeight = Masks() ? Masks().getWeight(maskCfg, luma, x, y, w, h) : 1;
          const amount = baseAmount * expWeight * maskWeight;
          if (amount <= 0) continue;

          if (colorAmt <= 0.001) {
            const noise = n * amount;
            data[i] = clamp255(r0 + noise);
            data[i + 1] = clamp255(g0 + noise);
            data[i + 2] = clamp255(b0 + noise);
          } else {
            const nR = hash01((idxFine + seed + 15485863) | 0) - 0.5;
            const nG = hash01((idxFine + seed + 104729) | 0) - 0.5;
            const nB = hash01((idxFine + seed + 217645) | 0) - 0.5;
            const noiseR = (n * (1 - colorAmt) + nR * colorAmt) * amount;
            const noiseG = (n * (1 - colorAmt) + nG * colorAmt) * amount;
            const noiseB = (n * (1 - colorAmt) + nB * colorAmt) * amount;
            data[i] = clamp255(r0 + noiseR);
            data[i + 1] = clamp255(g0 + noiseG);
            data[i + 2] = clamp255(b0 + noiseB);
          }
        }
      }

      function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

      FilmEngine.Grain = { apply };
    })(typeof window !== 'undefined' ? window : globalThis);
