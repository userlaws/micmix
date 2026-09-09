import { app, net } from 'electron';
import type { UpdateInfo } from './shared';
// Update NOTICE only. MicMix never downloads or installs anything by itself: it asks GitHub for the
// latest release tag, and if it is newer the UI shows a link to the release page. One small request,
// no account, no telemetry, and it can be switched off in Settings.
const REPO = /github\.com[/:]([^/]+)\/([^/.]+)/.exec(require('../package.json').repository?.url ?? '');
export const releasesUrl = REPO ? `https://github.com/${REPO[1]}/${REPO[2]}/releases` : null;
export function parseVersion(text: string): number[] | null {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(text);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}
export function isNewer(candidate: string, current: string): boolean {
  const a = parseVersion(candidate), b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
export async function checkForUpdate(current = app.getVersion()): Promise<UpdateInfo | null> {
  if (!REPO) return null;
  const response = await net.fetch(`https://api.github.com/repos/${REPO[1]}/${REPO[2]}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'MicMix/' + current },
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) return null;
  const release = await response.json() as { tag_name?: string; html_url?: string; draft?: boolean; prerelease?: boolean };
  if (!release.tag_name || release.draft || release.prerelease || !isNewer(release.tag_name, current)) return null;
  const version = parseVersion(release.tag_name)!.join('.');
  return { version, url: release.html_url ?? releasesUrl! };
}
