const path = require('node:path');
const { mkdir, writeFile } = require('node:fs/promises');
// Auto-advance regression test, orchestrated from main so it can move the real window around.
// Four YouTube tracks are each seeked close to their end, so the queue has to advance three times
// on its own, and every transition happens in a different UI state - the YouTube BrowserView used
// to be detached in exactly those states, and a detached view cannot be captured:
//   1. the video panel visible (the easy case)
//   2. the Settings sheet open, so the UI reports no slot at all
//   3. the window hidden to the tray
// Silent: mic, soundboard and master are 0 and monitoring is off.
const VIDEOS = ['M7lc1UVf-VE', 'aqz-KE-bpKQ', 'M7lc1UVf-VE', 'aqz-KE-bpKQ'];
const LABELS = ['panel visible', 'settings sheet open', 'window hidden to tray'];

module.exports = async function smoke(ui, worker, root, _registerFiles, youtube) {
  const run = code => ui.webContents.executeJavaScript('(async () => { ' + code + ' })()');
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const state = () => run('return await window.micmix.getAudioState();');
  const command = value => run('return await window.micmix.command(' + JSON.stringify(value) + ');');
  const viewState = () => ({ attached: ui.getBrowserViews().includes(youtube.view), bounds: youtube.view.getBounds() });
  const waitFor = async (predicate, description, tries = 400) => {
    for (let i = 0; i < tries; i++) {
      const current = await state();
      if (predicate(current)) return current;
      await sleep(100);
    }
    throw new Error('Timed out: ' + description);
  };

  const initial = await state();
  await command({ type: 'settings', settings: { ...initial.settings,
    levels: { mic: 0, music: 1, soundboard: 0, master: 0 }, monitor: false, monitorVolume: 0, ducking: false } });
  const devices = (await run('return (await window.micmix.getReport()).devices;'))
    .filter(d => !['default', 'communications'].includes(d.deviceId) && !/CABLE/i.test(d.label));
  const mic = devices.find(d => d.kind === 'audioinput');
  if (!mic) throw new Error('No real microphone to go live with');

  const transitions = [];
  try {
    await command({ type: 'start', deviceId: mic.deviceId });
    await waitFor(s => s.status === 'live', 'live');
    const tracks = [];
    for (const id of VIDEOS) {
      tracks.push(await run('return await window.micmix.youtubeTrack("https://www.youtube.com/watch?v=' + id + '");'));
    }
    await command({ type: 'enqueue', tracks });
    await waitFor(s => s.duration > 0, 'first track metadata');
    await command({ type: 'play' });
    await waitFor(s => s.playing, 'first track playing');

    for (let index = 0; index < VIDEOS.length - 1; index++) {
      if (index === 1) { await run('document.querySelector(".gear, [aria-label=Settings]").click();'); await sleep(500); }
      if (index === 2) {
        await run('const close = document.querySelector(".sheet .sheet-head button"); if (close) close.click();');
        await sleep(300); ui.hide(); await sleep(500);
      }
      const before = await waitFor(s => s.index === index && s.duration > 0 && s.playing, 'track ' + index + ' playing');
      await command({ type: 'seek', seconds: Math.max(0, before.duration - 5) });
      const at = Date.now();
      const advanced = await waitFor(s => s.index === index + 1, 'auto-advance past track ' + index, 300);
      const playing = await waitFor(s => s.playing && s.index === index + 1, 'track ' + (index + 1) + ' playing', 300);
      transitions.push({ from: index, gapMs: Date.now() - at, view: viewState(),
        error: advanced.error || playing.error || null });
      if (index === 2) { ui.show(); await sleep(400); }
    }
    const end = await state();
    const report = { transitions, end: { index: end.index, playing: end.playing, error: end.error } };
    await mkdir(path.join(root, 'artifacts'), { recursive: true });
    await writeFile(path.join(root, 'artifacts', 'autoplay.json'), JSON.stringify(report, null, 2));
    for (const t of transitions) {
      console.log('  advanced ' + t.from + ' -> ' + (t.from + 1) + ' in ' + t.gapMs + 'ms  (' + LABELS[t.from] +
        ', view attached=' + t.view.attached + ' ' + JSON.stringify(t.view.bounds) + ')');
    }
    const failed = transitions.find(t => t.error);
    if (failed) throw new Error('Auto-advance past track ' + failed.from + ' reported: ' + failed.error);
    if (!transitions.every(t => t.view.attached)) throw new Error('The YouTube view was detached during a transition');
    if (report.end.index !== 3 || !report.end.playing) throw new Error('Queue did not finish on track 3 playing: ' + JSON.stringify(report.end));
    console.log('autoplay OK: the queue advanced by itself in all three UI states');
  } finally {
    ui.show();
    await command({ type: 'stop' }).catch(() => {});
  }
};
