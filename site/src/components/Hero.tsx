import { motion } from 'motion/react';
import { DownloadButton } from './Header';
import { AppMockup } from './AppMockup';

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

export function Hero() {
  return (
    <section id="home" className="relative mx-auto max-w-7xl px-5 pb-16 pt-32 sm:pt-40 lg:pb-24">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8">
        <motion.div
          initial="hidden"
          animate="show"
          transition={{ staggerChildren: 0.1, delayChildren: 0.15 }}
          className="max-w-xl"
        >
          <motion.p
            variants={fadeUp}
            className="mb-4 text-xs font-semibold uppercase tracking-[0.35em] text-cyan/80"
          >
            Simple. Powerful. Free.
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl"
          >
            Your mic +<br />
            your music.<br />
            <span className="text-gradient">One output.</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-6 text-lg leading-relaxed text-mist">
            Play music through your microphone. Open MicMix, drop a YouTube link or a local file,
            hit play, and your voice chat hears both.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-8">
            <DownloadButton large />
          </motion.div>
          <motion.ul
            variants={fadeUp}
            className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mist"
          >
            <li>Windows 10/11</li>
            <li aria-hidden="true">•</li>
            <li>Free</li>
            <li aria-hidden="true">•</li>
            <li>No complicated setup</li>
          </motion.ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30, rotateX: 6 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
          style={{ perspective: 1200 }}
          className="animate-float will-change-transform"
        >
          <AppMockup />
        </motion.div>
      </div>
    </section>
  );
}
