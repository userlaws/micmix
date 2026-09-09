const assert = require('node:assert/strict');
const { writeFile } = require('node:fs/promises');
const path = require('node:path');
const { globalShortcut } = require('electron');
// Second half of the Phase 4 smoke: launched by smoke-phase4.cjs on the profile it just created.
module.exports = async function smoke(ui, worker, root) {
  const evalUi = code => ui.webContents.executeJavaScript(code);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  for (let i = 0; i < 100; i++) { if (await evalUi(`document.querySelector('#microphone')?.value`)) break; await sleep(100); }
  await sleep(500);
  const wizardShown = await evalUi(`!!document.querySelector('.wizard')`);
  const micLabel = await evalUi(`document.querySelector('#microphone').selectedOptions[0].textContent`);
  const state = await evalUi(`(async () => { for (let i = 0; i < 100; i++) { const s = await window.micmix.getAudioState(); if (s.pads[0]?.ready && s.queue.length) return s; await new Promise(r => setTimeout(r, 100)); } return window.micmix.getAudioState(); })()`);
  const report = { wizardShown, micLabel, musicLevel: state.settings.levels.music, pad0: state.pads[0] && { title: state.pads[0].title, hotkey: state.pads[0].hotkey, ready: state.pads[0].ready, error: state.pads[0].error },
    hotkeyRegistered: globalShortcut.isRegistered('Ctrl+Shift+F9'), queue: state.queue.map(t => t.title), status: state.status };
  await writeFile(path.join(root, 'artifacts', 'phase4-restart.json'), JSON.stringify(report, null, 2));
  assert.equal(wizardShown, false, 'wizard must not repeat once setup is done');
  assert.match(micLabel, /Yeti/i, 'saved microphone restored by label');
  assert.equal(report.musicLevel, 0.42, 'fader position restored');
  assert.equal(report.pad0?.ready, true, 'pad clip restored and decoded');
  assert.equal(report.pad0?.hotkey, 'Ctrl+Shift+F9'); assert.equal(report.hotkeyRegistered, true, 'hotkey re-registered after restart');
  assert.deepEqual(report.queue, ['restore-song.wav'], 'queue restored');
  assert.equal(report.status, 'off', 'restart must come up OFF AIR');
  console.log('Phase 4 restart checks passed:', JSON.stringify(report));
};
