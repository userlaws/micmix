export interface AudioDevice { deviceId: string; groupId: string; kind: 'audioinput' | 'audiooutput'; label: string }
export interface DeviceReport {
  devices: AudioDevice[]; scannedAt: string; error: string | null;
  setSinkIdSupported: boolean; secureContext: boolean;
}
export interface MicMixBridge {
  getReport(): Promise<DeviceReport | null>;
  refreshDevices(): Promise<void>;
  onReport(callback: (report: DeviceReport) => void): () => void;
}
declare global {
  interface Window {
    micmix: MicMixBridge;
    audioHost: { publish(report: DeviceReport): void; onScan(callback: () => void): void };
  }
}
