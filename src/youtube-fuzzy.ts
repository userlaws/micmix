import type { YouTubeResult } from './shared';
const normalize = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// Bounded edit distance, including adjacent swapped letters.
function distance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
  }
  return rows[a.length][b.length];
}
function similarity(query: string, word: string) {
  if (query === word) return 1;
  if (query.length >= 3 && word.startsWith(query)) return 0.9;
  const allowance = query.length >= 6 ? 2 : query.length >= 3 ? 1 : 0;
  if (!allowance || Math.abs(query.length - word.length) > allowance || query.length > 40 || word.length > 40) return 0;
  const edits = distance(query, word);
  return edits <= allowance ? 1 - edits / Math.max(query.length, word.length) : 0;
}
// Keep all fetched results and YouTube's ordering for ties or uncertain matches.
export function rankYouTubeResults(query: string, results: YouTubeResult[]): YouTubeResult[] {
  const normalized = normalize(query);
  const tokens = normalized.split(' ').filter(Boolean).slice(0, 12);
  if (!tokens.length) return results.slice();
  return results.map((result, index) => {
    const words = [...new Set(normalize(result.title + ' ' + result.channel).split(' '))].slice(0, 100);
    const matches = tokens.map(token => Math.max(0, ...words.map(word => similarity(token, word))));
    const score = matches.every(match => match >= 0.6)
      ? matches.reduce((sum, match) => sum + match, 0) / tokens.length + (normalize(result.title) === normalized ? 0.1 : 0) : 0;
    return { result, index, score };
  }).sort((a, b) => b.score - a.score || a.index - b.index).map(entry => entry.result);
}
