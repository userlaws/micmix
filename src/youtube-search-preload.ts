import { ipcRenderer } from 'electron';

function videoTitle(anchor: HTMLAnchorElement) {
  const card = anchor.closest('ytd-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer');
  const title = card?.querySelector<HTMLElement>('#video-title')?.innerText
    || anchor.getAttribute('aria-label') || anchor.getAttribute('title') || '';
  return title.replace(/\s+/g, ' ').trim().slice(0, 500);
}

// Capture result clicks before YouTube's single-page router handles them. Main validates
// the URL again and turns the selected result into a regular MicMix queue item.
document.addEventListener('click', event => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest<HTMLAnchorElement>('a[href]');
  if (!anchor) return;
  try {
    const url = new URL(anchor.href);
    if (url.pathname !== '/watch' && !/^\/(shorts|live)\//.test(url.pathname)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    ipcRenderer.send('youtube-search:select', { url: url.href, title: videoTitle(anchor) });
  } catch { /* Ignore malformed links rendered by the remote page. */ }
}, true);
