import {
  Link2,
  FolderOpen,
  AudioLines,
  Headphones,
  LayoutGrid,
  ShieldCheck,
  Keyboard,
  Gauge,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Link2,
    title: 'Paste a YouTube link',
    body: 'The video plays inside MicMix and its audio goes straight into your mic feed. No browser tabs, no loopback hacks.',
  },
  {
    icon: FolderOpen,
    title: 'Drop local files',
    body: 'MP3, WAV, FLAC and OGG. Drag them in, build a queue, and skip, seek or shuffle while you talk.',
  },
  {
    icon: AudioLines,
    title: 'Auto-duck when you speak',
    body: 'Music dips the moment your mic picks you up and eases back when you stop, so your voice always wins.',
  },
  {
    icon: LayoutGrid,
    title: 'Soundboard with hotkeys',
    body: 'Nine pads, each bound to a global shortcut that fires even while your game has focus.',
  },
  {
    icon: Headphones,
    title: 'Hear it your way',
    body: 'Monitor the mix in your own headphones at whatever level you like, without changing what your friends hear.',
  },
  {
    icon: Gauge,
    title: 'Built-in limiter',
    body: 'A master limiter and peak guard keep the output clean, so a loud drop never clips or distorts.',
  },
  {
    icon: Keyboard,
    title: 'One switch: LIVE / OFF AIR',
    body: 'Flip to OFF AIR and your mic is released instantly. Flip back and everything picks up where it was.',
  },
  {
    icon: ShieldCheck,
    title: 'No accounts, no cloud',
    body: 'Everything runs on your PC. Nothing is uploaded, nothing phones home, and the app never needs admin after install.',
  },
];

export function Features() {
  return (
    <>
      <section id="features" className="mx-auto max-w-6xl scroll-mt-24 border-t border-line px-5 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">What it does</h2>
          <p className="mt-3 text-mist">
            MicMix shows up in Windows as a microphone called MicMix Virtual Mic. Pick it wherever
            you pick a mic and you are done.
          </p>
        </div>

        <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <article key={f.title}>
              <f.icon className="size-5 text-accent" />
              <h3 className="mt-4 font-medium">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mist">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <HowItWorks />
    </>
  );
}

const STEPS = [
  { title: 'Install MicMix', body: 'Run the installer once. It sets up the virtual mic driver for you.' },
  { title: 'Pick your real mic', body: 'The setup wizard finds your microphone and plays a test tone.' },
  { title: 'Choose MicMix in your app', body: 'In Discord, FiveM, Teams or any game, select MicMix Virtual Mic as the input.' },
  { title: 'Go LIVE and hit play', body: 'Paste a link or drop a file. Your voice and the music arrive together.' },
];

function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-24 border-t border-line px-5 py-20">
      <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
      <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="border-t border-line pt-4">
            <div className="text-sm tabular-nums text-accent">0{i + 1}</div>
            <div className="mt-2 font-medium">{s.title}</div>
            <p className="mt-1 text-sm leading-relaxed text-mist">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
