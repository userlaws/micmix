import type { DeviceReport, AudioDevice } from './shared';
import { command, checkDevices, onDeviceLoss, youtubeUpdate } from './passthrough';
let scanning = false;
let rescan = false;
let labelsUnlocked = false;
async function scan() {
  if (scanning) { rescan = true; return; }
  scanning = true;
  const report: DeviceReport = {
    devices: [], scannedAt: new Date().toISOString(), error: null,
    setSinkIdSupported: 'setSinkId' in AudioContext.prototype, secureContext: window.isSecureContext
  };
  let stream: MediaStream | undefined;
  try {
    // Unlock once; rescans must not open a second mic while LIVE.
    if (!labelsUnlocked) stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false
    });
    labelsUnlocked = true;
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
    checkDevices(report.devices);
  } catch (error) {
    report.error = [report.error, 'Device enumeration: ' + String(error)].filter(Boolean).join(' ');
  } finally {
    window.audioHost.publish(report);
    scanning = false;
    if (rescan) { rescan = false; void scan(); }
  }
}
window.audioHost.onScan(() => { void scan(); });
onDeviceLoss(scan);
window.audioHost.onYouTube(youtubeUpdate);
window.audioHost.onCommand((id, value) => {
  void command(value).then(() => window.audioHost.reply(id, null))
    .catch(error => window.audioHost.reply(id, error instanceof Error ? error.message : String(error)));
});
navigator.mediaDevices.addEventListener('devicechange', () => { void scan(); });
void scan();
