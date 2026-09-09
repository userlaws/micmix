import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { DeviceReport, MicMixBridge, AudioState, AudioCommand, Meters, YouTubeCommand, YouTubeUpdate } from './shared';
if (process.argv.includes('--audio-worker')) {
  contextBridge.exposeInMainWorld('audioHost', {
    youtube: (command: YouTubeCommand) => ipcRenderer.invoke('youtube:control', command),
    onYouTube: (callback: (update: YouTubeUpdate) => void) => { ipcRenderer.on('audio:youtube', (_event, update) => callback(update)); },
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
  const api: MicMixBridge = {
    youtubeTrack: url => ipcRenderer.invoke('youtube:track', url),
    videoBounds: bounds => ipcRenderer.send('youtube:bounds', bounds),
    pickFiles: () => ipcRenderer.invoke('files:pick'),
    dropFiles: files => ipcRenderer.invoke('files:drop', files.map(file => webUtils.getPathForFile(file))),
    onMeters: callback => {
      const listener = (_event: Electron.IpcRendererEvent, meters: Meters) => callback(meters);
      ipcRenderer.on('audio:meters', listener);
      return () => { ipcRenderer.removeListener('audio:meters', listener); };
    },
    getAudioState: () => ipcRenderer.invoke('audio:get-state'),
    command: command => ipcRenderer.invoke('audio:command', command),
    onAudioState: callback => {
      const listener = (_event: Electron.IpcRendererEvent, state: AudioState) => callback(state);
      ipcRenderer.on('audio:state', listener);
      return () => { ipcRenderer.removeListener('audio:state', listener); };
    },
    getReport: () => ipcRenderer.invoke('devices:get'),
    refreshDevices: () => ipcRenderer.invoke('devices:refresh'),
    onReport: callback => {
      const listener = (_event: Electron.IpcRendererEvent, report: DeviceReport) => callback(report);
      ipcRenderer.on('devices:report', listener);
      return () => { ipcRenderer.removeListener('devices:report', listener); };
    }
  };
  contextBridge.exposeInMainWorld('micmix', api);
}
