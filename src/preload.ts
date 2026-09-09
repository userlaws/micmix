import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { DeviceReport, MicMixBridge, AudioState, AudioCommand, Meters, YouTubeCommand, YouTubeUpdate, IntegrationStatus, UpdateStatus } from './shared';
if (process.argv.includes('--audio-worker')) {
  contextBridge.exposeInMainWorld('audioHost', {
    youtube: (command: YouTubeCommand) => ipcRenderer.invoke('youtube:control', command),
    onYouTube: (callback: (update: YouTubeUpdate) => void) => { ipcRenderer.on('audio:youtube', (_event, update) => callback(update)); },
    readClip: (id: string) => ipcRenderer.invoke('clips:read', id),
    meters: (meters: Meters) => ipcRenderer.send('audio:meters', meters),
    state: (state: AudioState) => ipcRenderer.send('audio:state', state),
    onCommand: (callback: (id: number, command: AudioCommand) => void) => {
      ipcRenderer.on('audio:command', (_event, id, command) => callback(id, command));
    },
    reply: (id: number, error: string | null) => ipcRenderer.send('audio:reply', id, error),
    publish: (report: DeviceReport) => ipcRenderer.send('audio:report', report),
    onScan: (callback: () => void) => { ipcRenderer.on('audio:scan', () => callback()); }
  });
} else {
  const subscribe = <T,>(channel: string) => (callback: (value: T) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, value: T) => callback(value);
    ipcRenderer.on(channel, listener);
    return () => { ipcRenderer.removeListener(channel, listener); };
  };
  const api: MicMixBridge = {
    youtubeTrack: url => ipcRenderer.invoke('youtube:track', url),
    videoBounds: bounds => ipcRenderer.send('youtube:bounds', bounds),
    pickFiles: () => ipcRenderer.invoke('files:pick'),
    dropFiles: files => ipcRenderer.invoke('files:drop', files.map(file => webUtils.getPathForFile(file))),
    onMeters: subscribe<Meters>('audio:meters'),
    getAudioState: () => ipcRenderer.invoke('audio:get-state'),
    command: command => ipcRenderer.invoke('audio:command', command),
    onAudioState: subscribe<AudioState>('audio:state'),
    getReport: () => ipcRenderer.invoke('devices:get'),
    refreshDevices: () => ipcRenderer.invoke('devices:refresh'),
    onReport: subscribe<DeviceReport>('devices:report'),
    getConfig: () => ipcRenderer.invoke('config:get'),
    saveDevices: (micLabel, monitorLabel) => ipcRenderer.invoke('config:devices', micLabel, monitorLabel),
    completeSetup: () => ipcRenderer.invoke('config:setup-done'),
    assignPad: slot => ipcRenderer.invoke('pads:assign', slot),
    setPadHotkey: (slot, hotkey) => ipcRenderer.invoke('pads:hotkey', slot, hotkey),
    clearPad: slot => ipcRenderer.invoke('pads:clear', slot),
    getIntegrations: () => ipcRenderer.invoke('integrations:get'),
    onIntegrations: subscribe<IntegrationStatus>('integrations:status'),
    openVbCableSite: () => ipcRenderer.invoke('open:vbcable'),
    openDonation: () => ipcRenderer.invoke('open:donate'),
    getUpdate: () => ipcRenderer.invoke('update:get'),
    onUpdate: subscribe<UpdateStatus>('update:status'),
    checkForUpdates: () => ipcRenderer.invoke('update:check'),
    installUpdate: () => ipcRenderer.invoke('update:install'),
    updatesSupported: () => ipcRenderer.invoke('update:supported'),
    setUpdateCheck: enabled => ipcRenderer.invoke('config:update-check', enabled)
  };
  contextBridge.exposeInMainWorld('micmix', api);
}
