const assert = require('node:assert/strict');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
module.exports = async function smoke(ui, worker, root, registerFiles) {
  assert.equal(ui.isVisible(), true);
  assert.equal(worker.isVisible(), false);
  const graph = await worker.webContents.executeJavaScript(`import('./phase2-checks.js').then(module => module.run())`);
  console.log('Offline graph results:', graph);
  const tracks = await registerFiles(['wav', 'mp3', 'flac', 'ogg'].map(ext => path.join(root, 'artifacts', 'fixture.' + ext)));
  const corruptPath = path.join(root, 'artifacts', 'corrupt.wav');
  await writeFile(corruptPath, 'not an audio file');
  const corrupt = await registerFiles([corruptPath]);
  const result = await ui.webContents.executeJavaScript(`(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const assert = (ok, message) => { if (!ok) throw new Error(message); };
    const waitFor = async predicate => {
      for (let i = 0; i < 80; i++) { const state = await window.micmix.getAudioState(); if (predicate(state)) return state; await sleep(50); }
      throw new Error('Timed out waiting for playback state');
    };
    const initial = await window.micmix.getAudioState();
    assert(initial.status === 'off', 'Startup not OFF AIR');
    const errors = [];
    for (const command of [{ type: 'settings', settings: { ...initial.settings, duckDb: NaN } }, { type: 'play' }, { type: 'enqueue', tracks: [{ id: 'unregistered' }] }]) {
      try { await window.micmix.command(command); errors.push(false); } catch { errors.push(true); }
    }
    assert(errors.every(Boolean), 'Invalid or off-air commands accepted');
    await window.micmix.command({ type: 'enqueue', tracks: ${JSON.stringify(tracks)} });
    let state = await window.micmix.getAudioState();
    assert(state.queue.length === 4 && state.index === 0, 'Queue import failed');
    const devices = (await window.micmix.getReport()).devices;
    const explicit = d => !['default', 'communications'].includes(d.deviceId) && !/CABLE/i.test(d.label);
    const mic = devices.find(d => d.kind === 'audioinput' && explicit(d) && /Yeti/i.test(d.label));
    const headphones = devices.find(d => d.kind === 'audiooutput' && explicit(d) && /Headset Realtek/i.test(d.label));
    assert(mic && headphones, 'Test microphone/headphones not present');
    const settings = { ...initial.settings, levels: { mic: 0, music: 0.5, soundboard: 0, master: 0 }, monitor: false, monitorVolume: 0, ducking: false };
    await window.micmix.command({ type: 'settings', settings });
    let musicPeak = 0, masterPeak = 0, meterCount = 0;
    const off = window.micmix.onMeters(m => { musicPeak = Math.max(musicPeak, m.music); masterPeak = Math.max(masterPeak, m.master); meterCount++; });
    const decoded = [];
    try {
      await Promise.allSettled([
        window.micmix.command({ type: 'start', deviceId: mic.deviceId, monitorId: headphones.deviceId }),
        window.micmix.command({ type: 'stop' })
      ]);
      await sleep(200);
      assert((await window.micmix.getAudioState()).status === 'off', 'Cancelled start became LIVE');
      await window.micmix.command({ type: 'start', deviceId: mic.deviceId, monitorId: headphones.deviceId });
      for (let index = 0; index < 4; index++) {
        await window.micmix.command({ type: 'select', index });
        await waitFor(s => s.duration > 0);
        musicPeak = 0;
        await window.micmix.command({ type: 'play' }); await sleep(300);
        assert(musicPeak > 0.005, 'No real media signal for ' + index);
        await window.micmix.command({ type: 'pause' });
        state = await window.micmix.getAudioState(); assert(!state.playing, 'Pause failed');
        decoded.push({ title: state.queue[index].title, peak: musicPeak, duration: state.duration });
      }
      await window.micmix.command({ type: 'select', index: 0 }); await waitFor(s => s.duration > 0);
      await window.micmix.command({ type: 'seek', seconds: 0.5 });
      state = await window.micmix.getAudioState(); assert(Math.abs(state.position - 0.5) < 0.05, 'Seek failed');
      await window.micmix.command({ type: 'play' });
      await waitFor(s => s.index === 1 && s.playing);
      await window.micmix.command({ type: 'pause' });
      await window.micmix.command({ type: 'remove', index: 0 });
      state = await window.micmix.getAudioState(); assert(state.index === 0 && state.queue.length === 3, 'Remove previous item failed');
      await window.micmix.command({ type: 'next' });
      state = await window.micmix.getAudioState(); assert(state.index === 1 && !state.playing, 'Paused skip failed');
      await window.micmix.command({ type: 'remove', index: 1 });
      state = await window.micmix.getAudioState(); assert(state.queue.length === 2 && state.index === 1, 'Remove current item failed');
      await window.micmix.command({ type: 'enqueue', tracks: ${JSON.stringify(corrupt)} });
      await window.micmix.command({ type: 'select', index: 2 });
      await waitFor(s => !!s.error);
      state = await window.micmix.getAudioState(); assert(state.status === 'live' && !state.playing, 'Bad file stopped the mic engine');
      await window.micmix.command({ type: 'select', index: 0 });
      await waitFor(s => s.duration > 0 && !s.error);
      assert(masterPeak === 0, 'Muted master emitted a nonzero signal');
      assert(meterCount >= 20, 'Meter updates missing');
    } finally { await window.micmix.command({ type: 'stop' }); off(); }
    state = await window.micmix.getAudioState(); assert(state.status === 'off' && !state.playing, 'OFF AIR failed');
    await window.micmix.command({ type: 'clear' });
    await window.micmix.command({ type: 'settings', settings: initial.settings });
    return { decoded, masterPeak, meterCount, finalStatus: state.status, monitorId: state.monitorId };
  })()`);
  await new Promise(resolve => setTimeout(resolve, 150));
  await mkdir(path.join(root, 'artifacts'), { recursive: true });
  await writeFile(path.join(root, 'artifacts', 'phase2-ui.png'), (await ui.webContents.capturePage()).toPNG());
  await ui.webContents.executeJavaScript(`document.querySelector('[aria-label="Settings"]').click()`);
  await new Promise(resolve => setTimeout(resolve, 100));
  await writeFile(path.join(root, 'artifacts', 'phase2-settings.png'), (await ui.webContents.capturePage()).toPNG());
  await writeFile(path.join(root, 'artifacts', 'phase2-smoke.json'), JSON.stringify({ graph, ...result,
    audibleTests: 'NOT RUN. Virtual master and headphone monitor were muted during all live-context tests.' }, null, 2));
  console.log('Phase 2 silent checks passed:', JSON.stringify(result));
};
