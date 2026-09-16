import React, { useEffect, useState, useRef, useLayoutEffect, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { initialAudioState, emptyMeters, cablePresent, CABLE_INPUT, CABLE_OUTPUT, APP_HOTKEY_ACTIONS, type DeviceReport, type AudioCommand, type MixerSettings, type Channel, type UiConfig, type AppHotkeyAction, type IntegrationStatus, type Meters, type UpdateStatus, type EndpointFormat, type EngineInfo } from './shared';
import { acceleratorFromEvent, describeAccelerator } from './hotkeys';
import { microphoneChoices, playbackChoices } from './devices';
import { Soundboard } from './soundboard-panel';
import { YouTubePanel } from './youtube-panel';
import { Wizard } from './wizard';
import { Icon } from './icons';
import { Level, Switch, DeviceSelect } from './controls';
import './ui.css';

const time = (seconds: number) => Number.isFinite(seconds) ? Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0') : '0:00';
const pct = (value: number) => ({ '--p': Math.round(value * 100) + '%' } as React.CSSProperties);
const dbfs = (peak: number) => peak > 0.0001 ? (20 * Math.log10(peak)).toFixed(1) + ' dB' : '-inf dB';
const CHANNEL_META: Record<Channel, { name: string; icon: 'mic' | 'music' | 'grid' | 'waves' }> = {
  mic: { name: 'Mic', icon: 'mic' }, music: { name: 'Music', icon: 'music' }, soundboard: { name: 'Pads', icon: 'grid' }, master: { name: 'Master', icon: 'waves' },
};

function Strip({ channel, settings, change, peak, flag }: { channel: Channel; settings: MixerSettings; change: (settings: MixerSettings) => void; peak: number; flag?: { text: string; title: string; on: boolean } }) {
  const meta = CHANNEL_META[channel];
  const muted = settings.muted[channel];
  return <div className={'strip ' + channel}>
    <div className="strip-icon"><Icon name={meta.icon} size={20} /></div>
    <span className="strip-name">{meta.name}{flag && <small className={'strip-flag' + (flag.on ? ' on' : '')} title={flag.title}>{flag.text}</small>}</span>
    <output htmlFor={'fader-' + channel}>{Math.round(settings.levels[channel] * 100)}%</output>
    <button className={'btn icon ' + (muted ? 'on' : '')} aria-label={(muted ? 'Unmute ' : 'Mute ') + meta.name} aria-pressed={muted}
      onClick={() => change({ ...settings, muted: { ...settings.muted, [channel]: !muted } })}><Icon name={muted ? 'speakerOff' : 'speaker'} /></button>
    <input id={'fader-' + channel} aria-label={meta.name + ' level'} type="range" min="0" max="1" step="0.01" value={settings.levels[channel]} style={pct(settings.levels[channel])}
      onChange={e => change({ ...settings, levels: { ...settings.levels, [channel]: Number(e.target.value) } })} />
    <Level value={peak} />
  </div>;
}
function Mixer({ settings, change, meters }: { settings: MixerSettings; change: (settings: MixerSettings) => void; meters: Meters }) {
  // The voice light answers "is the limiter touching my voice right now?", the usual cause of a squashed, boxy mic.
  const voiceDb = Math.abs(meters.voiceReduction);
  const voiceFlag = voiceDb >= 0.5 ? { text: 'Limiting voice · ' + voiceDb.toFixed(1) + ' dB', title: 'The limiter is squashing your voice right now. Lower the Mic fader or your microphone gain until this stays off.', on: true }
    : settings.voiceHeadroom ? { text: 'Voice headroom on', title: 'Your voice has its own limiter; loud music cannot pump or squash it.', on: false }
    : { text: 'Shared limiter', title: 'Your voice shares one limiter with the music. Turn on Voice headroom in Settings to separate them.', on: false };
  return <section className="card mixer">
    <div className="card-head"><div><h2>Mixer</h2><div className="sub">Balance your audio sources</div></div></div>
    {(['mic', 'music', 'soundboard'] as Channel[]).map(channel => <Strip key={channel} channel={channel} settings={settings} change={change} peak={meters[channel]} flag={channel === 'mic' ? voiceFlag : undefined} />)}
    <div className={'duck-row ' + (meters.ducking ? 'active' : '')}>
      <Icon name="duck" size={22} />
      <div className="duck-text" style={{ flex: 1 }}><b>Duck music while talking</b>
        <small>{meters.ducking ? 'Ducking now: your voice is on top.' : 'Automatically lower music when you speak.'}</small></div>
      <Switch checked={settings.ducking} onChange={ducking => change({ ...settings, ducking })} label="Duck music while talking" />
    </div>
    <Strip channel="master" settings={settings} change={change} peak={meters.master} />
    <div className="limiter"><span>Limiter on · {Math.abs(meters.reduction).toFixed(1)} dB reduction</span>
      {meters.overload && <span className="error-text">Peak guard active, lower source levels</span>}</div>
  </section>;
}
function Wave({ level, live }: { level: number; live: boolean }) {
  // Purely decorative: a symmetric bar field driven by the master peak, so it breathes with the outgoing mix.
  const shape = useMemo(() => Array.from({ length: 34 }, (_, i) => 0.35 + 0.65 * Math.abs(Math.sin(i * 0.9 + 1.3) * Math.cos(i * 0.37))), []);
  return <div className="wave" aria-hidden="true">{shape.map((factor, i) => <i key={i} style={{ '--h': (live ? Math.max(3, 4 + level * 42 * factor) : 3) + 'px' } as React.CSSProperties} />)}</div>;
}

function SampleRates({ formats, micLabel, engine }: { formats: EndpointFormat[]; micLabel: string | null; engine: EngineInfo | null }) {
  const find = (flow: EndpointFormat['flow'], test: (f: EndpointFormat) => boolean) => formats.find(f => f.flow === flow && test(f));
  const rows = [
    { name: 'Microphone', format: micLabel ? find('capture', f => f.label === micLabel) ?? find('capture', f => micLabel.startsWith(f.label)) ?? find('capture', f => !!f.device && micLabel.includes(f.device)) : undefined },
    { name: 'CABLE Input', format: find('render', f => CABLE_INPUT.test(f.label)) },
    { name: 'CABLE Output', format: find('capture', f => CABLE_OUTPUT.test(f.label)) },
  ];
  const known = rows.filter(r => r.format).map(r => r.format!.sampleRate);
  if (engine) known.push(engine.sampleRate);
  const status = !known.length ? 'unknown' : new Set(known).size > 1 ? 'mismatch' : 'aligned';
  const hz = (n: number) => n.toLocaleString() + ' Hz';
  return <div className="row col sample-rates"><div className="row-top"><span>Sample rates</span><span className={'val ' + (status === 'mismatch' ? 'error-text' : status === 'aligned' ? 'accent' : '')}>{status}</span></div>
    <small>{rows.map(r => r.name + ' ' + (r.format ? hz(r.format.sampleRate) + ' ' + r.format.bits + '-bit' : 'unknown')).join(' · ')}
      {engine ? ' · MicMix engine ' + hz(engine.sampleRate) + (engine.micSampleRate ? ' (mic captured at ' + hz(engine.micSampleRate) + ')' : '') : ' · MicMix engine: go live to read'}</small>
    {status === 'mismatch'
      ? <small className="error-text">Windows resamples between different rates, which softens audio. Set every device above to the same rate (48000 Hz recommended): Windows Settings → System → Sound → choose the device → Format.</small>
      : <small>These are the rates Windows runs each device at. Matching rates mean nothing is resampled between MicMix and your voice app.</small>}
  </div>;
}
const mb = (bytes: number) => (bytes / 1048576).toFixed(bytes >= 104857600 ? 0 : 1) + ' MB';
const clock = (at: number) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function fivemTuneText(tune: IntegrationStatus['fivemTune']): string {
  if (!tune.enabled) return tune.state === 'waiting' ? 'FiveM defaults come back when FiveM closes.' : 'Off. FiveM keeps its own noise suppression and bitrate.';
  switch (tune.state) {
    case 'applied': return 'Applied: noise suppression off, 96 kbps voice. Takes effect the next time FiveM starts.';
    case 'waiting': return 'FiveM is running. MicMix applies this as soon as FiveM closes.';
    case 'missing': return 'Waiting for FiveM: its settings file appears after FiveM has run once on this PC.';
    case 'error': return 'Could not update FiveM settings' + (tune.detail ? ': ' + tune.detail : '.');
    default: return 'Ready.';
  }
}
function updateSummary(status: UpdateStatus, current: string, supported: boolean): string {
  if (!supported) return 'MicMix ' + current + '. Updates apply to installed builds only.';
  switch (status.phase) {
    case 'checking': return 'Looking for a newer version…';
    case 'available': return 'MicMix ' + status.version + ' found. Preparing download…';
    case 'downloading': return 'Downloading MicMix ' + status.version + ' · ' + Math.round(status.percent) + '% of ' + mb(status.total);
    case 'downloaded': return 'MicMix ' + status.version + ' is ready. Restart to finish, or it installs when you quit.';
    case 'installing': return 'Installing MicMix ' + status.version + '…';
    case 'upToDate': return 'MicMix ' + current + ' is up to date · checked ' + clock(status.at);
    case 'error': return 'Update check failed: ' + status.message;
    default: return 'MicMix ' + current + '. Checks run on launch and every few hours.';
  }
}
// Settings > Shortcuts: one row per app action. Click the key button, press the combination; Esc cancels, Backspace clears.
function Shortcuts({ config, run }: { config: UiConfig; run(action: () => Promise<void>): void }) {
  const [capturing, setCapturing] = useState<AppHotkeyAction | null>(null);
  useEffect(() => {
    if (capturing === null) return;
    const action = capturing;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault(); event.stopPropagation();
      if (event.code === 'Escape') { setCapturing(null); return; }
      if (event.code === 'Backspace') { run(() => window.micmix.setHotkey(action, null)); setCapturing(null); return; }
      const accelerator = acceleratorFromEvent(event);
      if (!accelerator) return;
      run(() => window.micmix.setHotkey(action, accelerator)); setCapturing(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturing, run]);
  return <>{APP_HOTKEY_ACTIONS.map(({ action, name, hint }) => {
    const hotkey = config.hotkeys[action];
    const unavailable = !!hotkey && config.unavailableHotkeys.includes(action);
    return <div className="row shortcut" key={action}>
      <div className="row-label"><span>{name}</span><small className={unavailable ? 'error-text' : ''}>{unavailable ? 'Another app or Windows owns this shortcut. Choose a different one.' : hint}</small></div>
      <button className={'btn small key ' + (capturing === action ? 'selected' : '')} aria-label={'Shortcut for ' + name} onClick={() => setCapturing(capturing === action ? null : action)}>
        <Icon name="keyboard" size={14} />{capturing === action ? 'Press keys… Esc cancels, Backspace clears' : hotkey ? describeAccelerator(hotkey) : 'Off'}</button>
    </div>;
  })}</>;
}
// Settings: Discord-style. A section list on the left jumps to (and follows) the scrolling column on the right.
interface SettingsSection { id: string; name: string; className?: string; body: React.ReactNode }
function SettingsSheet({ sections, close }: { sections: SettingsSection[]; close(): void }) {
  const [active, setActive] = useState(sections[0]?.id ?? '');
  const body = useRef<HTMLDivElement>(null);
  const spy = useCallback(() => {
    const el = body.current; if (!el) return;
    const groups = Array.from(el.querySelectorAll<HTMLElement>('.group[data-section]'));
    const bottomed = el.scrollTop + el.clientHeight >= el.scrollHeight - 32;
    let current = groups[0]?.dataset.section ?? '';
    // The active entry is the last section whose top has crossed the upper third of the viewport.
    const line = el.scrollTop + el.clientHeight * 0.35;
    for (const g of groups) if (g.offsetTop - el.offsetTop <= line) current = g.dataset.section ?? current;
    if (bottomed && groups.length) current = groups[groups.length - 1].dataset.section ?? current;
    setActive(current);
  }, []);
  const jump = (id: string) => {
    const el = body.current?.querySelector<HTMLElement>('.group[data-section="' + id + '"]');
    if (el && body.current) body.current.scrollTo({ top: el.offsetTop - body.current.offsetTop - 8, behavior: 'smooth' });
    setActive(id);
  };
  return <section className="card sheet settings" role="dialog" aria-modal="true" aria-label="Settings">
    <div className="sheet-head"><h2>Settings</h2><button className="btn icon" aria-label="Close settings" onClick={close}><Icon name="close" /></button></div>
    <div className="sheet-layout">
      <nav className="settings-nav" aria-label="Settings sections">
        {sections.map(section => <button key={section.id} className={active === section.id ? 'on' : ''} aria-current={active === section.id ? 'true' : undefined}
          onClick={() => jump(section.id)}>{section.name}</button>)}
      </nav>
      <div className="sheet-body" ref={body} onScroll={spy}>
        {sections.map(section => <section key={section.id} className={'group ' + (section.className ?? '')} data-section={section.id}>{section.body}</section>)}
      </div>
    </div>
  </section>;
}
// Header update chip: quiet while nothing is happening, a thin progress ring while downloading, green when
// ready. Clicking opens a popover with what changed. Installing is always the user's choice; nothing floats
// over the mixer and MicMix never restarts on its own.
function UpdateChip({ status, live, current }: { status: UpdateStatus; live: boolean; current: string }) {
  const [open, setOpen] = useState(false);
  const [seenUpdate, setSeenUpdate] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => { if (status.phase === 'available' || status.phase === 'downloading' || status.phase === 'downloaded') setSeenUpdate(true); }, [status.phase]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown); window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);
  const failed = status.phase === 'error' && seenUpdate;
  const active = status.phase === 'available' || status.phase === 'downloading' || status.phase === 'downloaded' || status.phase === 'installing' || failed;
  if (!active) return null;
  const percent = status.phase === 'downloading' ? status.percent : status.phase === 'available' ? 0 : 100;
  const version = 'version' in status ? status.version : '';
  const notes = 'notes' in status ? status.notes : '';
  const label = status.phase === 'downloading' ? Math.round(percent) + '%' : status.phase === 'downloaded' ? 'Restart to update' : status.phase === 'installing' ? 'Installing…' : failed ? 'Update failed' : 'Update';
  const detail = status.phase === 'downloading' ? mb(status.transferred) + ' of ' + mb(status.total) + ' · ' + mb(status.bytesPerSecond) + '/s'
    : status.phase === 'available' ? 'Preparing download…'
    : status.phase === 'downloaded' ? 'Downloaded and verified. Restart whenever you like; otherwise it installs the next time you quit.'
    : status.phase === 'installing' ? 'Hang tight, MicMix reopens in a few seconds.'
    : status.phase === 'error' ? status.message : '';
  return <div className={'update-wrap' + (open ? ' open' : '')} ref={wrap}>
    <button className={'update-chip ' + status.phase} aria-expanded={open} aria-label={'Update ' + label} onClick={() => setOpen(!open)}>
      <span className={'chip-ring ' + (status.phase === 'downloaded' ? 'done' : failed ? 'bad' : '')} style={{ '--p': percent + '%' } as React.CSSProperties}>
        {status.phase === 'downloaded' ? <Icon name="check" size={12} /> : status.phase === 'downloading' ? null : failed ? <Icon name="close" size={12} /> : <i className="spinner tiny" />}</span>
      <span className="chip-label">{label}</span>
    </button>
    {open && <div className="update-pop" role="dialog" aria-label="Update details">
      <div className="pop-head"><b>MicMix {version ? 'v' + version : ''}</b><small>You have v{current}</small></div>
      <small className="pop-detail">{detail}</small>
      {status.phase === 'downloading' && <div className="update-bar"><i style={{ width: percent + '%' }} /></div>}
      {notes && <div className="pop-notes"><span className="eyebrow">What's new</span><pre>{notes}</pre></div>}
      <div className="pop-actions">
        {status.phase === 'downloaded' && <>
          <button className="btn primary small" disabled={live} title={live ? 'Go off air first' : undefined} onClick={() => { setOpen(false); void window.micmix.installUpdate().catch(() => {}); }}><Icon name="refresh" size={14} />Restart now</button>
          <button className="btn small" onClick={() => setOpen(false)}>On next quit</button>
          {live && <small className="pop-live">Go off air first, so an update never cuts your session.</small>}</>}
        {failed && <button className="btn small" onClick={() => { setOpen(false); void window.micmix.checkForUpdates().catch(() => {}); }}><Icon name="refresh" size={14} />Retry</button>}
      </div>
    </div>}
  </div>;
}
function App() {
  const [report, setReport] = useState<DeviceReport | null>(null);
  const [audio, setAudio] = useState(initialAudioState);
  const [meters, setMeters] = useState(emptyMeters);
  const [config, setConfig] = useState<UiConfig | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationStatus>({ discord: false, fivem: false, fivemTune: { enabled: true, state: 'missing', detail: null } });
  const [update, setUpdate] = useState<UpdateStatus>({ phase: 'idle' });
  const [updatesSupported, setUpdatesSupported] = useState(false);
  const [error, setError] = useState('');
  const [micId, setMicId] = useState('');
  const [monitorId, setMonitorId] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [browsingYouTube, setBrowsingYouTube] = useState(false);
  const [source, setSource] = useState<'youtube' | 'local'>('youtube');
  const [wizard, setWizard] = useState(false);
  const [formats, setFormats] = useState<EndpointFormat[]>([]);
  const wizardDecided = useRef(false);
  const videoSlot = useRef<HTMLDivElement>(null);
  // The global "Go live / off air" shortcut presses the header button with whatever devices are selected right now.
  const liveHotkey = useRef(() => {});
  useEffect(() => {
    let receivedState = false, receivedReport = false, receivedIntegrations = false;
    const offState = window.micmix.onAudioState(value => { receivedState = true; setAudio(value); });
    const offReport = window.micmix.onReport(value => { receivedReport = true; setReport(value); });
    const offIntegrations = window.micmix.onIntegrations(value => { receivedIntegrations = true; setIntegrations(value); });
    const offMeters = window.micmix.onMeters(setMeters);
    const offUpdate = window.micmix.onUpdate(setUpdate);
    const offConfig = window.micmix.onConfig(setConfig);
    const offHotkey = window.micmix.onHotkey(action => { if (action === 'live') liveHotkey.current(); });
    void window.micmix.getUpdate().then(setUpdate).catch(() => {});
    void window.micmix.updatesSupported().then(setUpdatesSupported).catch(() => {});
    void window.micmix.getAudioState().then(value => { if (!receivedState) setAudio(value); }).catch(e => setError(String(e)));
    void window.micmix.getReport().then(value => { if (!receivedReport) setReport(value); }).catch(e => setError(String(e)));
    void window.micmix.getIntegrations().then(value => { if (!receivedIntegrations) setIntegrations(value); }).catch(() => {});
    void window.micmix.getConfig().then(setConfig).catch(e => setError(String(e)));
    return () => { offState(); offReport(); offIntegrations(); offMeters(); offUpdate(); offConfig(); offHotkey(); };
  }, []);
  useEffect(() => {
    if (!settingsOpen) return;
    void window.micmix.getEndpointFormats().then(setFormats).catch(() => {});
  }, [settingsOpen, report]);
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
  async function addYouTube(value: string, select: boolean) {
    setError(''); setBusy(true);
    try {
      const track = await window.micmix.youtubeTrack(value);
      if (!track) return;
      const before = await window.micmix.getAudioState();
      await window.micmix.command({ type: 'enqueue', tracks: [track] });
      if (select && before.queue.length) await window.micmix.command({ type: 'select', index: before.queue.length });
    }
    finally { setBusy(false); }
  }
  function finishWizard() {
    void window.micmix.completeSetup().catch(e => setError(String(e)));
    if (config) setConfig({ ...config, setupDone: true });
    setWizard(false);
  }
  const live = audio.status === 'live';
  const current = audio.queue[audio.index];
  const overlay = wizard || settingsOpen;
  useLayoutEffect(() => {
    // The YouTube BrowserView always paints above the page, so it is hidden whenever a sheet covers the UI.
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = videoSlot.current?.getBoundingClientRect();
        window.micmix.videoBounds(rect && !overlay && rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth ?
          { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null);
      });
    };
    const observer = new ResizeObserver(update);
    if (videoSlot.current) observer.observe(videoSlot.current);
    window.addEventListener('resize', update); window.addEventListener('scroll', update, true);
    update();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); window.micmix.videoBounds(null); };
  }, [current?.youtubeId, current?.title, overlay, error, audio.error, source, audio.queue.length, browsingYouTube]);
  const canGoLive = !(busy || !micId || !cable || !report?.setSinkIdSupported || (audio.settings.monitor && !monitorId));
  liveHotkey.current = () => {
    if (wizard) return;
    if (audio.status === 'off') { if (canGoLive) void send({ type: 'start', deviceId: micId, monitorId }); }
    else void send({ type: 'stop' });
  };
  const problem = error || audio.error || report?.error;
  const s = audio.settings;
  return <main onDragOver={e => { e.preventDefault(); }} onDrop={e => { e.preventDefault(); }}>
    <div className="titlebar">MicMix</div>
    {wizard && <Wizard cable={cable} reportError={report?.error ?? null} microphones={microphones} playbacks={playbacks}
      micId={micId} monitorId={monitorId} setMicId={setMicId} setMonitorId={setMonitorId} audio={audio} busy={busy} send={send} finish={finishWizard} />}
    <header>
      <div className="brand"><img className="logo" src="./brand/micmix-mark.svg" alt="" width={52} height={52} />
        <div><h1>Mic<span className="mix">Mix</span>{config?.appVersion && <span className="version">v{config.appVersion}</span>}</h1><div className="sub">Your voice + your music. One microphone.</div></div></div>
      <div className="header-actions">
        <div className="air-group">
          <div className="air-status"><span className={'dot ' + (live ? 'on' : audio.status === 'starting' ? 'warn' : '')} />
            <div><b>{live ? 'LIVE' : audio.status === 'starting' ? 'STARTING' : 'OFF AIR'}</b>
              <small>{live ? 'Your mic is on air' : audio.status === 'starting' ? 'Opening devices…' : 'Nothing reaches the virtual mic'}</small></div></div>
          <button className={'btn air ' + (live ? 'live' : 'primary')} disabled={audio.status === 'off' && !canGoLive}
            onClick={() => void send(audio.status === 'off' ? { type: 'start', deviceId: micId, monitorId } : { type: 'stop' })}>
            <Icon name={live ? 'stop' : audio.status === 'starting' ? 'close' : 'bolt'} size={16} />{live ? 'Go off air' : audio.status === 'starting' ? 'Cancel' : 'Go live'}</button>
        </div>
        <UpdateChip status={update} live={live} current={config?.appVersion ?? ''} />
        <button className="btn icon gear" aria-label="Settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}><Icon name="gear" size={22} /></button>
      </div>
    </header>
    {problem && <p role="alert" className="banner"><Icon name="close" size={18} />{problem}</p>}
    <section className="card devices">
      <div className="device"><div className="device-icon"><Icon name="mic" size={20} /></div><div className="device-body"><label htmlFor="microphone">Microphone</label>
        <DeviceSelect id="microphone" disabled={audio.status !== 'off' || busy} value={micId} onChange={setMicId} devices={microphones} placeholder="Choose your real microphone" /></div></div>
      <div className="device"><div className="device-icon violet"><Icon name="headphones" size={20} /></div><div className="device-body"><label htmlFor="headphones">Headphone monitor</label>
        <DeviceSelect id="headphones" disabled={audio.status !== 'off' || busy} value={monitorId} onChange={setMonitorId} devices={playbacks} placeholder="Choose your headphones" /></div></div>
      <div className="device"><div className="device-icon pink"><Icon name="waves" size={20} /></div><div className="device-body"><label>Output device (virtual mic)</label>
        <div className="field" title={cable ? 'Windows lists this as CABLE Input / CABLE Output' : 'VB-CABLE driver not found'}><span className={'dot ' + (cable ? 'on' : 'err')} />{cable ? 'MicMix Virtual Microphone' : 'Virtual microphone missing'}</div></div></div>
    </section>
    <div className="workspace">
      <Mixer settings={s} change={change} meters={meters} />
      <section className={'card music ' + (dragging ? 'dragging' : '')}
        onDragEnter={e => { e.preventDefault(); setDragging(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
        onDrop={e => { e.preventDefault(); setDragging(false); void addFiles(Array.from(e.dataTransfer.files)); }}>
        <div className="card-head"><div><h2>Music</h2><div className="sub">Search YouTube, paste a link, or play a local file</div></div>
          <div className="segment" role="tablist">
            <button role="tab" aria-selected={source === 'youtube'} className={source === 'youtube' ? 'on' : ''} onClick={() => setSource('youtube')}><Icon name="youtube" size={16} />YouTube</button>
            <button role="tab" aria-selected={source === 'local'} className={source === 'local' ? 'on' : ''} onClick={() => setSource('local')}><Icon name="file" size={16} />Local file</button>
          </div></div>
        {source === 'youtube' ? <YouTubePanel busy={busy} queue={audio.queue} onAdd={addYouTube} onBrowse={setBrowsingYouTube} /> : <div className="source-row">
          <div className="drop-hint"><Icon name="file" size={18} />Drop MP3, WAV, FLAC or OGG files anywhere on this card</div>
          <button className="btn primary" disabled={busy} onClick={() => void addFiles()}><Icon name="plus" size={16} />Add files</button>
        </div>}
        {(!browsingYouTube || current) && <div className={'player' + (browsingYouTube ? ' browsing' : '')}>
          {current?.youtubeId && !browsingYouTube ? <><div className="youtube-slot" ref={videoSlot}><span>Loading YouTube player…</span></div>
            <h3 className="youtube-title">{current.title}{audio.buffering && <span className="muted"> · Buffering…</span>}</h3></> :
          <div className="now"><div className={'art ' + (current ? '' : 'idle')}><Icon name="music" size={48} /></div>
            <div className="now-body"><span className="eyebrow">{audio.playing ? 'Now playing' : current ? 'Ready to play' : 'Music sources'}</span>
              <h3>{current?.title ?? 'Bring your music'}</h3>
              <p>{current ? (current.youtubeId ? 'YouTube' : 'Local file') + ' · ' + (audio.index + 1) + ' of ' + audio.queue.length : 'Search YouTube, paste a link, or add local files'}</p>
              {!live && <small>Go live to play. Off air pauses and silences all audio.</small>}</div></div>}
          <div className="seek"><input className="thin" aria-label="Seek music" type="range" min="0" max={audio.duration || 1} step="0.1" value={Math.min(audio.position, audio.duration || 1)}
            style={pct(audio.duration ? Math.min(1, audio.position / audio.duration) : 0)}
            disabled={!live || !audio.duration || busy} onChange={e => void send({ type: 'seek', seconds: Number(e.target.value) }, false)} />
            <div className="times"><span>{time(audio.position)}</span><span>{time(audio.duration)}</span></div></div>
          <div className="transport">
            <button className="btn icon" aria-label="Previous track" disabled={!current || audio.index <= 0 || busy} onClick={() => void send({ type: 'select', index: audio.index - 1 })}><Icon name="prev" size={22} /></button>
            <button className="play" aria-label={audio.playing ? 'Pause' : 'Play'} disabled={!live || !current || busy} onClick={() => void send({ type: audio.playing ? 'pause' : 'play' })}><Icon name={audio.playing ? 'pause' : 'play'} size={30} /></button>
            <button className="btn icon" aria-label="Next track" disabled={!current || audio.index + 1 >= audio.queue.length || busy} onClick={() => void send({ type: 'next' })}><Icon name="next" size={22} /></button>
          </div>
        </div>}
        <div className="queue-head"><h2>Up next <span className="count">{audio.queue.length}</span></h2>
          <button className="btn small" disabled={!audio.queue.length || busy} onClick={() => void send({ type: 'clear' })}>Clear</button></div>
        <ol className="queue">{audio.queue.map((track, index) => <li key={track.id + '-' + index} className={index === audio.index ? 'current' : ''}>
          <button className="queue-track" disabled={busy} onClick={() => void send({ type: 'select', index })}>
            <span className="num">{index + 1}</span><span className="title">{track.title}</span><span className="kind">{track.youtubeId ? 'YouTube' : 'File'}</span></button>
          <button className="remove" aria-label={'Remove ' + track.title} disabled={busy} onClick={() => void send({ type: 'remove', index })}><Icon name="close" size={14} /></button></li>)}</ol>
        {!audio.queue.length && <p className="empty">Your queue is empty. Load a link or add files to get started.</p>}
      </section>
      <Soundboard pads={audio.pads} active={audio.activePads} live={live} busy={busy} run={run} play={slot => void send({ type: 'pad', slot }, false)} />
    </div>
    <section className="card status">
      <div className="status-row">
      <div className="status-main"><span className={'dot ' + (live ? 'on' : cable ? '' : 'err')} />
        <div><b>MicMix Virtual Microphone</b><span className={'state ' + (live ? 'on' : '')}>{live ? '● Broadcasting' : cable ? '○ Off air' : '● Driver missing'}</span>
          <small>{live ? 'Your voice and music are being combined into a single virtual microphone.' : cable ? 'Go live to send your voice and music to Discord, FiveM and any app.' : 'Install VB-CABLE, then run setup again from the gear menu.'}</small></div></div>
      <Wave level={meters.master} live={live} />
      <div className="minis"><span>Mic</span><Level value={meters.mic} /><span>Music</span><Level value={meters.music} /><span>Pads</span><Level value={meters.soundboard} /></div>
      <div className="out-level"><small>Output level</small><b>{live ? dbfs(meters.master) : '—'}</b><Level value={meters.master} /></div>
      </div>
      <div className="chips">
        <span className={'chip ' + (cable ? 'on' : 'err')}><span className={'dot ' + (cable ? 'on' : 'err')} />{cable ? 'Virtual mic OK' : 'Virtual mic missing'}</span>
        <span className={'chip ' + (integrations.discord ? 'on' : '')}><span className={'dot ' + (integrations.discord ? 'on' : '')} />{integrations.discord ? 'Discord running · Input Device → CABLE Output' : 'Discord not detected'}</span>
        <span className={'chip ' + (integrations.fivem ? 'on' : '')}><span className={'dot ' + (integrations.fivem ? 'on' : '')} />{integrations.fivem ? 'FiveM running · Voice Chat → CABLE Output' : 'FiveM not detected'}</span>
        <span className="chip"><Icon name="headphones" size={14} />{s.monitor ? 'Monitor: ' + (s.monitorMic ? 'music + mic' : 'music only') : 'Monitor off'}</span>
      </div>
    </section>
    {settingsOpen && <div className="sheet-backdrop" onClick={e => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
      <SettingsSheet close={() => setSettingsOpen(false)} sections={[
        { id: 'ducking', name: 'Ducking', body: <><h2>Ducking</h2>
            <div className="row"><div className="row-label"><span>Lower the music while I talk</span><small>When your mic hears speech the music dips, so your voice stays on top.</small></div><Switch checked={s.ducking} onChange={ducking => change({ ...s, ducking })} label="Lower the music while I talk" /></div>
            <div className="row col"><div className="row-top"><span>Mic threshold</span><span className="val">{s.duckThreshold} dBFS</span></div>
              <input className="thin" aria-label="Mic threshold" type="range" min="-60" max="-10" step="1" value={s.duckThreshold} style={pct((s.duckThreshold + 60) / 50)} onChange={e => change({ ...s, duckThreshold: Number(e.target.value) })} />
              <small>How loud your voice must be before the music ducks. Move left to make it more sensitive.</small></div>
            <div className="row col"><div className="row-top"><span>Music reduction</span><span className="val">{s.duckDb} dB</span></div>
              <input className="thin" aria-label="Music reduction" type="range" min="-30" max="0" step="1" value={s.duckDb} style={pct((s.duckDb + 30) / 30)} onChange={e => change({ ...s, duckDb: Number(e.target.value) })} />
              <small>50 ms attack · 400 ms release. Raise the threshold if ducking lights up while you are silent.</small></div></> },
        { id: 'monitoring', name: 'Monitoring & output', body: <><h2>Monitoring & output</h2>
            <div className="row"><div className="row-label"><span>Headphone monitor</span><small>Hear the mix in your own headphones. Listeners get the same audio either way.</small></div><Switch checked={s.monitor} onChange={monitor => change({ ...s, monitor })} label="Headphone monitor enabled" /></div>
            <div className="row"><div className="row-label"><span>Include my microphone</span><small>Hear yourself in the headphones</small></div><Switch checked={s.monitorMic} onChange={monitorMic => change({ ...s, monitorMic })} label="Include microphone in headphones" /></div>
            <div className="row col"><div className="row-top"><span>Monitor volume</span><span className="val">{Math.round(s.monitorVolume * 100)}%</span></div>
              <input className="thin" aria-label="Monitor volume" type="range" min="0" max="1" step="0.01" value={s.monitorVolume} style={pct(s.monitorVolume)} onChange={e => change({ ...s, monitorVolume: Number(e.target.value) })} />
              <small>How loud everything is in your headphones only. Discord and FiveM always receive the full mix.</small></div>
            <div className="row col"><div className="row-top"><span>Music in my headphones</span><span className="val">{Math.round(s.monitorMusicVolume * 100)}%</span></div>
              <input className="thin" aria-label="Music in my headphones" type="range" min="0" max="1" step="0.01" value={s.monitorMusicVolume} style={pct(s.monitorMusicVolume)} onChange={e => change({ ...s, monitorMusicVolume: Number(e.target.value) })} />
              <small>Listeners always hear music at the Music/Master level; this only changes how loud it is for you.</small></div>
            <div className="row"><div className="row-label"><span>Voice headroom</span><small>Your voice gets its own limiter, so loud music never pumps or squashes it. Best with ducking on; keep the Mic meter out of the red.</small></div><Switch checked={s.voiceHeadroom} onChange={voiceHeadroom => change({ ...s, voiceHeadroom })} label="Voice headroom" /></div>
            <div className="row"><div className="row-label"><span>Mono virtual microphone</span><small>Safer for voice apps that expect one channel</small></div><Switch checked={s.mono} onChange={mono => change({ ...s, mono })} label="Mono virtual microphone output" /></div></> },
        { id: 'shortcuts', name: 'Shortcuts & tray', body: <><h2>Shortcuts & tray</h2>
            {config && <Shortcuts config={config} run={run} />}
            <div className="row"><div className="row-label"><span>Keep running in the tray</span><small>Closing the window hides MicMix next to the clock; your virtual mic stays on. Quit from the tray icon.</small></div>
              <Switch checked={config?.closeToTray ?? true} onChange={enabled => { if (config) setConfig({ ...config, closeToTray: enabled }); void window.micmix.setCloseToTray(enabled).catch(e => setError(String(e))); }} label="Keep running in the tray" /></div>
            <small className="group-note">Shortcuts work from any app, even with MicMix hidden. They need Ctrl, Alt or Shift plus a key, or an F-key, numpad or media key, so typing is never hijacked.</small></> },
        { id: 'integrations', name: 'Discord & FiveM', body: <><h2>Discord & FiveM</h2>
            <div className="row col"><div className="row-top"><strong>Discord</strong><span className={'val ' + (integrations.discord ? 'accent' : '')}>{integrations.discord ? 'running' : 'not detected'}</span></div>
              <p>User Settings → Voice & Video → Input Device → <strong>CABLE Output (VB-Audio Virtual Cable)</strong>. Custom profile: Noise Suppression None, Echo Cancellation off, Automatic Gain Control off.</p></div>
            <div className="row col"><div className="row-top"><strong>FiveM</strong><span className={'val ' + (integrations.fivem ? 'accent' : '')}>{integrations.fivem ? 'running' : 'not detected'}</span></div>
              <p>Settings → Voice Chat → Input Device → <strong>CABLE Output (VB-Audio Virtual Cable)</strong>, and use push-to-talk so FiveM's voice gate never cuts the music.</p>
              <div className="row-top"><span className="row-label"><span>Tune FiveM voice for MicMix</span><small>{fivemTuneText(integrations.fivemTune)}</small></span>
                <Switch checked={integrations.fivemTune.enabled} onChange={enabled => { setIntegrations({ ...integrations, fivemTune: { ...integrations.fivemTune, enabled } }); void window.micmix.setFivemTune(enabled).catch(e => setError(String(e))); }} label="Tune FiveM voice for MicMix" /></div>
              <small>FiveM runs a speech-only noise suppressor and a 48 kbps voice codec on everything it captures, which makes music sound low and hollow. MicMix turns that suppressor off and raises the bitrate in FiveM's saved settings. Proximity voice is still played back inside the game with distance and room effects, so it never sounds as direct as Discord.</small>
              <small>Automatic Discord device switching needs a Discord-approved app and an online sign-in, so MicMix keeps this manual and never touches Discord's files.</small></div></> },
        { id: 'diagnostics', name: 'Diagnostics', body: <><h2>Diagnostics</h2>
            <div className="row"><div className="row-label"><span>Test tone</span><small>1.5 s at 440 Hz into the virtual mic</small></div>
              <button className="btn" disabled={!live || audio.tone || busy} onClick={() => void send({ type: 'tone' })}>{audio.tone ? 'Sending tone…' : 'Send test tone'}</button></div>
            <div className="row"><div className="row-label"><span>Rescan devices</span><small>Look again for microphones and headphones you just plugged in.</small></div><button className="btn" onClick={() => void window.micmix.refreshDevices().catch(e => setError(String(e)))}><Icon name="refresh" size={16} />Rescan</button></div>
            <SampleRates formats={formats} micLabel={microphones.find(d => d.deviceId === micId)?.label ?? null} engine={audio.engine} />
            <div className="row"><div className="row-label"><span>Setup assistant</span><small>Settings, devices, queue and pads are saved automatically.</small></div>
              <button className="btn" onClick={() => { setSettingsOpen(false); setWizard(true); }}>Run setup again</button></div></> },
        { id: 'updates', name: 'Updates', body: <><h2>Updates</h2>
            <div className="row"><div className="row-label"><span>Version</span><small>{updateSummary(update, config?.appVersion ?? '', updatesSupported)}</small></div>
              {update.phase === 'downloaded' ? <button className="btn primary" onClick={() => void window.micmix.installUpdate().catch(e => setError(String(e)))}><Icon name="refresh" size={16} />Restart to update</button>
              : <button className="btn" disabled={!updatesSupported || update.phase === 'checking' || update.phase === 'downloading' || update.phase === 'installing'} onClick={() => void window.micmix.checkForUpdates().catch(e => setError(String(e)))}><Icon name="refresh" size={16} />{update.phase === 'checking' ? 'Checking…' : 'Check now'}</button>}</div>
            <div className="row"><div className="row-label"><span>Update automatically</span><small>Check on launch and every few hours; install while off air.</small></div>
              <Switch checked={config?.updateCheck ?? true} onChange={enabled => { if (config) setConfig({ ...config, updateCheck: enabled }); void window.micmix.setUpdateCheck(enabled).catch(e => setError(String(e))); }} label="Update automatically" /></div></> },
        { id: 'about', name: 'About', className: 'about', body: <><h2>About MicMix{config?.appVersion ? ' ' + config.appVersion : ''}</h2>
            <div className="row"><img className="about-art" src="./brand/micmix-primary-1024.png" alt="MicMix logo" width={72} height={72} /><p>One microphone for your voice plus music, YouTube and a soundboard, routed into Discord, FiveM and any app through the MicMix Virtual Mic.</p>
              <p>The virtual microphone is <strong>VB-CABLE</strong> by <strong>VB-Audio Software</strong>, included as donationware. If MicMix is useful, please support its author.</p>
              <div className="actions"><button className="btn" onClick={() => void window.micmix.openDonation()}><Icon name="heart" size={16} />Donate to VB-Audio</button>
                <button className="btn" onClick={() => void window.micmix.openVbCableSite()}>vb-audio.com/Cable</button></div></div></> },
      ]} />
    </div>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
