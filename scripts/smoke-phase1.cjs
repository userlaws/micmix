const assert = require('node:assert/strict');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');

// Silent integration checks only. Never starts mic passthrough or an oscillator.
module.exports = async function smoke(ui, worker, root) {
  const result = await ui.webContents.executeJavaScript(`(async () => {
    const before = await window.micmix.getAudioState();
    await window.micmix.command({ type: 'stop' });
    const errors = [];
    for (const command of [{ type: 'tone' }, { type: 'start', deviceId: 'default' }, { type: 'invalid' }]) {
      try { await window.micmix.command(command); errors.push(null); }
      catch (error) { errors.push(String(error)); }
    }
    const after = await window.micmix.getAudioState();
    const options = [...document.querySelectorAll('select option')].map(option => option.textContent);
    return { before, after, errors, options, text: document.body.innerText };
  })()`);
  assert.equal(result.before.status, 'off');
  assert.equal(result.after.status, 'off');
  assert.match(result.errors[0], /Go LIVE/);
  assert.match(result.errors[1], /real microphone/);
  assert.match(result.errors[2], /Invalid audio command/);
  assert.ok(result.options.length > 1);
  assert.ok(result.options.every(label => !/CABLE/i.test(label)));
  assert.match(result.text, /PHASE 1/);
  const sink = await worker.webContents.executeJavaScript(`(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cable = devices.find(d => d.kind === 'audiooutput' && /CABLE Input/i.test(d.label) && !['default', 'communications'].includes(d.deviceId));
    if (!cable) throw new Error('CABLE Input missing; cannot check sink selection.');
    const context = new AudioContext({ latencyHint: 'interactive' });
    try {
      await context.setSinkId(cable.deviceId);
      return { selected: context.sinkId === cable.deviceId, label: cable.label, sampleRate: context.sampleRate };
    } finally { await context.close(); }
  })()`);
  assert.equal(sink.selected, true);
  // Clear expected validation error before screenshot.
  await ui.webContents.executeJavaScript(`window.micmix.command({ type: 'stop' })`);
  await new Promise(resolve => setTimeout(resolve, 200));
  await mkdir(path.join(root, 'artifacts'), { recursive: true });
  await writeFile(path.join(root, 'artifacts', 'phase1-ui.png'), (await ui.webContents.capturePage()).toPNG());
  await writeFile(path.join(root, 'artifacts', 'phase1-smoke.json'), JSON.stringify({
    checks: 'OFF AIR startup, stop IPC, off-air tone rejection, cable/default mic rejection, malformed command rejection, physical mic options, real silent setSinkId',
    sink, audibleTests: 'NOT RUN — user checkpoint required'
  }, null, 2));
  console.log('Silent Phase 1 checks passed. Audible passthrough/tone tests NOT RUN.');
};
