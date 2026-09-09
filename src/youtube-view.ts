import { BrowserView, type BrowserWindow, type IpcMainEvent, session } from 'electron';
import path from 'node:path';
import type { VideoBounds, YouTubeCommand, YouTubeUpdate } from './shared';
import { youtubeError } from './youtube-url';

export class YouTubeView {
  readonly view: BrowserView;
  private videoId = '';
  private attached = false;
  private generation = 0;
  private pending: { resolve(): void; reject(error: Error): void; timer: NodeJS.Timeout } | null = null;
  constructor(private host: BrowserWindow, private emit: (update: YouTubeUpdate) => void) {
    const remote = session.fromPartition('micmix-youtube');
    remote.setPermissionCheckHandler(() => false);
    remote.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    remote.on('will-download', event => event.preventDefault());
    this.view = new BrowserView({ webPreferences: {
      session: remote, preload: path.join(__dirname, 'youtube-preload.cjs'),
      sandbox: true, nodeIntegration: false, contextIsolation: true, backgroundThrottling: false
    } });
    this.view.webContents.setAudioMuted(true);
    this.view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.view.webContents.on('will-navigate', event => event.preventDefault());
    this.view.webContents.on('render-process-gone', () => this.fail('The YouTube player stopped. Select the video again to retry.'));
    this.view.webContents.on('did-fail-load', (_event, code, description, _url, main) => {
      if (main && code !== -3) this.fail('YouTube could not load: ' + description + '. Check your connection.');
    });
  }
  private fail(message: string) {
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(new Error(message)); this.pending = null; }
    this.emit({ videoId: this.videoId, error: message });
  }
  frame() {
    if (this.view.webContents.isDestroyed() || !this.videoId || !this.view.webContents.getURL().startsWith('https://www.youtube.com/embed/' + this.videoId + '?')) return null;
    return this.view.webContents.mainFrame;
  }
  bounds(bounds: VideoBounds | null) {
    if (this.host.isDestroyed()) return;
    if (!bounds || bounds.width < 200 || bounds.height < 200) {
      if (this.attached) this.host.removeBrowserView(this.view);
      this.attached = false; return;
    }
    if (!this.attached) { this.host.addBrowserView(this.view); this.attached = true; }
    this.view.setBounds(bounds);
  }
  event(event: IpcMainEvent, data: { event?: string; value?: number; playerState?: number; position?: number; duration?: number; title?: string }) {
    if (event.sender !== this.view.webContents || event.senderFrame !== this.frame()) return;
    if (data.event === 'onError') { this.fail(youtubeError(Number(data.value))); return; }
    const ready = data.event === 'initialDelivery' || data.event === 'onReady';
    if (ready && this.pending) { clearTimeout(this.pending.timer); this.pending.resolve(); this.pending = null; }
    this.emit({ videoId: this.videoId, ready,
      playerState: data.event === 'onStateChange' ? data.value : data.playerState,
      position: data.position, duration: data.duration, title: data.title });
  }
  pause() { if (!this.view.webContents.isDestroyed()) this.view.webContents.send('youtube:post', 'pauseVideo', []); }
  async command(command: YouTubeCommand) {
    if (command.type === 'pause') { this.pause(); return; }
    if (command.type === 'load') {
      if (!/^[\w-]{11}$/.test(command.videoId) || !Number.isFinite(command.position) || command.position < 0) throw new Error('Invalid YouTube load command');
      if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(new Error('YouTube load replaced.')); this.pending = null; }
      const generation = ++this.generation;
      this.videoId = command.videoId;
      const ready = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => this.fail('YouTube did not become ready. Check your connection and try another link.'), 15000);
        this.pending = { resolve, reject, timer };
      });
      // Attach a rejection handler immediately in case navigation fails first.
      void ready.catch(() => {});
      const url = new URL('https://www.youtube.com/embed/' + command.videoId);
      url.search = new URLSearchParams({ enablejsapi: '1', origin: 'https://www.youtube.com', autoplay: '0', playsinline: '1', start: String(Math.floor(command.position)) }).toString();
      try {
        await this.view.webContents.loadURL(url.href, { httpReferrer: 'https://com.micmix.desktop/' });
        await ready;
      } catch (error) {
        if (generation === this.generation) this.fail(error instanceof Error ? error.message : String(error));
        throw error;
      }
      return;
    }
    if (!this.frame()) throw new Error('Load a YouTube video first.');
    if (command.type === 'play') this.view.webContents.send('youtube:post', 'playVideo', []);
    else if (command.type === 'seek' && Number.isFinite(command.seconds) && command.seconds >= 0) this.view.webContents.send('youtube:post', 'seekTo', [command.seconds, true]);
    else throw new Error('Invalid YouTube control');
  }
  close() {
    ++this.generation;
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(new Error('YouTube player closed.')); this.pending = null; }
    if (!this.view.webContents.isDestroyed()) this.view.webContents.close();
  }
}
