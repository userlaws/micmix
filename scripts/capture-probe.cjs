const { app, BrowserWindow, BrowserView, session } = require('electron');
const path = require('node:path');
const { writeFile, mkdir } = require('node:fs/promises');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setPath('userData', path.join(app.getPath('temp'), 'micmix-capture-probe-' + process.pid));
app.whenReady().then(async () => {
  const root = path.resolve(__dirname, '..');
  await mkdir(path.join(root, 'artifacts'), { recursive: true });
  await writeFile(path.join(root, 'artifacts', 'capture-source.html'), '<!doctype html><title>MicMix capture probe</title><audio id="audio" loop src="fixture.wav"></audio>');
  await writeFile(path.join(root, 'artifacts', 'capture-worker.html'), '<!doctype html><title>MicMix capture worker probe</title>');
  const host = new BrowserWindow({ show: false });
  const source = new BrowserView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  host.setBrowserView(source); source.setBounds({ x: 0, y: 0, width: 400, height: 300 });
  await source.webContents.loadFile(path.join(root, 'artifacts', 'capture-source.html'));
  source.webContents.setAudioMuted(true);
  const ses = session.fromPartition('capture-worker-probe');
  const worker = new BrowserWindow({ show: false, webPreferences: { session: ses, backgroundThrottling: false } });
  ses.setPermissionCheckHandler(wc => wc === worker.webContents);
  ses.setPermissionRequestHandler((wc, _permission, callback) => callback(wc === worker.webContents));
  ses.setDisplayMediaRequestHandler((request, callback) => {
    if (request.frame !== worker.webContents.mainFrame) return callback({});
    callback({ video: source.webContents.mainFrame, audio: source.webContents.mainFrame, enableLocalEcho: false });
  });
  await worker.loadFile(path.join(root, 'artifacts', 'capture-worker.html'));
  await worker.webContents.executeJavaScript(`(async () => {
    window.capture = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    window.capture.getVideoTracks().forEach(track => track.stop());
    window.ctx = new AudioContext(); await window.ctx.setSinkId({type:'none'});
    window.analyser = window.ctx.createAnalyser();
    window.ctx.createMediaStreamSource(window.capture).connect(window.analyser);
    window.analyser.connect(window.ctx.destination); await window.ctx.resume();
  })()`);
  await source.webContents.executeJavaScript('document.querySelector("audio").play()', true);
  const read = () => worker.webContents.executeJavaScript(`(async () => {
    let peak = 0; const samples = new Float32Array(window.analyser.fftSize);
    for (let i=0;i<10;i++) { await new Promise(r=>setTimeout(r,50)); window.analyser.getFloatTimeDomainData(samples); for (const s of samples) peak=Math.max(peak, Math.abs(s)); }
    return { peak, tracks: window.capture.getTracks().map(t=>({kind:t.kind,state:t.readyState})) };
  })()`);
  const muted = await read();
  // Capture now suppresses local playback via enableLocalEcho:false.
  source.webContents.setAudioMuted(false);
  const captureMutedLocally = await read();
  source.webContents.setAudioMuted(true);
  await source.webContents.executeJavaScript('document.querySelector("audio").pause()');
  await worker.webContents.executeJavaScript('window.capture.getTracks().forEach(t=>t.stop()); window.ctx.close()');
  console.log(JSON.stringify({ muted, captureMutedLocally }, null, 2));
  await writeFile(path.join(root, 'artifacts', 'capture-probe.json'), JSON.stringify({ muted, captureMutedLocally }, null, 2));
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });
setTimeout(() => { console.error('Capture probe timed out'); app.exit(1); }, 20000).unref();
