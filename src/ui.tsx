import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { initialAudioState, emptyMeters, type DeviceReport, type AudioCommand, type MixerSettings, type Channel } from './shared';
import { microphoneChoices, playbackChoices } from './devices';
import './ui.css';

const time = (seconds: number) => Number.isFinite(seconds) ? Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0') : '0:00';
function Mixer({ settings, change }: { settings: MixerSettings; change: (settings: MixerSettings) => void }) {
  const [meters, setMeters] = useState(emptyMeters);
  useEffect(() => window.micmix.onMeters(setMeters), []);
  return <section className="panel mixer"><div className="panel-heading"><h2>Mixer</h2><span className={meters.ducking ? 'accent' : 'muted'}>{meters.ducking ? 'DUCKING' : 'LEVELS'}</span></div>
    <div className="strips">{(['mic', 'music', 'soundboard'] as Channel[]).map(channel => <div className="strip" key={channel}>
      <label htmlFor={'fader-' + channel}>{channel === 'mic' ? 'Mic' : channel === 'music' ? 'Music' : 'Pads'}</label>
      <div className="fader-pair"><input id={'fader-' + channel} type="range" min="0" max="1" step="0.01"
        disabled={channel === 'soundboard'} value={settings.levels[channel]}
        onChange={e => change({ ...settings, levels: { ...settings.levels, [channel]: Number(e.target.value) } })} />
        <meter min="0" max="1" low={0.7} high={0.9} optimum={0.3} value={meters[channel]} aria-label={channel + ' peak'} /></div>
      <output>{Math.round(settings.levels[channel] * 100)}%</output>
      <button className={settings.muted[channel] ? 'selected' : ''} disabled={channel === 'soundboard'}
        onClick={() => change({ ...settings, muted: { ...settings.muted, [channel]: !settings.muted[channel] } })}>{settings.muted[channel] ? 'Muted' : 'Mute'}</button>
      {channel === 'soundboard' && <small>Phase 4</small>}
    </div>)}</div>
    <div className="master"><label htmlFor="master">Master <output>{Math.round(settings.levels.master * 100)}%</output></label>
      <input id="master" type="range" min="0" max="1" step="0.01" value={settings.levels.master}
        onChange={e => change({ ...settings, levels: { ...settings.levels, master: Number(e.target.value) } })} />
      <meter min="0" max="1" low={0.7} high={0.9} optimum={0.3} value={meters.master} aria-label="Master peak" />
      <button className={settings.muted.master ? 'selected' : ''} onClick={() => change({ ...settings, muted: { ...settings.muted, master: !settings.muted.master } })}>{settings.muted.master ? 'Master muted' : 'Mute master'}</button>
      <small>Limiter on · {Math.abs(meters.reduction).toFixed(1)} dB reduction</small>
      {meters.overload && <span className="error-text">Peak guard active — lower source levels</span>}
    </div>
  </section>;
}
function App() {
  const [report, setReport] = useState<DeviceReport | null>(null);
  const [audio, setAudio] = useState(initialAudioState);
  const [error, setError] = useState('');
  const [micId, setMicId] = useState('');
  const [monitorId, setMonitorId] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const videoSlot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let receivedState = false, receivedReport = false;
    const offState = window.micmix.onAudioState(value => { receivedState = true; setAudio(value); });
    const offReport = window.micmix.onReport(value => { receivedReport = true; setReport(value); });
    void window.micmix.getAudioState().then(value => { if (!receivedState) setAudio(value); }).catch(e => setError(String(e)));
    void window.micmix.getReport().then(value => { if (!receivedReport) setReport(value); }).catch(e => setError(String(e)));
    return () => { offState(); offReport(); };
  }, []);
  const microphones = microphoneChoices(report?.devices ?? []);
  const playbacks = playbackChoices(report?.devices ?? []);
  useEffect(() => {
    if (!report) return;
    function defaultId(kind: 'audioinput' | 'audiooutput') {
      const d = report!.devices.find(d => d.kind === kind && d.deviceId === 'default');
      return (kind === 'audioinput' ? microphones : playbacks).find(choice => d?.groupId && choice.groupId === d.groupId)?.deviceId ?? '';
    }
    if (!microphones.some(d => d.deviceId === micId)) setMicId(defaultId('audioinput'));
    if (!playbacks.some(d => d.deviceId === monitorId)) setMonitorId(defaultId('audiooutput'));
  }, [report, micId, monitorId]);
  async function send(command: AudioCommand, lock = true) {
    setError('');
    if (lock) setBusy(true);
    try { await window.micmix.command(command); }
    catch (e) { setError(String(e)); }
    finally { if (lock) setBusy(false); }
  }
  const change = (settings: MixerSettings) => { void send({ type: 'settings', settings }, false); };
  async function addFiles(files?: File[]) {
    setError(''); setBusy(true);
    try {
      const tracks = files ? await window.micmix.dropFiles(files) : await window.micmix.pickFiles();
      if (tracks.length) await window.micmix.command({ type: 'enqueue', tracks });
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }
  async function addYouTube() {
    setError(''); setBusy(true);
    try {
      const track = await window.micmix.youtubeTrack(youtubeUrl);
      const before = await window.micmix.getAudioState();
      await window.micmix.command({ type: 'enqueue', tracks: [track] });
      if (before.queue.length) await window.micmix.command({ type: 'select', index: before.queue.length });
      setYoutubeUrl('');
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }
  const cable = report?.devices.some(d => d.kind === 'audiooutput' && /CABLE Input/i.test(d.label)) &&
    report?.devices.some(d => d.kind === 'audioinput' && /CABLE Output/i.test(d.label));
  const live = audio.status === 'live';
  const current = audio.queue[audio.index];
  useLayoutEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = videoSlot.current?.getBoundingClientRect();
        window.micmix.videoBounds(rect && rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth ?
          { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null);
      });
    };
    const observer = new ResizeObserver(update);
    if (videoSlot.current) observer.observe(videoSlot.current);
    window.addEventListener('resize', update); window.addEventListener('scroll', update, true);
    update();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); window.micmix.videoBounds(null); };
  }, [current?.youtubeId, current?.title, settingsOpen, error, audio.error]);
  return <main onDragOver={e => { e.preventDefault(); }} onDrop={e => { e.preventDefault(); }}>
    <header><div><span className="eyebrow">YOUR SOUND. ONE MICROPHONE.</span><h1>MicMix <span className="phase">PHASE 3</span></h1></div>
      <div className="header-actions"><button className={'air ' + (live ? 'live' : '')}
        disabled={audio.status === 'off' && (busy || !micId || !cable || !report?.setSinkIdSupported || (audio.settings.monitor && !monitorId))}
        onClick={() => void send(audio.status === 'off' ? { type: 'start', deviceId: micId, monitorId } : { type: 'stop' })}>
        {live ? '● LIVE · Go off air' : audio.status === 'starting' ? 'Starting… Cancel' : '○ OFF AIR · Go live'}</button>
        <button className="gear" aria-label="Settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}>⚙</button></div>
    </header>
    {(error || audio.error || report?.error) && <p role="alert" className="banner">{error || audio.error || report?.error}</p>}
    <section className="devices panel">
      <label htmlFor="microphone">Microphone<select id="microphone" disabled={audio.status !== 'off' || busy} value={micId} onChange={e => setMicId(e.target.value)}>
        <option value="">Choose your real microphone</option>{microphones.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}</select></label>
      <label htmlFor="headphones">Headphone monitor<select id="headphones" disabled={audio.status !== 'off' || busy} value={monitorId} onChange={e => setMonitorId(e.target.value)}>
        <option value="">Choose your headphones</option>{playbacks.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}</select></label>
      <span className="device-note">Change devices while OFF AIR.<br />Monitor excludes your mic by default.</span>
    </section>
    {settingsOpen && <section className="panel settings"><div><h2>Settings</h2>
      <label className="check"><input type="checkbox" checked={audio.settings.ducking} onChange={e => change({ ...audio.settings, ducking: e.target.checked })} />Auto-duck music when I speak</label>
      <label>Mic threshold: {audio.settings.duckThreshold} dBFS<input type="range" min="-60" max="-10" step="1" value={audio.settings.duckThreshold} onChange={e => change({ ...audio.settings, duckThreshold: Number(e.target.value) })} /></label>
      <label>Music reduction: {audio.settings.duckDb} dB<input type="range" min="-30" max="0" step="1" value={audio.settings.duckDb} onChange={e => change({ ...audio.settings, duckDb: Number(e.target.value) })} /></label>
      <small>50 ms attack · 400 ms release</small></div>
      <div><h2>Monitoring & output</h2>
        <label className="check"><input type="checkbox" checked={audio.settings.monitor} onChange={e => change({ ...audio.settings, monitor: e.target.checked })} />Headphone monitor enabled</label>
        <label className="check"><input type="checkbox" checked={audio.settings.monitorMic} onChange={e => change({ ...audio.settings, monitorMic: e.target.checked })} />Include microphone in headphones</label>
        <label>Monitor volume: {Math.round(audio.settings.monitorVolume * 100)}%<input type="range" min="0" max="1" step="0.01" value={audio.settings.monitorVolume} onChange={e => change({ ...audio.settings, monitorVolume: Number(e.target.value) })} /></label>
        <label className="check"><input type="checkbox" checked={audio.settings.mono} onChange={e => change({ ...audio.settings, mono: e.target.checked })} />Mono virtual microphone output</label>
      </div><div><h2>Diagnostics</h2><button disabled={!live || audio.tone || busy} onClick={() => void send({ type: 'tone' })}>{audio.tone ? 'Sending tone…' : 'Send 1.5-second test tone'}</button>
        <button onClick={() => void window.micmix.refreshDevices().catch(e => setError(String(e)))}>Rescan devices</button>
        <p>Settings and queue are session-only until Phase 4.</p></div>
    </section>}
    <div className="workspace"><Mixer settings={audio.settings} change={change} />
      <section className={'panel music ' + (dragging ? 'dragging' : '')}
        onDragEnter={e => { e.preventDefault(); setDragging(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
        onDrop={e => { e.preventDefault(); setDragging(false); void addFiles(Array.from(e.dataTransfer.files)); }}>
        <div className="panel-heading"><h2>Music</h2><button disabled={busy} onClick={() => void addFiles()}>＋ Add files</button></div>
        <form className="youtube-form" onSubmit={e => { e.preventDefault(); void addYouTube(); }}>
          <input aria-label="YouTube URL" type="url" required placeholder="Paste a YouTube link…" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} />
          <button disabled={busy || !youtubeUrl.trim()} type="submit">Load link</button>
        </form>
        {current?.youtubeId ? <><div className="youtube-slot" ref={videoSlot}><span>Loading YouTube player…</span></div><h3 className="youtube-title">{current.title}</h3></> :
        <div className="now-playing"><span className="eyebrow">{audio.playing ? 'NOW PLAYING' : current ? 'READY TO PLAY' : 'MUSIC SOURCES'}</span>
          <div className="record-icon" aria-hidden="true">♫</div><h3>{current?.title ?? 'Bring your music'}</h3>
          <p>{current ? 'Local file · ' + (audio.index + 1) + ' of ' + audio.queue.length : 'Paste a YouTube link above, or drop MP3, WAV, FLAC, or OGG files here'}</p>
          {!live && <small>Go LIVE to play. OFF AIR pauses and silences all audio.</small>}</div>}
        <div className="seek"><input aria-label="Seek music" type="range" min="0" max={audio.duration || 1} step="0.1" value={Math.min(audio.position, audio.duration || 1)}
          disabled={!live || !audio.duration || busy} onChange={e => void send({ type: 'seek', seconds: Number(e.target.value) }, false)} />
          <div><span>{time(audio.position)}</span><span>{time(audio.duration)}</span></div></div>
        <div className="transport"><button className="play" disabled={!live || !current || busy} onClick={() => void send({ type: audio.playing ? 'pause' : 'play' })}>{audio.playing ? 'Ⅱ Pause' : '▶ Play'}</button>
          <button disabled={!current || audio.index + 1 >= audio.queue.length || busy} onClick={() => void send({ type: 'next' })}>Skip →</button></div>
        <div className="panel-heading queue-heading"><h2>Queue <span className="muted">{audio.queue.length}</span></h2><button disabled={!audio.queue.length || busy} onClick={() => void send({ type: 'clear' })}>Clear</button></div>
        <ol className="queue">{audio.queue.map((track, index) => <li key={track.id + '-' + index} className={index === audio.index ? 'current' : ''}>
          <button className="queue-track" disabled={busy} onClick={() => void send({ type: 'select', index })}><span>{String(index + 1).padStart(2, '0')}</span><span>{track.title}</span></button>
          <button aria-label={'Remove ' + track.title} disabled={busy} onClick={() => void send({ type: 'remove', index })}>×</button></li>)}</ol>
        {!audio.queue.length && <p className="empty">Your queue is empty. Add files to get started.</p>}
      </section>
      <section className="panel soundboard"><div className="panel-heading"><h2>Soundboard</h2><span className="muted">PHASE 4</span></div><div className="pads">{Array.from({ length: 9 }, (_, i) => <button disabled key={i}>{String(i + 1).padStart(2, '0')}</button>)}</div><p>Local clips and global hotkeys arrive in Phase 4.</p></section>
    </div>
    <footer><span className={cable ? 'accent' : 'error-text'}>{cable ? '● Virtual Mic OK' : '● Virtual Mic missing'}</span><span>Discord: manual setup</span><span>FiveM: detection in Phase 4</span><span>{audio.settings.monitor ? 'Monitor: ' + (audio.settings.monitorMic ? 'music + mic' : 'music only') : 'Monitor off'}</span></footer>
    <p className="checkpoint">Phase 3 checkpoint: paste a YouTube link, go LIVE, and press Play. Have a friend confirm video audio + your mic in Discord using <strong>CABLE Output</strong>.
      In Discord’s <strong>Custom</strong> input profile set Noise Suppression to <strong>None</strong>, turn off Echo Cancellation and Automatic Gain Control, and drag Input Sensitivity fully left (or enable automatic) — otherwise Discord treats music as noise and gates it.
      Turn MicMix monitoring off during Discord’s mic test: its playback reaches your mic and ducks the music.</p>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
