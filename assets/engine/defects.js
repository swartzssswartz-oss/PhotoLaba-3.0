
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

      function render(ctx, w, h, state, refImageData, age) {
        const seed = state.defectLock ? state.defectSeed : Math.floor(performance.now() / 300);
        const rng = makeRng(seed);
        const maskCfg = state.maskDefects;

        // ---- Бромные потёки (вертикальные следы от перфорации, при неровной ажитации) ----
        if (state.bromide > 0) {
          ctx.save(); ctx.globalAlpha = state.bromide / 240;
          for (let x = 0; x < w; x += Math.max(18, Math.round(w / 18))) {
            const drift = Math.sin(x * 1.73) * 4;
            const g = ctx.createLinearGradient(x + drift, 0, x + drift + 5, h);
            g.addColorStop(0, 'rgba(230,230,210,.95)'); g.addColorStop(.15, 'rgba(35,28,20,.34)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.fillRect(x + drift, 0, 5, h);
          } ctx.restore();
        }
        // ---- Ретикуляция (растрескивание желатины) + коррозия от старения ----
        if (state.reticulation > 0 || (age || 0) > 0) {
          ctx.save();
          ctx.globalAlpha = state.reticulation / 260 + (age || 0) / 12;
          ctx.strokeStyle = '#070707'; ctx.lineWidth = Math.max(1, state.reticulation / 42);
          const count = Math.round((state.reticulation / 100) * 70 + (age || 0) * 45);
          for (let n = 0; n < count; n++) {
            const x = (Math.sin(n * 91.7) * .5 + .5) * w, y = (Math.sin(n * 47.3) * .5 + .5) * h;
            ctx.beginPath(); ctx.moveTo(x, y);
            ctx.lineTo(x + Math.sin(n * 13) * (8 + state.reticulation / 2), y + Math.cos(n * 17) * (8 + state.reticulation / 2)); ctx.stroke();
            if ((age || 0) > .25) { ctx.fillStyle = 'rgba(245,205,130,.5)'; ctx.fillRect(x, y, 1 + age * 4, 1 + age * 4); }
          } ctx.restore();
        }

        // ---- Неравномерность общей плотности (мутные разводы по всей площади) ----
        if (state.unevenDensity > 0) {
          ctx.save();
          const blobs = 5 + Math.round(state.unevenDensity / 12);
          for (let n = 0; n < blobs; n++) {
            const x = rng() * w, y = rng() * h;
            const r = (0.18 + rng() * 0.28) * Math.max(w, h);
            const wgt = maskAt(maskCfg, refImageData, w, h, x, y);
            const alpha = (state.unevenDensity / 100) * 0.11 * wgt;
            if (alpha <= 0.002) continue;
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            const dark = rng() > 0.5;
            g.addColorStop(0, `rgba(${dark ? '0,0,0' : '255,250,235'},${alpha})`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
          }
          ctx.restore();
        }

        // ---- Повреждения эмульсии (крупные проплешины/потёртости) ----
        if (state.damage > 0) {
          ctx.save();
          const count = Math.round(state.damage / 8);
          for (let n = 0; n < count; n++) {
            const x = rng() * w, y = rng() * h;
            const rw = (0.03 + rng() * 0.08) * w, rh = (0.02 + rng() * 0.05) * h;
            const wgt = maskAt(maskCfg, refImageData, w, h, x, y);
            const alpha = 0.25 * wgt * (0.4 + rng() * 0.6);
            if (alpha <= 0.005) continue;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rng() * Math.PI);
            ctx.fillStyle = `rgba(235,225,205,${alpha})`;
            ctx.beginPath();
            ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          ctx.restore();
        }

        // ---- Пятна / разводы (грибок, вода, химические потёки) ----
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
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, `rgba(${warm ? '200,150,70' : '90,110,90'},${alpha})`);
            g.addColorStop(0.7, `rgba(${warm ? '160,110,50' : '60,80,60'},${alpha * 0.4})`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        }

        // ---- Царапины (тонкие продольные линии, обычно вдоль протяжки) ----
        if (state.scratches > 0) {
          ctx.save();
          const count = Math.round(state.scratches / 5);
          for (let n = 0; n < count; n++) {
            const x = rng() * w;
            const y0 = rng() * h * 0.3, y1 = h - rng() * h * 0.3;
            const wgt = maskAt(maskCfg, refImageData, w, h, x, (y0 + y1) / 2);
            const alpha = 0.5 * wgt * (0.3 + rng() * 0.7);
            if (alpha <= 0.005) continue;
            const bright = rng() > 0.3;
            ctx.strokeStyle = bright ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
            ctx.lineWidth = 0.6 + rng() * 1.2;
            ctx.beginPath();
            ctx.moveTo(x + (rng() - 0.5) * 6, y0);
            ctx.lineTo(x + (rng() - 0.5) * 6, y1);
            ctx.stroke();
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
        if (state.leak > 0) {
          const g = ctx.createRadialGradient(w, 0, 10, w, 0, Math.max(w, h) * 0.8);
          g.addColorStop(0, `rgba(255, 90, 20, ${state.leak / 100})`);
          g.addColorStop(0.5, `rgba(255, 40, 0, ${(state.leak / 100) * 0.4})`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        }
      }

      FilmEngine.Defects = { render };
    })(typeof window !== 'undefined' ? window : globalThis);
