// pipeline.js
// Всё, что касается собственно обработки пикселей: тоновая кривая,
// цветовые матрицы, построение LUT и полный проход renderFilmPipeline.
// Ничего не знает про DOM-события — только canvas 2D context и state.



function applyToneCurveCustom(val, gamma, baseFog) {
  let norm = val / 255.0;
  norm = Math.max(0, (norm - baseFog) / (1.0 - baseFog));
  let curved = Math.pow(norm, 1.0 / gamma);
  return Math.min(255, Math.max(0, curved * 255.0));
}

function applyColorMatrixCustom(r, g, b, matrix) {
  if (!matrix) return [r, g, b];
  let nr = r / 255.0, ng = g / 255.0, nb = b / 255.0;
  let outR = nr * matrix[0] + ng * matrix[1] + nb * matrix[2];
  let outG = nr * matrix[3] + ng * matrix[4] + nb * matrix[5];
  let outB = nr * matrix[6] + ng * matrix[7] + nb * matrix[8];
  return [
    Math.min(255, Math.max(0, outR * 255.0)),
    Math.min(255, Math.max(0, outG * 255.0)),
    Math.min(255, Math.max(0, outB * 255.0))
  ];
}

function buildCurveLUT() {
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let t = i / 255;
    let cy1 = 1 - (state.p1.y / 120);
    let cy2 = 1 - (state.p2.y / 120);
    let b = 3 * (1 - t) * (1 - t) * t * cy1 + 3 * (1 - t) * t * t * cy2 + t * t * t;
    lut[i] = Math.min(255, Math.max(0, Math.round(b * 255)));
  }
  return lut;
}

function render35mmFrame(ctx, w, h) {
  const margin = Math.round(Math.min(w, h) * 0.08);
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, w, margin);
  ctx.fillRect(0, h - margin, w, margin);

  ctx.fillStyle = '#111111';
  const holeW = Math.round(margin * 0.5);
  const holeH = Math.round(margin * 0.6);
  const holeGap = holeW * 1.8;

  for (let x = 10; x < w; x += holeGap) {
    ctx.fillRect(x, Math.round(margin * 0.2), holeW, holeH);
    ctx.fillRect(x, h - margin + Math.round(margin * 0.2), holeW, holeH);
  }

  ctx.font = `${Math.round(margin * 0.35)}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = 'rgba(230, 230, 230, 0.7)';
  ctx.fillText(state.frameText, Math.round(w * 0.15), Math.round(margin * 0.65));
  ctx.fillText("SAFETY FILM", Math.round(w * 0.7), h - Math.round(margin * 0.35));
}

function renderLabImprint(ctx, w, h) {
  let imprintText = state.imprintText;
  if (!imprintText || imprintText.trim() === '') {
    const film = findFilm(state.preset);
    const filmName = film ? film.name : 'UNKNOWN';
    const dateStr = new Date().toISOString().slice(0, 10);
    imprintText = `${filmName} | DEV: ${state.devType.toUpperCase()} | PAPER: ${state.paper.toUpperCase()} | ${dateStr}`;
  }

  ctx.font = `bold ${Math.max(10, Math.round(w * 0.018))}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = 'rgba(255, 180, 60, 0.85)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 4;

  const padding = Math.round(w * 0.03);
  ctx.fillText(imprintText, padding, h - padding);
  ctx.shadowBlur = 0;
}

/**
 * Основной проход пайплайна: экспозиция -> цветовой профиль пленки ->
 * контраст -> света/тени -> тоновая кривая -> бумага/тонер -> зерно ->
 * оптические эффекты (хромоаберрация, bloom, засветка, виньетка) -> рамка/штамп.
 *
 * @param {CanvasRenderingContext2D} ctx - контекст основного канваса (уже с исходным кадром)
 * @param {HTMLCanvasElement} canvas - сам канвас (нужен для доп. временных канвасов эффектов)
 * @param {HTMLCanvasElement} previewCanvas - буфер превью, из которого рендерим
 */
