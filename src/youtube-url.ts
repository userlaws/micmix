export function youtubeId(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('Paste a valid YouTube video URL.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error('Paste a valid YouTube video URL.');
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.split('/')[1];
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else if (/^\/(embed|shorts|live)\//.test(url.pathname)) id = url.pathname.split('/')[2];
  }
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error('Use a YouTube video link, not a channel or playlist-only link.');
  return id;
}

export type YouTubeInput = { kind: 'video'; videoId: string } | { kind: 'search'; query: string };

export function youtubeInput(value: string): YouTubeInput {
  const input = value.trim();
  if (!input) throw new Error('Enter a YouTube link or something to search for.');
  if (input.length > 2048) throw new Error('That YouTube link or search is too long.');

  // Keep URL-like input on the strict URL validation path. This prevents a mistyped or
  // non-YouTube URL from silently becoming a YouTube search.
  const schemed = /^[a-z][a-z0-9+.-]*:/i.test(input);
  const bareYouTube = /^(?:(?:www|m|music)\.)?youtube\.com\/|^youtu\.be\//i.test(input);
  if (schemed || bareYouTube) {
    return { kind: 'video', videoId: youtubeId(bareYouTube && !schemed ? 'https://' + input : input) };
  }
  if (input.length > 200) throw new Error('Keep YouTube searches under 200 characters.');
  return { kind: 'search', query: input };
}
export function youtubeError(code: number) {
  if (code === 101 || code === 150) return 'This video blocks embedding, try another';
  if (code === 100) return 'This video is unavailable or private. Try another link.';
  if (code === 153) return 'YouTube could not identify this app. Restart MicMix and try again.';
  if (code === 2) return 'YouTube rejected this video link. Try another.';
  return 'YouTube could not play this video. Check your connection or try another link.';
}
