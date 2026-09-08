import { contextBridge, ipcRenderer } from 'electron';
import type { DeviceReport, MicMixBridge } from './shared';
if (process.argv.includes('--audio-worker')) {
  contextBridge.exposeInMainWorld('audioHost', {
    publish: (report: DeviceReport) => ipcRenderer.send('audio:report', report),
    onScan: (callback: () => void) => { ipcRenderer.on('audio:scan', () => callback()); }
  });
} else {
  const api: MicMixBridge = {
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
