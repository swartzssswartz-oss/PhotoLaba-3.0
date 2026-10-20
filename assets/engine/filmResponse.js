
    // ──────────────────────────────────────────────────────────────────────
    // FilmEngine.FilmResponse
    // Физическая модель отклика эмульсии: Lift/Gamma/Gain на канал
    // (= toe / midtone / shoulder), точки чёрного и белого, общая гамма,
    // кросс-канальный микс (протравка красителей между слоями), и поверх
    // всего — творческая мастер-кривая (Безье, как в оригинале).
    // ──────────────────────────────────────────────────────────────────────
    (function (root) {
      const FilmEngine = root.FilmEngine = root.FilmEngine || {};

      function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

      // Применяет Lift (тени) / Gamma (полутона) / Gain (света) к нормированному 0..1 значению.
      function applyLGG(t, lift, gamma, gain) {
        t = clamp01(t);
        // lift сильнее всего поднимает/топит тени (вес (1-t)), почти не трогает света
        t = t + lift * (1 - t) * (1 - t);
        t = clamp01(t);
        // gamma формирует середину диапазона
        t = Math.pow(t, 1 / Math.max(0.05, gamma));
        // gain — мультипликативный, сильнее всего влияет на света
        t = t * gain;
        return clamp01(t);
      }

      // Строит master-кривую (кубическая Безье по двум контрольным точкам, как в оригинале).
      function buildMasterLUT(state) {
        const lut = new Uint8Array(256);
        const cy1 = 1 - (state.p1.y / 120);
        const cy2 = 1 - (state.p2.y / 120);
        for (let i = 0; i < 256; i++) {
          const t = i / 255;
          const b = 3 * (1 - t) * (1 - t) * t * cy1 + 3 * (1 - t) * t * t * cy2 + t * t * t;
          lut[i] = Math.min(255, Math.max(0, Math.round(b * 255)));
        }
        return lut;
      }

      // Строит по одному LUT на канал: blackPoint/whitePoint → per-channel LGG → masterGamma → master curve.
      function buildChannelLUTs(state) {
        const masterLut = buildMasterLUT(state);
        const bp = state.frBlackPoint, wp = Math.max(bp + 1, state.frWhitePoint);
        const mg = state.frMasterGamma / 100;

        const specs = [
          { lift: state.frLiftR / 100, gamma: state.frGammaR / 100, gain: state.frGainR / 100 },
          { lift: state.frLiftG / 100, gamma: state.frGammaG / 100, gain: state.frGainG / 100 },
          { lift: state.frLiftB / 100, gamma: state.frGammaB / 100, gain: state.frGainB / 100 }
        ];

        return specs.map(spec => {
          const lut = new Uint8Array(256);
          for (let i = 0; i < 256; i++) {
            let t = (i - bp) / (wp - bp);
            t = clamp01(t);
            t = applyLGG(t, spec.lift, spec.gamma, spec.gain);
            t = Math.pow(t, 1 / Math.max(0.05, mg));
            let v = Math.round(t * 255);
            v = masterLut[Math.min(255, Math.max(0, v))];
            lut[i] = v;
          }
          return lut;
        });
      }

      // Кросс-канальный микс: r/g/b «протекают» друг в друга (диффузия красителей).
      function crossMix(r, g, b, state) {
        const mRG = state.frMixRG / 100, mRB = state.frMixRB / 100, mGB = state.frMixGB / 100;
        const nr = r + mRG * (g - r) * 0.5 + mRB * (b - r) * 0.5;
        const ng = g + mRG * (r - g) * 0.5 + mGB * (b - g) * 0.5;
        const nb = b + mRB * (r - b) * 0.5 + mGB * (g - b) * 0.5;
        return [nr, ng, nb];
      }

      FilmEngine.FilmResponse = { buildChannelLUTs, buildMasterLUT, crossMix, applyLGG };
    })(typeof window !== 'undefined' ? window : globalThis);
