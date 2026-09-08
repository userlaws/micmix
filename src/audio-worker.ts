import type { DeviceReport, AudioDevice } from './shared';
let scanning = false;
let rescan = false;
async function scan() {
  if (scanning) { rescan = true; return; }
  scanning = true;
  const report: DeviceReport = {
    devices: [], scannedAt: new Date().toISOString(), error: null,
    setSinkIdSupported: 'setSinkId' in AudioContext.prototype, secureContext: window.isSecureContext
  };
  let stream: MediaStream | undefined;
  try {
    // Open only to unlock labels. No AudioContext, playback, or recording in Phase 0.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false
    });
  } catch (error) {
    report.error = 'Microphone access: ' + (error instanceof Error ? error.message : String(error)) +
      '. Check Windows Settings > Privacy & security > Microphone > Let desktop apps access your microphone.';
  } finally {
    stream?.getTracks().forEach(track => track.stop());
  }
  try {
    report.devices = (await navigator.mediaDevices.enumerateDevices())
      .filter(device => device.kind === 'audioinput' || device.kind === 'audiooutput')
      .map(device => ({ deviceId: device.deviceId, groupId: device.groupId,
        kind: device.kind as AudioDevice['kind'], label: device.label }));
  } catch (error) {
    report.error = [report.error, 'Device enumeration: ' + String(error)].filter(Boolean).join(' ');
  } finally {
    window.audioHost.publish(report);
    scanning = false;
    if (rescan) { rescan = false; void scan(); }
  }
}
window.audioHost.onScan(() => { void scan(); });
navigator.mediaDevices.addEventListener('devicechange', () => { void scan(); });
void scan();
