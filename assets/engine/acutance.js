
    // ──────────────────────────────────────────────────────────────────────
    // FilmEngine.Acutance
    // Эффект прилегания / линии Мэки (Mackie lines, adjacency effect) —
    // микро-контраст на резких границах: рядом с границей света и тени
    // проявитель локально истощается у светлого края (граница чуть темнеет
    // изнутри) и обогащается продуктами реакции у тёмного (граница чуть
    // светлеет снаружи) — характерная «хрусткость» реальной плёнки, которой
    // нет у цифровой матрицы. Разбавленные и холодные проявители усиливают
    // эффект (классика — Родинал), поэтому сила берётся из dev.acutance
    // (FilmEngine.Developer.computeDeveloperParams) — это побочный эффект
    // рецепта проявки, а не отдельная творческая ручка в интерфейсе.
    //
    // Реализовано как unsharp mask небольшого радиуса на уже полностью
    // тонированном кадре (после Film Response, ДО зерна) — так резкость
    // ловит именно границы объекта, а не накручивает синтетический шум
    // зерна, который добавляется отдельным шагом позже.
    // ──────────────────────────────────────────────────────────────────────
    (function (root) {
      const FilmEngine = root.FilmEngine = root.FilmEngine || {};

      // Свой маленький пул канвасов — тот же приём, что в Halation/Bloom:
      // не аллоцировать новый canvas на каждый кадр/движение слайдера.
      const pool = {};
      function getCanvas(key, w, h) {
        let c = pool[key];
        if (!c) { c = document.createElement('canvas'); pool[key] = c; }
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
        else { c.getContext('2d').clearRect(0, 0, w, h); }
        return c;
      }

      function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

      // imgData — уже отрисованный на этот момент кадр (его .data мутируется на месте).
      // amount — dev.acutance (обычно 0..~0.6). radiusPx — небольшой (1..2px),
      // чтобы ловить именно резкие границы, а не общую форму тонов/виньетку.
      function render(w, h, imgData, amount, radiusPx) {
        if (!amount || amount <= 0.01) return;

        const src = getCanvas('acut_src', w, h);
        src.getContext('2d').putImageData(imgData, 0, 0);

        const blurred = getCanvas('acut_blur', w, h);
        const bctx = blurred.getContext('2d');
        bctx.filter = `blur(${radiusPx}px)`;
        bctx.drawImage(src, 0, 0);
        bctx.filter = 'none';

        const blurData = bctx.getImageData(0, 0, w, h).data;
        const data = imgData.data;
        const strength = Math.min(1.6, amount * 1.4);

        for (let i = 0; i < data.length; i += 4) {
          data[i] = clamp255(data[i] + (data[i] - blurData[i]) * strength);
          data[i + 1] = clamp255(data[i + 1] + (data[i + 1] - blurData[i + 1]) * strength);
          data[i + 2] = clamp255(data[i + 2] + (data[i + 2] - blurData[i + 2]) * strength);
        }
      }

      FilmEngine.Acutance = { render };
    })(typeof window !== 'undefined' ? window : globalThis);
