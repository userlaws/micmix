import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Mail } from 'lucide-react';
import { site } from '../site-config';
import { FAQ } from '../content/faq';


export function Support() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="support" className="mx-auto max-w-7xl scroll-mt-28 px-5 py-20">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan/80">Support</p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Stuck? Start here.</h2>
          <p className="mt-4 text-lg text-mist">
            Most problems come down to one of the answers on the right. If yours is not there, email
            us and include what app you are using and what you hear.
          </p>
          <a
            href={`mailto:${site.supportEmail}`}
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold transition hover:border-azure/50 hover:bg-white/10"
          >
            <Mail className="size-4" />
            {site.supportEmail}
          </a>
        </div>

        <div className="flex flex-col gap-3">
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="panel overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold"
                >
                  {item.q}
                  <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="size-5 text-mist" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                    >
                      <p className="px-5 pb-5 text-sm leading-relaxed text-mist">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
