// Fake MicMix bridge for marketing screenshots: renders the REAL UI bundle (dist/ui.js + ui.css)
// with a staged LIVE state. No devices are opened and no audio exists; this only feeds the React UI.
const { contextBridge } = require('electron');
const version = process.argv.find(a => a.startsWith('--app-version='))?.slice('--app-version='.length) ?? '1.0.0';

const devices = [
  { deviceId: 'mic-1', groupId: 'g1', kind: 'audioinput', label: 'Microphone (Blue Yeti)' },
  { deviceId: 'cable-out', groupId: 'g2', kind: 'audioinput', label: 'CABLE Output (VB-Audio Virtual Cable)' },
  { deviceId: 'hp-1', groupId: 'g3', kind: 'audiooutput', label: 'Headphones (Realtek(R) Audio)' },
  { deviceId: 'cable-in', groupId: 'g2', kind: 'audiooutput', label: 'CABLE Input (VB-Audio Virtual Cable)' },
];
const report = { devices, scannedAt: new Date().toISOString(), error: null, setSinkIdSupported: true, secureContext: true };
const pad = (slot, title, hotkey) => ({ slot, id: 'pad-' + slot, title, url: '', hotkey, ready: true, error: null });
const state = {
  status: 'live', micId: 'mic-1', monitorId: 'hp-1', tone: false, error: null,
  queue: [
    { id: 't1', title: 'Midnight City', url: '' },
    { id: 't2', title: 'Blinding Lights (Official Audio)', url: '', youtubeId: 'abc' },
    { id: 't3', title: 'Lo-fi beats to play games to', url: '', youtubeId: 'def' },
  ],
  index: 0, playing: true, buffering: false, position: 74, duration: 243,
  settings: {
    levels: { mic: 1, music: 0.72, soundboard: 0.85, master: 1 },
    muted: { mic: false, music: false, soundboard: false, master: false },
    ducking: true, duckThreshold: -30, duckDb: -8,
    mono: false, monitor: true, monitorMic: false, monitorVolume: 0.7, monitorMusicVolume: 1,
  },
  pads: [pad(0, 'Airhorn', 'Ctrl+Shift+F1'), pad(1, 'Applause', 'Ctrl+Shift+F2'), pad(2, 'Bruh', 'Ctrl+Shift+F3'),
    pad(3, 'Drum roll', 'Ctrl+Shift+F4'), pad(4, 'Laugh track', null), pad(5, 'Trombone', null), null, null, null],
  activePads: [],
};
const meters = { mic: 0.62, music: 0.48, soundboard: 0.0, master: 0.71, ducking: true, reduction: 4.2, overload: false };
const noop = () => () => {};
const ok = () => Promise.resolve();

contextBridge.exposeInMainWorld('micmix', {
  searchYouTube: () => Promise.resolve(null),
  cancelYouTubeSearch: ok,
  youtubeTrack: () => Promise.resolve(null),
  videoBounds: () => {},
  pickFiles: () => Promise.resolve([]),
  dropFiles: () => Promise.resolve([]),
  onMeters: callback => { callback(meters); return () => {}; },
  getAudioState: () => Promise.resolve(state),
  command: ok,
  onAudioState: noop,
  getReport: () => Promise.resolve(report),
  refreshDevices: ok,
  onReport: noop,
  getConfig: () => Promise.resolve({ setupDone: true, micLabel: 'Microphone (Blue Yeti)', monitorLabel: 'Headphones (Realtek(R) Audio)', updateCheck: true, appVersion: version }),
  saveDevices: ok,
  completeSetup: ok,
  assignPad: ok,
  setPadHotkey: ok,
  clearPad: ok,
  getIntegrations: () => Promise.resolve({ discord: true, fivem: false }),
  onIntegrations: noop,
  downloadVbCable: ok,
  openVbCableSite: ok,
  openDonation: ok,
  getUpdate: () => Promise.resolve({ phase: 'idle' }),
  onUpdate: noop,
  checkForUpdates: ok,
  installUpdate: () => Promise.resolve(false),
  updatesSupported: () => Promise.resolve(false),
  setUpdateCheck: ok,
});
