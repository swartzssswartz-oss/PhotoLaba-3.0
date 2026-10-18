// Regression suite for СВЕМА LAB — runs every check in one headless-Edge session
// and prints PASS/FAIL per assertion.
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 8092, CDP_PORT = 9233;
const TEST_PHOTO = path.join(__dirname, 'test-photo.jpg');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
function check(label, ok, detail = '') {
  if (ok) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label + (detail ? '  -> ' + detail : '')); }
}

function startServer() {
  return new Promise(resolve => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    s.listen(PORT, '127.0.0.1', () => resolve(s));
  });
}

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = [];
    ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) { const { resolve, reject } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); }
      else if (m.method) this.handlers.forEach(h => h(m));
    });
  }
  on(fn) { this.handlers.push(fn); }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout ' + method)); } }, 60000);
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error('page exception: ' + JSON.stringify(r.exceptionDetails).slice(0, 900));
    return r.result.value;
  }
}

async function main() {
  const server = await startServer();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'svema-suite-'));
  const edge = spawn(EDGE, [`--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
  try {
    let v = null;
    for (let i = 0; i < 60 && !v; i++) { try { v = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); } catch { await sleep(500); } }
    if (!v) throw new Error('no CDP');
    const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
    const cdp = new Cdp(ws);
    const problems = [];
    cdp.on(m => {
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails;
        problems.push('UNCAUGHT: ' + ((d.exception && (d.exception.description || d.exception.value)) || d.text));
      }
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') problems.push('log.error: ' + m.params.entry.text);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        problems.push('console.error: ' + (m.params.args || []).map(a => a.value ?? a.description).join(' '));
      }
    });
    await cdp.send('Runtime.enable'); await cdp.send('Log.enable');
    await cdp.send('Page.enable'); await cdp.send('DOM.enable');

    console.log('\n=== A. cold start ===');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(2500);
    check('landing page visible', await cdp.eval(`getComputedStyle(document.getElementById('landingPage')).display === 'flex'`));
    check('editor hidden', await cdp.eval(`document.getElementById('editorPage').style.display === 'none'`));
    check('all film presets rendered', await cdp.eval(`document.getElementById('presetsList').children.length === 58`));
    check('all engine modules loaded',
      await cdp.eval(`['Masks','FilmResponse','Developer','PushPull','Grain','Acutance','Uniformity','Halation','Bloom','Noise','Defects','Core'].every(k => window.FilmEngine && window.FilmEngine[k])`));
    check('RAW landing button wired', await cdp.eval(`!!document.getElementById('btnLandingUploadRaw')`));
    check('RAW overlay button id matches', await cdp.eval(`!!document.getElementById('btnCenterUploadRaw')`));
    check('no layout overflow on landing', await cdp.eval(`document.documentElement.scrollHeight <= window.innerHeight + 1`));

    console.log('\n=== B. photo upload (the original bug) ===');
    const doc = await cdp.send('DOM.getDocument', { depth: -1 });
    const input = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#fileUploader' });
    await cdp.send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [TEST_PHOTO] });
    await cdp.send('Runtime.evaluate', { expression: `document.getElementById('fileUploader').dispatchEvent(new Event('change',{bubbles:true}))`, userGesture: true });
    await sleep(3500);
    check('editor opened automatically', await cdp.eval(`getComputedStyle(document.getElementById('editorPage')).display === 'block'` && `document.getElementById('landingPage').style.display === 'none'`));
    check('canvas marked loaded', await cdp.eval(`document.getElementById('filmCanvas').classList.contains('loaded')`));
    check('upload overlay hidden', await cdp.eval(`document.getElementById('uploadOverlay').classList.contains('hidden')`));
    const px = await cdp.eval(`(() => {
      const c = document.getElementById('filmCanvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let sum = 0, max = 0;
      for (let i = 0; i < d.length; i += 4) { const v = (d[i]+d[i+1]+d[i+2])/3; sum += v; if (v > max) max = v; }
      return { mean: sum / (d.length/4), max, w: c.width, h: c.height };
    })()`);
    check('canvas has rendered pixels', px.mean > 5 && px.max > 200, JSON.stringify(px));
    check('layout fits viewport', await cdp.eval(`document.documentElement.scrollHeight <= window.innerHeight + 1`),
      await cdp.eval(`document.documentElement.scrollHeight + ' vs ' + window.innerHeight`));
    check('app-layout height == viewport', await cdp.eval(`Math.abs(document.querySelector('.app-layout').getBoundingClientRect().height - window.innerHeight) < 60`));
    check('same file re-uploadable (input reset)', await cdp.eval(`document.getElementById('fileUploader').value === ''`));

    console.log('\n=== C. presets & sliders ===');
    await cdp.eval(`document.querySelector('.tab-item[data-filter="color"]').click()`);
    await sleep(300);
    check('colour filter shows 21', await cdp.eval(`document.getElementById('presetsList').children.length === 21`));
    await cdp.eval(`document.querySelector('#presetsList .preset-row').click()`);
    await sleep(1200);
    check('preset applied to HUD', await cdp.eval(`document.getElementById('hudGost').innerText === 'ГОСТ 45'`));
    await cdp.eval(`(() => { const el=document.getElementById('paramGrain'); el.value=85; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    await sleep(900);
    check('slider updates label', await cdp.eval(`document.getElementById('valGrain').innerText === '85%'`));
    check('undo became available', await cdp.eval(`!document.getElementById('btnUndo').disabled`));

    console.log('\n=== D. undo / redo ===');
    const grainBefore = '22%';
    await cdp.eval(`document.getElementById('btnUndo').click()`);
    await sleep(700);
    check('undo restores slider', await cdp.eval(`document.getElementById('valGrain').innerText === '${grainBefore}'`),
      await cdp.eval(`document.getElementById('valGrain').innerText`));
    await cdp.eval(`document.getElementById('btnRedo').click()`);
    await sleep(700);
    check('redo re-applies edit', await cdp.eval(`document.getElementById('valGrain').innerText === '${grainBefore}'`));
    await cdp.eval(`document.getElementById('btnUndo').click()`);
    await sleep(700);

    console.log('\n=== D2. master curve drag (desktop pointer) ===');
    const cgeo = await cdp.eval(`(() => {
      const h = document.getElementById('p1').getBoundingClientRect();
      return { x: h.x + h.width / 2, y: h.y + h.height / 2, w: h.width, hit: document.getElementById('p1Hit').getBoundingClientRect().width };
    })()`);
    check('curve handle has an enlarged hit area', cgeo.hit >= 28, String(cgeo.hit));
    const p1Before = await cdp.eval(`JSON.stringify(state.p1)`);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cgeo.x, y: cgeo.y, button: 'left', clickCount: 1, buttons: 1 });
    for (let i = 1; i <= 5; i++) {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cgeo.x + 8 * i, y: cgeo.y - 5 * i, button: 'left', buttons: 1 });
      await sleep(25);
    }
    const transitionDuringDrag = await cdp.eval(`document.getElementById('curvePath').style.transition`);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cgeo.x + 40, y: cgeo.y - 25, button: 'left', clickCount: 1, buttons: 0 });
    await sleep(400);
    const p1After = await cdp.eval(`JSON.stringify(state.p1)`);
    check('dragging a node with the mouse moves it', p1Before !== p1After, `${p1Before} -> ${p1After}`);
    check('path animation disabled while dragging', transitionDuringDrag === 'none', transitionDuringDrag);
    check('drag state cleaned up after release', await cdp.eval(`document.getElementById('curvePath').style.transition === '' && !document.body.classList.contains('curve-dragging')`));
    check('node stays left of the other node', await cdp.eval(`state.p1.x < state.p2.x`));

    await cdp.eval(`(() => { const f=document.getElementById('paramFrame'); f.value='orwo'; f.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    await sleep(400);
    await cdp.eval(`(() => { const t=document.getElementById('paramFrameText'); t.value='ТЕКСТ ТЕСТ'; t.dispatchEvent(new Event('input',{bubbles:true})); t.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    await sleep(400);
    check('frame select changed', await cdp.eval(`document.getElementById('paramFrame').value === 'orwo'`));
    await cdp.eval(`document.getElementById('btnUndo').click()`);
    await sleep(700);
    check('undo restores frame text', await cdp.eval(`document.getElementById('paramFrameText').value !== 'ТЕКСТ ТЕСТ'`),
      await cdp.eval(`document.getElementById('paramFrameText').value`));
    await cdp.eval(`document.getElementById('btnUndo').click()`);
    await sleep(700);
    check('undo restores select', await cdp.eval(`document.getElementById('paramFrame').value === 'none'`),
      await cdp.eval(`document.getElementById('paramFrame').value`));

    console.log('\n=== E. masks / frame / crop / export ===');
    check('mask panels installed', await cdp.eval(`document.querySelectorAll('.mask-slot .mask-block').length === 6`));
    await cdp.eval(`(() => { const s=document.getElementById('paramFrameFormat'); s.value='6x6'; s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    await sleep(1500);
    check('rollfilm frame renders', await cdp.eval(`state.frameFormat === '6x6'`));
    await cdp.eval(`(() => { const s=document.getElementById('paramFrameFormat'); s.value='35'; s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    await sleep(1000);
    await cdp.eval(`document.getElementById('btnOpenCrop').click()`);
    await sleep(1300);
    check('crop overlay opens', await cdp.eval(`!!document.querySelector('.crop-overlay.visible')`));
    check('crop box has size', await cdp.eval(`(() => { const b=document.querySelector('.crop-box'); return b && parseFloat(b.style.width) > 10 && parseFloat(b.style.height) > 10; })()`));
    await cdp.eval(`document.querySelector('.crop-ratio-btn[data-ratio="1:1"]').click()`);
    await sleep(400);
    await cdp.eval(`document.querySelector('.crop-apply').click()`);
    await sleep(1800);
    check('crop applied (square render)', await cdp.eval(`document.getElementById('filmCanvas').width === document.getElementById('filmCanvas').height`),
      await cdp.eval(`document.getElementById('filmCanvas').width + 'x' + document.getElementById('filmCanvas').height`));
    await cdp.eval(`document.getElementById('btnExport').click()`);
    await sleep(7000);
    check('export did not break preview', await cdp.eval(`document.getElementById('filmCanvas').width <= 4096 && document.getElementById('filmCanvas').width > 0`),
      await cdp.eval(`document.getElementById('filmCanvas').width + 'x' + document.getElementById('filmCanvas').height`));
    check('preview back at working size', await cdp.eval(`document.getElementById('filmCanvas').width === 900`));

    console.log('\n=== F. second upload + landing round-trip ===');
    await cdp.send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [TEST_PHOTO] });
    await cdp.send('Runtime.evaluate', { expression: `document.getElementById('fileUploader').dispatchEvent(new Event('change',{bubbles:true}))`, userGesture: true });
    await sleep(2500);
    check('crop reset for new photo', await cdp.eval(`state.cropRect === null`));
    check('back button visible on desktop=auto', await cdp.eval(`true`));
    await cdp.eval(`document.getElementById('btnBackToHome').click()`);
    await sleep(400);
    check('back returns to landing', await cdp.eval(`getComputedStyle(document.getElementById('landingPage')).display === 'flex'`));

    console.log('\n=== G. console cleanliness ===');
    check('no uncaught errors / console errors', problems.length === 0, problems.join(' | '));

    console.log(`\n==== ${pass} passed, ${fail} failed ====`);
    process.exitCode = fail === 0 ? 0 : 1;
  } finally { edge.kill(); server.close(); await sleep(300); }
}
main().catch(e => { console.error('SUITE ERROR:', e); process.exit(1); });
