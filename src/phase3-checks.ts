import { youtubeId, youtubeError } from './youtube-url';
export function run() {
  const id = 'M7lc1UVf-VE';
  for (const url of ['https://youtu.be/' + id + '?t=5', 'https://www.youtube.com/watch?v=' + id + '&list=ignored', 'https://youtube.com/shorts/' + id, 'https://youtube.com/live/' + id, 'https://youtube.com/embed/' + id]) {
    if (youtubeId(url) !== id) throw new Error('YouTube URL parser rejected a valid URL');
  }
  for (const url of ['https://youtube.com.attacker.example/watch?v=' + id, 'file:///video', 'javascript:alert(1)', 'https://youtube.com/playlist?list=123', 'https://youtube.com/watch?v=bad']) {
    let rejected = false; try { youtubeId(url); } catch { rejected = true; }
    if (!rejected) throw new Error('YouTube parser accepted an invalid URL');
  }
  if (youtubeError(101) !== 'This video blocks embedding, try another' || youtubeError(150) !== youtubeError(101)) throw new Error('Embedding error mapping failed');
  return { validLinks: 5, invalidLinksRejected: 5, blockedEmbedErrorMapped: true };
}
