
    const canvas = document.getElementById('filmCanvas');
    const ctx = canvas.getContext('2d');
    let sourceImg = null;
    let previewCanvas = document.createElement('canvas');
    let previewCtx = previewCanvas.getContext('2d');
    const inspectCanvas = document.getElementById('inspectCanvas');
    const inspectCtx = inspectCanvas.getContext('2d');
    let inspectorMode = null;

    // Mobile Tab Navigation Logic
    document.querySelectorAll('.m-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.m-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const tabKey = tab.dataset.tab;
        const leftSidebar = document.getElementById('section-presets');
        const rightSidebar = document.getElementById('section-right-controls');
        const mobileSections = document.querySelectorAll('.mobile-section');

        if (tabKey === 'presets') {
          leftSidebar.classList.add('mobile-active');
          rightSidebar.classList.remove('mobile-active');
        } else {
          leftSidebar.classList.remove('mobile-active');
          rightSidebar.classList.add('mobile-active');

          mobileSections.forEach(sec => {
            if (sec.dataset.mGroup === tabKey) {
              sec.classList.add('active-mobile-section');
            } else {
              sec.classList.remove('active-mobile-section');
            }
          });
        }
      });
    });

    // SVG Curve Setup & Touch Support
    const svg = document.getElementById('curveSvg');
    const p1El = document.getElementById('p1');
    const p2El = document.getElementById('p2');
    const curvePath = document.getElementById('curvePath');
    let activePoint = null;

    function updateCurveSvg() {
      curvePath.setAttribute('d', `M 0 120 C ${state.p1.x} ${state.p1.y}, ${state.p2.x} ${state.p2.y}, 200 0`);
      p1El.setAttribute('x', state.p1.x - 6);
      p1El.setAttribute('y', state.p1.y - 6);
      p2El.setAttribute('x', state.p2.x - 6);
      p2El.setAttribute('y', state.p2.y - 6);
      if (sourceImg) requestRender();
    }

    function getSvgCoords(clientX, clientY) {
      const rect = svg.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(200, (clientX - rect.left) * (200 / rect.width))),
        y: Math.max(0, Math.min(120, (clientY - rect.top) * (120 / rect.height)))
      };
    }

    [p1El, p2El].forEach((el, idx) => {
      el.addEventListener('mousedown', () => activePoint = idx === 0 ? state.p1 : state.p2);
      el.addEventListener('touchstart', (e) => {
        activePoint = idx === 0 ? state.p1 : state.p2;
        e.preventDefault();
      }, { passive: false });
    });

    window.addEventListener('mousemove', (e) => {
      if (!activePoint) return;
      const c = getSvgCoords(e.clientX, e.clientY);
      activePoint.x = c.x;
      activePoint.y = c.y;
      updateCurveSvg();
    });

    window.addEventListener('touchmove', (e) => {
      if (!activePoint) return;
      const touch = e.touches[0];
      const c = getSvgCoords(touch.clientX, touch.clientY);
      activePoint.x = c.x;
      activePoint.y = c.y;
      updateCurveSvg();
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('mouseup', () => activePoint = null);
    window.addEventListener('touchend', () => activePoint = null);

    // Presets List
    function renderPresetsList() {
      const container = document.getElementById('presetsList');
      container.innerHTML = '';

      filmDatabase.forEach(film => {
        if (state.activeFilter !== 'all' && film.type !== state.activeFilter) return;

        const row = document.createElement('div');
        row.className = `preset-row ${film.id === state.preset ? 'active' : ''}`;
        row.dataset.id = film.id;

        const tagLabel = film.type === 'color' ? 'ЦВЕТ' : film.type === 'aero' ? 'СПЕЦ' : 'Ч/Б';

        row.innerHTML = `
          <div class="preset-meta">
            <span class="preset-title">${film.name}</span>
            <span class="preset-tag">${tagLabel}</span>
          </div>
          <span class="preset-gost">${film.gost}</span>
        `;

        row.addEventListener('click', () => {
          document.querySelectorAll('.preset-row').forEach(r => r.classList.remove('active'));
          row.classList.add('active');
          selectPreset(film.id);
        });

        container.appendChild(row);
      });
    }

    function selectPreset(id) {
      state.preset = id;
      const film = filmDatabase.find(f => f.id === id);
      if (!film) return;

      document.getElementById('presetDesc').innerText = film.desc;
      document.getElementById('hudGost').innerText = film.gost;
      document.getElementById('hudRes').innerText = film.res;
      document.getElementById('hudDev').innerText = film.dev;
      playLabSound('rewind');

      const defText = `${film.name} :: ${film.gost} :: 24A`;
      state.frameText = defText;
      document.getElementById('paramFrameText').value = defText;

      if (sourceImg) requestRender();
    }

    document.querySelectorAll('.tab-item').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeFilter = btn.dataset.filter;
        renderPresetsList();
      });
    });

    function preparePreviewBuffer(maxDim = 900) {
      let scale = Math.min(1, maxDim / Math.max(sourceImg.width, sourceImg.height));
      let sw=sourceImg.width, sh=sourceImg.height, sx=0, sy=0;
      if (state.crop !== 'free') { const [a,b]=state.crop.split(':').map(Number), ratio=a/b, current=sw/sh; if(current>ratio){sw=Math.round(sh*ratio);sx=Math.round((sourceImg.width-sw)/2)}else{sh=Math.round(sw/ratio);sy=Math.round((sourceImg.height-sh)/2)} }
      const rot=Math.abs(state.rotation)%180===90;
      previewCanvas.width = Math.round((rot?sh:sw) * scale); previewCanvas.height = Math.round((rot?sw:sh) * scale);
      previewCtx.clearRect(0,0,previewCanvas.width,previewCanvas.height);previewCtx.save();previewCtx.translate(previewCanvas.width/2,previewCanvas.height/2);previewCtx.rotate(state.rotation*Math.PI/180);previewCtx.drawImage(sourceImg,sx,sy,sw,sh,-(sw*scale)/2,-(sh*scale)/2,sw*scale,sh*scale);previewCtx.restore();
      
      canvas.width = previewCanvas.width;
      canvas.height = previewCanvas.height;
      
      document.getElementById('uploadOverlay').classList.add('hidden');
      requestRender();
    }

    function requestRender() {
      if (!state.renderPending && sourceImg) {
        state.renderPending = true;
        requestAnimationFrame(renderFilmPipeline);
      }
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

    function applyLensDistortion(w, h) {
      if (state.distortion === 0) return;

      let tempCanvas = document.createElement('canvas');
      tempCanvas.width = w; tempCanvas.height = h;
      let tCtx = tempCanvas.getContext('2d');
      tCtx.drawImage(canvas, 0, 0);

      let srcData = tCtx.getImageData(0, 0, w, h);
      let dstData = ctx.createImageData(w, h);
      let src = srcData.data;
      let dst = dstData.data;

      let cx = w / 2;
      let cy = h / 2;
      let k = (state.distortion / 50) * 0.0000004;
      let normCoeff = Math.sqrt(cx * cx + cy * cy);

      for (let y = 0; y < h; y++) {
        let dy = y - cy;
        for (let x = 0; x < w; x++) {
          let dx = x - cx;
          let r2 = dx * dx + dy * dy;
          let factor = 1 + k * r2;

          let sx = Math.round(cx + dx * factor);
          let sy = Math.round(cy + dy * factor);

          let dstIdx = (y * w + x) * 4;

          if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
            let srcIdx = (sy * w + sx) * 4;
            dst[dstIdx]     = src[srcIdx];
            dst[dstIdx + 1] = src[srcIdx + 1];
            dst[dstIdx + 2] = src[srcIdx + 2];
            dst[dstIdx + 3] = src[srcIdx + 3];
          } else {
            dst[dstIdx] = dst[dstIdx + 1] = dst[dstIdx + 2] = 0;
            dst[dstIdx + 3] = 255;
          }
        }
      }
      ctx.putImageData(dstData, 0, 0);
    }

    function renderFilmPipeline() {
      state.renderPending = false;
      if (!previewCanvas.width) return;

      const w = previewCanvas.width;
      const h = previewCanvas.height;
      
      ctx.drawImage(previewCanvas, 0, 0);

      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      const curveLut = buildCurveLUT();

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
      const grainVal = (state.grain + pushGrainBonus) * 0.6 * devGrainMult;
      const grainScale = state.grainSize / 10;
      const fadeVal = (state.fade / 50) * 35;
      const age = (2026 - state.foundYear) / 46;
      const ageFog = age * 42;
      const p = state.preset;

      const fR = 1 + (state.filterR / 50);
      const fG = 1 + (state.filterG / 50);
      const fB = 1 + (state.filterB / 50);
      const grainSeed = state.grainLock ? state.grainSeed : Math.floor(performance.now() / 250);

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i] * expFactor * fR;
        let g = data[i+1] * expFactor * fG;
        let b = data[i+2] * expFactor * fB;

        if (p === 'aerochrome') {
          let origR = r, origG = g, origB = b;
          r = origG * 1.8 + origR * 0.4;
          g = origR * 0.7;
          b = origB * 0.6;
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

        if (p.startsWith('svema') && !p.includes('cv') && !p.includes('co') || p.startsWith('tasma') && p !== 'tasmacnb' && p !== 'tasmai810' || p === 'foto65' || p.startsWith('mikrat') || p.startsWith('foma') || p.startsWith('retro') || p.startsWith('adox')) {
          let gray = 0.299 * r + 0.587 * g + 0.114 * b;
          if (p === 'mikrat200') gray = gray > 115 ? 245 : 15;
          r = g = b = gray;
        } else if (p === 'tasmai810') {
          let irGray = 0.6 * r + 0.3 * g + 0.1 * b;
          r = g = b = Math.min(255, irGray * 1.35);
        } else if (p === 'sovcolor' || p === 'co32d') {
          r = r * 1.05 + 8; b = b * 0.85 + 18;
        } else if (p === 'ds5m' || p === 'orwo19' || p === 'orwout15') {
          r = r * 0.95 + 12; g = g * 1.02; b = b * 0.88 + 8;
        } else if (p === 'svemacv32' || p === 'sovds2') {
          r = r * 1.1 + 14; g = g * 0.95 + 5; b = b * 0.82;
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

        // Краткая засветка в проявителе: частично обращает только света.
        if (state.sabattier > 0) {
          const solar = state.sabattier / 100;
          const sLum = 0.299 * r + 0.587 * g + 0.114 * b;
          const weight = Math.max(0, (sLum - 145) / 110) * solar;
          r = r * (1 - weight) + (255 - r) * weight;
          g = g * (1 - weight) + (255 - g) * weight;
          b = b * (1 - weight) + (255 - b) * weight;
        }

        // Старая кассета: вуаль, потеря чувствительности и вымывание красителя.
        if (age > 0) {
          const agedLum = 0.299 * r + 0.587 * g + 0.114 * b;
          r = r * (1 - age * .28) + agedLum * age * .20 + ageFog;
          g = g * (1 - age * .22) + agedLum * age * .18 + ageFog;
          b = b * (1 - age * .38) + agedLum * age * .25 + ageFog;
        }

        if (!p.includes('bw') && p !== 'tasmai810' && !p.startsWith('svema64') && !p.startsWith('svema125') && !p.startsWith('svema250') && !p.startsWith('tasma25') && !p.startsWith('tasma100') && p !== 'foto65' && !p.startsWith('mikrat') && !p.startsWith('foma') && !p.startsWith('retro') && !p.startsWith('adox')) {
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

        if (state.halation > 0 && (r + g + b) > 480) {
          r += state.halation * 0.45;
          g += state.halation * 0.08;
        }

        if (grainVal > 0) {
          let pixelIndex = Math.floor((i / 4) / grainScale);
          let hash = (pixelIndex + grainSeed) | 0;
          hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
          hash = Math.imul(hash ^ (hash >>> 13), 3266489909) ^ (hash >>> 16);
          const noise = ((hash >>> 0) / 4294967295) * grainVal - (grainVal / 2);
          r += noise; g += noise; b += noise;
        }

        if (state.dust > 0 && Math.random() < (state.dust / 8000)) {
          let scratch = Math.random() > 0.5 ? 255 : 0;
          r = g = b = scratch;
        }

        data[i]     = Math.min(255, Math.max(0, r));
        data[i + 1] = Math.min(255, Math.max(0, g));
        data[i + 2] = Math.min(255, Math.max(0, b));
      }

      ctx.putImageData(imgData, 0, 0);

      renderChemicalArtifacts(w, h, age);

      // 1. Применение Дисторсии Объектива
      if (state.distortion !== 0) {
        applyLensDistortion(w, h);
      }

      // 2. Хроматические аберрации
      if (state.chroma > 0) {
        let shift = Math.round(state.chroma);
        let tempCanvas = document.createElement('canvas');
        tempCanvas.width = w; tempCanvas.height = h;
        let tCtx = tempCanvas.getContext('2d');
        tCtx.drawImage(canvas, 0, 0);

        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(tempCanvas, -shift, 0);
        ctx.globalCompositeOperation = 'source-over';
      }

      // 3. Свечение / Блум (Bloom)
      if (state.bloom > 0) {
        let glowCanvas = document.createElement('canvas');
        glowCanvas.width = Math.max(10, Math.round(w / 2)); 
        glowCanvas.height = Math.max(10, Math.round(h / 2));
        let gCtx = glowCanvas.getContext('2d');
        gCtx.filter = `blur(${Math.max(1, Math.round(state.bloom / 8))}px)`;
        gCtx.drawImage(canvas, 0, 0, glowCanvas.width, glowCanvas.height);

        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = state.bloom / 100;
        ctx.drawImage(glowCanvas, 0, 0, w, h);
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
      }

      // 4. Засветки
      if (state.leak > 0) {
        let lGrad = ctx.createRadialGradient(w, 0, 10, w, 0, Math.max(w, h) * 0.8);
        lGrad.addColorStop(0, `rgba(255, 90, 20, ${state.leak / 100})`);
        lGrad.addColorStop(0.5, `rgba(255, 40, 0, ${(state.leak / 100) * 0.4})`);
        lGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = lGrad;
        ctx.fillRect(0, 0, w, h);
      }

      // 5. Виньетирование
      if (state.vignette > 0) {
        const radGrad = ctx.createRadialGradient(w/2, h/2, Math.min(w,h) * 0.3, w/2, h/2, Math.max(w,h) * 0.75);
        radGrad.addColorStop(0, 'rgba(0,0,0,0)');
        radGrad.addColorStop(1, `rgba(0,0,0,${state.vignette / 100})`);
        ctx.fillStyle = radGrad;
        ctx.fillRect(0, 0, w, h);
      }

      if (state.frame !== 'none' || state.frameFormat !== '35') {
        renderFilmFrame(w, h);
      }

      if (state.imprint) {
        renderLabImprint(w, h);
      }
    }

    function renderChemicalArtifacts(w, h, age) {
      // Вертикальные следы бромида, идущие от перфорации.
      if (state.bromide > 0) {
        ctx.save(); ctx.globalAlpha = state.bromide / 240;
        for (let x = 0; x < w; x += Math.max(18, Math.round(w / 18))) {
          const drift = Math.sin(x * 1.73) * 4;
          const g = ctx.createLinearGradient(x + drift, 0, x + drift + 5, h);
          g.addColorStop(0, 'rgba(230,230,210,.95)'); g.addColorStop(.15, 'rgba(35,28,20,.34)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g; ctx.fillRect(x + drift, 0, 5, h);
        } ctx.restore();
      }
      // Растрескивание желатины и точки коррозии старой эмульсии.
      if (state.reticulation > 0 || age > 0) {
        ctx.save();
        ctx.globalAlpha = state.reticulation / 260 + age / 12;
        ctx.strokeStyle = '#070707'; ctx.lineWidth = Math.max(1, state.reticulation / 42);
        const count = Math.round((state.reticulation / 100) * 70 + age * 45);
        for (let n = 0; n < count; n++) {
          const x = (Math.sin(n * 91.7) * .5 + .5) * w, y = (Math.sin(n * 47.3) * .5 + .5) * h;
          ctx.beginPath(); ctx.moveTo(x, y);
          ctx.lineTo(x + Math.sin(n * 13) * (8 + state.reticulation / 2), y + Math.cos(n * 17) * (8 + state.reticulation / 2)); ctx.stroke();
          if (age > .25) { ctx.fillStyle = 'rgba(245,205,130,.5)'; ctx.fillRect(x, y, 1 + age * 4, 1 + age * 4); }
        } ctx.restore();
      }
    }

    function renderFilmFrame(w, h) {
      if (state.frameFormat === 'anamorphic') {
        const target = 2.39, current = w / h, crop = current > target ? (w - h * target) / 2 : 0;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, crop, h); ctx.fillRect(w - crop, 0, crop, h);
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .38;
        const flare = ctx.createLinearGradient(0, h*.48, w, h*.52); flare.addColorStop(0,'rgba(0,0,0,0)'); flare.addColorStop(.46,'rgba(40,140,255,.7)'); flare.addColorStop(.54,'rgba(255,170,60,.7)'); flare.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=flare;ctx.fillRect(0,h*.47,w,h*.06);ctx.restore(); return;
      }
      if (state.frameFormat === '6x6' || state.frameFormat === '6x7' || state.frameFormat === '4x5') {
        const m = Math.round(Math.min(w,h)*.06); ctx.fillStyle='#080808'; ctx.fillRect(0,0,w,m);ctx.fillRect(0,h-m,w,m);ctx.fillRect(0,0,m,h);ctx.fillRect(w-m,0,m,h);
        if (state.frameFormat === '4x5') { ctx.fillStyle='#000'; const c=m*1.6; [[0,0],[w-c,0],[0,h-c],[w-c,h-c]].forEach(([x,y])=>{ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+c,y);ctx.lineTo(x,y+c);ctx.fill();}); }
        ctx.font=`${Math.round(m*.42)}px 'JetBrains Mono', monospace`;ctx.fillStyle='#aaa';ctx.fillText(state.frameFormat.toUpperCase()+' • ROLLFILM',m*1.4,m*.72); return;
      }
      render35mmFrame(w, h);
    }

    function render35mmFrame(w, h) {
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
      ctx.fillText(`${state.frameText} :: ${state.frameNumber}`, Math.round(w * 0.15), Math.round(margin * 0.65));
      ctx.fillText("SAFETY FILM", Math.round(w * 0.7), h - Math.round(margin * 0.35));
    }

    function renderLabImprint(w, h) {
      let imprintText = state.imprintText;
      if (!imprintText || imprintText.trim() === '') {
        const film = filmDatabase.find(f => f.id === state.preset);
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

    // Upload Triggers
    document.getElementById('btnCenterUpload').addEventListener('click', () => {
      document.getElementById('fileUploader').click();
    });
    document.getElementById('btnHeaderUpload').addEventListener('click', () => {
      document.getElementById('fileUploader').click();
    });

    document.getElementById('fileUploader').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const img = new Image();
      img.onload = () => {
        sourceImg = img;
        preparePreviewBuffer();
        playLabSound('shutter');
      };
      img.src = URL.createObjectURL(file);
    });

    const bindSlider = (id, key, formatFn) => {
      const el = document.getElementById(id);
      if(!el) return;
      el.addEventListener('input', (e) => {
        state[key] = parseFloat(e.target.value);
        const valElem = document.getElementById('val' + key.charAt(0).toUpperCase() + key.slice(1));
        if (valElem) valElem.innerText = formatFn(state[key]);
        requestRender();
      });
    };

    bindSlider('paramPush', 'pushPull', v => v === 0 ? 'NORMAL' : v > 0 ? `PUSH +${v}` : `PULL ${v}`);
    bindSlider('paramDyeFade', 'dyeFade', v => `${v}%`);
    bindSlider('paramExp', 'exp', v => (v / 50).toFixed(1));
    bindSlider('paramContrast', 'contrast', v => v > 0 ? `+${v}` : v);
    bindSlider('paramHighlights', 'highlights', v => v > 0 ? `+${v}` : v);
    bindSlider('paramShadows', 'shadows', v => v > 0 ? `+${v}` : v);
    bindSlider('paramFade', 'fade', v => `${v}%`);
    bindSlider('paramGrain', 'grain', v => `${v}%`);
    bindSlider('paramGrainSize', 'grainSize', v => `${(v/10).toFixed(1)}x`);
    bindSlider('paramFilterR', 'filterR', v => v > 0 ? `+${v}` : v);
    bindSlider('paramFilterG', 'filterG', v => v > 0 ? `+${v}` : v);
    bindSlider('paramFilterB', 'filterB', v => v > 0 ? `+${v}` : v);
    bindSlider('paramTemp', 'temp', v => v > 0 ? `+${v}` : v);
    bindSlider('paramSat', 'sat', v => `${v}%`);
    bindSlider('paramSplitShadow', 'splitShadow', v => `${v}%`);
    bindSlider('paramDistortion', 'distortion', v => v > 0 ? `+${v}` : v);
    bindSlider('paramChroma', 'chroma', v => `+${v}`);
    bindSlider('paramBloom', 'bloom', v => `${v}%`);
    bindSlider('paramHalation', 'halation', v => `${v}%`);
    bindSlider('paramVignette', 'vignette', v => `${v}%`);
    bindSlider('paramLeak', 'leak', v => `${v}%`);
    bindSlider('paramDust', 'dust', v => `${v}%`);
    bindSlider('paramSabattier', 'sabattier', v => `${v}%`);
    bindSlider('paramReticulation', 'reticulation', v => `${v}%`);
    bindSlider('paramBromide', 'bromide', v => `${v}%`);
    bindSlider('paramFoundYear', 'foundYear', v => `${v}`);
    document.getElementById('paramFoundYear').addEventListener('input', () => {
      const film = filmDatabase.find(f => f.id === state.preset);
      const iso = (film && (film.gost.match(/\d+/) || [100]))[0];
      const effective = Math.max(1, Math.round(iso * (1 - (2026 - state.foundYear) / 70)));
      document.getElementById('hudGost').innerText = `ISO ${effective} (ном. ${iso})`;
    });

    document.getElementById('paramDevType').addEventListener('change', (e) => { state.devType = e.target.value; requestRender(); });
    document.getElementById('paramPaper').addEventListener('change', (e) => { state.paper = e.target.value; requestRender(); });
    document.getElementById('paramToner').addEventListener('change', (e) => { state.toner = e.target.value; requestRender(); });
    document.getElementById('paramFrame').addEventListener('change', (e) => { state.frame = e.target.value; requestRender(); });
    document.getElementById('paramFrameText').addEventListener('input', (e) => { state.frameText = e.target.value; requestRender(); });
    document.getElementById('paramImprintText').addEventListener('input', (e) => { state.imprintText = e.target.value; requestRender(); });
    document.getElementById('paramImprint').addEventListener('change', (e) => { state.imprint = e.target.checked; requestRender(); });
    document.getElementById('paramFrameFormat').addEventListener('change', (e) => { state.frameFormat = e.target.value; requestRender(); });
    document.getElementById('paramCrop').addEventListener('change', e=>{state.crop=e.target.value;preparePreviewBuffer();});
    bindSlider('paramRotation','rotation',v=>`${v}°`);
    document.getElementById('paramRotation').addEventListener('change',()=>preparePreviewBuffer());
    document.getElementById('paramGrainLock').addEventListener('change',e=>{state.grainLock=e.target.checked;state.grainSeed=Math.random()*99999;requestRender();});
    document.getElementById('paramFrameNumber').addEventListener('input',e=>{state.frameNumber=e.target.value;requestRender();});
    document.getElementById('paramCondition').addEventListener('change',e=>{state.condition=e.target.value;const p={fresh:[2026,0,0],drawer:[1997,16,18],attic:[1985,40,50],camera:[1991,25,35]}[e.target.value];state.foundYear=p[0];state.dyeFade=p[1];state.dust=p[2];['FoundYear','DyeFade','Dust'].forEach((n,i)=>{const el=document.getElementById('param'+n);el.value=p[i];el.dispatchEvent(new Event('input'));});});
    document.getElementById('paramRecipe').addEventListener('change',e=>{state.recipe=e.target.value;const r={d76:['st2',0,0,30],rodinal:['rodinal',1,12,55],stand:['rodinal',-1,-12,42]}[e.target.value];if(!r)return;state.devType=r[0];document.getElementById('paramDevType').value=r[0];['Push','Contrast','Grain'].forEach((n,i)=>{const el=document.getElementById('param'+n);el.value=r[i+1];el.dispatchEvent(new Event('input'));});});
    function playLabSound() {} // звук убран из интерфейса, вызовы сохранены для совместимости.
    function saveHistory(){if(!sourceImg)return;state.history.unshift(canvas.toDataURL('image/jpeg',.45));state.history=state.history.slice(0,6);}
    document.getElementById('btnHistory').addEventListener('click',()=>{if(!state.history.length)saveHistory();const win=window.open('','history','width=760,height=500');if(win)win.document.write(`<body style="margin:0;background:#111;color:#fff;font:12px monospace;padding:16px"><h3>ИСТОРИЯ РЕНДЕРОВ</h3>${state.history.map((s,i)=>`<img title="Версия ${i+1}" src="${s}" style="width:30%;margin:1%;border:1px solid #555">`).join('')}</body>`);});
    let showOriginal=false;document.getElementById('btnAB').addEventListener('pointerdown',()=>{if(!sourceImg)return;showOriginal=true;ctx.drawImage(previewCanvas,0,0);});document.getElementById('btnAB').addEventListener('pointerup',()=>{showOriginal=false;requestRender();});document.getElementById('btnAB').addEventListener('pointerleave',()=>{if(showOriginal){showOriginal=false;requestRender();}});
    function updateInspector(e) {
      if (!sourceImg || !inspectorMode) return;
      const rect=canvas.getBoundingClientRect(), x=Math.max(0,Math.min(canvas.width-1,Math.round((e.clientX-rect.left)*canvas.width/rect.width))), y=Math.max(0,Math.min(canvas.height-1,Math.round((e.clientY-rect.top)*canvas.height/rect.height)));
      const scale=inspectorMode==='focus'?4:1, sw=Math.max(1,Math.round(50/scale)), sh=Math.max(1,Math.round(32/scale)); inspectCtx.imageSmoothingEnabled=false;inspectCtx.drawImage(canvas,x-sw/2,y-sh/2,sw,sh,0,0,202,130);
      const px=ctx.getImageData(x,y,1,1).data,T=Math.max(.001,(px[0]+px[1]+px[2])/765),D=Math.log10(1/T),zone=D>.25&&D<1.25?'ЛИНЕЙНЫЙ УЧАСТОК':D<=.25?'toe / тени':'shoulder / света';
      document.getElementById('inspectMeta').innerHTML=`<b>${inspectorMode==='focus'?'ФОКУС-СКОП 400%':'ПИПЕТКА-ДЕНСИТОМЕТР'}</b><br>RGB ${px[0]} / ${px[1]} / ${px[2]} · D = ${D.toFixed(2)}<br><b>${zone}</b>`;
    }
    function toggleInspector(mode) { inspectorMode=inspectorMode===mode?null:mode;document.getElementById('inspectOverlay').classList.toggle('visible',!!inspectorMode); }
    document.getElementById('btnDensitometer')?.addEventListener('click',()=>toggleInspector('dens'));
    document.getElementById('btnFocusScope')?.addEventListener('click',()=>toggleInspector('focus'));
    canvas.addEventListener('pointermove',updateInspector);
    async function makeContactSheet(files) {
      const chosen=[...files].slice(0,12);if(!chosen.length)return;const sheet=document.createElement('canvas');sheet.width=2400;sheet.height=3000;const sc=sheet.getContext('2d');sc.fillStyle='#f1eee5';sc.fillRect(0,0,2400,3000);const cols=3,rows=Math.ceil(chosen.length/cols),pad=110,cw=(2400-pad*(cols+1))/cols,ch=(3000-pad*(rows+1))/rows;
      await Promise.all(chosen.map((f,i)=>new Promise(ok=>{const im=new Image();im.onload=()=>{const x=pad+(i%cols)*(cw+pad),y=pad+Math.floor(i/cols)*(ch+pad),s=Math.min((cw-36)/im.width,(ch-90)/im.height);sc.fillStyle='#090909';sc.fillRect(x,y,cw,ch);sc.drawImage(im,x+(cw-im.width*s)/2,y+22,im.width*s,im.height*s);sc.fillStyle='#eee';for(let q=x+18;q<x+cw;q+=50){sc.fillRect(q,y+5,28,12);sc.fillRect(q,y+ch-17,28,12)}sc.fillStyle='#222';sc.font='bold 25px monospace';sc.fillText(String(i+1).padStart(2,'0')+'  SVEMA LAB',x,y+ch+35);URL.revokeObjectURL(im.src);ok();};im.src=URL.createObjectURL(f)})));
      const a=document.createElement('a');a.download='SvemaLab_contact-sheet_24x30.png';a.href=sheet.toDataURL('image/png');a.click();
    }
    document.getElementById('btnContact')?.addEventListener('click',()=>document.getElementById('contactUploader')?.click());
    document.getElementById('contactUploader')?.addEventListener('change',e=>makeContactSheet(e.target.files));
    // Небольшой самодостаточный GIF89a: 3 кадра с дрейфом и новым зерном.
    function gifLzw(indices) {
      const clear=256,eoi=257;let codeSize=9,next=258,dict=new Map(),out=[],bits=0,n=0;
      const put=c=>{bits|=c<<n;n+=codeSize;while(n>=8){out.push(bits&255);bits>>=8;n-=8;}}; put(clear);let phrase=String.fromCharCode(indices[0]);
      for(let i=1;i<indices.length;i++){const ch=String.fromCharCode(indices[i]),key=phrase+ch;if(dict.has(key))phrase=key;else{put(phrase.length===1?phrase.charCodeAt(0):dict.get(phrase));dict.set(key,next++);if(next===(1<<codeSize)&&codeSize<12)codeSize++;if(next>=4095){put(clear);dict=new Map();codeSize=9;next=258;}phrase=ch;}}
      put(phrase.length===1?phrase.charCodeAt(0):dict.get(phrase));put(eoi);if(n)out.push(bits&255);return out;
    }
    function makeLiveGrainGif() {
      if(!sourceImg)return; const w=Math.min(320,canvas.width),h=Math.round(canvas.height*w/canvas.width),bytes=[];const push=s=>{for(let i=0;i<s.length;i++)bytes.push(s.charCodeAt(i))},word=v=>bytes.push(v&255,v>>8),frame=document.createElement('canvas');frame.width=w;frame.height=h;const fc=frame.getContext('2d');push('GIF89a');word(w);word(h);bytes.push(247,0,0);for(let i=0;i<256;i++)bytes.push(i,i,i);push('!\xFF\x0BNETSCAPE2.0\x03\x01\x00\x00\x00');
      for(let k=0;k<3;k++){fc.drawImage(canvas,k-1,0,w,h);let d=fc.getImageData(0,0,w,h),idx=new Uint8Array(w*h);for(let i=0,p=0;i<d.data.length;i+=4,p++){let n=(Math.random()-.5)*12;idx[p]=Math.max(0,Math.min(255,Math.round(.299*d.data[i]+.587*d.data[i+1]+.114*d.data[i+2]+n)));}push('!\xF9\x04\x04\x08\x00\x00\x00\x00');bytes.push(44);word(0);word(0);word(w);word(h);bytes.push(0,8);const lzw=gifLzw(idx);for(let q=0;q<lzw.length;q+=255){bytes.push(Math.min(255,lzw.length-q),...lzw.slice(q,q+255));}bytes.push(0);}bytes.push(59);const a=document.createElement('a');a.download='SvemaLab_live-grain.gif';a.href=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'image/gif'}));a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    }
    document.getElementById('btnGif')?.addEventListener('click',makeLiveGrainGif);

    // Reset All
    document.getElementById('btnReset').addEventListener('click', () => {
      state = { ...defaultState, history: [] };
      document.querySelectorAll('input[type="range"]').forEach(input => {
        const key = input.id.replace('param', '');
        const lowerKey = key.charAt(0).toLowerCase() + key.slice(1);
        if (state[lowerKey] !== undefined) {
          input.value = state[lowerKey];
          input.dispatchEvent(new Event('input'));
        }
      });
      document.getElementById('paramDevType').value = 'st2';
      document.getElementById('paramPaper').value = 'rc';
      document.getElementById('paramToner').value = 'none';
      document.getElementById('paramFrame').value = 'none';
      document.getElementById('paramFrameFormat').value = '35';
      document.getElementById('paramCondition').value = 'fresh';
      document.getElementById('paramCrop').value = 'free';
      document.getElementById('paramRotation').value = 0;
      document.getElementById('paramRecipe').value = 'manual';
      document.getElementById('paramGrainLock').checked = false;
      document.getElementById('paramFrameNumber').value = state.frameNumber;
      document.getElementById('paramFrameText').value = state.frameText;
      document.getElementById('paramImprint').checked = false;
      document.getElementById('paramImprintText').value = '';
      updateCurveSvg();
    });

    // Export PNG
    document.getElementById('btnExport').addEventListener('click', () => {
      if (!sourceImg) return;
      preparePreviewBuffer(Infinity);
      renderFilmPipeline();
      saveHistory();
      const link = document.createElement('a');
      link.download = `SvemaLab_Mobile_${state.preset}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      preparePreviewBuffer();
    });

    // Initialization
    renderPresetsList();
    selectPreset('svema64');
    updateCurveSvg();
  
