import { Gamepad2 } from 'lucide-react';
import { siDiscord, siObsstudio, siFivem } from 'simple-icons';

function Brand({ path, title }: { path: string; title: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" role="img" aria-label={title}>
      <path d={path} fill="currentColor" />
    </svg>
  );
}

function TeamsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" role="img" aria-label="Microsoft Teams" fill="currentColor">
      <circle cx="18" cy="7" r="2.6" />
      <path d="M15.5 10.5h6a1 1 0 0 1 1 1v4.3a3.8 3.8 0 0 1-3.8 3.8h-.4a3.8 3.8 0 0 1-3.8-3.8v-4.3a1 1 0 0 1 1-1z" />
      <rect x="2" y="6" width="12" height="12" rx="1.6" />
      <path d="M5.4 9.2h5.4v1.5H8.9v5.2H7.3v-5.2H5.4z" fill="#0a1020" />
    </svg>
  );
}

const ITEMS = [
  { label: 'Discord', icon: <Brand path={siDiscord.path} title="Discord" /> },
  { label: 'FiveM', icon: <Brand path={siFivem.path} title="FiveM" /> },
  { label: 'Teams', icon: <TeamsIcon /> },
  { label: 'OBS', icon: <Brand path={siObsstudio.path} title="OBS Studio" /> },
  { label: 'Any game', icon: <Gamepad2 className="size-6" /> },
];

export function Integrations() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <p className="text-sm text-mist">Works anywhere you can choose a microphone</p>
      <ul className="mt-5 flex flex-wrap items-center gap-x-10 gap-y-4 text-mist">
        {ITEMS.map((item) => (
          <li key={item.label} className="flex items-center gap-2.5 text-sm font-medium">
            {item.icon}
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
