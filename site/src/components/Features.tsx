import { motion } from 'motion/react';
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
    <section id="features" className="mx-auto max-w-7xl scroll-mt-28 px-5 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan/80">Features</p>
        <h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
          Everything a stream deck does, <span className="text-gradient">minus the deck.</span>
        </h2>
        <p className="mt-4 text-lg text-mist">
          MicMix shows up in Windows as a microphone called MicMix Virtual Mic. Pick it wherever you
          pick a mic and you are done.
        </p>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f, i) => (
          <motion.article
            key={f.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ delay: (i % 4) * 0.07, duration: 0.45 }}
            className="panel group relative overflow-hidden p-6 transition-colors hover:border-azure/40"
          >
            <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-azure/10 blur-2xl transition-opacity group-hover:opacity-100 sm:opacity-0" />
            <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan/25 to-violet/25 text-cyan ring-1 ring-white/10">
              <f.icon className="size-5" />
            </div>
            <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-mist">{f.body}</p>
          </motion.article>
        ))}
      </div>

      <HowItWorks />
    </section>
  );
}

const STEPS = [
  { n: '1', title: 'Install MicMix', body: 'Run the installer once. It sets up the virtual mic driver for you.' },
  { n: '2', title: 'Pick your real mic', body: 'The setup wizard finds your microphone and plays a test tone.' },
  { n: '3', title: 'Choose MicMix in your app', body: 'In Discord, FiveM, Teams or any game, select MicMix Virtual Mic as the input.' },
  { n: '4', title: 'Go LIVE and hit play', body: 'Paste a link or drop a file. Your voice and the music arrive together.' },
];

function HowItWorks() {
  return (
    <div className="mt-24">
      <div className="mx-auto max-w-2xl text-center">
        <h3 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Up and running in four steps</h3>
      </div>
      <ol className="relative mt-12 grid gap-6 md:grid-cols-4">
        <div className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-azure/50 to-transparent md:block" />
        {STEPS.map((s, i) => (
          <motion.li
            key={s.n}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ delay: i * 0.1, duration: 0.45 }}
            className="relative flex gap-4 md:flex-col md:items-center md:text-center"
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink-2 text-lg font-bold text-white ring-2 ring-azure shadow-[0_0_24px_rgb(59_130_246/0.5)]">
              {s.n}
            </div>
            <div>
              <div className="font-semibold">{s.title}</div>
              <p className="mt-1 text-sm text-mist">{s.body}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