function renderFilmPipeline(ctx, canvas, previewCanvas) {
  state.renderPending = false;
  if (!previewCanvas.width) return;

  const w = previewCanvas.width;
  const h = previewCanvas.height;

  ctx.drawImage(previewCanvas, 0, 0);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const curveLut = buildCurveLUT();
  const filmProfile = findFilm(state.preset);

  let pushEv = state.pushPull * 22;
  let pushContrast = state.pushPull * 8;
  let pushGrainBonus = state.pushPull > 0 ? state.pushPull * 12 : 0;

  let devGrainMult = 1.0;
  let devContrastBonus = 0;
  if (state.devType === 'rodinal') { devGrainMult = 1.6; devContrastBonus = 10; }
  else if (state.devType === 'hydro') { devGrainMult = 1.2; devContrastBonus = 30; }
  else if (state.devType === 'micro') { devGrainMult = 0.65; devContrastBonus = -8; }

  const totalExp = state.exp + pushEv;
  let totalContrast = state.contrast + pushContrast + devContrastBonus;
  if (state.paper === 'baryta') { totalContrast -= 6; } else { totalContrast += 4; }

  const expFactor = Math.pow(2, totalExp / 50);
  const contrastFactor = (259 * (totalContrast + 255)) / (255 * (259 - totalContrast));

  const satVal = state.sat / 100;
  const grainVal = (state.grain + pushGrainBonus) * 0.6 * devGrainMult * (filmProfile.grain ? filmProfile.grain.size : 1.0);
  const grainScale = state.grainSize / 10;
  const fadeVal = (state.fade / 50) * 35;
  const p = state.preset;

  const fR = 1 + (state.filterR / 50);
  const fG = 1 + (state.filterG / 50);
  const fB = 1 + (state.filterB / 50);

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] * expFactor * fR;
    let g = data[i + 1] * expFactor * fG;
    let b = data[i + 2] * expFactor * fB;

    // Apply profile color matrix or convert to BW
    if (filmProfile.colorShiftMatrix) {
      [r, g, b] = applyColorMatrixCustom(r, g, b, filmProfile.colorShiftMatrix);
    } else if (p === 'aerochrome') {
      let origR = r, origG = g, origB = b;
      r = origG * 1.8 + origR * 0.4;
      g = origR * 0.7;
      b = origB * 0.6;
    } else if (p === 'tasmai810') {
      let irGray = 0.6 * r + 0.3 * g + 0.1 * b;
      r = g = b = Math.min(255, irGray * 1.35);
    } else {
      let mono = 0.299 * r + 0.587 * g + 0.114 * b;
      if (p === 'mikrat200') mono = mono > 115 ? 245 : 15;
      r = g = b = mono;
    }

    r = contrastFactor * (r - 128) + 128;
    g = contrastFactor * (g - 128) + 128;
    b = contrastFactor * (b - 128) + 128;

    let lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum > 128) {
      let hL = (lum - 128) / 127;
      r += state.highlights * hL; g += state.highlights * hL; b += state.highlights * hL;
    } else {
      let sL = (128 - lum) / 128;
      r += state.shadows * sL; g += state.shadows * sL; b += state.shadows * sL;
    }

    r += state.temp * 1.2;
    b -= state.temp * 1.2;

    if (filmProfile.gamma && filmProfile.baseFog) {
      r = applyToneCurveCustom(r, filmProfile.gamma, filmProfile.baseFog);
      g = applyToneCurveCustom(g, filmProfile.gamma, filmProfile.baseFog);
      b = applyToneCurveCustom(b, filmProfile.gamma, filmProfile.baseFog);
    }

    if (state.paper === 'baryta') { r = r * 1.03 + 4; b = b * 0.96; }

    if (state.toner === 'sepia') {
      let avg = 0.299 * r + 0.587 * g + 0.114 * b;
      r = avg * 1.15; g = avg * 0.95; b = avg * 0.75;
    } else if (state.toner === 'selenium') {
      let avg = 0.299 * r + 0.587 * g + 0.114 * b;
      r = avg * 0.92; g = avg * 0.95; b = avg * 1.12;
    } else if (state.toner === 'cyanotype') {
      let avg = 0.299 * r + 0.587 * g + 0.114 * b;
      r = avg * 0.7; g = avg * 0.9; b = avg * 1.3;
    }

    if (state.dyeFade > 0 && p !== 'aerochrome') {
      let fade = state.dyeFade / 100;
      r = r * (1 - fade * 0.25) + g * (fade * 0.15);
      g = g * (1 - fade * 0.1) + b * (fade * 0.1);
      b = b * (1 - fade * 0.35) + 20 * fade;
    }

    if (filmProfile.type === 'color' || p === 'aerochrome') {
      let curLum = 0.299 * r + 0.587 * g + 0.114 * b;
      r = curLum + (r - curLum) * satVal;
      g = curLum + (g - curLum) * satVal;
      b = curLum + (b - curLum) * satVal;
    }

    if (state.splitShadow > 0) {
      let sWeight = (255 - lum) / 255;
      r += state.splitShadow * 1.2 * sWeight;
      g += state.splitShadow * 0.6 * sWeight;
    }

    r = curveLut[Math.min(255, Math.max(0, Math.round(r)))];
    g = curveLut[Math.min(255, Math.max(0, Math.round(g)))];
    b = curveLut[Math.min(255, Math.max(0, Math.round(b)))];

    r = r * (1 - fadeVal / 255) + fadeVal;
    g = g * (1 - fadeVal / 255) + fadeVal;
    b = b * (1 - fadeVal / 255) + fadeVal;

    let halationIntensity = filmProfile.halation ? filmProfile.halation.intensity * 30 : state.halation;
    if (halationIntensity > 0 && (r + g + b) > 480) {
      r += halationIntensity * 0.45;
      g += halationIntensity * 0.08;
    }

    if (grainVal > 0) {
      let shadowW = filmProfile.grain ? filmProfile.grain.shadowWeight : 0.7;
      let roughness = filmProfile.grain ? filmProfile.grain.roughness : 0.7;
      let pixelIndex = Math.floor((i / 4) / grainScale);
      let brightness = (r + g + b) / 3.0;
      let grainFactor = (1.0 - (brightness / 255.0) * shadowW) * roughness;
      const noise = ((Math.sin(pixelIndex * 12.9898) * 43758.5453) % 1) * grainVal * 2.0 * grainFactor - (grainVal * grainFactor);
      r += noise; g += noise; b += noise;
    }

    if (state.dust > 0 && Math.random() < (state.dust / 8000)) {
      let scratch = Math.random() > 0.5 ? 255 : 0;
      r = g = b = scratch;
    }

    data[i] = Math.min(255, Math.max(0, r));
    data[i + 1] = Math.min(255, Math.max(0, g));
    data[i + 2] = Math.min(255, Math.max(0, b));
  }

  ctx.putImageData(imgData, 0, 0);

  if (state.chroma > 0) {
    let shift = Math.round(state.chroma);
    let tempCanvas = document.createElement('canvas');
    tempCanvas.width = w; tempCanvas.height = h;
    let tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    tCtx.drawImage(canvas, 0, 0);

    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(tempCanvas, -shift, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  if (state.bloom > 0) {
    let glowCanvas = document.createElement('canvas');
    glowCanvas.width = w / 2; glowCanvas.height = h / 2;
    let gCtx = glowCanvas.getContext('2d');
    gCtx.filter = `blur(${Math.round(state.bloom / 8)}px)`;
    gCtx.drawImage(canvas, 0, 0, w / 2, h / 2);

    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = state.bloom / 100;
    ctx.drawImage(glowCanvas, 0, 0, w, h);
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
  }

  if (state.leak > 0) {
    let lGrad = ctx.createRadialGradient(w, 0, 10, w, 0, Math.max(w, h) * 0.8);
    lGrad.addColorStop(0, `rgba(255, 90, 20, ${state.leak / 100})`);
    lGrad.addColorStop(0.5, `rgba(255, 40, 0, ${(state.leak / 100) * 0.4})`);
    lGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lGrad;
    ctx.fillRect(0, 0, w, h);
  }

  if (state.spots > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${state.spots / 300})`;
    for (let s = 0; s < Math.round(state.spots / 5); s++) {
      let sx = (Math.sin(s * 99) * 0.5 + 0.5) * w;
      let sy = (Math.cos(s * 33) * 0.5 + 0.5) * h;
      let sr = (Math.sin(s * 12) * 0.5 + 0.5) * 20 + 5;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (state.vignette > 0) {
    const radGrad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    radGrad.addColorStop(0, 'rgba(0,0,0,0)');
    radGrad.addColorStop(1, `rgba(0,0,0,${state.vignette / 100})`);
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, w, h);
  }

  if (state.frame !== 'none') {
    render35mmFrame(ctx, w, h);
  }

  if (state.imprint) {
    renderLabImprint(ctx, w, h);
  }
}
