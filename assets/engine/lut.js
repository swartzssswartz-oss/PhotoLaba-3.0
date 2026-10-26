// ──────────────────────────────────────────────────────────────────────
// FilmEngine.Lut — цветовая часть движка через 3D LUT.
//
// Идея: всё, что движок делает с цветом одного пикселя (экспозиция, контраст проявки,
// toe/shoulder, характер плёнки, бумага, тонеры, кросс-процесс, старение, вуаль,
// Film Response, мастер-кривая), — это функция (R,G,B) → (R,G,B). Её можно один раз
// «запечь» в решётку 33³ и дальше применять к кадру тетраэдральной интерполяцией:
// быстрее прямого расчёта, и тот же LUT можно отдать наружу как .cube.
//
// В LUT НЕ попадает то, что зависит от соседних пикселей или от места в кадре:
// зерно, галация, блум, резкость, дефекты, виньетка, хром. аберрация — они
// остаются в render() и применяются после LUT. Карта неравномерности экспозиции
// (тоже пространственная) умножается на вход пикселя до LUT — математически это
// то же самое, что умножение внутри цикла.
//
// Прямой расчёт (старый путь) остаётся как запасной: для кастомных масок
// (зависят от координат), жёсткого порога Микрат-200 и по переключателю
// «Точный расчёт без LUT».
// ──────────────────────────────────────────────────────────────────────
(function (root) {
  const FilmEngine = root.FilmEngine = root.FilmEngine || {};

  const N_PREVIEW = 33;   // рабочая решётка
  const N_EXPORT = 65;    // решётка для .cube

  // Решётка: индекс ((b*n + g)*n + r)*4, значения 0..255 (float), красный меняется быстрее всех —
  // тот же порядок, что требует формат .cube.
  function bake(C, n) {
    const total = n * n * n;
    const buf = new Float32Array(total * 4);
    const step = 255 / (n - 1);
    let k = 0;
    for (let b = 0; b < n; b++) {
      for (let g = 0; g < n; g++) {
        for (let r = 0; r < n; r++, k += 4) {
          buf[k] = r * step; buf[k + 1] = g * step; buf[k + 2] = b * step; buf[k + 3] = 255;
        }
      }
    }
    // позиции не нужны: кастомные маски сюда не попадают (см. canBake)
    C.run(buf, total, total, 1, null);
    return buf;
  }

  function canBake(state, C) {
    const mFR = state.maskFilmResponse, mDev = state.maskDeveloper;
    if ((mFR && mFR.target === 'custom') || (mDev && mDev.target === 'custom')) return false;
    if (C.isMikrat200) return false; // порог gray > 115 → 245/15: решётка размоет резкий скачок
    return true;
  }

  // Тетраэдральная интерполяция (4 чтения вместо 8, без цветовых артефактов трилинейной).
  // strength: 1 = целиком LUT, меньше = смешивание с исходным цветом.
  function apply(lut, n, data, count, uniformMap, strength) {
    const s = strength === undefined ? 1 : strength;
    const n1 = n - 1, scale = n1 / 255;
    const dR = 4, dG = n * 4, dB = n * n * 4;
    for (let px = 0, i = 0; px < count; px++, i += 4) {
      const r0v = data[i], g0v = data[i + 1], b0v = data[i + 2];
      let r = r0v, g = g0v, b = b0v;
      if (uniformMap) { const u = uniformMap[px]; r *= u; g *= u; b *= u; }
      r = r < 0 ? 0 : r > 255 ? 255 : r;
      g = g < 0 ? 0 : g > 255 ? 255 : g;
      b = b < 0 ? 0 : b > 255 ? 255 : b;
      r *= scale; g *= scale; b *= scale;
      let ri = r | 0, gi = g | 0, bi = b | 0;
      if (ri >= n1) ri = n1 - 1; if (gi >= n1) gi = n1 - 1; if (bi >= n1) bi = n1 - 1;
      const fr = r - ri, fg = g - gi, fb = b - bi;
      const o = (bi * n * n + gi * n + ri) * 4;
      const o100 = o + dR, o010 = o + dG, o001 = o + dB, o110 = o + dR + dG, o101 = o + dR + dB, o011 = o + dG + dB, o111 = o + dR + dG + dB;
      let a1, a2, a3, p1, p2, p3; // вес и два угла-приращения тетраэдра
      let c1, c2, c3;
      if (fr >= fg) {
        if (fg >= fb)      { a1 = fr; a2 = fg; a3 = fb; c1 = o100; c2 = o110; c3 = o111; p1 = o; p2 = o100; p3 = o110; }
        else if (fr >= fb) { a1 = fr; a2 = fb; a3 = fg; c1 = o100; c2 = o101; c3 = o111; p1 = o; p2 = o100; p3 = o101; }
        else               { a1 = fb; a2 = fr; a3 = fg; c1 = o001; c2 = o101; c3 = o111; p1 = o; p2 = o001; p3 = o101; }
      } else {
        if (fb >= fg)      { a1 = fb; a2 = fg; a3 = fr; c1 = o001; c2 = o011; c3 = o111; p1 = o; p2 = o001; p3 = o011; }
        else if (fb >= fr) { a1 = fg; a2 = fb; a3 = fr; c1 = o010; c2 = o011; c3 = o111; p1 = o; p2 = o010; p3 = o011; }
        else               { a1 = fg; a2 = fr; a3 = fb; c1 = o010; c2 = o110; c3 = o111; p1 = o; p2 = o010; p3 = o110; }
      }
      // v = c0 + a1·(c1−c0) + a2·(c2−c1) + a3·(c3−c2)
      let vr = lut[o] + a1 * (lut[c1] - lut[o]) + a2 * (lut[c2] - lut[c1]) + a3 * (lut[c3] - lut[c2]);
      let vg = lut[o + 1] + a1 * (lut[c1 + 1] - lut[o + 1]) + a2 * (lut[c2 + 1] - lut[c1 + 1]) + a3 * (lut[c3 + 1] - lut[c2 + 1]);
      let vb = lut[o + 2] + a1 * (lut[c1 + 2] - lut[o + 2]) + a2 * (lut[c2 + 2] - lut[c1 + 2]) + a3 * (lut[c3 + 2] - lut[c2 + 2]);
      if (s !== 1) { vr = r0v + (vr - r0v) * s; vg = g0v + (vg - g0v) * s; vb = b0v + (vb - b0v) * s; }
      data[i] = vr; data[i + 1] = vg; data[i + 2] = vb; // Uint8ClampedArray сам округлит и обрежет
    }
  }

  // ---- кэш запечённого LUT: ключ — всё состояние (оно небольшое), пересборка ~десятки мс ----
  let cache = { key: null, lut: null };
  function getBaked(C, state) {
    const key = JSON.stringify(state);
    if (cache.key === key) return cache.lut;
    const t = performance.now();
    const lut = bake(C, N_PREVIEW);
    cache = { key, lut };
    last.bakeMs = Math.round(performance.now() - t);
    return lut;
  }

  const last = { path: '', bakeMs: 0, applyMs: 0 };

  // Главная точка входа из core.render(): решает, какой путь использовать.
  //   state.lutMode: 'engine' (по умолчанию) | 'external' (только внешний .cube) | 'both' (движок, затем .cube)
  //   state.lutStrength: 0..100 — сила внешнего LUT
  //   state.lutEngine === false → принудительный прямой расчёт без LUT
  function process(o) {
    const { C, state, data, count, w, h, uniformMap, extLut } = o;
    const t = performance.now();
    const mode = state.lutMode || 'engine';
    const strength = Math.max(0, Math.min(100, state.lutStrength === undefined ? 100 : state.lutStrength)) / 100;
    const hasExt = !!(extLut && extLut.data);

    if (mode === 'external' && hasExt) {
      apply(extLut.data, extLut.size, data, count, uniformMap, strength);
      last.path = 'external';
    } else {
      if (state.lutEngine !== false && canBake(state, C)) {
        apply(getBaked(C, state), N_PREVIEW, data, count, uniformMap, 1);
        last.path = 'lut';
      } else {
        C.run(data, count, w, h, uniformMap);
        last.path = 'direct';
      }
      if (mode === 'both' && hasExt) {
        apply(extLut.data, extLut.size, data, count, null, strength);
        last.path += '+external';
      }
    }
    last.applyMs = Math.round(performance.now() - t);
    return last;
  }

  // ---- .cube ----
  function toCube(C, state, title, n) {
    const size = n || N_EXPORT;
    const lut = bake(C, size);
    const out = [];
    out.push('TITLE "' + String(title || 'SVEMA LAB').replace(/[^\x20-\x7E]/g, '').replace(/"/g, '') + '"');
    out.push('# Created by SVEMA LAB: colour stage only (no grain/halation/bloom/vignette)');
    out.push('LUT_3D_SIZE ' + size);
    out.push('DOMAIN_MIN 0.0 0.0 0.0');
    out.push('DOMAIN_MAX 1.0 1.0 1.0');
    const f = v => { v = v / 255; v = v < 0 ? 0 : v > 1 ? 1 : v; return v.toFixed(6); };
    for (let k = 0; k < lut.length; k += 4) out.push(f(lut[k]) + ' ' + f(lut[k + 1]) + ' ' + f(lut[k + 2]));
    return out.join('\n') + '\n';
  }

  function parseCube(text) {
    let size = 0, name = '', dmin = [0, 0, 0], dmax = [1, 1, 1];
    const vals = [];
    const lines = String(text).split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line[0] === '#') continue;
      const up = line.toUpperCase();
      if (up.startsWith('TITLE')) { name = line.slice(5).trim().replace(/^"|"$/g, ''); continue; }
      if (up.startsWith('LUT_1D_SIZE')) throw new Error('Это 1D LUT. Поддерживаются 3D LUT (LUT_3D_SIZE).');
      if (up.startsWith('LUT_3D_SIZE')) { size = parseInt(line.split(/\s+/)[1], 10); continue; }
      if (up.startsWith('DOMAIN_MIN')) { dmin = line.split(/\s+/).slice(1, 4).map(Number); continue; }
      if (up.startsWith('DOMAIN_MAX')) { dmax = line.split(/\s+/).slice(1, 4).map(Number); continue; }
      if (/^[A-Z_]/i.test(line) && !/^[-+.\d]/.test(line)) continue; // прочие ключевые слова
      const p = line.split(/\s+/);
      if (p.length >= 3) vals.push(parseFloat(p[0]), parseFloat(p[1]), parseFloat(p[2]));
    }
    if (!size || size < 2) throw new Error('В файле нет LUT_3D_SIZE.');
    if (vals.length !== size * size * size * 3) throw new Error('Размер данных не совпадает с LUT_3D_SIZE ' + size + '.');
    if (dmin.some(v => v !== 0) || dmax.some(v => v !== 1)) throw new Error('LUT с нестандартным DOMAIN (не 0..1) пока не поддерживается.');
    const data = new Float32Array(size * size * size * 4);
    for (let i = 0, j = 0; i < vals.length; i += 3, j += 4) {
      for (let c = 0; c < 3; c++) {
        const v = vals[i + c];
        if (!isFinite(v)) throw new Error('В данных LUT есть нечисловое значение.');
        data[j + c] = (v < 0 ? 0 : v > 1 ? 1 : v) * 255;
      }
      data[j + 3] = 255;
    }
    return { size, data, name: name || 'LUT' };
  }

  FilmEngine.Lut = { process, bake, apply, toCube, parseCube, canBake, last, N_PREVIEW, N_EXPORT };
})(typeof window !== 'undefined' ? window : globalThis);
