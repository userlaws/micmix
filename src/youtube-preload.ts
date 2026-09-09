import { ipcRenderer } from 'electron';
const origin = 'https://www.youtube.com';
const post = (data: object) => window.postMessage(JSON.stringify({ ...data, id: 'micmix' }), origin);
// The remote page gets no filesystem or IPC bridge. Only bounded player events leave this preload.
window.addEventListener('message', event => {
  if (event.origin !== origin || event.source !== window || typeof event.data !== 'string' || event.data.length > 65536) return;
  try {
    const data = JSON.parse(event.data);
    if (data.id !== 'micmix') return;
    if (data.event === 'onReady' || data.event === 'initialDelivery') {
      clearInterval(handshake);
      for (const name of ['onStateChange', 'onError']) post({ event: 'command', func: 'addEventListener', args: [name] });
      // The player's own volume is independent of the muted webContents; the mixer owns loudness.
      post({ event: 'command', func: 'unMute', args: [] });
      post({ event: 'command', func: 'setVolume', args: [100] });
    }
    if (!['onReady', 'initialDelivery', 'infoDelivery', 'onStateChange', 'onError'].includes(data.event)) return;
    const info = data.info;
    ipcRenderer.send('youtube:event', {
      event: data.event,
      value: typeof info === 'number' ? info : undefined,
      playerState: Number.isFinite(info?.playerState) ? info.playerState : undefined,
      position: Number.isFinite(info?.currentTime) ? info.currentTime : undefined,
      duration: Number.isFinite(info?.duration) ? info.duration : undefined,
      title: typeof info?.videoData?.title === 'string' ? info.videoData.title.slice(0, 500) : undefined
    });
  } catch { /* Ignore unrelated or malformed remote messages. */ }
});
const handshake = setInterval(() => post({ event: 'listening' }), 250);
window.addEventListener('unload', () => clearInterval(handshake));
ipcRenderer.on('youtube:post', (_event, func: string, args: unknown[]) => {
  if (['playVideo', 'pauseVideo', 'seekTo'].includes(func)) post({ event: 'command', func, args });
});
