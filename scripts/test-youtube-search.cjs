const assert = require('node:assert/strict');
const { parseYouTubeResults, fetchYouTubeResults } = require('../artifacts/search-check/youtube-results.cjs');
const { YouTubeSearch } = require('../artifacts/search-check/youtube-search.cjs');
const { rankYouTubeResults } = require('../artifacts/search-check/youtube-fuzzy.cjs');
const fixture = 'var ytInitialData = ' + JSON.stringify({ contents: [
  { videoRenderer: { videoId: 'M7lc1UVf-VE', title: { runs: [{ text: 'Example }; <video> & music' }] }, ownerText: { runs: [{ text: 'Example channel' }] }, lengthText: { simpleText: '3:42' }, shortViewCountText: { simpleText: '1.2M views' }, publishedTimeText: { simpleText: '1 year ago' } } },
  { videoRenderer: { videoId: 'M7lc1UVf-VE', title: { simpleText: 'Duplicate' } } },
  { videoRenderer: { videoId: 'invalid', title: { simpleText: 'Invalid' } } },
  { videoRenderer: { videoId: 'abcdefghijk', title: { simpleText: 'Live music' }, badges: [{ metadataBadgeRenderer: { style: 'BADGE_STYLE_TYPE_LIVE_NOW' } }] } }
] }) + ';';
(async () => {
  const candidates = [
    { videoId: 'unrelated00', title: 'Ambient piano', channel: 'Sleep sounds' },
    { videoId: 'drake000000', title: 'Passionfruit', channel: 'Drake' },
    { videoId: 'beyonce0000', title: 'Halo', channel: 'Beyoncé' },
    { videoId: 'exact000000', title: 'Drake Passionfruit', channel: 'Music' }
  ];
  assert.equal(rankYouTubeResults('drkae pasionfrut', candidates)[0].videoId, 'drake000000');
  assert.equal(rankYouTubeResults('beyonce halo', candidates)[0].videoId, 'beyonce0000');
  assert.equal(rankYouTubeResults('DRAKE - PASSIONFRUIT', candidates)[0].videoId, 'exact000000');
  assert.equal(rankYouTubeResults('passion', candidates)[0].videoId, 'drake000000');
  assert.deepEqual(rankYouTubeResults('xy', candidates), candidates);
  assert.deepEqual(rankYouTubeResults('unmatched artist', candidates), candidates);
  assert.equal(rankYouTubeResults('drkae', candidates).length, candidates.length);
  console.log('PASS fuzzy matching: swapped/missing letters, accents, punctuation, prefixes, exact matches, stable fallback');
  const parsed = parseYouTubeResults(fixture);
  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed[0], { videoId: 'M7lc1UVf-VE', title: 'Example }; <video> & music', channel: 'Example channel', duration: '3:42', views: '1.2M views', published: '1 year ago', live: false, thumbnail: 'https://i.ytimg.com/vi/M7lc1UVf-VE/mqdefault.jpg' });
  assert.equal(parsed[1].live, true);
  assert.equal(parsed[1].duration, '');
  assert.throws(() => parseYouTubeResults('<html>Consent required</html>'), /unavailable/);
  assert.throws(() => parseYouTubeResults('ytInitialData = {broken};'), /unreadable/);
  assert.deepEqual(parseYouTubeResults('ytInitialData = {};'), []);
  const many = 'ytInitialData = ' + JSON.stringify({ contents: Array.from({ length: 50 }, (_, i) => ({ videoRenderer: { videoId: String(i).padStart(11, '0'), title: { simpleText: 'Song ' + i } } })) }) + ';';
  assert.equal(parseYouTubeResults(many).length, 30);
  const realFetch = global.fetch;
  global.fetch = async () => new Response(new Uint8Array(5 * 1024 * 1024 + 1));
  await assert.rejects(fetchYouTubeResults('test', new AbortController().signal), /too much/);
  global.fetch = async () => new Response('', { status: 503 });
  await assert.rejects(fetchYouTubeResults('test', new AbortController().signal), /could not load/);
  global.fetch = realFetch;
  const live = await fetchYouTubeResults('drake', AbortSignal.timeout(20000));
  assert.ok(live.length > 0 && live.length <= 30);
  assert.ok(live.some(result => result.channel && result.duration));
  console.log('Live YouTube search:', live.length, 'results with metadata; first:', live[0].title);
  const search = new YouTubeSearch();
  global.fetch = async () => new Response(fixture);
  assert.deepEqual(await search.search('example'), parsed);
  assert.equal(search.result('M7lc1UVf-VE').title, parsed[0].title);
  let oldSignal, release;
  global.fetch = (_url, { signal }) => { oldSignal = signal; return new Promise(resolve => { release = resolve; }); };
  const old = search.search('old');
  global.fetch = async () => new Response(many);
  const next = await search.search('new');
  assert.ok(oldSignal.aborted);
  release(new Response(fixture));
  assert.equal(await old, null);
  assert.equal(next.length, 30);
  let aborted = false;
  global.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }, { once: true });
  });
  const canceled = search.search('cancel');
  search.close();
  assert.equal(await canceled, null);
  assert.ok(aborted);
  global.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(search.search('offline'), /offline/);
  global.fetch = async () => new Response(fixture);
  assert.deepEqual(await search.search('retry'), parsed);
  search.close();
  global.fetch = realFetch;
  console.log('PASS: metadata, punctuation, deduplication, result/response limits, replacement, cancellation, error recovery');
})().catch(error => { console.error(error); process.exitCode = 1; });
