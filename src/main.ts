import { app, BrowserWindow, ipcMain, session, dialog } from 'electron';
import path from 'node:path';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { initialAudioState, emptyMeters, type DeviceReport, type AudioState, type AudioCommand, type LocalTrack, type Meters } from './shared';
import { validCommand } from './commands';

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setName('MicMix');
const diagnose = process.argv.includes('--diagnose');
const smokeTest = process.argv.includes('--smoke-phase1') || process.argv.includes('--smoke-phase2');
// Diagnostics use their own cache so they can run beside the user's open app.
if (diagnose || smokeTest) app.setPath('userData', path.join(app.getPath('temp'), 'micmix-diagnostics-' + process.pid));
else if (!app.requestSingleInstanceLock()) app.quit();
let ui: BrowserWindow | null = null;
let worker: BrowserWindow | null = null;
let latest: DeviceReport | null = null;
let timeout: NodeJS.Timeout | undefined;
let audioState: AudioState = initialAudioState();
const localFiles = new Map<string, LocalTrack>();
async function registerFiles(paths: string[]) {
  if (!Array.isArray(paths) || paths.length > 200 || paths.some(p => typeof p !== 'string' || !path.isAbsolute(p) || !/\.(mp3|wav|flac|ogg)$/i.test(p))) {
    throw new Error('Choose up to 200 local mp3, wav, flac, or ogg files.');
  }
  const tracks: LocalTrack[] = [];
  for (const file of paths) {
    if (!(await stat(file)).isFile()) throw new Error('Not an audio file: ' + path.basename(file));
    const existing = [...localFiles.values()].find(t => t.url === pathToFileURL(file).href);
    tracks.push(existing ?? { id: randomUUID(), title: path.basename(file), url: pathToFileURL(file).href });
  }
  for (const track of tracks) localFiles.set(track.id, track);
  return tracks;
}
let commandId = 0;
const pending = new Map<number, { resolve(): void; reject(error: Error): void; timer: NodeJS.Timeout }>();
function publishAudio(state: AudioState) {
  audioState = state;
  if (ui && !ui.isDestroyed()) ui.webContents.send('audio:state', state);
}
function cancelPending(reason: string) {
  for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error(reason)); }
  pending.clear();
}
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
  ipcMain.handle('files:pick', async event => {
    if (event.sender !== ui?.webContents || event.senderFrame?.url !== uiUrl) throw new Error('Unauthorized');
    const result = await dialog.showOpenDialog(ui!, { properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'ogg'] }] });
    return result.canceled ? [] : registerFiles(result.filePaths);
  });
  ipcMain.handle('files:drop', (event, paths: string[]) => {
    if (event.sender !== ui?.webContents || event.senderFrame?.url !== uiUrl) throw new Error('Unauthorized');
    return registerFiles(paths);
  });

  ipcMain.handle('audio:get-state', event => {
    if (event.sender !== ui?.webContents || event.senderFrame?.url !== uiUrl) throw new Error('Unauthorized');
    return audioState;
  });
  ipcMain.handle('audio:command', (event, command: AudioCommand) => {
    if (event.sender !== ui?.webContents || event.senderFrame?.url !== uiUrl) throw new Error('Unauthorized');
    if (!validCommand(command)) {
      throw new Error('Invalid audio command');
    }
    if (command.type === 'enqueue') command = { type: 'enqueue', tracks: command.tracks.map(track => {
      const registered = localFiles.get(track.id);
      if (!registered) throw new Error('Choose this file with Add files or drag and drop first.');
      return registered;
    }) };
    if (!worker || worker.isDestroyed() || worker.webContents.isDestroyed()) throw new Error('Audio worker unavailable. Restart MicMix.');
    if (command.type === 'stop') cancelPending('Audio operation cancelled.');
    const id = ++commandId;
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        if (worker && !worker.isDestroyed()) worker.webContents.send('audio:command', ++commandId, { type: 'stop' });
        reject(new Error('Audio command timed out. Output stopped; check microphone permissions and retry.'));
      }, 15000);
      pending.set(id, { resolve, reject, timer });
      worker!.webContents.send('audio:command', id, command);
    });
  });
  ipcMain.on('audio:reply', (event, id: number, error: string | null) => {
    if (!isWorker(event.sender) || event.senderFrame?.url !== audioUrl) return;
    const entry = pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer); pending.delete(id);
    if (error) entry.reject(new Error(error)); else entry.resolve();
  });
  ipcMain.on('audio:state', (event, state: AudioState) => {
    if (isWorker(event.sender) && event.senderFrame?.url === audioUrl) publishAudio(state);
  });
  ipcMain.on('audio:meters', (event, meters: Meters) => {
    if (isWorker(event.sender) && event.senderFrame?.url === audioUrl && ui && !ui.isDestroyed()) ui.webContents.send('audio:meters', meters);
  });
  app.on('second-instance', () => { if (ui) { if (ui.isMinimized()) ui.restore(); ui.show(); ui.focus(); } });

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
    cancelPending('Audio worker stopped. Restart MicMix.');
    publishAudio({ ...audioState, status: 'off', micId: null, monitorId: null, tone: false, playing: false, error: 'Audio worker stopped. Restart MicMix.' });
    if (ui && !ui.isDestroyed()) ui.webContents.send('audio:meters', emptyMeters);
    publish({ devices: [], scannedAt: new Date().toISOString(), error: 'Audio worker stopped: ' + details.reason + '. Restart MicMix.',
      setSinkIdSupported: false, secureContext: false });
    if (diagnose) app.exit(1);
  });
  if (!diagnose) {
    ui = new BrowserWindow({ width: 1260, height: 850, minWidth: 900, minHeight: 640,
      title: 'MicMix — Phase 2', backgroundColor: '#101318', autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    protect(ui);
    ui.webContents.on('render-process-gone', () => {
      if (worker && !worker.isDestroyed()) worker.webContents.send('audio:command', ++commandId, { type: 'stop' });
    });
    ui.on('closed', () => { ui = null; app.quit(); });
    await ui.loadFile(path.join(__dirname, 'index.html'));
    ui.show();
    ui.focus();
  }
  timeout = setTimeout(() => {
    if (latest) return;
    console.error('Device scan timed out. Check Windows microphone access.');
    publish({ devices: [], scannedAt: new Date().toISOString(), error: 'Device scan timed out. Check Windows microphone access and rescan.',
      setSinkIdSupported: false, secureContext: false });
    if (diagnose) app.exit(1);
  }, 20000);
  await worker.loadURL(audioUrl);
  if (smokeTest && ui) {
    const deadline = Date.now() + 20000;
    while (!latest && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    if (!latest) throw new Error('Smoke check timed out waiting for devices.');
    const smoke = require(path.join(app.getAppPath(), 'scripts', process.argv.includes('--smoke-phase2') ? 'smoke-phase2.cjs' : 'smoke-phase1.cjs'));
    await smoke(ui, worker, app.getAppPath(), registerFiles);
    app.quit();
  }
}).catch(error => { console.error(error); app.exit(1); });
app.on('before-quit', () => { clearTimeout(timeout); cancelPending('MicMix is closing.'); });
