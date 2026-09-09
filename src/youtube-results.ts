import type { YouTubeResult } from './shared';
const MAX_BYTES = 5 * 1024 * 1024;

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject => value && typeof value === 'object' ? value as JsonObject : {};
function text(value: unknown): string {
  const data = object(value);
  const raw = typeof data.simpleText === 'string' ? data.simpleText
    : Array.isArray(data.runs) ? data.runs.map(run => typeof object(run).text === 'string' ? object(run).text : '').join('') : '';
  return raw.replace(/\s+/g, ' ').trim().slice(0, 500);
}

// Extract JSON without executing page scripts. Balance braces so punctuation in
// titles and descriptions cannot truncate the data (e.g. a title containing "};").
function initialData(html: string): unknown {
  const match = /\bytInitialData\s*=\s*\{/.exec(html);
  if (!match) throw new Error('YouTube search is unavailable. Try again or paste a video link.');
  const start = match.index + match[0].length - 1;
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < html.length; i++) {
    const char = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) {
      try { return JSON.parse(html.slice(start, i + 1)); }
      catch { break; }
    }
  }
  throw new Error('YouTube returned unreadable search results. Try a video link.');
}

export function parseYouTubeResults(html: string): YouTubeResult[] {
  const results: YouTubeResult[] = [];
  const seen = new Set<string>();
  const stack: unknown[] = [initialData(html)];
  while (stack.length && results.length < 30) {
    const item = stack.pop();
    if (!item || typeof item !== 'object') continue;
    const data = object(item);
    const video = object(data.videoRenderer);
    const videoId = video.videoId;
    const title = text(video.title);
    if (typeof videoId === 'string' && /^[\w-]{11}$/.test(videoId) && title && !seen.has(videoId)) {
      const badges = Array.isArray(video.badges) ? video.badges : [];
      const live = badges.some(badge => object(object(badge).metadataBadgeRenderer).style === 'BADGE_STYLE_TYPE_LIVE_NOW');
      seen.add(videoId);
      results.push({ videoId, title, channel: text(video.ownerText) || text(video.shortBylineText),
        duration: text(video.lengthText), views: text(video.shortViewCountText) || text(video.viewCountText),
        published: text(video.publishedTimeText), live,
        thumbnail: 'https://i.ytimg.com/vi/' + videoId + '/mqdefault.jpg' });
    }
    const children = Object.values(data);
    for (let i = children.length - 1; i >= 0; i--) if (children[i] && typeof children[i] === 'object') stack.push(children[i]);
  }
  return results;
}

export async function fetchYouTubeResults(query: string, signal: AbortSignal): Promise<YouTubeResult[]> {
  const url = new URL('https://www.youtube.com/results');
  url.searchParams.set('search_query', query);
  const response = await fetch(url, { signal, headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
  if (!response.ok || !response.body) {
    await response.body?.cancel().catch(() => {});
    throw new Error('YouTube search could not load. Try again or paste a video link.');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error('YouTube returned too much search data. Try a video link.');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return parseYouTubeResults(Buffer.concat(chunks).toString('utf8'));
}
