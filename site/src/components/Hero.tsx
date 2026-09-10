import { ArrowRight } from 'lucide-react';
import { DownloadButton } from './Header';
import { site } from '../site-config';

export function Hero() {
  return (
    <section id="home" className="relative overflow-hidden">
      {/* The app's own backdrop: the same three soft radial washes MicMix paints behind its cards. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(900px 520px at 8% 100%, rgb(0 229 255 / 0.10), transparent 60%), ' +
            'radial-gradient(800px 480px at 92% 85%, rgb(255 43 214 / 0.10), transparent 60%), ' +
            'radial-gradient(700px 420px at 55% 20%, rgb(168 85 255 / 0.08), transparent 60%)',
        }}
      />

      <div className="mx-auto max-w-6xl px-5 pt-32 sm:pt-40">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-mist">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Version {site.version} · Free for Windows
          </span>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Play music through
            <br />
            your mic.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-mist">
            MicMix mixes your microphone with YouTube, local files and a soundboard into one virtual
            mic. Pick it in Discord, FiveM, Teams or any game and everyone hears both.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <DownloadButton large />
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-md border border-line px-5 py-3 text-base font-medium text-white transition-colors hover:border-white/25 hover:bg-white/5"
            >
              See how it works
              <ArrowRight className="size-4" />
            </a>
          </div>
          <p className="mt-4 text-sm text-mist">No account, no subscription, nothing uploaded.</p>
        </div>

        <figure className="mt-14 sm:mt-20">
          <div className="overflow-hidden rounded-xl border border-white/12 bg-[#071126] shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)] sm:rounded-2xl">
            <img
              src={import.meta.env.BASE_URL + 'screenshots/micmix-live.png'}
              width={2800}
              height={1918}
              alt="MicMix live: mixer faders for mic, music and pads, a track playing in the Music panel, a soundboard with hotkeys, and the virtual microphone broadcasting to Discord."
              className="block h-auto w-full"
              decoding="async"
              fetchPriority="high"
            />
          </div>
        </figure>
      </div>
    </section>
  );
}
