import { DownloadButton } from './Header';
import { AppMockup } from './AppMockup';
import { site } from '../site-config';

export function Hero() {
  return (
    <section id="home" className="mx-auto max-w-6xl px-5 pb-8 pt-32 sm:pt-40">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Play music through your mic.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-mist">
          MicMix mixes your microphone with YouTube, local files and a soundboard into one virtual
          mic. Pick it in Discord, FiveM, Teams or any game, hit play, and everyone hears both.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <DownloadButton large />
          <a href="#how" className="text-sm text-mist underline-offset-4 hover:text-white hover:underline">
            See how it works
          </a>
        </div>
        <p className="mt-4 text-sm text-mist">
          Free · Windows 10/11 · Version {site.version} · No account needed
        </p>
      </div>

      <div className="mt-14">
        <AppMockup />
      </div>
    </section>
  );
}
