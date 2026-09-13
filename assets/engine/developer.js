
    // ──────────────────────────────────────────────────────────────────────
    // FilmEngine.Developer
    // Переводит параметры химии проявки в готовые дельты для пайплайна:
    // контраст, вуаль/базовая плотность, множитель зерна, ровность (для бромных
    // потёков) и лёгкую потерю резкости при сильном разбавлении/долгом времени.
    // ──────────────────────────────────────────────────────────────────────
    (function (root) {
      const FilmEngine = root.FilmEngine = root.FilmEngine || {};

      // Быстрые рецепты — выставляют слайдеры Developer одним кликом.
      const RECIPES = {
        st2:     { devTemp: 20, devTime: 100, devDilution: 0,  devAgitation: 55, devContrast: 0,  devFog: 8,  label: 'СТ-2 / D-76 (Стандарт)' },
        rodinal: { devTemp: 20, devTime: 110, devDilution: 65, devAgitation: 40, devContrast: 10, devFog: 6,  label: 'Родинал / R-09 (Острое зерно)' },
        hydro:   { devTemp: 22, devTime: 95,  devDilution: 10, devAgitation: 70, devContrast: 30, devFog: 12, label: 'Гидрохиноновый Д-19 (Графика)' },
        micro:   { devTemp: 20, devTime: 100, devDilution: 5,  devAgitation: 60, devContrast: -8, devFog: 4,  label: 'Microdol-X (Мелкозернистый)' }
      };

      function computeDeveloperParams(state) {
        const tempDelta = (state.devTemp - 20) / 10;          // -0.5..+1.0 типично
        const timeDelta = (state.devTime - 100) / 100;         // -1..+1
        const dilution = state.devDilution / 100;               // 0..1
        const agitation = state.devAgitation / 100;             // 0..1 (0 = потёки/неровность)

        // Контраст: температура и время работают как push/pull-подобный процесс,
        // плюс ручная поправка devContrast и разбавление (чуть смягчает).
        const contrastDelta =
          state.devContrast +
          tempDelta * 14 +
          timeDelta * 18 -
          dilution * 6;

        // Вуаль/база: растёт с температурой, временем и низкой ажитацией.
        const fogDensity = Math.max(0, state.devFog + tempDelta * 6 + Math.max(0, timeDelta) * 5 - agitation * 2);

        // Зерно: разбавленные, долгие и тёплые проявители дают более крупное/резкое зерно.
        const grainMult = 1 + dilution * 0.5 + Math.max(0, tempDelta) * 0.25 + Math.max(0, timeDelta) * 0.2;

        // Резкость/акутанс: разбавление повышает субъективную резкость краёв (эффект Родинала).
        const acutance = dilution * 0.6 - Math.max(0, -tempDelta) * 0.2;

        // Неровность обработки: низкая ажитация => больше шанс потёков/неравномерности (используется defects/bromide).
        const unevenness = clamp01(1 - agitation);

        return { contrastDelta, fogDensity, grainMult, acutance, unevenness };
      }

      function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

      function applyRecipe(state, key) {
        const r = RECIPES[key];
        if (!r) return state;
        state.devType = key;
        state.devTemp = r.devTemp;
        state.devTime = r.devTime;
        state.devDilution = r.devDilution;
        state.devAgitation = r.devAgitation;
        state.devContrast = r.devContrast;
        state.devFog = r.devFog;
        return state;
      }

      FilmEngine.Developer = { computeDeveloperParams, applyRecipe, RECIPES };
    })(typeof window !== 'undefined' ? window : globalThis);
