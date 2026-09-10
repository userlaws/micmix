import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { DownloadButton } from './Header';
import { SignalFlow } from './SignalFlow';
import { site } from '../site-config';

const APPS = ['Discord', 'FiveM', 'Teams', 'any game'];

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

function RotatingApp() {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setI((v) => (v + 1) % APPS.length), 2200);
    return () => clearInterval(t);
  }, [reduced]);
  return (
    <span className="relative inline-grid overflow-hidden align-bottom">
      {/* Reserve the widest word so the line never reflows. */}
      <span className="invisible col-start-1 row-start-1">any game</span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={APPS[i]}
          className="col-start-1 row-start-1 text-gradient"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {APPS[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function ProductShot() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  // Starts tilted back and flattens as it scrolls into view.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start 35%'] });
  const rotateX = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [14, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], reduced ? [1, 1] : [0.94, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [0.6, 1]);
  return (
    <div ref={ref} style={{ perspective: 1400 }}>
      <motion.figure style={{ rotateX, scale, opacity, transformOrigin: 'center top' }} className="will-change-transform">
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
      </motion.figure>
    </div>
  );
}

export function Hero() {
  const reduced = useReducedMotion();
  return (
    <section id="home" className="relative overflow-hidden">
      {/* The app's own backdrop: the same three soft radial washes MicMix paints behind its cards, drifting slowly. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        animate={reduced ? undefined : { backgroundPosition: ['0% 0%', '4% 6%', '0% 0%'] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          backgroundSize: '110% 110%',
          backgroundImage:
            'radial-gradient(900px 520px at 8% 100%, rgb(0 229 255 / 0.10), transparent 60%), ' +
            'radial-gradient(800px 480px at 92% 85%, rgb(255 43 214 / 0.10), transparent 60%), ' +
            'radial-gradient(700px 420px at 55% 20%, rgb(168 85 255 / 0.08), transparent 60%)',
        }}
      />

      <div className="mx-auto max-w-6xl px-5 pt-32 sm:pt-40">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)] lg:gap-8">
          <motion.div initial="hidden" animate="show" transition={{ staggerChildren: 0.09, delayChildren: 0.1 }} className="max-w-2xl">
            <motion.span variants={item} className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-mist">
              <span className="relative flex size-1.5">
                {!reduced && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
              </span>
              Version {site.version} · Free for Windows
            </motion.span>
            <motion.h1 variants={item} className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Play music through
              <br />
              your mic in <RotatingApp />
            </motion.h1>
            <motion.p variants={item} className="mt-6 max-w-xl text-lg leading-relaxed text-mist">
              MicMix mixes your microphone with YouTube, local files and a soundboard into one virtual
              mic. Pick it wherever you pick a microphone and everyone hears both.
            </motion.p>
            <motion.div variants={item} className="mt-8 flex flex-wrap items-center gap-3">
              <DownloadButton large />
              <a
                href="#how"
                className="group inline-flex items-center gap-2 rounded-md border border-line px-5 py-3 text-base font-medium text-white transition-colors hover:border-white/25 hover:bg-white/5"
              >
                See how it works
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </motion.div>
            <motion.p variants={item} className="mt-4 text-sm text-mist">
              No account, no subscription, nothing uploaded.
            </motion.p>
          </motion.div>

          <div className="hidden lg:block">
            <SignalFlow />
          </div>
        </div>

        <div className="mt-14 sm:mt-20">
          <ProductShot />
        </div>
      </div>
    </section>
  );
}
