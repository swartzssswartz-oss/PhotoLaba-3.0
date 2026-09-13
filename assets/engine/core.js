
    // ──────────────────────────────────────────────────────────────────────
    // FilmEngine.Core
    // Единая точка входа рендера. Порядок пайплайна (физически осмысленный):
    //
    //  1. Exposure Uniformity  — карта неравномерности засветки/протяжки
    //  2. Базовая экспозиция + светофильтры + характер эмульсии (стоковый сдвиг)
    //  3. Developer + Push/Pull — контраст, вуаль/база, множитель зерна
    //  4. Творческая тональность (света/тени/темп/бумага/тонер/старение/сатурация)
    //  5. Film Response — LGG по каналам, чёрная/белая точка, кросс-микс, мастер-кривая
    //  6. Grain Engine
    //  7. [canvas] Emulsion Defects (+ бромид/ретикуляция/засветка)
    //  8. [canvas] Хроматическая аберрация (объектив, нарастает к краям кадра)
    //  9. [canvas] Halation
    // 10. [canvas] Bloom
    // 11. [canvas] Виньетирование (форма/смещение)
    //
    // Системные категории, которые не видны как отдельные этапы, но влияют на многие из них:
    // — kind (негатив/слайд) задаёт базовый контраст/широту помимо recipe конкретной плёнки;
    // — crossProcess временно инвертирует эту категорию и даёт свой цветовой каст;
    // — agingProfile/reciprocityTint (из FILM_COLOR_SCIENCE в film-data.js) дают каждому бренду
    //   своё старение и свой сдвиг на длинных выдержках вместо одной формулы на всех.
    // ───────────────────────────────────────────────────────────────
    (function (root) {
      const FilmEngine = root.FilmEngine = root.FilmEngine || {};

      function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

      function render(opts) {
        const { ctx, canvas, previewCanvas, state, filmDatabase, filmColorScience } = opts;
        if (!previewCanvas.width) return;
        const w = previewCanvas.width, h = previewCanvas.height;

        ctx.drawImage(previewCanvas, 0, 0);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // ---- 3. Developer + Push/Pull -------------------------------------------------
        const dev = FilmEngine.Developer.computeDeveloperParams(state);
        const pp = FilmEngine.PushPull.computePushPull(state);

        const p = state.preset;

        // ---- Категория стока вычисляется ОДИН раз на кадр, а не на каждый пиксель.
        //      Раньше .startsWith()/.includes() гонялись по каждому пикселю — на
        //      мобильных это заметно тормозило (сотни тысяч лишних строковых операций).
        const isAerochrome = p === 'aerochrome';
        const isBWStock = (p.startsWith('svema') && !p.includes('cv') && !p.includes('co')) ||
          (p.startsWith('tasma') && p !== 'tasmacnb' && p !== 'tasmai810') ||
          p === 'foto65' || p.startsWith('mikrat') || p.startsWith('foma') || p.startsWith('retro') || p.startsWith('adox');
        const isMikrat200 = p === 'mikrat200';
        const isIRStock = p === 'tasmai810';
        const skipDyeFadeStock = isAerochrome;
        const applySaturation = !p.includes('bw') && p !== 'tasmai810' && !p.startsWith('svema64') && !p.startsWith('svema125') &&
          !p.startsWith('svema250') && !p.startsWith('tasma25') && !p.startsWith('tasma100') && p !== 'foto65' &&
          !p.startsWith('mikrat') && !p.startsWith('foma') && !p.startsWith('retro') && !p.startsWith('adox');

        // Спектральная чувствительность конкретной ч/б эмульсии (панхром/ортохром
        // и т.п.) — раньше все ч/б стоки переводились в серый одной и той же
        // формулой (0.299/0.587/0.114), из-за чего пресеты визуально не отличались
        // друг от друга. теперь у каждой плёнки свой набор весов R/G/B (задан в
        // film-data.js как bwMix), как у реальных панхроматических/ортохроматических
        // эмульсий с разной чувствительностью к цвету.
        const currentFilm = filmDatabase.find(f => f.id === p);
        const bwMix = (currentFilm && currentFilm.bwMix) || [0.299, 0.587, 0.114];
        const [bwWR, bwWG, bwWB] = bwMix;

        // ---- kind (негатив/слайд) — системная категория, а не просто одно из полей recipe: слайды
        // всегда жёстче и узкоширнее (аккуратнее клипят света), негативы — мягче и шире,
        // независимо от того, как recipe конкретной плёнки подобран на глаз. Кросс-процесс
        // (проявить в «чужой» химии) временно меняет эту категорию на противоположную.
        const filmKind = (currentFilm && currentFilm.kind) || 'negative';
        const crossProcess = !!state.crossProcess;
        const chemKind = crossProcess ? (filmKind === 'slide' ? 'negative' : 'slide') : filmKind;
        const KIND_CONTRAST_BIAS = { negative: -6, slide: 16 };

        let totalContrast = state.contrast + pp.contrastDelta + dev.contrastDelta + KIND_CONTRAST_BIAS[chemKind];
        if (crossProcess) totalContrast += 12; // нештатная химия — дополнительный резкий скачок контраста
        totalContrast += ((state.paperGrade ?? 2) - 2) * 11; // грейд бумаги (как Ilford Multigrade 0..5)
        if (state.paper === 'baryta') totalContrast -= 6; else totalContrast += 4;
        const contrastFactor = (259 * (totalContrast + 255)) / (255 * (259 - totalContrast));
        const totalExp = state.exp + pp.evDelta;
        const expFactor = Math.pow(2, totalExp / 50);

        const fogDensity = dev.fogDensity;
        const grainMult = dev.grainMult;
        const pushGrainBonus = pp.grainBonus;

        const age = (2026 - state.foundYear) / 46;
        const ageFog = age * 42;

        // ---- Индивидуальная «цветовая наука» бренда: старение и reciprocity failure теперь
        // разные у разных стоков (agingProfile в film-data.js), а не одна формула на всех.
        const DEFAULT_COLOR_SCIENCE = { agingRDecay: .28, agingRMix: .20, agingGDecay: .22, agingGMix: .18, agingBDecay: .38, agingBMix: .25, reciprocityTint: { r: 0, g: 0, b: 0 } };
        const colorScience = (filmColorScience && currentFilm && filmColorScience[currentFilm.agingProfile]) || DEFAULT_COLOR_SCIENCE;
        const recipTint = colorScience.reciprocityTint || { r: 0, g: 0, b: 0 };

        // ---- Кросс-процесс также меняет насыщенность: слайд в негативной химии — заметно
        // перенасыщен, негатив в слайдовой — глушеный/грязный.
        let satVal = state.sat / 100;
        if (crossProcess) satVal *= chemKind === 'negative' ? 1.35 : 0.62;

        const fR = 1 + (state.filterR / 50);
        const fG = 1 + (state.filterG / 50);
        const fB = 1 + (state.filterB / 50);

        // ---- 1. Exposure Uniformity ------------------------------------------------
        const uniformMap = FilmEngine.Uniformity.buildExposureMap(w, h, state);

        // ---- 5. Film Response LUTs (строятся один раз на кадр) ---------------------
        const [lutR, lutG, lutB] = FilmEngine.FilmResponse.buildChannelLUTs(state);
        const maskCfgFR = state.maskFilmResponse;
        const maskCfgDev = state.maskDeveloper;

        for (let px = 0; px < w * h; px++) {
          const i = px * 4;
          const x = px % w, y = (px / w) | 0;
          const uMult = uniformMap ? uniformMap[px] : 1;

          let r = data[i] * expFactor * fR * uMult;
          let g = data[i + 1] * expFactor * fG * uMult;
          let b = data[i + 2] * expFactor * fB * uMult;

          // ---- 2b. Характер эмульсии конкретного стока -------------------------
          if (isAerochrome) {
            const origR = r, origG = g, origB = b;
            r = origG * 1.8 + origR * 0.4;
            g = origR * 0.7;
            b = origB * 0.6;
          }

          // ---- 3. Контраст проявки + push/pull (с маской Developer) -----------
          {
            const preR = r, preG = g, preB = b;
            const cr = contrastFactor * (preR - 128) + 128;
            const cg = contrastFactor * (preG - 128) + 128;
            const cb = contrastFactor * (preB - 128) + 128;
            const lumaN = (0.299 * preR + 0.587 * preG + 0.114 * preB) / 255;
            const wgt = FilmEngine.Masks.getWeight(maskCfgDev, lumaN, x, y, w, h);
            r = preR + (cr - preR) * wgt;
            g = preG + (cg - preG) * wgt;
            b = preB + (cb - preB) * wgt;
          }

          let lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum > 128) {
            const hL = (lum - 128) / 127;
            r += state.highlights * hL; g += state.highlights * hL; b += state.highlights * hL;
            r += pp.highlightDelta * hL; g += pp.highlightDelta * hL; b += pp.highlightDelta * hL;
          } else {
            const sL = (128 - lum) / 128;
            r += state.shadows * sL; g += state.shadows * sL; b += state.shadows * sL;
            r += pp.shadowDelta * sL; g += pp.shadowDelta * sL; b += pp.shadowDelta * sL;
          }

          r += state.temp * 1.2;
          b -= state.temp * 1.2;

          // ---- Характер стока (Ч/Б десатурация, ИК) ----------------------------
          // Цветовые сдвиги для цветных плёнок (sovcolor/ds5m/orwo19/...) больше
          // не хардкодятся тут отдельными формулами — теперь это делает
          // физическая модель Film Response (Lift/Gain по каналам из recipe
          // конкретной плёнки), которая всё равно применяется чуть ниже.
          if (isBWStock) {
            let gray = bwWR * r + bwWG * g + bwWB * b;
            if (isMikrat200) gray = gray > 115 ? 245 : 15;
            r = g = b = gray;
          } else if (isIRStock) {
            const irGray = 0.6 * r + 0.3 * g + 0.1 * b;
            r = g = b = Math.min(255, irGray * 1.35);
          }

          if (state.paper === 'baryta') { r = r * 1.03 + 4; b = b * 0.96; }

          // ---- Поверхность бумаги: глянец даёт глубже чёрные (база—чёрная точка без изменений),
          // мат/перламутр рассеивают отражение и поднимают чёрную точку (меньше динамический диапазон).
          if (state.paperSurface === 'matte') { r = r * 0.90 + 14; g = g * 0.90 + 14; b = b * 0.90 + 14; }
          else if (state.paperSurface === 'pearl') { r = r * 0.96 + 6; g = g * 0.96 + 6; b = b * 0.96 + 6; }

          // ---- Кросс-процесс: цветовой каст от «чужой» химии — только для цветных стоков
          // (для ч/б это была бы бессмыслица: r=g=b уже выше свели в серый).
          if (crossProcess && !isBWStock) {
            const lumaCP = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            if (filmKind === 'slide') {
              // слайд проявлен в негативной химии: зеленоватые тени, тёплые/жёлтые света
              g += (1 - lumaCP) * 20;
              r += lumaCP * 12; b -= lumaCP * 16;
            } else {
              // негатив проявлен в слайдовой химии: вялый/грязный результат с тёплым оттенком
              const avgCP = 0.299 * r + 0.587 * g + 0.114 * b;
              r = r * 0.82 + avgCP * 0.18 + 10;
              g = g * 0.88 + avgCP * 0.12 + 4;
              b = b * 0.78 + avgCP * 0.22 - 8;
            }
          }

          if (state.toner === 'sepia') {
            const avg = 0.299 * r + 0.587 * g + 0.114 * b;
            r = avg * 1.15; g = avg * 0.95; b = avg * 0.75;
          } else if (state.toner === 'selenium') {
            const avg = 0.299 * r + 0.587 * g + 0.114 * b;
            r = avg * 0.92; g = avg * 0.95; b = avg * 1.12;
          } else if (state.toner === 'cyanotype') {
            const avg = 0.299 * r + 0.587 * g + 0.114 * b;
            r = avg * 0.7; g = avg * 0.9; b = avg * 1.3;
          }

          if (state.dyeFade > 0 && !skipDyeFadeStock) {
            const fade = state.dyeFade / 100;
            r = r * (1 - fade * 0.25) + g * (fade * 0.15);
            g = g * (1 - fade * 0.1) + b * (fade * 0.1);
            b = b * (1 - fade * 0.35) + 20 * fade;
          }

          if (state.sabattier > 0) {
            const solar = state.sabattier / 100;
            const sLum = 0.299 * r + 0.587 * g + 0.114 * b;
            const weight = Math.max(0, (sLum - 145) / 110) * solar;
            r = r * (1 - weight) + (255 - r) * weight;
            g = g * (1 - weight) + (255 - g) * weight;
            b = b * (1 - weight) + (255 - b) * weight;
          }

          if (age > 0) {
            // Старение теперь индивидуально для бренда (colorScience.agingRDecay/Mix и т.д.,
            // взяты из agingProfile конкретной плёнки в film-data.js) вместо одной формулы на всех.
            const agedLum = 0.299 * r + 0.587 * g + 0.114 * b;
            r = r * (1 - age * colorScience.agingRDecay) + agedLum * age * colorScience.agingRMix + ageFog;
            g = g * (1 - age * colorScience.agingGDecay) + agedLum * age * colorScience.agingGMix + ageFog;
            b = b * (1 - age * colorScience.agingBDecay) + agedLum * age * colorScience.agingBMix + ageFog;
          }

          // ---- Reciprocity failure: на длинных выдержках тени теряют плотность (классический
          // «toe droop») и плёнка даёт свой цветовой каст (recipTint из agingProfile).
          if (state.reciprocity > 0) {
            const recip = state.reciprocity / 100;
            if (lum < 128) {
              const drop = recip * 24 * ((128 - lum) / 128);
              r -= drop; g -= drop; b -= drop;
            }
            r += recipTint.r * recip; g += recipTint.g * recip; b += recipTint.b * recip;
          }

          if (applySaturation) {
            const curLum = 0.299 * r + 0.587 * g + 0.114 * b;
            r = curLum + (r - curLum) * satVal;
            g = curLum + (g - curLum) * satVal;
            b = curLum + (b - curLum) * satVal;
          }

          if (state.splitShadow > 0) {
            const sWeight = (255 - lum) / 255;
            r += state.splitShadow * 1.2 * sWeight;
            g += state.splitShadow * 0.6 * sWeight;
          }

          // ---- Вуаль / база проявителя (поднимает чёрную точку) ---------------
          if (fogDensity > 0) {
            r = r * (1 - fogDensity / 255) + fogDensity;
            g = g * (1 - fogDensity / 255) + fogDensity;
            b = b * (1 - fogDensity / 255) + fogDensity;
          }

          // ---- 5. Film Response: per-channel LUT + кросс-микс + мастер-кривая (с маской) ----
          {
            const lumaN = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            const wgt = FilmEngine.Masks.getWeight(maskCfgFR, lumaN, x, y, w, h);
            const ri = clamp255(Math.round(r)), gi = clamp255(Math.round(g)), bi = clamp255(Math.round(b));
            let fr = lutR[ri], fg = lutG[gi], fb = lutB[bi];
            [fr, fg, fb] = FilmEngine.FilmResponse.crossMix(fr, fg, fb, state);
            r = r + (fr - r) * wgt;
            g = g + (fg - g) * wgt;
            b = b + (fb - b) * wgt;
          }

          data[i] = clamp255(r);
          data[i + 1] = clamp255(g);
          data[i + 2] = clamp255(b);
        }

        // ---- 6. Grain Engine --------------------------------------------------------
        FilmEngine.Grain.apply(data, w, h, state, grainMult, pushGrainBonus);

        ctx.putImageData(imgData, 0, 0);

        // ---- 7. Emulsion Defects (canvas-level) -------------------------------------
        FilmEngine.Defects.render(ctx, w, h, state, imgData, age);

        // ---- 8. Хроматическая аберрация (нарастает к краям кадра, см. app.js:applyChroma) -----------------------
        if (state.chroma > 0 && opts.applyChroma) opts.applyChroma(w, h);

        // ---- 9 / 10. Halation + Bloom (раздельные алгоритмы) ------------------------
        const postDefectsData = ctx.getImageData(0, 0, w, h);
        FilmEngine.Halation.render(ctx, canvas, w, h, state, postDefectsData);
        FilmEngine.Bloom.render(ctx, canvas, w, h, state, postDefectsData);

        // ---- 11. Виньетирование (форма round/oval + смещение центра) ------------------------
        if (state.vignette > 0) {
          const cx = w / 2 + (state.vignetteX || 0) / 100 * w;
          const cy = h / 2 + (state.vignetteY || 0) / 100 * h;
          ctx.save();
          if (state.vignetteShape === 'oval') {
            // Овальная виньетка повторяет пропорции кадра: сжимаем пространство в единицы
            // полукадра (круг становится овалом, точно вторяющим углы w×h), рисуем круговой
            // градиент, потом растягиваем всё обратно — без этого createRadialGradient всегда круг.
            ctx.translate(cx, cy);
            ctx.scale(w / 2, h / 2);
            const radGrad = ctx.createRadialGradient(0, 0, 0.35, 0, 0, 1.05);
            radGrad.addColorStop(0, 'rgba(0,0,0,0)');
            radGrad.addColorStop(1, `rgba(0,0,0,${state.vignette / 100})`);
            ctx.fillStyle = radGrad;
            ctx.fillRect(-2, -2, 4, 4);
          } else {
            const radGrad = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.3, cx, cy, Math.max(w, h) * 0.75);
            radGrad.addColorStop(0, 'rgba(0,0,0,0)');
            radGrad.addColorStop(1, `rgba(0,0,0,${state.vignette / 100})`);
            ctx.fillStyle = radGrad;
            ctx.fillRect(0, 0, w, h);
          }
          ctx.restore();
        }
      }

      FilmEngine.Core = { render };
    })(typeof window !== 'undefined' ? window : globalThis);
