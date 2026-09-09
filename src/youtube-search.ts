import { fetchYouTubeResults } from './youtube-results';
import type { YouTubeResult } from './shared';
import { rankYouTubeResults } from './youtube-fuzzy';

// One bounded request at a time; searches never create windows or video players.
export class YouTubeSearch {
  private pending: AbortController | null = null;
  private results = new Map<string, YouTubeResult>();

  result(videoId: string) { return this.results.get(videoId); }

  async search(query: string): Promise<YouTubeResult[] | null> {
    this.close();
    const controller = new AbortController();
    this.pending = controller;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
    try {
      const results = rankYouTubeResults(query, await fetchYouTubeResults(query, controller.signal));
      if (controller.signal.aborted) return null;
      for (const result of results) {
        this.results.delete(result.videoId);
        this.results.set(result.videoId, result);
      }
      while (this.results.size > 120) this.results.delete(this.results.keys().next().value!);
      return results;
    } catch (error) {
      if (timedOut) throw new Error('YouTube search timed out. Try again or paste a video link.');
      if (controller.signal.aborted) return null;
      throw new Error(error instanceof Error ? error.message : 'YouTube search could not load. Please try again.');
    } finally {
      clearTimeout(timer);
      if (this.pending === controller) this.pending = null;
    }
  }

  close() { this.pending?.abort(); this.pending = null; }
}
