const assert = require('node:assert/strict');
const { mkdir, writeFile, readFile } = require('node:fs/promises');
const path = require('node:path');
const { globalShortcut } = require('electron');
// App shortcuts + tray, silently: defaults registered, validation and duplicate rules across pads and
// actions, every action driven through the same handler the global shortcut calls, close-to-tray hides
// the window instead of quitting, and the Show shortcut brings it back. Master 0 and monitor off throughout.
// Run via scripts/check-hotkeys.mjs, which seeds a profile with setup already done so no wizard appears.
function sineWav(seconds, frequency) {
  const rate = 48000, frames = Math.floor(rate * seconds), data = Buffer.alloc(44 + frames * 2);
  data.write('RIFF', 0); data.writeUInt32LE(36 + frames * 2, 4); data.write('WAVEfmt ', 8); data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++) data.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * frequency / rate) * 0.5 * 32767), 44 + i * 2);
  return data;
}
module.exports = async function smoke(ui, worker, root, registerFiles, youtube, helpers) {
  const evalUi = code => ui.webContents.executeJavaScript(code);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const state = () => evalUi('window.micmix.getAudioState()');
  const waitFor = async (test, label) => {
    for (let i = 0; i < 100; i++) { const s = await state(); if (test(s)) return s; await sleep(100); }
    throw new Error('Timed out waiting for ' + label);
  };
  await mkdir(path.join(root, 'artifacts'), { recursive: true });
  const a = path.join(root, 'artifacts', 'hotkey-a.wav'), b = path.join(root, 'artifacts', 'hotkey-b.wav'), clip = path.join(root, 'artifacts', 'hotkey-clip.wav');
  await writeFile(a, sineWav(4, 330)); await writeFile(b, sineWav(4, 440)); await writeFile(clip, sineWav(0.6, 660));
  for (let i = 0; i < 100; i++) { if (await evalUi(`document.querySelector('#microphone')?.value`)) break; await sleep(100); }
  assert.equal(await evalUi(`!!document.querySelector('.wizard')`), false, 'seeded profile must skip the wizard');
  // 1. Defaults and registration state.
  const config = await evalUi('window.micmix.getConfig()');
  assert.equal(config.closeToTray, true);
  assert.deepEqual(config.hotkeys, { playPause: 'Ctrl+Alt+P', next: 'Ctrl+Alt+N', previous: 'Ctrl+Alt+B', muteMic: 'Ctrl+Alt+K', stopPads: 'Ctrl+Alt+X', live: 'Ctrl+Alt+L', show: 'Ctrl+Alt+H' });
  for (const [action, accelerator] of Object.entries(config.hotkeys)) {
    // Another MicMix (the user's own copy) may already own a default; then it must be reported, never silently dropped.
    assert.equal(globalShortcut.isRegistered(accelerator) || config.unavailableHotkeys.includes(action), true, action + ' neither registered nor reported');
  }
  // 2. Validation and conflicts across pads and actions.
  await assert.rejects(evalUi(`window.micmix.setHotkey('playPause', 'A')`), /Ctrl, Alt or Shift/, 'bare key rejected');
  await assert.rejects(evalUi(`window.micmix.setHotkey('nope', 'Ctrl+Alt+F10')`), /Unknown shortcut/, 'unknown action rejected');
  await evalUi(`window.micmix.setHotkey('playPause', 'Ctrl+Alt+Shift+F10')`);
  assert.equal(globalShortcut.isRegistered('Ctrl+Alt+Shift+F10'), true, 'new shortcut registered');
  assert.equal(globalShortcut.isRegistered('Ctrl+Alt+P'), false, 'old shortcut released');
  await evalUi(`window.micmix.setHotkey('stopPads', 'MediaStop')`); // media keys are safe without a modifier
  await assert.rejects(evalUi(`window.micmix.setHotkey('next', 'Ctrl+Alt+Shift+F10')`), /"Play \/ pause music" already uses/, 'action duplicate rejected');
  await helpers.assignPadFile(0, clip);
  await waitFor(s => s.pads[0]?.ready, 'pad decode');
  await assert.rejects(evalUi(`window.micmix.setPadHotkey(0, 'Ctrl+Alt+Shift+F10')`), /"Play \/ pause music" already uses/, 'pad cannot take an action shortcut');
  await evalUi(`window.micmix.setPadHotkey(0, 'Ctrl+Alt+Shift+F11')`);
  await assert.rejects(evalUi(`window.micmix.setHotkey('next', 'Ctrl+Alt+Shift+F11')`), /Pad 1 already uses/, 'action cannot take a pad hotkey');
  await evalUi(`window.micmix.setHotkey('next', null)`);
  let after = await evalUi('window.micmix.getConfig()');
  assert.equal(after.hotkeys.next, null); assert.equal(after.hotkeys.playPause, 'Ctrl+Alt+Shift+F10'); assert.equal(after.hotkeys.stopPads, 'MediaStop');
  await sleep(700); helpers.flushConfig();
  const saved = JSON.parse(await readFile(helpers.configPath(), 'utf8'));
  assert.deepEqual(saved.hotkeys, after.hotkeys, 'shortcuts persisted');
  await evalUi(`window.micmix.setHotkey('next', 'Ctrl+Alt+N')`);
  // 3. Actions through the shortcut handler. Nothing applies OFF AIR except mute.
  const tracks = await registerFiles([a, b]);
  await evalUi(`window.micmix.command({ type: 'enqueue', tracks: ${JSON.stringify(tracks)} })`);
  helpers.runHotkey('playPause'); await sleep(300);
  assert.equal((await state()).playing, false, 'play/pause is a no-op OFF AIR');
  helpers.runHotkey('muteMic');
  await waitFor(s => s.settings.muted.mic === true, 'mic muted by shortcut');
  helpers.runHotkey('muteMic');
  await waitFor(s => s.settings.muted.mic === false, 'mic unmuted by shortcut');
  // Silence: master 0 and monitor off before anything goes live.
  await evalUi(`window.micmix.getAudioState().then(s => window.micmix.command({ type: 'settings', settings: { ...s.settings, levels: { ...s.settings.levels, master: 0 }, monitor: false, monitorVolume: 0 } }))`);
  let masterPeak = 0;
  await evalUi(`window.__peak = 0; window.__off = window.micmix.onMeters(m => { window.__peak = Math.max(window.__peak, m.master); }); true`);
  helpers.runHotkey('live'); // routed through the UI, which presses its own Go live button
  await waitFor(s => s.status === 'live', 'go live by shortcut');
  helpers.runHotkey('playPause');
  await waitFor(s => s.playing && s.index === 0, 'play by shortcut');
  helpers.runHotkey('next');
  await waitFor(s => s.index === 1, 'next by shortcut');
  helpers.runHotkey('previous');
  await waitFor(s => s.index === 0, 'previous by shortcut');
  helpers.runHotkey('playPause');
  await waitFor(s => !s.playing, 'pause by shortcut');
  await evalUi(`window.micmix.command({ type: 'pad', slot: 0 })`);
  await waitFor(s => s.activePads.length === 1, 'pad playing');
  helpers.runHotkey('stopPads');
  await waitFor(s => s.activePads.length === 0, 'pads stopped by shortcut');
  helpers.runHotkey('live');
  await waitFor(s => s.status === 'off', 'off air by shortcut');
  masterPeak = await evalUi('window.__off(); window.__peak');
  assert.equal(masterPeak, 0, 'master must stay silent with master fader at 0');
  // 4. Tray: closing hides, Show brings it back, and turning the option off is honoured.
  assert.ok(helpers.tray(), 'tray icon exists');
  const closeHidden = new Promise(resolve => ui.once('hide', () => resolve(true)));
  ui.close();
  assert.equal(await Promise.race([closeHidden, sleep(3000).then(() => false)]), true, 'close should hide to the tray');
  assert.equal(ui.isDestroyed(), false, 'window survives close'); assert.equal(ui.isVisible(), false);
  helpers.runHotkey('show');
  await sleep(300);
  assert.equal(ui.isVisible(), true, 'show shortcut restores the window');
  await evalUi(`window.micmix.setCloseToTray(false)`);
  after = await evalUi('window.micmix.getConfig()');
  assert.equal(after.closeToTray, false);
  await evalUi(`window.micmix.setCloseToTray(true)`);
  // 5. Settings sheet screenshot with the Shortcuts group in view.
  await evalUi(`document.querySelector('.gear').click(); true`);
  await sleep(300);
  await evalUi(`(() => { const h = [...document.querySelectorAll('.sheet .group h2')].find(h => h.textContent.startsWith('Shortcuts')); h.scrollIntoView({ block: 'start' }); return true; })()`);
  await sleep(300);
  const rows = await evalUi(`document.querySelectorAll('.row.shortcut').length`);
  assert.equal(rows, 7, 'seven shortcut rows in Settings');
  await writeFile(path.join(root, 'artifacts', 'hotkeys-settings.png'), (await ui.webContents.capturePage()).toPNG());
  await writeFile(path.join(root, 'artifacts', 'hotkeys-smoke.json'), JSON.stringify({ defaults: config, after, masterPeakWhileMuted: masterPeak,
    audibleTests: 'NOT RUN. Master 0 and monitor off throughout.' }, null, 2));
  console.log('Hotkey + tray silent checks passed:', JSON.stringify({ hotkeys: after.hotkeys, unavailable: after.unavailableHotkeys, masterPeak }));
};
