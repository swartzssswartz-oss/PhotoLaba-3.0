
    // ──────────────────────────────────────────────────────────────────────
    // FilmEngine.Defects
    // Физические дефекты эмульсии/плёнки. Всё детерминировано через seed
    // (defectSeed), поэтому один и тот же кадр с dust=X всегда даёт один
    // и тот же узор при defectLock=true. Каждый под-эффект уважает маску
    // (maskDefects) — плотность конкретного дефекта скейлится по весу
    // маски в точке, где он оказался.
    // ──────────────────────────────────────────────────────────────────────
    (function (root) {
      const FilmEngine = root.FilmEngine = root.FilmEngine || {};
      const Masks = () => FilmEngine.Masks;

      function makeRng(seed) {
        let s = seed >>> 0 || 1;
        return function () {
          s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
          return s / 4294967296;
        };
      }

      function lumaAt(imgData, w, x, y) {
        const i = (Math.max(0, Math.min(imgData.height - 1, y)) * w + Math.max(0, Math.min(w - 1, x))) * 4;
        const d = imgData.data;
        return (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      }

      function maskAt(maskCfg, imgData, w, h, x, y) {
        if (!maskCfg || maskCfg.target === 'all') return 1;
        const l = maskCfg.target === 'custom' ? 0.5 : lumaAt(imgData, w, x, y);
        return Masks().getWeight(maskCfg, l, x, y, w, h);
      }

      // Детерминированный хэш 0..1 для точецного джиттера формы/альфы (не требует полного
      // шумового поля — переиспользует хэш-функцию из FilmEngine.Noise, если модуль подгружен.
      function hash01(n) {
        if (FilmEngine.Noise) return FilmEngine.Noise.hash01(n);
        let h = n | 0;
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909) ^ (h >>> 16);
        return (h >>> 0) / 4294967295;
      }

      // Строит неровный контур «кляксы» вместо идеальной окружности/эллипса —
      // радиус по каждому углу чуть колеблется (детерминированно, по seedBase), гладкая
      // заливка (градиент) так ещё выглядит как пятно/потёртость, а не выдаёт себя
      // чертежом правильной окружности.
      function tracePotatoOutline(ctx, cx, cy, rx, ry, seedBase) {
        const points = 10;
        ctx.beginPath();
        for (let i = 0; i <= points; i++) {
          const a = (i / points) * Math.PI * 2;
          const wob = 0.72 + hash01(seedBase + i * 731) * 0.56; // 0.72..1.28
          const px = cx + Math.cos(a) * rx * wob;
          const py = cy + Math.sin(a) * ry * wob;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
      }

      function render(ctx, w, h, state, refImageData, age) {
        const seed = state.defectLock ? state.defectSeed : Math.floor(performance.now() / 300);
        const rng = makeRng(seed);
        const maskCfg = state.maskDefects;

        // ---- Бромные потёки (вертикальные следы от перфорации, при неровной ажитации) ----
        // Раньше потёки шли строго через одинаковый шаг — читалось как «штрих-код», а не
        // потёк химии. Сейчас — неровные интервалы между потёками + вертикальная
        // модуляция альфы по фрактальному шуму — потёк местами густе, местами едва виден, как
        // у реальной неравномерной циркуляции химии.
        if (state.bromide > 0) {
          const baseAlpha = state.bromide / 240;
          const streakField = FilmEngine.Noise ? FilmEngine.Noise.makeFractalField(w, h, Math.max(20, Math.round(h * 0.12)), seed + 5555, 2) : null;
          ctx.save();
          const avgGap = Math.max(14, w / 18);
          const bands = 12;
          let x = 6 + rng() * 14;
          while (x < w) {
            const drift = Math.sin(x * 1.73) * 4;
            const streakW = 3 + rng() * 3;
            const g = ctx.createLinearGradient(x + drift, 0, x + drift + streakW, h);
            g.addColorStop(0, 'rgba(230,230,210,.95)'); g.addColorStop(.15, 'rgba(35,28,20,.34)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            for (let b = 0; b < bands; b++) {
              const by0 = Math.round(h * b / bands), by1 = Math.round(h * (b + 1) / bands);
              const nSample = streakField ? streakField(x, (by0 + by1) / 2) : 0;
              ctx.globalAlpha = baseAlpha * Math.max(0.12, 0.55 + nSample * 0.55);
              ctx.fillRect(x + drift, by0, streakW, by1 - by0);
            }
            x += avgGap * (0.55 + rng() * 0.9); // неровный интервал между потёками
          }
          ctx.globalAlpha = 1;
          ctx.restore();
        }

        // ---- Ретикуляция (растрескивание желатины) + коррозия от старения ----
        // Раньше это были ровные отрезки по sin/cos — явная геометрия. Сейчас — трещины
        // идут по градиенту фрактального шума (FilmEngine.Noise) — похоже на настоящий crackle-узор
        // реакционно-диффузного типа, без стоимости честной итеративной симуляции.
        if ((state.reticulation > 0 || (age || 0) > 0) && FilmEngine.Noise) {
          const amt = state.reticulation / 100;
          const ageAmt = age || 0;
          const field = FilmEngine.Noise.makeFractalField(w, h, Math.max(4, Math.round(Math.max(w, h) * 0.012)), seed + 9001, 3);
          const tex = document.createElement('canvas'); tex.width = w; tex.height = h;
          const tctx = tex.getContext('2d');
          const out = tctx.createImageData(w, h);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const n0 = field(x, y), n1 = field(x + 1, y), n2 = field(x, y + 1);
              const grad = Math.abs(n1 - n0) + Math.abs(n2 - n0);
              const crack = Math.max(0, grad * 10 - 0.6);
              const wgt = maskAt(maskCfg, refImageData, w, h, x, y);
              const idx = (y * w + x) * 4;
              out.data[idx] = out.data[idx + 1] = out.data[idx + 2] = 0;
              out.data[idx + 3] = Math.min(255, crack * 255 * (amt + ageAmt * 0.6) * wgt);
            }
          }
          tctx.putImageData(out, 0, 0);
          ctx.save();
          ctx.globalAlpha = Math.min(1, 0.6 + amt * 0.35);
          ctx.drawImage(tex, 0, 0);
          ctx.restore();

          // Мелкие охристые крапинки коррозии от старения — это реальные дискретные частицы,
          // им уместно остаться точками, а не текстурой.
          if (ageAmt > 0.25) {
            ctx.save();
            ctx.fillStyle = `rgba(245,205,130,${Math.min(0.6, ageAmt * 0.5)})`;
            const speckCount = Math.round(ageAmt * 220);
            for (let n = 0; n < speckCount; n++) {
              const x = rng() * w, y = rng() * h;
              ctx.fillRect(x, y, 1 + ageAmt * 4, 1 + ageAmt * 4);
            }
            ctx.restore();
          }
        }

        // ---- Неравномерность общей плотности (мутные разводы по всей площади) ----
        // Раньше это были 5-20 идеальных круглых radial-gradient пятен — геометрия была слишком
        // заметна. теперь — фрактальный (многооктавный) шум, дающий органичные разводы
        // без выдающей себя формы окружности.
        if (state.unevenDensity > 0 && FilmEngine.Noise) {
          const amt = state.unevenDensity / 100;
          const field = FilmEngine.Noise.makeFractalField(w, h, Math.max(24, Math.round(Math.max(w, h) * 0.10)), seed + 4001, 4);
          const tex = document.createElement('canvas'); tex.width = w; tex.height = h;
          const tctx = tex.getContext('2d');
          const out = tctx.createImageData(w, h);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const n = field(x, y); // -1..1
              const wgt = maskAt(maskCfg, refImageData, w, h, x, y);
              const v = 128 + n * 90 * wgt;
              const idx = (y * w + x) * 4;
              out.data[idx] = out.data[idx + 1] = out.data[idx + 2] = Math.max(0, Math.min(255, v));
              out.data[idx + 3] = 255;
            }
          }
          tctx.putImageData(out, 0, 0);
          ctx.save();
          ctx.globalAlpha = Math.min(1, amt * 0.85);
          ctx.globalCompositeOperation = 'overlay';
          ctx.drawImage(tex, 0, 0);
          ctx.restore();
        }

        // ---- Повреждения эмульсии (крупные проплешины/потёртости) ----
        // Раньше — идеальный эллипс (ctx.ellipse). Сейчас контур неровный (tracePotatoOutline) —
        // проплешина выглядит как настоящая потёртость, а не штампик.
        if (state.damage > 0) {
          ctx.save();
          const count = Math.round(state.damage / 8);
          for (let n = 0; n < count; n++) {
            const x = rng() * w, y = rng() * h;
            const rw = (0.03 + rng() * 0.08) * w, rh = (0.02 + rng() * 0.05) * h;
            const wgt = maskAt(maskCfg, refImageData, w, h, x, y);
            const alpha = 0.25 * wgt * (0.4 + rng() * 0.6);
            if (alpha <= 0.005) continue;
            const seedBase = Math.floor(rng() * 999999);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rng() * Math.PI);
            ctx.fillStyle = `rgba(235,225,205,${alpha})`;
            tracePotatoOutline(ctx, 0, 0, rw, rh, seedBase);
            ctx.fill();
            ctx.restore();
          }
          ctx.restore();
        }

        // ---- Пятна / разводы (грибок, вода, химические потёки) ----
        // Раньше — идеальный круг (ctx.arc). Сейчас контур неровный, градиент при этом
        // остаётся центрированным — пятно выглядит как натёкший развод, а не штамп.
        if (state.spots > 0) {
          ctx.save();
          const count = Math.round(state.spots / 6);
          for (let n = 0; n < count; n++) {
            const x = rng() * w, y = rng() * h;
            const r = (0.01 + rng() * 0.035) * Math.max(w, h);
            const wgt = maskAt(maskCfg, refImageData, w, h, x, y);
            const alpha = 0.35 * wgt * (0.3 + rng() * 0.7);
            if (alpha <= 0.005) continue;
            const warm = rng() > 0.4;
            const seedBase = Math.floor(rng() * 999999);
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, `rgba(${warm ? '200,150,70' : '90,110,90'},${alpha})`);
            g.addColorStop(0.7, `rgba(${warm ? '160,110,50' : '60,80,60'},${alpha * 0.4})`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            tracePotatoOutline(ctx, x, y, r, r, seedBase);
            ctx.fill();
          }
          ctx.restore();
        }

        // ---- Царапины (тонкие продольные линии, обычно вдоль протяжки) ----
        // Раньше — одна ровная линия на всю высоту. Реальная царапина неравномерна по
        // глубине — рвём на отрезки с разной видимостью/толщиной, местами она почти исчезает.
        if (state.scratches > 0) {
          ctx.save();
          const count = Math.round(state.scratches / 5);
          const segments = 16;
          for (let n = 0; n < count; n++) {
            const x = rng() * w;
            const y0 = rng() * h * 0.3, y1 = h - rng() * h * 0.3;
            const wgt = maskAt(maskCfg, refImageData, w, h, x, (y0 + y1) / 2);
            const baseAlpha = 0.5 * wgt * (0.3 + rng() * 0.7);
            if (baseAlpha <= 0.005) continue;
            const bright = rng() > 0.3;
            const seedBase = Math.floor(rng() * 999999);
            for (let s = 0; s < segments; s++) {
              const visibility = hash01(seedBase + s * 131);
              if (visibility < 0.24) continue; // царапина местами «пропадает»
              const t0 = s / segments, t1 = (s + 1) / segments;
              const sy0 = y0 + (y1 - y0) * t0, sy1 = y0 + (y1 - y0) * t1;
              const localAlpha = baseAlpha * (0.5 + hash01(seedBase + s * 57) * 0.8);
              ctx.strokeStyle = bright ? `rgba(255,255,255,${localAlpha})` : `rgba(0,0,0,${localAlpha})`;
              ctx.lineWidth = 0.4 + hash01(seedBase + s * 17) * 1.4;
              ctx.beginPath();
              ctx.moveTo(x + (rng() - 0.5) * 6, sy0);
              ctx.lineTo(x + (rng() - 0.5) * 6, sy1);
              ctx.stroke();
            }
          }
          ctx.restore();
        }

        // ---- Пыль (мелкие точки) ----
        if (state.dust > 0) {
          ctx.save();
          const count = Math.round((state.dust / 100) * (w * h) / 3200);
          for (let n = 0; n < count; n++) {
            const x = rng() * w, y = rng() * h;
            const wgt = maskAt(maskCfg, refImageData, w, h, x, y);
            if (rng() > wgt) continue;
            const bright = rng() > 0.5;
            const r = 0.5 + rng() * 1.3;
            ctx.fillStyle = bright ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.75)';
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        }

        // ---- Засветка (light leak) ----
        // Раньше всегда из одного и того же угла (верхне-правого) — одинаково на любой
        // фото. Сейчас угол/радиус/оттенок зависят от seed — как у реальной случайной
        // засветки через щель кассеты, меняется вместе с остальными дефектами, когда defectLock выключен.
        if (state.leak > 0) {
          const corner = Math.floor(hash01(seed * 13 + 77) * 4);
          const lx = corner % 2 === 0 ? w : 0;
          const ly = corner < 2 ? 0 : h;
          const warm = hash01(seed * 29 + 3) > 0.35;
          const reach = Math.max(w, h) * (0.55 + hash01(seed * 7 + 41) * 0.35);
          const g = ctx.createRadialGradient(lx, ly, 10, lx, ly, reach);
          g.addColorStop(0, `rgba(${warm ? '255, 90, 20' : '255, 40, 130'}, ${state.leak / 100})`);
          g.addColorStop(0.5, `rgba(${warm ? '255, 40, 0' : '200, 20, 90'}, ${(state.leak / 100) * 0.4})`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        }
      }

      FilmEngine.Defects = { render };
    })(typeof window !== 'undefined' ? window : globalThis);
