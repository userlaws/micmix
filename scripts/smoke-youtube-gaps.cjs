const { ipcMain } = require('electron');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
// Silent gap detector. Mic 0 (no ducking), master 0, monitor off. Cross-references the YouTube
// video element's clock with the captured audio meter so buffering, skips and capture dropouts
// can be told apart. Nothing is audible.
module.exports = async function smoke(ui, worker, root, _registerFiles, youtube) {
  const seconds = Number(process.env.MICMIX_SOAK_SECONDS || 60);
  const started = Date.now();
  const playerEvents = [];
  ipcMain.on('youtube:event', (_event, data) => {
    if (data?.event === 'onStateChange' || data?.event === 'onError') playerEvents.push({ t: Date.now() - started, event: data.event, value: data.value });
  });
  const clock = [];
  const poll = setInterval(() => {
    youtube.view.webContents.executeJavaScript(`(() => { const v = document.querySelector('video'); return v ? { currentTime: v.currentTime, paused: v.paused, readyState: v.readyState, buffered: v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0 } : null; })()`)
      .then(sample => clock.push({ t: Date.now() - started, ...sample })).catch(() => {});
  }, 250);
  const result = await ui.webContents.executeJavaScript(`(async () => {
    const started = ${started};
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const waitFor = async (predicate, description) => {
      for (let i = 0; i < 200; i++) {
        const state = await window.micmix.getAudioState();
        if (state.error) throw new Error(state.error);
        if (predicate(state)) return state;
        await sleep(100);
      }
      throw new Error('Timed out: ' + description);
    };
    const initial = await window.micmix.getAudioState();
    await window.micmix.command({ type: 'settings', settings: { ...initial.settings, levels: { mic: 0, music: 1, soundboard: 0, master: 0 }, monitor: false, monitorVolume: 0, ducking: false } });
    const track = await window.micmix.youtubeTrack('https://www.youtube.com/watch?v=M7lc1UVf-VE');
    await window.micmix.command({ type: 'enqueue', tracks: [track] });
    await waitFor(state => state.duration > 0, 'YouTube metadata');
    const devices = (await window.micmix.getReport()).devices;
    const explicit = d => !['default', 'communications'].includes(d.deviceId) && !/CABLE/i.test(d.label);
    const mic = devices.find(d => d.kind === 'audioinput' && explicit(d) && /Yeti/i.test(d.label));
    const headphones = devices.find(d => d.kind === 'audiooutput' && explicit(d) && /Headset Realtek/i.test(d.label));
    if (!mic || !headphones) throw new Error('Test devices are missing');
    const frames = [];
    const off = window.micmix.onMeters(m => frames.push({ t: Date.now() - started, music: m.music }));
    const stateLog = [];
    const offState = window.micmix.onAudioState(s => { const last = stateLog[stateLog.length - 1]; if (!last || last.playing !== s.playing || last.error !== s.error) stateLog.push({ t: Date.now() - started, playing: s.playing, error: s.error }); });
    try {
      await window.micmix.command({ type: 'start', deviceId: mic.deviceId, monitorId: headphones.deviceId });
      await window.micmix.command({ type: 'seek', seconds: 30 });
      await window.micmix.command({ type: 'play' });
      await waitFor(state => state.playing, 'play');
      await sleep(${seconds} * 1000);
      return { frames, stateLog };
    } finally { await window.micmix.command({ type: 'stop' }); off(); offState(); }
  })()`);
  clearInterval(poll);
  // Audio gaps: runs of >= 3 consecutive meter frames (~150 ms) below -60 dBFS while the video clock advanced.
  const gaps = [];
  let run = null;
  for (const frame of result.frames) {
    if (frame.music < 0.001) { if (!run) run = { start: frame.t, frames: 0 }; run.frames++; }
    else if (run) { if (run.frames >= 3) gaps.push({ start: run.start, ms: frame.t - run.start }); run = null; }
  }
  const stalls = [], jumps = [];
  for (let i = 1; i < clock.length; i++) {
    const a = clock[i - 1], b = clock[i];
    if (!a?.currentTime && a?.currentTime !== 0 || !b?.currentTime) continue;
    if (a.paused || b.paused) continue;
    const advanced = b.currentTime - a.currentTime, wall = (b.t - a.t) / 1000;
    if (advanced < 0.02) stalls.push({ t: b.t, at: b.currentTime, readyState: b.readyState, bufferedAhead: Number((b.buffered - b.currentTime).toFixed(1)) });
    else if (Math.abs(advanced - wall) > 0.5) jumps.push({ t: b.t, from: a.currentTime, to: b.currentTime, wall });
  }
  const audioGapsDuringPlayback = gaps.filter(gap => !stalls.some(stall => Math.abs(stall.t - gap.start) < 600));
  const summary = { seconds, meterFrames: result.frames.length, clockSamples: clock.length,
    audioGaps: gaps, audioGapsNotExplainedByStall: audioGapsDuringPlayback, videoStalls: stalls, videoJumps: jumps,
    playerEvents, stateLog: result.stateLog, minBufferedAhead: Math.min(...clock.filter(c => c?.currentTime).map(c => c.buffered - c.currentTime)).toFixed(1),
    audibleTests: 'NOT RUN. Mic 0, master 0, monitor off, YouTube own output muted.' };
  await mkdir(path.join(root, 'artifacts'), { recursive: true });
  await writeFile(path.join(root, 'artifacts', 'youtube-gaps.json'), JSON.stringify({ ...summary, clock, frames: result.frames }, null, 2));
  console.log(JSON.stringify(summary, null, 1));
};
