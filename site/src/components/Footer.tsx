import { Wordmark } from './Logo';
import { DownloadButton } from './Header';
import { site } from '../site-config';

export function Footer() {
  return (
    <>
      <section id="download" className="mx-auto max-w-6xl border-t border-line px-5 py-20">
        <h2 className="text-3xl font-semibold tracking-tight">Ready when you are.</h2>
        <p className="mt-3 max-w-xl text-mist">
          One installer, one setup wizard, and your voice chat gets a soundtrack.
        </p>
        <div className="mt-8">
          <DownloadButton large />
        </div>
        <p className="mt-4 text-sm text-mist">
          Version {site.version} · Windows 10/11 · 64-bit
        </p>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-5 py-8 text-sm text-mist sm:flex-row sm:items-center">
          <Wordmark className="text-base" />
          <nav className="flex flex-wrap items-center gap-5" aria-label="Footer">
            <a className="hover:text-white" href="#support">Support</a>
            <a className="hover:text-white" href={site.releasesUrl} target="_blank" rel="noreferrer">Releases</a>
            <a className="hover:text-white" href={site.vbAudioUrl} target="_blank" rel="noreferrer">
              VB-CABLE by VB-Audio
            </a>
          </nav>
        </div>
      </footer>
    </>
  );
}
