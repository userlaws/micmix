const assert = require('node:assert/strict');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
module.exports = async function smoke(ui, worker, root, registerFiles, youtube) {
  assert.equal(ui.isVisible(), true); assert.equal(worker.isVisible(), false);
  assert.equal(youtube.view.webContents.isAudioMuted(), true);
  const parser = await worker.webContents.executeJavaScript(`import('./phase3-checks.js').then(module => module.run())`);
  // Since Phase 4, a fresh profile opens the setup wizard, which keeps the YouTube BrowserView
  // detached (it renders above all DOM). Finish setup first, exactly as a first-run user does,
  // so the video can attach and its capture source can start.
  await ui.webContents.executeJavaScript(`(async () => {
    for (let i = 0; i < 60 && document.querySelector('.wizard'); i++) {
      const finish = [...document.querySelectorAll('.wizard button')].find(b => b.textContent.trim().startsWith('Finish'));
      if (finish) { finish.click(); break; }
      const next = [...document.querySelectorAll('.wizard-nav button')].find(b => b.textContent.trim().startsWith('Next') && !b.disabled);
      if (next) next.click(); else await window.micmix.completeSetup();
      await new Promise(r => setTimeout(r, 60));
    }
    for (let i = 0; i < 60 && document.querySelector('.wizard'); i++) await new Promise(r => setTimeout(r, 50));
    if (document.querySelector('.wizard')) throw new Error('Setup wizard did not close');
  })()`);
  const result = await ui.webContents.executeJavaScript(`(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const waitFor = async (predicate, description) => {
      for (let i = 0; i < 160; i++) {
        const state = await window.micmix.getAudioState();
        if (state.error) throw new Error(state.error);
        if (predicate(state)) return state;
        await sleep(100);
      }
      throw new Error('Timed out: ' + description + ' ' + JSON.stringify(await window.micmix.getAudioState()));
    };
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const initial = await window.micmix.getAudioState();
    await window.micmix.command({ type: 'settings', settings: { ...initial.settings, levels: { mic: 0, music: 0.6, soundboard: 0, master: 0 }, monitor: false, monitorVolume: 0, ducking: false } });
    let rejected = false;
    try { await window.micmix.youtubeTrack('https://example.com/watch?v=M7lc1UVf-VE'); } catch { rejected = true; }
    assert(rejected, 'Non-YouTube URL was accepted');
    const track = await window.micmix.youtubeTrack('https://www.youtube.com/watch?v=M7lc1UVf-VE');
    await window.micmix.command({ type: 'enqueue', tracks: [track] });
    await waitFor(state => state.duration > 0, 'YouTube metadata');
    const devices = (await window.micmix.getReport()).devices;
    const explicit = d => !['default', 'communications'].includes(d.deviceId) && !/CABLE/i.test(d.label);
    const mic = devices.find(d => d.kind === 'audioinput' && explicit(d) && /Yeti/i.test(d.label));
    const headphones = devices.find(d => d.kind === 'audiooutput' && explicit(d) && /Headset Realtek/i.test(d.label));
    assert(mic && headphones, 'Test devices are missing');
    let musicPeak = 0, masterPeak = 0, meterCount = 0;
    const off = window.micmix.onMeters(m => { musicPeak = Math.max(musicPeak, m.music); masterPeak = Math.max(masterPeak, m.master); meterCount++; });
    let playing, paused, seek;
    try {
      await window.micmix.command({ type: 'start', deviceId: mic.deviceId, monitorId: headphones.deviceId });
      await window.micmix.command({ type: 'play' });
      playing = await waitFor(state => state.playing && state.position > 2 && musicPeak > 0.005, 'YouTube playback and captured audio');
      await window.micmix.command({ type: 'pause' });
      paused = await waitFor(state => !state.playing, 'YouTube pause');
      await window.micmix.command({ type: 'seek', seconds: 10 });
      await window.micmix.command({ type: 'play' });
      seek = await waitFor(state => state.position >= 10 && state.playing, 'YouTube seek');
      assert(masterPeak === 0, 'Muted virtual master emitted signal');
    } finally { await window.micmix.command({ type: 'stop' }); off(); }
    const stopped = await window.micmix.getAudioState();
    assert(stopped.status === 'off' && !stopped.playing, 'OFF AIR failed');
    return { title: playing.queue[0].title, duration: playing.duration, position: playing.position,
      paused: !paused.playing, seekPosition: seek.position, musicPeak, masterPeak, meterCount, offAir: true };
  })()`);
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(youtube.view.webContents.isAudioMuted(), true);
  const player = await youtube.view.webContents.executeJavaScript(`({ paused: document.querySelector('video')?.paused, url: location.href })`);
  await mkdir(path.join(root, 'artifacts'), { recursive: true });
  await writeFile(path.join(root, 'artifacts', 'phase3-ui.png'), (await ui.webContents.capturePage()).toPNG());
  if (ui.getBrowserViews().includes(youtube.view)) await writeFile(path.join(root, 'artifacts', 'phase3-player.png'), (await youtube.view.webContents.capturePage()).toPNG());
  await writeFile(path.join(root, 'artifacts', 'phase3-smoke.json'), JSON.stringify({ parser, ...result, player,
    audibleTests: 'NOT RUN. YouTube own output, virtual master, and monitor were muted. Nonzero music meter is captured data, not a listening result.' }, null, 2));
  console.log('Phase 3 silent checks passed:', JSON.stringify(result));
};
