export interface AudioDevice { deviceId: string; groupId: string; kind: 'audioinput' | 'audiooutput'; label: string }
export interface DeviceReport {
  devices: AudioDevice[]; scannedAt: string; error: string | null;
  setSinkIdSupported: boolean; secureContext: boolean;
}
export interface MicMixBridge {
  getAudioState(): Promise<AudioState>;
  command(command: AudioCommand): Promise<void>;
  onAudioState(callback: (state: AudioState) => void): () => void;
  getReport(): Promise<DeviceReport | null>;
  refreshDevices(): Promise<void>;
  onReport(callback: (report: DeviceReport) => void): () => void;
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
      onCommand(callback: (id: number, command: AudioCommand) => void): void;
      reply(id: number, error: string | null): void;
    };
  }
}
export type AudioCommand = { type: 'start'; deviceId: string } | { type: 'stop' } | { type: 'tone' };
export interface AudioState {
  status: 'off' | 'starting' | 'live'; micId: string | null; tone: boolean; error: string | null;
}
