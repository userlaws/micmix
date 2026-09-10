// Renders the real MicMix UI (dist/) with a staged LIVE state and writes a 2x PNG for the marketing site.
// Usage: npm run build && node scripts/site-shot.mjs   (that wrapper clears ELECTRON_RUN_AS_NODE)
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { writeFile, mkdir } = require('node:fs/promises');

const root = path.join(__dirname, '..');
const version = require(path.join(root, 'package.json')).version;
const out = process.argv.find(a => a.startsWith('--out='))?.slice('--out='.length) ?? path.join(root, 'site', 'public', 'screenshots', 'micmix-live.png');
const scale = Number(process.argv.find(a => a.startsWith('--scale='))?.slice('--scale='.length) ?? 2);
const WIDTH = 1400, HEIGHT = 920;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: WIDTH, height: HEIGHT, show: false, backgroundColor: '#071126', useContentSize: true,
    webPreferences: { preload: path.join(__dirname, 'site-shot-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true,
      additionalArguments: ['--app-version=' + version] } });
  await win.loadFile(path.join(root, 'dist', 'index.html'));
  await new Promise(r => setTimeout(r, 1200));
  // The frameless title strip is empty chrome in a screenshot; hide it and pull the layout up.
  const layout = await win.webContents.executeJavaScript(`(() => { document.querySelector('.titlebar').style.display = 'none'; document.querySelector('main').style.paddingTop = '18px'; return { scrollHeight: document.documentElement.scrollHeight, innerWidth: innerWidth, innerHeight: innerHeight }; })()`);
  console.log('Layout', layout);
  // DevTools Protocol screenshot: the clip scale gives a 2x render regardless of the physical screen size.
  const dbg = win.webContents.debugger;
  dbg.attach('1.3');
  const height = Math.max(HEIGHT, layout.scrollHeight);
  await dbg.sendCommand('Emulation.setDeviceMetricsOverride', { width: WIDTH, height, deviceScaleFactor: scale, mobile: false });
  await new Promise(r => setTimeout(r, 400));
  const { data } = await dbg.sendCommand('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: WIDTH, height, scale: 1 } });
  dbg.detach();
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, Buffer.from(data, 'base64'));
  console.log('Wrote', out);
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });
