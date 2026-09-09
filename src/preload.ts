import { contextBridge, ipcRenderer } from 'electron';
import type { DeviceReport, MicMixBridge, AudioState, AudioCommand } from './shared';
if (process.argv.includes('--audio-worker')) {
  contextBridge.exposeInMainWorld('audioHost', {
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
