
    // ──────────────────────────────────────────────────────────────────────
    // FilmEngine.PushPull
    // Push +1/+2/+3 (компенсация недодержки удлинением проявки) и
    // Pull −1/−2 (компенсация передержки укорочением проявки).
    // Автоматически тянет за собой зерно, контраст и баланс теней/светов —
    // как это происходит физически при реальной обработке плёнки.
    // ──────────────────────────────────────────────────────────────────────
    (function (root) {
      const FilmEngine = root.FilmEngine = root.FilmEngine || {};

      function computePushPull(state) {
        const stops = state.pushPull; // -2..+3

        const evDelta = stops * 22;                    // компенсация экспозиции
        const contrastDelta = stops * 8;                 // push растит контраст, pull снижает
        const grainBonus = stops > 0 ? stops * 12 : Math.abs(stops) * 3; // pull тоже слегка огрубляет
        const shadowDelta = stops > 0 ? -stops * 4 : -stops * 2;  // push топит тени
        const highlightDelta = stops > 0 ? stops * 3 : stops * 5; // push поджимает света; pull их разжижает

        return { evDelta, contrastDelta, grainBonus, shadowDelta, highlightDelta, stops };
      }

      FilmEngine.PushPull = { computePushPull };
    })(typeof window !== 'undefined' ? window : globalThis);
