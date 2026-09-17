const path = require('node:path');
const { mkdir, writeFile } = require('node:fs/promises');
// Autoplay regression test, orchestrated from main so it can move the real window around.
// Part 1: autoplay is OFF by default, so a finished track must NOT roll on to the next one.
// Part 2: with autoplay ON, four YouTube tracks are each seeked close to their end so the queue
// has to advance three times by itself, and every transition happens in a different UI state -
// the YouTube BrowserView used to be detached in exactly those states, and a detached view
// cannot be captured:
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
  const setAutoplay = async on => {
    const current = await state();
    await command({ type: 'settings', settings: { ...current.settings, autoplay: on } });
  };
  // Runs the current track to its end and reports what the queue did.
  const runToEnd = async index => {
    const before = await waitFor(s => s.index === index && s.duration > 0 && s.playing, 'track ' + index + ' playing');
    await command({ type: 'seek', seconds: Math.max(0, before.duration - 5) });
    const at = Date.now();
    for (let i = 0; i < 300; i++) {
      const now = await state();
      if (now.index !== index) return { advanced: true, gapMs: Date.now() - at, error: now.error };
      await sleep(100);
    }
    return { advanced: false, gapMs: Date.now() - at, error: (await state()).error };
  };

  const initial = await state();
  if (initial.settings.autoplay !== false) throw new Error('Autoplay should default to off, got ' + initial.settings.autoplay);
  await command({ type: 'settings', settings: { ...initial.settings,
    levels: { mic: 0, music: 0, soundboard: 0, master: 0 }, monitor: false, monitorVolume: 0, ducking: false } });
  const devices = (await run('return (await window.micmix.getReport()).devices;'))
    .filter(d => !['default', 'communications'].includes(d.deviceId) && !/CABLE/i.test(d.label));
  const mic = devices.find(d => d.kind === 'audioinput');
  if (!mic) throw new Error('No real microphone to go live with');

  const transitions = [];
  let heldStill = null;
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

    // Part 1: autoplay off - the queue must stay put and stop playing.
    const off = await runToEnd(0);
    const after = await state();
    heldStill = { advanced: off.advanced, index: after.index, playing: after.playing, error: off.error };
    console.log('  autoplay off: index stayed ' + after.index + ', playing=' + after.playing);
    if (off.advanced) throw new Error('Autoplay is off but the queue advanced anyway');
    if (after.playing) throw new Error('Autoplay is off but playback did not stop at the end of the track');

    // Part 2: autoplay on - the queue rolls on by itself, whatever the UI is doing.
    await setAutoplay(true);
    await command({ type: 'play' });
    await waitFor(s => s.playing && s.index === 0, 'first track playing again');
    for (let index = 0; index < VIDEOS.length - 1; index++) {
      if (index === 1) { await run('document.querySelector(".gear, [aria-label=Settings]").click();'); await sleep(500); }
      if (index === 2) {
        await run('const close = document.querySelector(".sheet .sheet-head button"); if (close) close.click();');
        await sleep(300); ui.hide(); await sleep(500);
      }
      const advance = await runToEnd(index);
      if (!advance.advanced) throw new Error('Autoplay is on but the queue did not advance past track ' + index);
      const playing = await waitFor(s => s.playing && s.index === index + 1, 'track ' + (index + 1) + ' playing', 300);
      transitions.push({ from: index, gapMs: advance.gapMs, view: viewState(), error: advance.error || playing.error || null });
      if (index === 2) { ui.show(); await sleep(400); }
    }
    const end = await state();
    const report = { heldStill, transitions, end: { index: end.index, playing: end.playing, error: end.error } };
    await mkdir(path.join(root, 'artifacts'), { recursive: true });
    await writeFile(path.join(root, 'artifacts', 'autoplay.json'), JSON.stringify(report, null, 2));
    for (const t of transitions) {
      console.log('  autoplay on: advanced ' + t.from + ' -> ' + (t.from + 1) + ' in ' + t.gapMs + 'ms  (' + LABELS[t.from] +
        ', view attached=' + t.view.attached + ' ' + JSON.stringify(t.view.bounds) + ')');
    }
    const failed = transitions.find(t => t.error);
    if (failed) throw new Error('Auto-advance past track ' + failed.from + ' reported: ' + failed.error);
    if (!transitions.every(t => t.view.attached)) throw new Error('The YouTube view was detached during a transition');
    if (report.end.index !== 3 || !report.end.playing) throw new Error('Queue did not finish on track 3 playing: ' + JSON.stringify(report.end));
    console.log('autoplay OK: off holds the track, on advances in all three UI states');
  } finally {
    ui.show();
    await command({ type: 'stop' }).catch(() => {});
  }
};
