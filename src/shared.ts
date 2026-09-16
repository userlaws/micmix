export interface AudioDevice { deviceId: string; groupId: string; kind: 'audioinput' | 'audiooutput'; label: string }
export interface DeviceReport {
  devices: AudioDevice[]; scannedAt: string; error: string | null;
  setSinkIdSupported: boolean; secureContext: boolean;
}
export const PAD_COUNT = 9;
export interface SoundPad { slot: number; id: string; title: string; url: string; hotkey: string | null }
export interface PadState extends SoundPad { ready: boolean; error: string | null }
export interface IntegrationStatus { discord: boolean; fivem: boolean; fivemTune: FivemTuneStatus }
// MicMix edits two lines in FiveM's saved settings (fivem.cfg) so the CABLE Output stream is not noise-suppressed
// and is encoded at full bitrate. FiveM rewrites that file when it exits, so writes wait until it is closed.
export type FivemTuneState = 'applied' | 'restored' | 'waiting' | 'missing' | 'error';
export interface FivemTuneStatus { enabled: boolean; state: FivemTuneState; detail: string | null }
// Shared-mode format Windows runs an endpoint at (read from the registry in main; Web Audio cannot see it).
export interface EndpointFormat {
  flow: 'render' | 'capture'; name: string; device: string; label: string;
  sampleRate: number; channels: number; bits: number;
}
// Rates the live engine actually runs at, so a mismatch with Windows is visible in Diagnostics.
export interface EngineInfo { sampleRate: number; micSampleRate: number | null; micChannels: number | null }
// App-wide global shortcuts (Electron accelerators). null disables an action; a value that another app or Windows
// already owns fails to register and is reported in unavailableHotkeys so Settings can show it.
export type AppHotkeyAction = 'live' | 'playPause' | 'next' | 'previous' | 'muteMic' | 'stopPads' | 'show';
export type AppHotkeys = Record<AppHotkeyAction, string | null>;
export const APP_HOTKEY_ACTIONS: { action: AppHotkeyAction; name: string; hint: string }[] = [
  { action: 'playPause', name: 'Play / pause music', hint: 'Toggles the current track while live' },
  { action: 'next', name: 'Next track', hint: 'Skips to the next item in the queue' },
  { action: 'previous', name: 'Previous track', hint: 'Goes back one item in the queue' },
  { action: 'muteMic', name: 'Mute / unmute mic', hint: 'Silences your voice; music keeps playing' },
  { action: 'stopPads', name: 'Stop all pads', hint: 'Cuts every soundboard clip' },
  { action: 'live', name: 'Go live / off air', hint: 'Same as the big button in the header' },
  { action: 'show', name: 'Show / hide MicMix', hint: 'Brings the window back from the tray' },
];
export const defaultHotkeys: AppHotkeys = {
  playPause: 'Ctrl+Alt+P', next: 'Ctrl+Alt+N', previous: 'Ctrl+Alt+B', muteMic: 'Ctrl+Alt+K',
  stopPads: 'Ctrl+Alt+X', live: 'Ctrl+Alt+L', show: 'Ctrl+Alt+H'
};
export interface SetupConfig {
  setupDone: boolean; micLabel: string | null; monitorLabel: string | null; updateCheck: boolean; fivemTune: boolean;
  hotkeys: AppHotkeys; closeToTray: boolean;
}
export interface UiConfig extends SetupConfig { appVersion: string; unavailableHotkeys: AppHotkeyAction[] }
export type UpdateStatus =
  | { phase: 'idle' } | { phase: 'checking' }
  | { phase: 'upToDate'; version: string; at: number }
  | { phase: 'available'; version: string; notes: string }
  | { phase: 'downloading'; version: string; percent: number; transferred: number; total: number; bytesPerSecond: number; notes: string }
  // restartAt: epoch ms of a scheduled automatic restart (only while idle and off air), null when none is planned.
  | { phase: 'downloaded'; version: string; notes: string; restartAt?: number | null }
  | { phase: 'installing'; version: string }
  | { phase: 'error'; message: string; at: number };
