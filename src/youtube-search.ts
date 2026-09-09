import { BrowserWindow, session, type IpcMainEvent, type Session } from 'electron';
import path from 'node:path';
import { youtubeId } from './youtube-url';

export interface YouTubeSearchSelection { videoId: string; title: string }

function youtubePage(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com'));
  } catch { return false; }
}

export class YouTubeSearch {
  private picker: { win: BrowserWindow; finish(value: YouTubeSearchSelection | null, error?: Error): void } | null = null;
  private remote: Session;

  constructor(private host: BrowserWindow) {
    this.remote = session.fromPartition('micmix-youtube-search');
    this.remote.setPermissionCheckHandler(() => false);
    this.remote.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    this.remote.on('will-download', event => event.preventDefault());
  }

  private select(value: unknown, sender?: Electron.WebContents) {
    const active = this.picker;
    if (!active || (sender && sender !== active.win.webContents) || !value || typeof value !== 'object') return false;
    const data = value as { url?: unknown; title?: unknown };
    if (typeof data.url !== 'string' || data.url.length > 2048) return false;
    try {
      const videoId = youtubeId(data.url);
      const rawTitle = typeof data.title === 'string' ? data.title.replace(/\s+/g, ' ').trim().slice(0, 500) : '';
      active.finish({ videoId, title: rawTitle || 'YouTube · ' + videoId });
      return true;
    } catch { return false; }
  }

  event(event: IpcMainEvent, data: unknown) { this.select(data, event.sender); }

  pick(query: string): Promise<YouTubeSearchSelection | null> {
    if (this.picker) {
      this.picker.win.show(); this.picker.win.focus();
      return Promise.reject(new Error('Finish or close the open YouTube search first.'));
    }
    const win = new BrowserWindow({
      parent: this.host, modal: true, show: false, width: 1120, height: 780, minWidth: 760, minHeight: 560,
      title: 'Search YouTube — MicMix', autoHideMenuBar: true, backgroundColor: '#0f0f0f',
      webPreferences: { preload: path.join(__dirname, 'youtube-search-preload.cjs'), session: this.remote,
        sandbox: true, nodeIntegration: false, contextIsolation: true }
    });
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (value: YouTubeSearchSelection | null, error?: Error) => {
        if (settled) return;
        settled = true;
        if (this.picker?.win === win) this.picker = null;
        if (!win.isDestroyed()) win.close();
        if (error) reject(error); else resolve(value);
      };
      this.picker = { win, finish };
      win.webContents.setWindowOpenHandler(details => {
        this.select({ url: details.url, title: '' }, win.webContents);
        return { action: 'deny' };
      });
      win.webContents.on('will-navigate', (event, url) => {
        if (this.select({ url, title: '' }, win.webContents)) { event.preventDefault(); return; }
        if (!youtubePage(url)) event.preventDefault();
      });
      win.webContents.on('did-navigate-in-page', (_event, url) => { this.select({ url, title: '' }, win.webContents); });
      win.webContents.on('page-title-updated', event => { event.preventDefault(); win.setTitle('Choose a YouTube video — MicMix'); });
      win.webContents.on('did-fail-load', (_event, code, description, _url, main) => {
        if (main && code !== -3) finish(null, new Error('YouTube search could not load: ' + description + '.'));
      });
      win.on('closed', () => finish(null));
      win.once('ready-to-show', () => { if (!settled) { win.show(); win.focus(); } });
      const url = new URL('https://www.youtube.com/results');
      url.searchParams.set('search_query', query);
      void win.loadURL(url.href).catch(error => finish(null, error instanceof Error ? error : new Error(String(error))));
    });
  }

  close() { this.picker?.finish(null); }
}
