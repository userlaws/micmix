import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { UpdateStatus } from './shared';
// In-app updater (user request, 2026-09-09): checks GitHub Releases on launch, downloads the new
// installer in the background, verifies it (electron-updater checks the sha512 from latest.yml) and
// restarts into it. Nothing else is fetched. Can be switched off in Settings; a manual check stays available.
type Listener = (status: UpdateStatus) => void;
let status: UpdateStatus = { phase: 'idle' };
let available = '';
const listeners = new Set<Listener>();
function set(next: UpdateStatus) { status = next; for (const listener of listeners) listener(status); }
export function updateStatus() { return status; }
export function onUpdateStatus(listener: Listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
// Development builds cannot update (nothing is packaged); MICMIX_UPDATE_SIMULATE=1 plays the whole flow with fake data for UI work.
export const simulate = !app.isPackaged && process.env.MICMIX_UPDATE_SIMULATE === '1';
export const updatesSupported = app.isPackaged || simulate;
const busy = () => status.phase === 'checking' || status.phase === 'downloading' || status.phase === 'installing';
function friendly(error: unknown): string {
  const text = String((error as Error)?.message ?? error);
  if (/ERR_INTERNET_DISCONNECTED|ENOTFOUND|EAI_AGAIN|ERR_NAME_NOT_RESOLVED/.test(text)) return 'No internet connection.';
  if (/404|Cannot find latest\.yml/i.test(text)) return 'No update information published yet.';
  if (/ERR_CONNECTION|ETIMEDOUT|ECONNRESET|timed out/i.test(text)) return 'Could not reach GitHub. Try again later.';
  if (/sha512|checksum/i.test(text)) return 'The download did not verify. Try again later.';
  return text.length > 140 ? text.slice(0, 140) + '…' : text;
}
let wired = false;
function wire() {
  if (wired) return; wired = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true; // a downloaded update still installs if the user quits instead of restarting
  autoUpdater.allowDowngrade = false;
  autoUpdater.logger = { info() {}, warn: (m: unknown) => console.warn('[update]', m), error: (m: unknown) => console.error('[update]', m), debug() {} };
  autoUpdater.on('checking-for-update', () => set({ phase: 'checking' }));
  autoUpdater.on('update-available', info => { available = info.version; set({ phase: 'available', version: info.version }); });
  autoUpdater.on('update-not-available', () => set({ phase: 'upToDate', version: app.getVersion(), at: Date.now() }));
  autoUpdater.on('download-progress', p => set({ phase: 'downloading', version: available, percent: p.percent, transferred: p.transferred, total: p.total, bytesPerSecond: p.bytesPerSecond }));
  autoUpdater.on('update-downloaded', info => set({ phase: 'downloaded', version: info.version }));
  autoUpdater.on('error', error => set({ phase: 'error', message: friendly(error), at: Date.now() }));
}
let simTimer: NodeJS.Timeout | null = null;
function runSimulation() {
  const version = app.getVersion().replace(/(\d+)$/, (_, n) => String(Number(n) + 1));
  const total = 114_758_813;
  const steps: Array<[number, () => void]> = [
    [0, () => set({ phase: 'checking' })],
    [900, () => set({ phase: 'available', version })],
  ];
  for (let i = 1; i <= 40; i++) steps.push([1400 + i * 110, () => set({ phase: 'downloading', version, percent: i * 2.5, transferred: total * i / 40, total, bytesPerSecond: 24_000_000 + Math.sin(i) * 6_000_000 })]);
  steps.push([6200, () => set({ phase: 'downloaded', version })]);
  for (const [delay, run] of steps) setTimeout(run, delay);
}
export async function checkForUpdates() {
  if (!updatesSupported || busy()) return;
  if (simulate) { runSimulation(); return; }
  wire();
  try { await autoUpdater.checkForUpdates(); }
  catch (error) { set({ phase: 'error', message: friendly(error), at: Date.now() }); }
}
export function installUpdate(): boolean {
  if (status.phase !== 'downloaded') return false;
  const version = status.version;
  set({ phase: 'installing', version });
  if (simulate) { if (simTimer) clearTimeout(simTimer); simTimer = setTimeout(() => set({ phase: 'upToDate', version, at: Date.now() }), 2500); return true; }
  // isSilent: NSIS runs with /S; isForceRunAfter: MicMix relaunches when the installer finishes.
  setImmediate(() => autoUpdater.quitAndInstall(true, true));
  return true;
}
