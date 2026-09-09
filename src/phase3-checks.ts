import { youtubeId, youtubeInput, youtubeError } from './youtube-url';
export function run() {
  const id = 'M7lc1UVf-VE';
  for (const url of ['https://youtu.be/' + id + '?t=5', 'https://www.youtube.com/watch?v=' + id + '&list=ignored', 'https://youtube.com/shorts/' + id, 'https://youtube.com/live/' + id, 'https://youtube.com/embed/' + id]) {
    if (youtubeId(url) !== id) throw new Error('YouTube URL parser rejected a valid URL');
  }
  for (const url of ['https://youtube.com.attacker.example/watch?v=' + id, 'file:///video', 'javascript:alert(1)', 'https://youtube.com/playlist?list=123', 'https://youtube.com/watch?v=bad']) {
    let rejected = false; try { youtubeId(url); } catch { rejected = true; }
    if (!rejected) throw new Error('YouTube parser accepted an invalid URL');
  }
  const search = youtubeInput('lofi hip hop');
  if (search.kind !== 'search' || search.query !== 'lofi hip hop') throw new Error('YouTube keywords were not classified as a search');
  const bareLink = youtubeInput('youtu.be/' + id);
  if (bareLink.kind !== 'video' || bareLink.videoId !== id) throw new Error('Bare YouTube link was not classified as a video');
  let externalRejected = false;
  try { youtubeInput('https://example.com/watch?v=' + id); } catch { externalRejected = true; }
  if (!externalRejected) throw new Error('Non-YouTube URL was classified as a search');
  if (youtubeError(101) !== 'This video blocks embedding, try another' || youtubeError(150) !== youtubeError(101)) throw new Error('Embedding error mapping failed');
  return { validLinks: 5, invalidLinksRejected: 5, searchInputClassified: true, blockedEmbedErrorMapped: true };
}
