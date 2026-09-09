const assert = require('node:assert/strict');
const { mkdir, writeFile, readFile } = require('node:fs/promises');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { app, globalShortcut } = require('electron');
// Fresh-install simulation: this process starts with an empty userData profile, walks the wizard,
// assigns a pad and a hotkey, then a second MicMix process on the same profile proves everything
// survived a restart. Master and monitor stay muted; nothing is audible.
function sineWav(seconds, frequency) {
  const rate = 48000, frames = Math.floor(rate * seconds), data = Buffer.alloc(44 + frames * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + frames * 2, 4); data.write('WAVEfmt ', 8); data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++) data.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * frequency / rate) * 0.5 * 32767), 44 + i * 2);
  return data;
}
module.exports = async function smoke(ui, worker, root, registerFiles, youtube, helpers) {
  assert.equal(ui.isVisible(), true); assert.equal(worker.isVisible(), false);
  await mkdir(path.join(root, 'artifacts'), { recursive: true });
  const clip = path.join(root, 'artifacts', 'pad-clip.wav'), song = path.join(root, 'artifacts', 'restore-song.wav');
  await writeFile(clip, sineWav(0.6, 660)); await writeFile(song, sineWav(1.2, 330));
  const evalUi = code => ui.webContents.executeJavaScript(code);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const waitForDom = async (selector, present = true) => {
    for (let i = 0; i < 100; i++) { if ((await evalUi(`!!document.querySelector(${JSON.stringify(selector)})`)) === present) return; await sleep(100); }
    throw new Error('Timed out waiting for ' + selector + ' present=' + present);
  };
  // 1. Fresh profile: the wizard must show, and the config file must not exist yet.
  await waitForDom('.wizard');
  await assert.rejects(readFile(helpers.configPath()), 'config.json must not exist before setup');
  const click = text => evalUi(`(() => { const b = [...document.querySelectorAll('.wizard button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(text)})); if (!b || b.disabled) throw new Error('Wizard button unavailable: ' + ${JSON.stringify(text)}); b.click(); return true; })()`);
  await writeFile(path.join(root, 'artifacts', 'phase4-wizard.png'), (await ui.webContents.capturePage()).toPNG());
  await click('Next'); // virtual mic present
  const wizardMic = await evalUi(`document.querySelector('#wizard-mic').selectedOptions[0].textContent`);
  assert.match(wizardMic, /Yeti/i, 'wizard preselects the real default microphone');
  await click('Next');
  // Silence before the wizard goes LIVE: master 0, monitor off.
  await evalUi(`window.micmix.getAudioState().then(s => window.micmix.command({ type: 'settings', settings: { ...s.settings, levels: { ...s.settings.levels, master: 0 }, monitor: false, monitorVolume: 0 } }))`);
  await click('○ Go LIVE');
  await evalUi(`(async () => { for (let i = 0; i < 100; i++) { const s = await window.micmix.getAudioState(); if (s.error) throw new Error(s.error); if (s.status === 'live') return; await new Promise(r => setTimeout(r, 100)); } throw new Error('Wizard start timed out'); })()`);
  let toneMax = 0;
  const offTone = await evalUi(`window.__peak = 0; window.__off = window.micmix.onMeters(m => { window.__peak = Math.max(window.__peak, m.master); }); true`);
  await click('Send test tone');
  await sleep(900);
  toneMax = await evalUi('window.__off(); window.__peak');
  assert.equal(toneMax, 0, 'master must stay silent with master fader at 0');
  await click('● LIVE');
  await click('Next');
  await click('Finish');
  await waitForDom('.wizard', false);
  const savedAfterWizard = JSON.parse(await readFile(helpers.configPath(), 'utf8'));
  assert.equal(savedAfterWizard.setupDone, true); assert.match(savedAfterWizard.micLabel, /Yeti/i);
  // 2. Pads: assign a clip, decode, hotkey rules, play while LIVE with master muted.
  await helpers.assignPadFile(0, clip);
  await evalUi(`(async () => { for (let i = 0; i < 100; i++) { const s = await window.micmix.getAudioState(); if (s.pads[0]?.error) throw new Error(s.pads[0].error); if (s.pads[0]?.ready) return; await new Promise(r => setTimeout(r, 100)); } throw new Error('Pad decode timed out'); })()`);
  await assert.rejects(evalUi(`window.micmix.setPadHotkey(0, 'A')`), /Ctrl, Alt or Shift/, 'bare keys are rejected');
  await evalUi(`window.micmix.setPadHotkey(0, 'Ctrl+Shift+F9')`);
  assert.equal(globalShortcut.isRegistered('Ctrl+Shift+F9'), true, 'hotkey registered globally');
  await assert.rejects(evalUi(`window.micmix.command({ type: 'pad', slot: 0 })`), /Go LIVE/, 'pads refuse to play while OFF AIR');
  const padResult = await evalUi(`(async () => {
    const devices = (await window.micmix.getReport()).devices;
    const explicit = d => !['default', 'communications'].includes(d.deviceId) && !/CABLE/i.test(d.label);
    const mic = devices.find(d => d.kind === 'audioinput' && explicit(d) && /Yeti/i.test(d.label));
    const initial = await window.micmix.getAudioState();
    await window.micmix.command({ type: 'settings', settings: { ...initial.settings, levels: { mic: 0, music: 0, soundboard: 1, master: 0 }, monitor: false, monitorVolume: 0, ducking: false } });
    let pads = 0, master = 0; const off = window.micmix.onMeters(m => { pads = Math.max(pads, m.soundboard); master = Math.max(master, m.master); });
    try {
      await window.micmix.command({ type: 'start', deviceId: mic.deviceId });
      await window.micmix.command({ type: 'pad', slot: 0 });
      const during = await window.micmix.getAudioState();
      await new Promise(r => setTimeout(r, 400));
      await window.micmix.command({ type: 'pad', slot: 0 }); // second tap stops
      await new Promise(r => setTimeout(r, 200));
      const after = await window.micmix.getAudioState();
      await window.micmix.command({ type: 'pad', slot: 0 });
      await new Promise(r => setTimeout(r, 900)); // clip ends by itself (0.6 s)
      const ended = await window.micmix.getAudioState();
      return { activeDuring: during.activePads, activeAfterStop: after.activePads, activeAfterEnd: ended.activePads, padPeak: pads, masterPeak: master };
    } finally { await window.micmix.command({ type: 'stop' }); off(); }
  })()`);
  assert.deepEqual(padResult.activeDuring, [0]); assert.deepEqual(padResult.activeAfterStop, []); assert.deepEqual(padResult.activeAfterEnd, []);
  assert.ok(padResult.padPeak > 0.1, 'pad audio reached the soundboard meter: ' + padResult.padPeak);
  assert.equal(padResult.masterPeak, 0, 'muted master emitted signal');
  // 3. Persist a queue entry and a fader position, then restart on the same profile.
  const [track] = await registerFiles([song]);
  await evalUi(`window.micmix.command({ type: 'enqueue', tracks: [${JSON.stringify(track)}] })`);
  await evalUi(`window.micmix.getAudioState().then(s => window.micmix.command({ type: 'settings', settings: { ...s.settings, levels: { ...s.settings.levels, music: 0.42 } } }))`);
  await sleep(700); helpers.flushConfig();
  const saved = JSON.parse(await readFile(helpers.configPath(), 'utf8'));
  assert.equal(saved.settings.levels.music, 0.42); assert.equal(saved.pads[0].hotkey, 'Ctrl+Shift+F9'); assert.equal(saved.queue.length, 1);
  await writeFile(path.join(root, 'artifacts', 'phase4-ui.png'), (await ui.webContents.capturePage()).toPNG());
  globalShortcut.unregisterAll(); // the restarted process must be able to claim the hotkey
  const restart = await new Promise(resolve => {
    const child = spawn(process.execPath, [app.getAppPath(), '--smoke-phase4-restart'], { env: { ...process.env, MICMIX_USERDATA: helpers.userData }, stdio: 'inherit', windowsHide: false });
    child.on('exit', code => resolve(code));
  });
  assert.equal(restart, 0, 'restart smoke failed');
  const restartReport = JSON.parse(await readFile(path.join(root, 'artifacts', 'phase4-restart.json'), 'utf8'));
  await writeFile(path.join(root, 'artifacts', 'phase4-smoke.json'), JSON.stringify({ wizardMic, toneMasterPeakWhileMuted: toneMax, savedAfterWizard, padResult, saved, restart: restartReport,
    audibleTests: 'NOT RUN. Master 0 and monitor off throughout; pad meter is captured data, not a listening result.' }, null, 2));
  console.log('Phase 4 silent checks passed:', JSON.stringify({ padResult, restart: restartReport }));
};
