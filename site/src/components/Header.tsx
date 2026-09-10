import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { LogoMark, Wordmark, WindowsIcon } from './Logo';
import { site } from '../site-config';

const NAV = [
  { id: 'features', label: 'Features', href: '#features' },
  { id: 'how', label: 'How it works', href: '#how' },
  { id: 'support', label: 'Support', href: '#support' },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  const floating = scrolled || open;
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
      <div
        className={`mx-auto flex h-14 items-center justify-between border px-4 transition-[max-width,background-color,border-color,box-shadow,border-radius] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${
          floating
            ? 'max-w-3xl rounded-2xl border-white/10 bg-ink/70 shadow-[0_12px_40px_-16px_rgb(0_0_0/0.8)] backdrop-blur-xl backdrop-saturate-150 sm:rounded-full'
            : 'max-w-6xl rounded-full border-transparent bg-transparent'
        }`}
      >
        <a href="#home" className="flex items-center gap-2.5" aria-label="MicMix home">
          <LogoMark size={28} />
          <Wordmark className="text-lg" />
        </a>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <a key={item.id} href={item.href} className="text-sm text-mist transition-colors hover:text-white">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <DownloadButton />
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="inline-flex size-9 items-center justify-center rounded-full border border-line text-white md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="mx-auto mt-2 max-w-3xl rounded-2xl border border-white/10 bg-ink/75 px-3 py-2 shadow-[0_12px_40px_-16px_rgb(0_0_0/0.8)] backdrop-blur-xl backdrop-saturate-150 md:hidden"
        >
          <ul className="flex flex-col">
            {NAV.map((item) => (
              <li key={item.id}>
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-3 text-base text-white hover:bg-white/5"
                >
                  {item.label}
                </a>
              </li>
            ))}
            <li className="p-2 pt-3">
              <DownloadButton className="w-full" onClick={() => setOpen(false)} />
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}

export function DownloadButton({
  className = '',
  large = false,
  onClick,
}: {
  className?: string;
  large?: boolean;
  onClick?: () => void;
}) {
  return (
    <a
      href={site.downloadUrl}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-md bg-accent font-medium text-white transition-colors hover:bg-accent-hover ${
        large ? 'px-5 py-3 text-base' : 'px-4 py-2 text-sm'
      } ${className}`}
    >
      <WindowsIcon className={large ? 'size-5' : 'size-4'} />
      Download for Windows
    </a>
  );
}
