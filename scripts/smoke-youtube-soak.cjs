const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
// Silent soak: plays a YouTube embed for a while and records, once per second, whether captured
// audio keeps flowing. Master is 0 and monitor is off, so nothing is audible.
module.exports = async function smoke(ui, worker, root, _registerFiles, youtube) {
  const seconds = Number(process.env.MICMIX_SOAK_SECONDS || 45);
  const events = [];
  youtube.view.webContents.on('console-message', (_event, _level, message) => events.push({ t: Date.now(), console: message.slice(0, 300) }));
  const result = await ui.webContents.executeJavaScript(`(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const waitFor = async (predicate, description) => {
      for (let i = 0; i < 200; i++) {
        const state = await window.micmix.getAudioState();
        if (state.error) throw new Error(state.error);
        if (predicate(state)) return state;
        await sleep(100);
      }
      throw new Error('Timed out: ' + description + ' ' + JSON.stringify(await window.micmix.getAudioState()));
    };
    const initial = await window.micmix.getAudioState();
    await window.micmix.command({ type: 'settings', settings: { ...initial.settings, levels: { mic: 1, music: 1, soundboard: 0, master: 0 }, monitor: false, monitorVolume: 0, ducking: true } });
    const track = await window.micmix.youtubeTrack('https://www.youtube.com/watch?v=M7lc1UVf-VE');
    await window.micmix.command({ type: 'enqueue', tracks: [track] });
    await waitFor(state => state.duration > 0, 'YouTube metadata');
    const devices = (await window.micmix.getReport()).devices;
    const explicit = d => !['default', 'communications'].includes(d.deviceId) && !/CABLE/i.test(d.label);
    const mic = devices.find(d => d.kind === 'audioinput' && explicit(d) && /Yeti/i.test(d.label));
    const headphones = devices.find(d => d.kind === 'audiooutput' && explicit(d) && /Headset Realtek/i.test(d.label));
    if (!mic || !headphones) throw new Error('Test devices are missing');
    let second = { music: 0, mic: 0, master: 0, ducked: 0, frames: 0 };
    const rows = [];
    const off = window.micmix.onMeters(m => { second.music = Math.max(second.music, m.music); second.mic = Math.max(second.mic, m.mic); second.master = Math.max(second.master, m.master); if (m.ducking) second.ducked++; second.frames++; });
    const stateLog = [];
    const offState = window.micmix.onAudioState(s => { const last = stateLog[stateLog.length - 1]; if (!last || last.playing !== s.playing || last.error !== s.error) stateLog.push({ t: Date.now(), playing: s.playing, error: s.error, position: s.position }); });
    try {
      await window.micmix.command({ type: 'start', deviceId: mic.deviceId, monitorId: headphones.deviceId });
      await window.micmix.command({ type: 'play' });
      const started = Date.now();
      for (let i = 0; i < ${seconds}; i++) {
        await sleep(1000);
        const state = await window.micmix.getAudioState();
        rows.push({ s: i + 1, position: Number(state.position.toFixed(1)), playing: state.playing, error: state.error, ...second, music: Number(second.music.toFixed(3)), mic: Number(second.mic.toFixed(3)) });
        second = { music: 0, mic: 0, master: 0, ducked: 0, frames: 0 };
      }
      return { elapsed: Date.now() - started, rows, stateLog, settings: (await window.micmix.getAudioState()).settings };
    } finally { await window.micmix.command({ type: 'stop' }); off(); offState(); }
  })()`);
  const player = await youtube.view.webContents.executeJavaScript(`({ paused: document.querySelector('video')?.paused, ended: document.querySelector('video')?.ended, currentTime: document.querySelector('video')?.currentTime, volume: document.querySelector('video')?.volume, muted: document.querySelector('video')?.muted, visibility: document.visibilityState, url: location.href })`);
  await mkdir(path.join(root, 'artifacts'), { recursive: true });
  await writeFile(path.join(root, 'artifacts', 'youtube-soak.json'), JSON.stringify({ ...result, player, events, audibleTests: 'NOT RUN. Master 0, monitor off, YouTube own output muted.' }, null, 2));
  console.table(result.rows.map(r => ({ s: r.s, pos: r.position, playing: r.playing, music: r.music, mic: r.mic, ducked: r.ducked + '/' + r.frames, err: r.error || '' })));
  console.log('player', JSON.stringify(player));
  console.log('state changes', JSON.stringify(result.stateLog));
};
