import { Wordmark } from './Logo';
import { DownloadButton } from './Header';
import { site } from '../site-config';

export function Footer() {
  return (
    <>
      <section id="download" className="mx-auto max-w-7xl px-5 pb-20">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-ink-3 to-ink-2 px-6 py-14 text-center sm:px-12">
          <div className="pointer-events-none absolute -left-20 top-0 size-72 rounded-full bg-azure/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 bottom-0 size-72 rounded-full bg-violet/25 blur-3xl" />
          <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-5xl">
            Ready when you are.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-mist">
            One installer, one setup wizard, and your voice chat gets a soundtrack.
          </p>
          <div className="relative mt-8 flex justify-center">
            <DownloadButton large />
          </div>
          <p className="relative mt-4 text-xs text-mist">
            Version {site.version} · Windows 10/11 · 64-bit
          </p>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-mist sm:flex-row">
          <div className="flex items-center gap-3">
            <Wordmark className="text-xl" />
            <span>Your voice. Your music. Together.</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-5" aria-label="Footer">
            <a className="transition hover:text-white" href="#privacy">Privacy</a>
            <a className="transition hover:text-white" href="#terms">Terms</a>
            <a className="transition hover:text-white" href="#support">Support</a>
            <a className="transition hover:text-white" href={site.releasesUrl} target="_blank" rel="noreferrer">Releases</a>
            <a className="transition hover:text-white" href={site.vbAudioUrl} target="_blank" rel="noreferrer">
              VB-CABLE by VB-Audio
            </a>
          </nav>
        </div>
      </footer>
    </>
  );
}
