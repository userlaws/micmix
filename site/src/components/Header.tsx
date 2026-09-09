import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useScroll, useMotionValueEvent } from 'motion/react';
import { Menu, X, ArrowRight } from 'lucide-react';
import { LogoMark, Wordmark, WindowsIcon } from './Logo';
import { site } from '../site-config';

const NAV = [
  { id: 'home', label: 'Home', href: '#home' },
  { id: 'features', label: 'Features', href: '#features' },
  { id: 'support', label: 'Support', href: '#support' },
];

function useActiveSection() {
  const [active, setActive] = useState('home');
  useEffect(() => {
    const sections = NAV.map((n) => document.getElementById(n.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: [0, 0.2, 0.5] },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);
  return active;
}

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const active = useActiveSection();
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24));

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Close the drawer if the viewport grows past the mobile breakpoint.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5"
    >
      <div
        className={`mx-auto flex max-w-7xl items-center justify-between rounded-2xl px-3 py-2 transition-all duration-300 sm:px-4 ${
          scrolled || open
            ? 'glass shadow-[0_10px_40px_-15px_rgb(59_130_246/0.35)]'
            : 'border border-transparent'
        }`}
      >
        <a href="#home" className="group flex items-center gap-3" aria-label="MicMix home">
          <motion.div
            whileHover={{ rotate: -6, scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          >
            <LogoMark size={40} className="drop-shadow-[0_0_14px_rgb(59_130_246/0.5)]" />
          </motion.div>
          <Wordmark className="text-2xl" />
        </a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => {
            const isActive = active === item.id;
            return (
              <a
                key={item.id}
                href={item.href}
                className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'text-white' : 'text-mist hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-white/8 ring-1 ring-white/10"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative">{item.label}</span>
                {isActive && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full bg-brand"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block"><DownloadButton compact={scrolled} /></div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="inline-flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 md:hidden"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={open ? 'x' : 'menu'}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex"
              >
                {open ? <X className="size-5" /> : <Menu className="size-5" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 -z-10 bg-ink/70 backdrop-blur-sm md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.nav
              id="mobile-nav"
              aria-label="Mobile"
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="glass mx-auto mt-2 max-w-7xl rounded-2xl p-2 md:hidden"
            >
              <ul className="flex flex-col">
                {NAV.map((item, i) => (
                  <motion.li
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.05 }}
                  >
                    <a
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center justify-between rounded-xl px-4 py-3 text-base font-medium transition ${
                        active === item.id
                          ? 'bg-white/8 text-white'
                          : 'text-mist hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {item.label}
                      <ArrowRight className="size-4 opacity-50" />
                    </a>
                  </motion.li>
                ))}
                <motion.li
                  className="p-2 pt-3"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22 }}
                >
                  <DownloadButton className="w-full" onClick={() => setOpen(false)} />
                </motion.li>
              </ul>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

export function DownloadButton({
  className = '',
  compact = false,
  large = false,
  onClick,
}: {
  className?: string;
  compact?: boolean;
  large?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.a
      href={site.downloadUrl}
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={`group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-full bg-brand font-semibold text-white shadow-[0_8px_30px_-8px_rgb(168_85_247/0.7)] ring-1 ring-white/15 transition-[padding] duration-300 ${
        large ? 'px-8 py-4 text-lg' : compact ? 'px-4 py-2 text-sm' : 'px-5 py-2.5 text-sm'
      } ${className}`}
    >
      <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/25 opacity-0 blur-md group-hover:animate-shimmer group-hover:opacity-100" />
      <WindowsIcon className={large ? 'size-6' : 'size-4'} />
      <span className="relative">Download for Windows</span>
      {large && <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />}
    </motion.a>
  );
}
