export interface AudioDevice { deviceId: string; groupId: string; kind: 'audioinput' | 'audiooutput'; label: string }
export interface DeviceReport {
  devices: AudioDevice[]; scannedAt: string; error: string | null;
  setSinkIdSupported: boolean; secureContext: boolean;
}
export const PAD_COUNT = 9;
export interface SoundPad { slot: number; id: string; title: string; url: string; hotkey: string | null }
export interface PadState extends SoundPad { ready: boolean; error: string | null }
export interface IntegrationStatus { discord: boolean; fivem: boolean }
export interface SetupConfig { setupDone: boolean; micLabel: string | null; monitorLabel: string | null }
export interface SavedConfig extends SetupConfig { version: 1; settings: MixerSettings; queue: LocalTrack[]; pads: (SoundPad | null)[] }
export interface MicMixBridge {
  youtubeTrack(url: string): Promise<LocalTrack>;
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
  getConfig(): Promise<SetupConfig & { appVersion: string }>;
  saveDevices(micLabel: string | null, monitorLabel: string | null): Promise<void>;
  completeSetup(): Promise<void>;
  assignPad(slot: number): Promise<void>;
  setPadHotkey(slot: number, hotkey: string | null): Promise<void>;
  clearPad(slot: number): Promise<void>;
  getIntegrations(): Promise<IntegrationStatus>;
  onIntegrations(callback: (status: IntegrationStatus) => void): () => void;
  openVbCableSite(): Promise<void>;
  openDonation(): Promise<void>;
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
  pads: (PadState | null)[]; activePads: number[];
}
export interface LocalTrack { id: string; title: string; url: string; youtubeId?: string }
export interface VideoBounds { x: number; y: number; width: number; height: number }
export type YouTubeCommand = { type: 'load'; videoId: string; position: number } | { type: 'play' } | { type: 'pause' } | { type: 'seek'; seconds: number };
export interface YouTubeUpdate { videoId: string; ready?: boolean; playerState?: number; position?: number; duration?: number; title?: string; error?: string }
export type Channel = 'mic' | 'music' | 'soundboard' | 'master';
export interface MixerSettings {
  levels: Record<Channel, number>; muted: Record<Channel, boolean>;
  ducking: boolean; duckThreshold: number; duckDb: number;
  mono: boolean; monitor: boolean; monitorMic: boolean; monitorVolume: number;
}
export interface Meters { mic: number; music: number; soundboard: number; master: number; ducking: boolean; reduction: number; overload: boolean }
export const defaultSettings: MixerSettings = {
  // Full level by default; the limiter handles overload and the user trims with faders.
  levels: { mic: 1, music: 1, soundboard: 1, master: 1 },
  muted: { mic: false, music: false, soundboard: false, master: false },
  // -30 dBFS RMS: a sensitive condenser in a normal room sits well below this; speech sits above it.
  ducking: true, duckThreshold: -30, duckDb: -12,
  mono: false, monitor: true, monitorMic: false, monitorVolume: 0.7
};
export const emptyMeters: Meters = { mic: 0, music: 0, soundboard: 0, master: 0, ducking: false, reduction: 0, overload: false };
export function initialAudioState(): AudioState {
  return { status: 'off', micId: null, monitorId: null, tone: false, error: null,
    queue: [], index: -1, playing: false, buffering: false, position: 0, duration: 0,
    settings: structuredClone(defaultSettings), pads: Array.from({ length: PAD_COUNT }, () => null), activePads: [] };
}
export const CABLE_INPUT = /CABLE Input/i;
export const CABLE_OUTPUT = /CABLE Output/i;
export function cablePresent(devices: AudioDevice[]) {
  return devices.some(d => d.kind === 'audiooutput' && CABLE_INPUT.test(d.label)) &&
    devices.some(d => d.kind === 'audioinput' && CABLE_OUTPUT.test(d.label));
}
