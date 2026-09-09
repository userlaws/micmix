import React, { useEffect, useRef, useState } from 'react';
import type { LocalTrack, YouTubeResult } from './shared';
import { youtubeInput } from './youtube-url';
import { Icon } from './icons';

interface Props {
  busy: boolean; queue: LocalTrack[];
  onAdd(value: string, select: boolean): Promise<void>;
  onBrowse(open: boolean): void;
}
interface SearchState { query: string; results: YouTubeResult[]; loading: boolean; error: string }
const errorText = (error: unknown) => String(error instanceof Error ? error.message : error).replace(/^Error(?: invoking remote method '[^']+': Error)?:\s*/, '');

function Thumbnail({ result }: { result: YouTubeResult }) {
  const [failed, setFailed] = useState(false);
  return <div className="result-thumbnail">
    {failed ? <Icon name="youtube" size={28} /> : <img src={result.thumbnail} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />}
    {(result.duration || result.live) && <span className={'result-duration' + (result.live ? ' is-live' : '')}>{result.live ? 'LIVE' : result.duration}</span>}
  </div>;
}

export function YouTubePanel({ busy, queue, onAdd, onBrowse }: Props) {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState<SearchState | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [addError, setAddError] = useState('');
  const [notice, setNotice] = useState('');
  const generation = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const addPending = useRef(false);
  const linkLike = /^(?:[a-z][a-z0-9+.-]*:|(?:(?:www|m|music)\.)?youtube\.com\/|youtu\.be\/)/i.test(input.trim());
  useEffect(() => () => {
    generation.current++;
    void window.micmix.cancelYouTubeSearch().catch(() => {});
    onBrowse(false);
  }, [onBrowse]);

  function closeSearch() {
    generation.current++;
    void window.micmix.cancelYouTubeSearch().catch(() => {});
    setSearch(null); setAddError(''); setNotice(''); onBrowse(false);
    inputRef.current?.focus();
  }

  async function add(value: string, result?: YouTubeResult) {
    if (busy || addPending.current) return;
    addPending.current = true;
    setAdding(result?.videoId ?? 'link'); setAddError(''); setNotice('');
    try {
      await onAdd(value, !result);
      if (result) setNotice('Added “' + result.title + '” to your queue.');
      else { setInput(''); closeSearch(); }
    } catch (error) { setAddError(errorText(error)); }
    finally { addPending.current = false; setAdding(null); }
  }

  async function submit() {
    setAddError(''); setNotice('');
    let parsed;
    try { parsed = youtubeInput(input); }
    catch (error) { setAddError(errorText(error)); return; }
    if (parsed.kind === 'video') { await add(input); return; }
    const request = ++generation.current;
    setSearch({ query: parsed.query, results: [], loading: true, error: '' });
    onBrowse(true);
    try {
      const results = await window.micmix.searchYouTube(parsed.query);
      if (request !== generation.current) return;
      setSearch(results === null ? null : { query: parsed.query, results, loading: false, error: '' });
      if (results === null) onBrowse(false);
      listRef.current?.scrollTo(0, 0);
    } catch (error) {
      if (request === generation.current) setSearch({ query: parsed.query, results: [], loading: false, error: errorText(error) });
    }
  }

  return <div className="youtube-browser">
    <form className="source-row" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <div className="input-wrap"><Icon name={linkLike ? 'link' : 'search'} size={18} />
        <input ref={inputRef} aria-label="Search YouTube or paste a video link" type="text" required maxLength={2048}
          placeholder="Search songs, artists, or paste a link…" value={input} onChange={event => setInput(event.target.value)}
          onKeyDown={event => { if (event.key === 'Escape' && search) { event.preventDefault(); closeSearch(); } }} />
        {!!input && <button className="search-clear" type="button" aria-label="Clear search text" onClick={() => { setInput(''); inputRef.current?.focus(); }}><Icon name="close" size={14} /></button>}
      </div>
      <button className="btn primary" disabled={!input.trim() || (linkLike && (busy || !!adding)) || (search?.loading && search.query === input.trim())} type="submit">
        {linkLike ? (adding === 'link' ? 'Adding…' : 'Load') : 'Search'}
      </button>
    </form>
    {addError && <p role="alert" className="search-error">{addError}</p>}
    {search && <section className="search-results" aria-label="YouTube search results">
      <div className="search-results-head">
        <div className="search-heading"><span className="search-source"><Icon name="youtube" size={16} />YOUTUBE SEARCH</span>
          <h3 title={search.query}>{search.query}</h3>
        </div>
        <button className="btn small search-done" type="button" onClick={closeSearch}><Icon name="close" size={14} />{search.loading ? 'Cancel' : 'Done'}</button>
      </div>
      {search.loading ? <div className="search-loading" role="status"><p>Finding your music…</p>
        <div className="search-skeletons" aria-hidden="true">{[0, 1, 2].map(index => <div className="search-skeleton" key={index}><i /><div><i /><i /></div></div>)}</div>
      </div> : search.error ? <div className="search-empty"><Icon name="search" size={28} /><h4>Couldn’t load results</h4><p role="alert">{search.error}</p>
        <button className="btn small" onClick={() => void submit()}><Icon name="refresh" size={14} />Try again</button></div>
        : !search.results.length ? <div className="search-empty"><Icon name="search" size={28} /><h4>No videos found</h4><p>Try another artist or song, or paste a YouTube link.</p></div>
        : <>
          <div className="search-results-meta"><span>{search.results.length} videos</span><span>Add songs to your queue</span></div>
          <ol className="search-result-list" ref={listRef}>
            {search.results.map(result => {
              const queued = queue.some(track => track.youtubeId === result.videoId);
              const isAdding = adding === result.videoId;
              return <li className={'search-result' + (queued ? ' is-queued' : '')} key={result.videoId}>
                <Thumbnail result={result} />
                <div className="result-info"><h4 title={result.title}>{result.title}</h4>
                  {result.channel && <p className="result-channel" title={result.channel}>{result.channel}</p>}
                  {(result.views || result.published) && <p className="result-stats">{[result.views, result.published].filter(Boolean).join(' · ')}</p>}
                </div>
                <button className={'result-add' + (queued ? ' is-added' : '')} disabled={busy || !!adding || queued}
                  aria-label={queued ? result.title + ' is in your queue' : 'Add ' + result.title + ' to queue'}
                  onClick={() => void add('https://www.youtube.com/watch?v=' + result.videoId, result)}>
                  <Icon name={queued ? 'check' : 'plus'} size={16} /><span>{isAdding ? 'Adding…' : queued ? 'Added' : 'Add'}</span>
                </button>
              </li>;
            })}
          </ol>
        </>}
      <p className="search-footer" role="status">{notice || 'Add a few favorites, then press Done.'}</p>
    </section>}
  </div>;
}