// resumeHidden: set right before an automatic update restart while the window sat in the tray, so the relaunch stays there.
export interface SavedConfig extends SetupConfig { version: 1; settings: MixerSettings; queue: LocalTrack[]; pads: (SoundPad | null)[]; resumeHidden?: boolean }
export interface MicMixBridge {
  searchYouTube(query: string): Promise<YouTubeResult[] | null>;
  cancelYouTubeSearch(): Promise<void>;
  youtubeTrack(input: string): Promise<LocalTrack | null>;
  videoBounds(bounds: VideoBounds | null): void;
  pickFiles(): Promise<LocalTrack[]>;
  dropFiles(files: File[]): Promise<LocalTrack[]>;
  onMeters(callback: (meters: Meters) => void): () => void;
  getAudioState(): Promise<AudioState>;
  command(command: AudioCommand): Promise<void>;
  onAudioState(callback: (state: AudioState) => void): () => void;
  getReport(): Promise<DeviceReport | null>;
  refreshDevices(): Promise<void>;
  onReport(callback: (report: DeviceReport) => void): () => void;
  getConfig(): Promise<UiConfig>;
  onConfig(callback: (config: UiConfig) => void): () => void;
  setHotkey(action: AppHotkeyAction, hotkey: string | null): Promise<void>;
  setCloseToTray(enabled: boolean): Promise<void>;
  onHotkey(callback: (action: AppHotkeyAction) => void): () => void;
  saveDevices(micLabel: string | null, monitorLabel: string | null): Promise<void>;
  completeSetup(): Promise<void>;
  assignPad(slot: number): Promise<void>;
  setPadHotkey(slot: number, hotkey: string | null): Promise<void>;
  clearPad(slot: number): Promise<void>;
  getIntegrations(): Promise<IntegrationStatus>;
  getEndpointFormats(): Promise<EndpointFormat[]>;
  onIntegrations(callback: (status: IntegrationStatus) => void): () => void;
  downloadVbCable(): Promise<void>;
  openVbCableSite(): Promise<void>;
  openDonation(): Promise<void>;
  getUpdate(): Promise<UpdateStatus>;
  onUpdate(callback: (status: UpdateStatus) => void): () => void;
  checkForUpdates(): Promise<void>;
  installUpdate(): Promise<boolean>;
  snoozeUpdate(): Promise<void>;
  activity(): void;
  updatesSupported(): Promise<boolean>;
  setUpdateCheck(enabled: boolean): Promise<void>;
  setFivemTune(enabled: boolean): Promise<void>;
}
declare global {
  // Chromium supports these APIs; TypeScript 5.9's DOM declarations omit them.
  interface AudioContext {
    setSinkId(sinkId: string): Promise<void>;
    readonly sinkId: string | { type: 'none' };
  }
  interface Window {
    micmix: MicMixBridge;
    audioHost: {
      publish(report: DeviceReport): void; onScan(callback: () => void): void;
      state(state: AudioState): void;
      meters(meters: Meters): void;
      youtube(command: YouTubeCommand): Promise<void>;
      onYouTube(callback: (update: YouTubeUpdate) => void): void;
      readClip(id: string): Promise<ArrayBuffer | Uint8Array>;
      onCommand(callback: (id: number, command: AudioCommand) => void): void;
      reply(id: number, error: string | null): void;
    };
  }
}
export type AudioCommand = { type: 'start'; deviceId: string; monitorId?: string } | { type: 'stop' } | { type: 'tone' }
  | { type: 'settings'; settings: MixerSettings }
  | { type: 'enqueue'; tracks: LocalTrack[] }
  | { type: 'play' } | { type: 'pause' } | { type: 'next' }
  | { type: 'select'; index: number } | { type: 'remove'; index: number }
  | { type: 'seek'; seconds: number } | { type: 'clear' }
  | { type: 'pads'; pads: (SoundPad | null)[] } | { type: 'pad'; slot: number } | { type: 'stopPads' };
export interface AudioState {
  status: 'off' | 'starting' | 'live'; micId: string | null; tone: boolean; error: string | null;
  monitorId: string | null; queue: LocalTrack[]; index: number; playing: boolean; buffering: boolean;
  position: number; duration: number; settings: MixerSettings;
  pads: (PadState | null)[]; activePads: number[]; engine: EngineInfo | null;
}
export interface LocalTrack { id: string; title: string; url: string; youtubeId?: string }
export interface YouTubeResult {
  videoId: string; title: string; channel: string; duration: string;
  views: string; published: string; live: boolean; thumbnail: string;
}
export interface VideoBounds { x: number; y: number; width: number; height: number }
export type YouTubeCommand = { type: 'load'; videoId: string; position: number } | { type: 'play' } | { type: 'pause' } | { type: 'seek'; seconds: number };
export interface YouTubeUpdate { videoId: string; ready?: boolean; playerState?: number; position?: number; duration?: number; title?: string; error?: string }
export type Channel = 'mic' | 'music' | 'soundboard' | 'master';
export interface MixerSettings {
  levels: Record<Channel, number>; muted: Record<Channel, boolean>;
  ducking: boolean; duckThreshold: number; duckDb: number;
  mono: boolean; monitor: boolean; monitorMic: boolean; monitorVolume: number; monitorMusicVolume: number;
  // voiceHeadroom: the mic gets its own limiter beside the shared one, so loud music never modulates speech.
  voiceHeadroom: boolean;
}
export interface Meters {
  mic: number; music: number; soundboard: number; master: number; ducking: boolean; reduction: number; overload: boolean;
  // dB of gain reduction currently applied to the voice (its own limiter with headroom on; the shared one while the mic is active otherwise).
  voiceReduction: number;
}
export const defaultSettings: MixerSettings = {
  // Full level by default; the limiter handles overload and the user trims with faders.
  levels: { mic: 1, music: 1, soundboard: 1, master: 1 },
  muted: { mic: false, music: false, soundboard: false, master: false },
  // -30 dBFS RMS: a sensitive condenser in a normal room sits well below this; speech sits above it.
  // -8 dB duck: music stays present under your voice; still adjustable in Settings.
  ducking: true, duckThreshold: -30, duckDb: -8,
  // monitorMusicVolume scales music/pads in YOUR headphones only, never the outgoing mix.
  mono: false, monitor: true, monitorMic: false, monitorVolume: 0.7, monitorMusicVolume: 1,
  voiceHeadroom: true
};
export const emptyMeters: Meters = { mic: 0, music: 0, soundboard: 0, master: 0, ducking: false, reduction: 0, overload: false, voiceReduction: 0 };
export function initialAudioState(): AudioState {
  return { status: 'off', micId: null, monitorId: null, tone: false, error: null,
    queue: [], index: -1, playing: false, buffering: false, position: 0, duration: 0,
    settings: structuredClone(defaultSettings), pads: Array.from({ length: PAD_COUNT }, () => null), activePads: [], engine: null };
}
export const CABLE_INPUT = /CABLE Input/i;
export const CABLE_OUTPUT = /CABLE Output/i;
export function cablePresent(devices: AudioDevice[]) {
  return devices.some(d => d.kind === 'audiooutput' && CABLE_INPUT.test(d.label)) &&
    devices.some(d => d.kind === 'audioinput' && CABLE_OUTPUT.test(d.label));
}
