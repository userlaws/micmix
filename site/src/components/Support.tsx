import { ChevronDown } from 'lucide-react';
import { site } from '../site-config';
import { FAQ } from '../content/faq';

export function Support() {
  return (
    <section id="support" className="mx-auto max-w-6xl scroll-mt-24 border-t border-line px-5 py-20">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Support</h2>
          <p className="mt-3 text-mist">
            Most problems come down to one of these answers. If yours is not here, open an issue on
            GitHub and say which app you are using and what you hear.
          </p>
          <a
            href={site.issuesUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-block text-sm text-white underline underline-offset-4 hover:text-accent"
          >
            Report a problem on GitHub
          </a>
        </div>

        <div className="border-t border-line">
          {FAQ.map((item, i) => (
            <details key={item.q} open={i === 0} className="group border-b border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown className="size-4 shrink-0 text-mist transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-mist">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
