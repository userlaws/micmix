import type { AudioDevice } from './shared';
export function isExplicitDevice(device: AudioDevice) {
  return !!device.deviceId && !['default', 'communications'].includes(device.deviceId);
}
export function microphoneChoices(devices: AudioDevice[]) {
  return devices.filter(d => d.kind === 'audioinput' && isExplicitDevice(d) && !!d.label && !/CABLE/i.test(d.label));
}
export function cableSink(devices: AudioDevice[]) {
  return devices.find(d => d.kind === 'audiooutput' && isExplicitDevice(d) && /CABLE Input/i.test(d.label));
}
export function playbackChoices(devices: AudioDevice[]) {
  return devices.filter(d => d.kind === 'audiooutput' && isExplicitDevice(d) && !!d.label && !/CABLE/i.test(d.label));
}
