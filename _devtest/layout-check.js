// Layout diagnostic: measures the real geometry of the editor after a photo load
// and dumps a screenshot, to verify the preview is not squashed/stretched.
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 8098;
const CDP_PORT = 9227;
const TEST_PHOTO = path.join(__dirname, 'test-photo.jpg');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = [];
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      } else if (m.method) this.handlers.forEach(h => h(m));
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
    if (r.exceptionDetails) throw new Error('page exception: ' + JSON.stringify(r.exceptionDetails).slice(0, 800));
    return r.result.value;
  }
}

const MEASURE = `(() => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return sel + ': MISSING';
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return sel + ': ' + Math.round(r.width) + 'x' + Math.round(r.height)
      + ' @' + Math.round(r.left) + ',' + Math.round(r.top)
      + ' display=' + cs.display + ' flex=' + cs.flex + ' height=' + cs.height + ' overflow=' + cs.overflow;
  };
  return [
    'viewport: ' + window.innerWidth + 'x' + window.innerHeight,
    box('body'), box('#editorPage'), box('header'), box('.app-layout'),
    box('.viewport-stage'), box('#canvasContainer'), box('#filmCanvas'),
    box('.sidebar-left'), box('.sidebar-right')
  ].join('\\n');
})()`;

async function main() {
  const width = Number(process.argv[2] || 1440);
  const height = Number(process.argv[3] || 900);
  const server = await startServer();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'svema-layout-'));
  const edge = spawn(EDGE, [
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--window-size=${width},${height}`, 'about:blank'
  ], { stdio: 'ignore' });

  try {
    let version = null;
    for (let i = 0; i < 60 && !version; i++) {
      try { version = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); }
      catch (e) { await sleep(500); }
    }
    if (!version) throw new Error('no CDP');
    const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
    const cdp = new Cdp(ws);
    const problems = [];
    cdp.on(m => {
      if (m.method === 'Runtime.exceptionThrown') problems.push('UNCAUGHT: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 400));
    });
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 900 });

    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(2500);

    const doc = await cdp.send('DOM.getDocument', { depth: -1 });
    const input = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#fileUploader' });
    await cdp.send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [TEST_PHOTO] });
    await cdp.send('Runtime.evaluate', { expression: `document.getElementById('fileUploader').dispatchEvent(new Event('change',{bubbles:true}))`, userGesture: true });
    await sleep(4000);

    console.log(`\n### viewport ${width}x${height} ###`);
    console.log(await cdp.eval(MEASURE));
    console.log('scrollHeight: ' + await cdp.eval(`document.documentElement.scrollHeight + ' bodyScroll=' + document.body.scrollHeight`));
    console.log('bitmap: ' + await cdp.eval(`document.getElementById('filmCanvas').width + 'x' + document.getElementById('filmCanvas').height`));

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(__dirname, `shot-${width}x${height}.png`), Buffer.from(shot.data, 'base64'));
    console.log('problems: ' + (problems.length ? problems.join(' | ') : 'none'));
  } finally {
    edge.kill(); server.close(); await sleep(200);
  }
}
main().catch(e => { console.error('ERROR', e); process.exit(1); });
