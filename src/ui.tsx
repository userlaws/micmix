import React, { useEffect, useState, useRef, useLayoutEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { initialAudioState, emptyMeters, cablePresent, type DeviceReport, type AudioCommand, type MixerSettings, type Channel, type SetupConfig, type IntegrationStatus } from './shared';
import { microphoneChoices, playbackChoices } from './devices';
import { Soundboard } from './soundboard-panel';
import { Wizard } from './wizard';
import './ui.css';

const time = (seconds: number) => Number.isFinite(seconds) ? Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0') : '0:00';
function Mixer({ settings, change }: { settings: MixerSettings; change: (settings: MixerSettings) => void }) {
  const [meters, setMeters] = useState(emptyMeters);
  useEffect(() => window.micmix.onMeters(setMeters), []);
  return <section className="panel mixer"><div className="panel-heading"><h2>Mixer</h2>
    <label className={'toggle ' + (meters.ducking ? 'accent' : '')} title="Lower the music while you talk">
      <input type="checkbox" checked={settings.ducking} onChange={e => change({ ...settings, ducking: e.target.checked })} />
      {meters.ducking ? 'DUCKING' : 'DUCK ON TALK'}</label></div>
    <div className="strips">{(['mic', 'music', 'soundboard'] as Channel[]).map(channel => <div className="strip" key={channel}>
      <label htmlFor={'fader-' + channel}>{channel === 'mic' ? 'Mic' : channel === 'music' ? 'Music' : 'Pads'}</label>
      <div className="fader-pair"><input id={'fader-' + channel} type="range" min="0" max="1" step="0.01" value={settings.levels[channel]}
        onChange={e => change({ ...settings, levels: { ...settings.levels, [channel]: Number(e.target.value) } })} />
        <meter min="0" max="1" low={0.7} high={0.9} optimum={0.3} value={meters[channel]} aria-label={channel + ' peak'} /></div>
      <output>{Math.round(settings.levels[channel] * 100)}%</output>
      <button className={settings.muted[channel] ? 'selected' : ''}
        onClick={() => change({ ...settings, muted: { ...settings.muted, [channel]: !settings.muted[channel] } })}>{settings.muted[channel] ? 'Muted' : 'Mute'}</button>
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
  const [config, setConfig] = useState<SetupConfig | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationStatus>({ discord: false, fivem: false });
  const [error, setError] = useState('');
  const [micId, setMicId] = useState('');
  const [monitorId, setMonitorId] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [wizard, setWizard] = useState(false);
  const wizardDecided = useRef(false);
  const videoSlot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let receivedState = false, receivedReport = false, receivedIntegrations = false;
    const offState = window.micmix.onAudioState(value => { receivedState = true; setAudio(value); });
    const offReport = window.micmix.onReport(value => { receivedReport = true; setReport(value); });
    const offIntegrations = window.micmix.onIntegrations(value => { receivedIntegrations = true; setIntegrations(value); });
    void window.micmix.getAudioState().then(value => { if (!receivedState) setAudio(value); }).catch(e => setError(String(e)));
    void window.micmix.getReport().then(value => { if (!receivedReport) setReport(value); }).catch(e => setError(String(e)));
    void window.micmix.getIntegrations().then(value => { if (!receivedIntegrations) setIntegrations(value); }).catch(() => {});
    void window.micmix.getConfig().then(setConfig).catch(e => setError(String(e)));
    return () => { offState(); offReport(); offIntegrations(); };
  }, []);
  const microphones = microphoneChoices(report?.devices ?? []);
  const playbacks = playbackChoices(report?.devices ?? []);
  const cable = !!report && cablePresent(report.devices);
  useEffect(() => {
    if (!report || !config) return;
    function defaultId(kind: 'audioinput' | 'audiooutput') {
      const d = report!.devices.find(d => d.kind === kind && d.deviceId === 'default');
      return (kind === 'audioinput' ? microphones : playbacks).find(choice => d?.groupId && choice.groupId === d.groupId)?.deviceId ?? '';
    }
    // Saved devices are matched by label: Chromium device IDs do not survive a restart.
    if (!microphones.some(d => d.deviceId === micId)) setMicId(microphones.find(d => d.label === config.micLabel)?.deviceId ?? defaultId('audioinput'));
    if (!playbacks.some(d => d.deviceId === monitorId)) setMonitorId(playbacks.find(d => d.label === config.monitorLabel)?.deviceId ?? defaultId('audiooutput'));
  }, [report, config, micId, monitorId]);
  useEffect(() => {
    if (!config) return;
    const micLabel = microphones.find(d => d.deviceId === micId)?.label ?? null;
    const monitorLabel = playbacks.find(d => d.deviceId === monitorId)?.label ?? null;
    if ((micLabel && micLabel !== config.micLabel) || (monitorLabel && monitorLabel !== config.monitorLabel)) {
      setConfig({ ...config, micLabel: micLabel ?? config.micLabel, monitorLabel: monitorLabel ?? config.monitorLabel });
      void window.micmix.saveDevices(micLabel, monitorLabel).catch(() => {});
    }
  }, [micId, monitorId, config, microphones, playbacks]);
  useEffect(() => {
    if (!config || !report || wizardDecided.current) return;
    wizardDecided.current = true;
    // First launch, or the cable vanished since last time: guide the user again.
    setWizard(!config.setupDone || !cable);
  }, [config, report, cable]);
  async function send(command: AudioCommand, lock = true) {
    setError('');
    if (lock) setBusy(true);
    try { await window.micmix.command(command); }
    catch (e) { setError(String(e)); }
    finally { if (lock) setBusy(false); }
  }
  const run = useCallback((action: () => Promise<void>) => {
    setError(''); setBusy(true);
    void action().catch(e => setError(String(e))).finally(() => setBusy(false));
  }, []);
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
  function finishWizard() {
    void window.micmix.completeSetup().catch(e => setError(String(e)));
    if (config) setConfig({ ...config, setupDone: true });
    setWizard(false);
  }
  const live = audio.status === 'live';
  const current = audio.queue[audio.index];
  useLayoutEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = videoSlot.current?.getBoundingClientRect();
        window.micmix.videoBounds(rect && !wizard && rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth ?
          { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null);
      });
    };
    const observer = new ResizeObserver(update);
    if (videoSlot.current) observer.observe(videoSlot.current);
    window.addEventListener('resize', update); window.addEventListener('scroll', update, true);
    update();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); window.micmix.videoBounds(null); };
  }, [current?.youtubeId, current?.title, settingsOpen, error, audio.error, wizard]);
  return <main onDragOver={e => { e.preventDefault(); }} onDrop={e => { e.preventDefault(); }}>
    {wizard && <Wizard cable={cable} reportError={report?.error ?? null} microphones={microphones} playbacks={playbacks}
      micId={micId} monitorId={monitorId} setMicId={setMicId} setMonitorId={setMonitorId} audio={audio} busy={busy} send={send} finish={finishWizard} />}
    <header><div><span className="eyebrow">YOUR SOUND. ONE MICROPHONE.</span><h1>MicMix <span className="phase">PHASE 4</span></h1></div>
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
    {settingsOpen && <section className="panel settings"><div><h2>Ducking</h2>
      <label className="check"><input type="checkbox" checked={audio.settings.ducking} onChange={e => change({ ...audio.settings, ducking: e.target.checked })} />Lower the music while I talk</label>
      <label>Mic threshold: {audio.settings.duckThreshold} dBFS<input type="range" min="-60" max="-10" step="1" value={audio.settings.duckThreshold} onChange={e => change({ ...audio.settings, duckThreshold: Number(e.target.value) })} /></label>
      <label>Music reduction: {audio.settings.duckDb} dB<input type="range" min="-30" max="0" step="1" value={audio.settings.duckDb} onChange={e => change({ ...audio.settings, duckDb: Number(e.target.value) })} /></label>
      <small>50 ms attack · 400 ms release. Raise the threshold if DUCKING lights up while you are silent.</small></div>
      <div><h2>Monitoring & output</h2>
        <label className="check"><input type="checkbox" checked={audio.settings.monitor} onChange={e => change({ ...audio.settings, monitor: e.target.checked })} />Headphone monitor enabled</label>
        <label className="check"><input type="checkbox" checked={audio.settings.monitorMic} onChange={e => change({ ...audio.settings, monitorMic: e.target.checked })} />Include microphone in headphones</label>
        <label>Monitor volume: {Math.round(audio.settings.monitorVolume * 100)}%<input type="range" min="0" max="1" step="0.01" value={audio.settings.monitorVolume} onChange={e => change({ ...audio.settings, monitorVolume: Number(e.target.value) })} /></label>
        <label className="check"><input type="checkbox" checked={audio.settings.mono} onChange={e => change({ ...audio.settings, mono: e.target.checked })} />Mono virtual microphone output</label>
      </div><div><h2>Diagnostics</h2><button disabled={!live || audio.tone || busy} onClick={() => void send({ type: 'tone' })}>{audio.tone ? 'Sending tone…' : 'Send 1.5-second test tone'}</button>
        <button onClick={() => void window.micmix.refreshDevices().catch(e => setError(String(e)))}>Rescan devices</button>
        <button onClick={() => { setSettingsOpen(false); setWizard(true); }}>Run setup again</button>
        <p>Settings, devices, queue and pads are saved automatically.</p></div>
      <div><h2>Discord & FiveM</h2>
        <p><strong>Discord</strong> {integrations.discord ? '· running' : '· not detected'}: User Settings → Voice & Video → Input Device → <strong>CABLE Output (VB-Audio Virtual Cable)</strong>. Custom profile: Noise Suppression None, Echo Cancellation off, Automatic Gain Control off.</p>
        <p><strong>FiveM</strong> {integrations.fivem ? '· running' : '· not detected'}: Settings → Voice Chat → Input Device → <strong>CABLE Output (VB-Audio Virtual Cable)</strong>.</p>
        <small>Automatic Discord device switching needs a Discord-approved app and an online sign-in, so MicMix keeps this manual and never touches Discord's files.</small></div>
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
        {current?.youtubeId ? <><div className="youtube-slot" ref={videoSlot}><span>Loading YouTube player…</span></div><h3 className="youtube-title">{current.title}{audio.buffering && <span className="muted"> · Buffering…</span>}</h3></> :
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
      <Soundboard pads={audio.pads} active={audio.activePads} live={live} busy={busy} run={run} play={slot => void send({ type: 'pad', slot }, false)} />
    </div>
    <footer><span className={cable ? 'accent' : 'error-text'}>{cable ? '● Virtual Mic OK' : '● Virtual Mic missing'}</span>
      <span className={integrations.discord ? 'accent' : ''}>{integrations.discord ? '● Discord running · Input Device → CABLE Output' : '○ Discord not detected'}</span>
      <span className={integrations.fivem ? 'accent' : ''}>{integrations.fivem ? '● FiveM running · Voice Chat → CABLE Output' : '○ FiveM not detected'}</span>
      <span>{audio.settings.monitor ? 'Monitor: ' + (audio.settings.monitorMic ? 'music + mic' : 'music only') : 'Monitor off'}</span></footer>
    <p className="checkpoint">Phase 4 checkpoint: close MicMix, delete <strong>%APPDATA%\MicMix\config.json</strong>, relaunch. The setup wizard should run once; afterwards your mic, headphones, faders, queue and pads should survive a restart, and pad hotkeys should fire from any app while LIVE.</p>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
