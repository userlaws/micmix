import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import type { DeviceReport } from './shared';

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setName('MicMix');
const diagnose = process.argv.includes('--diagnose');
let ui: BrowserWindow | null = null;
let worker: BrowserWindow | null = null;
let latest: DeviceReport | null = null;
let timeout: NodeJS.Timeout | undefined;
const audioUrl = pathToFileURL(path.join(__dirname, 'audio.html')).href;
const uiUrl = pathToFileURL(path.join(__dirname, 'index.html')).href;
function isWorker(contents: Electron.WebContents | null) {
  return !!worker && contents === worker.webContents && contents.getURL() === audioUrl;
}
function publish(report: DeviceReport) {
  latest = report;
  if (ui && !ui.isDestroyed()) ui.webContents.send('devices:report', report);
}
function protect(win: BrowserWindow) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
}
app.whenReady().then(async () => {
  const audioSession = session.fromPartition('micmix-audio');
  audioSession.setPermissionCheckHandler((contents, permission) =>
    isWorker(contents) && (permission === 'media' || permission === 'speaker-selection'));
  audioSession.setPermissionRequestHandler((contents, permission, callback, details) =>
    callback(isWorker(contents) && (permission === 'speaker-selection' ||
      (permission === 'media' && 'mediaTypes' in details &&
        details.mediaTypes?.every(type => type === 'audio') === true))));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));

  ipcMain.handle('devices:get', event => {
    if (event.sender !== ui?.webContents || event.senderFrame?.url !== uiUrl) throw new Error('Unauthorized');
    return latest;
  });
  ipcMain.handle('devices:refresh', event => {
    if (event.sender !== ui?.webContents || event.senderFrame?.url !== uiUrl) throw new Error('Unauthorized');
    if (!worker || worker.isDestroyed()) throw new Error('Audio worker unavailable. Restart MicMix.');
    worker.webContents.send('audio:scan');
  });
  ipcMain.on('audio:report', (event, report: DeviceReport) => {
    if (!isWorker(event.sender) || event.senderFrame?.url !== audioUrl) return;
    publish(report);
    console.log('\nMicMix: actual Electron audio endpoints at ' + report.scannedAt);
    console.table(report.devices.map(device => ({ kind: device.kind, label: device.label || '(label unavailable)', deviceId: device.deviceId })));
    console.log('AudioContext.setSinkId:', report.setSinkIdSupported);
    if (report.error) console.error(report.error);
    const cableInput = report.devices.some(d => d.kind === 'audiooutput' && /CABLE Input/i.test(d.label));
    const cableOutput = report.devices.some(d => d.kind === 'audioinput' && /CABLE Output/i.test(d.label));
    console.log('CABLE Input:', cableInput, '| CABLE Output:', cableOutput);
    if (diagnose) {
      clearTimeout(timeout);
      void mkdir(path.join(app.getAppPath(), 'artifacts'), { recursive: true })
        .then(() => writeFile(path.join(app.getAppPath(), 'artifacts', 'devices.json'),
          JSON.stringify({ versions: process.versions, ...report, cableInput, cableOutput }, null, 2)))
        .then(() => app.exit(report.error ? 1 : cableInput && cableOutput ? 0 : 2))
        .catch(error => { console.error(error); app.exit(1); });
    }
  });
  worker = new BrowserWindow({
    show: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'),
      session: audioSession, contextIsolation: true, nodeIntegration: false, sandbox: true,
      backgroundThrottling: false, additionalArguments: ['--audio-worker'] }
  });
  protect(worker);
  worker.webContents.on('render-process-gone', (_event, details) => {
    publish({ devices: [], scannedAt: new Date().toISOString(), error: 'Audio worker stopped: ' + details.reason + '. Restart MicMix.',
      setSinkIdSupported: false, secureContext: false });
    if (diagnose) app.exit(1);
  });
  if (!diagnose) {
    ui = new BrowserWindow({ width: 1050, height: 780, minWidth: 760, minHeight: 560,
      title: 'MicMix — Phase 0', backgroundColor: '#101318', autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    protect(ui);
    ui.on('closed', () => { ui = null; app.quit(); });
    await ui.loadFile(path.join(__dirname, 'index.html'));
  }
  timeout = setTimeout(() => {
    if (latest) return;
    console.error('Device scan timed out. Check Windows microphone access.');
    publish({ devices: [], scannedAt: new Date().toISOString(), error: 'Device scan timed out. Check Windows microphone access and rescan.',
      setSinkIdSupported: false, secureContext: false });
    if (diagnose) app.exit(1);
  }, 20000);
  await worker.loadURL(audioUrl);
}).catch(error => { console.error(error); app.exit(1); });
app.on('before-quit', () => { clearTimeout(timeout); });
