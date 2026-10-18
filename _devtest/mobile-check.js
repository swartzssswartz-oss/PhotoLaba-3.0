// Mobile checks: tab bar fits fully, the settings tab is gone, and the master
// curve nodes can actually be dragged by a touch pointer.
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 8091, CDP_PORT = 9234;
const TEST_PHOTO = path.join(__dirname, 'test-photo.jpg');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  if (ok) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label + (detail ? '  -> ' + detail : '')); }
};

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

// A finger produces pointerdown/pointermove/pointerup with pointerType 'touch'
// (Input.dispatchTouchEvent bypasses the pointer-event layer entirely, so it
// cannot exercise pointer-based handlers).
async function touchDrag(cdp, from, to, steps = 6) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from.x, y: from.y, button: 'left', clickCount: 1, buttons: 1, pointerType: 'touch' });
  for (let i = 1; i <= steps; i++) {
    const x = from.x + (to.x - from.x) * i / steps;
    const y = from.y + (to.y - from.y) * i / steps;
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1, pointerType: 'touch' });
    await sleep(35);
  }
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to.x, y: to.y, button: 'left', clickCount: 1, buttons: 0, pointerType: 'touch' });
}

async function main() {
  const width = Number(process.argv[2] || 390);
  const height = Number(process.argv[3] || 844);
  const server = await startServer();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'svema-mob-'));
  const edge = spawn(EDGE, [`--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--headless=new', '--disable-gpu', '--no-first-run', '--window-size=' + width + ',' + height, 'about:blank'], { stdio: 'ignore' });
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
    });
    await cdp.send('Runtime.enable'); await cdp.send('Log.enable');
    await cdp.send('Page.enable'); await cdp.send('DOM.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(2200);
    const doc = await cdp.send('DOM.getDocument', { depth: -1 });
    const input = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#fileUploader' });
    await cdp.send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [TEST_PHOTO] });
    await cdp.send('Runtime.evaluate', { expression: `document.getElementById('fileUploader').dispatchEvent(new Event('change',{bubbles:true}))`, userGesture: true });
    await sleep(3000);

    console.log(`\n=== mobile ${width}x${height} ===`);
    console.log('\n-- tab bar --');
    const tabs = await cdp.eval(`(() => {
      const bar = document.getElementById('mobileNavTabs');
      const r = bar.getBoundingClientRect();
      return {
        barLeft: r.left, barRight: r.right, barWidth: r.width,
        scrollW: bar.scrollWidth, clientW: bar.clientWidth, scrollLeft: bar.scrollLeft,
        innerWidth: window.innerWidth,
        tabs: [...bar.querySelectorAll('.m-tab')].map(b => {
          const br = b.getBoundingClientRect();
          return { label: b.textContent.trim(), tab: b.dataset.tab, left: Math.round(br.left), right: Math.round(br.right), width: Math.round(br.width), minW: getComputedStyle(b).minWidth, ws: getComputedStyle(b).whiteSpace };
        })
      };
    })()`);
    tabs.tabs.forEach(t => console.log(`    ${t.tab.padEnd(9)} ${t.label.padEnd(9)} left=${String(t.left).padStart(4)} right=${String(t.right).padStart(4)} w=${String(t.width).padStart(3)} minWidth=${t.minW} ws=${t.ws}`));
    check('settings tab removed', !tabs.tabs.some(t => t.tab === 'settings'));
    check('exactly 5 tabs', tabs.tabs.length === 5);
    check('every tab fully inside the screen',
      tabs.tabs.every(t => t.left >= -0.5 && t.right <= tabs.innerWidth + 0.5),
      tabs.tabs.map(t => `${t.tab}:${t.left}..${t.right} vs ${tabs.innerWidth}`).join(', '));
    check('tab bar needs no horizontal scrolling', tabs.scrollW <= tabs.clientW + 1, `scrollW=${tabs.scrollW} clientW=${tabs.clientW}`);
    check('tab bar not clipped by viewport', tabs.barRight <= tabs.innerWidth + 0.5 && tabs.barLeft >= -0.5);
    check('tab bar sits at the bottom', await cdp.eval(`Math.abs(document.getElementById('mobileNavTabs').getBoundingClientRect().bottom - window.innerHeight) < 2`));
    check('tabs are big enough to tap', tabs.tabs.every(t => t.width >= 30));

    console.log('\n-- master curve drag with a finger --');
    await cdp.eval(`document.querySelector('.m-tab[data-tab="response"]').click()`);
    await sleep(400);
    check('response tab activates its section', await cdp.eval(`!!document.querySelector('.mobile-section[data-m-group="response"].active-mobile-section')`));
    await cdp.eval(`(() => { const pbs=[...document.querySelectorAll('.mobile-section[data-m-group="response"] .panel-block')]; pbs.forEach(p=>p.classList.remove('collapsed')); return true; })()`);
    await sleep(300);
    // Curves live in the first panel of the "Отклик" tab; scroll it into view so
    // the synthetic pointer events land inside the viewport.
    await cdp.eval(`document.getElementById('curveSvg').scrollIntoView({ block: 'center' })`);
    await sleep(600);
    const geo = await cdp.eval(`(() => {
      const svg = document.getElementById('curveSvg');
      const r = svg.getBoundingClientRect();
      const h1 = document.getElementById('p1').getBoundingClientRect();
      const h2 = document.getElementById('p2').getBoundingClientRect();
      const hit1 = document.getElementById('p1Hit').getBoundingClientRect();
      return { svg: { x: r.x, y: r.y, w: r.width, h: r.height },
               p1: { x: h1.x + h1.width/2, y: h1.y + h1.height/2, w: h1.width },
               p2: { x: h2.x + h2.width/2, y: h2.y + h2.height/2 },
               hit1w: hit1.width,
               visible: r.width > 0 && r.height > 0,
               p1state: JSON.stringify(state.p1) };
    })()`);
    console.log('    geometry:', JSON.stringify(geo));
    check('curve is visible on mobile', geo.visible);
    check('curve handle is touch-sized (>=20px)', geo.p1.w >= 20, String(geo.p1.w));
    check('curve has an enlarged hit area', geo.hit1w >= 34, String(geo.hit1w));

    const before1 = await cdp.eval(`JSON.stringify(state.p1)`);
    await touchDrag(cdp, { x: geo.p1.x, y: geo.p1.y }, { x: geo.p1.x + 40, y: geo.p1.y - 30 });
    await sleep(500);
    const after1 = await cdp.eval(`JSON.stringify(state.p1)`);
    console.log(`    p1 before=${before1} after=${after1}`);
    check('dragging p1 by touch moves the node', before1 !== after1);

    // Grab slightly OFF-centre: the enlarged hit circle must still catch it.
    const geo2 = await cdp.eval(`(() => { const h = document.getElementById('p2').getBoundingClientRect(); return { x: h.x + h.width/2, y: h.y + h.height/2 }; })()`);
    const before2 = await cdp.eval(`JSON.stringify(state.p2)`);
    await touchDrag(cdp, { x: geo2.x + 10, y: geo2.y + 8 }, { x: geo2.x - 30, y: geo2.y + 25 });
    await sleep(500);
    const after2 = await cdp.eval(`JSON.stringify(state.p2)`);
    console.log(`    p2 (grabbed 10px off-centre) before=${before2} after=${after2}`);
    check('off-centre touch still grabs the node', before2 !== after2);

    check('path transition disabled while dragging', await cdp.eval(`document.getElementById('curvePath').style.transition === ''`));
    check('dragging class cleaned up', await cdp.eval(`!document.body.classList.contains('curve-dragging') && document.querySelectorAll('.curve-handle.dragging').length === 0`));

    console.log('\n-- page still sane after the drag --');
    check('no page overflow introduced', await cdp.eval(`document.documentElement.scrollHeight <= window.innerHeight + 1`));
    check('canvas still rendered', await cdp.eval(`document.getElementById('filmCanvas').classList.contains('loaded')`));

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, `mobile-${width}.png`), Buffer.from(shot.data, 'base64'));

    console.log('\n-- console --');
    check('no errors', problems.length === 0, problems.join(' | '));
    console.log(`\n==== ${pass} passed, ${fail} failed ====`);
    process.exitCode = fail === 0 ? 0 : 1;
  } finally { edge.kill(); server.close(); await sleep(300); }
}
main().catch(e => { console.error('ERROR', e); process.exit(1); });
