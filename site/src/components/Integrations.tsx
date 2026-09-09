import { motion } from 'motion/react';
import { Gamepad2, MoreHorizontal } from 'lucide-react';
import { siDiscord, siObsstudio, siFivem } from 'simple-icons';

function Brand({ path, color, title }: { path: string; color: string; title: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-9" role="img" aria-label={title}>
      <path d={path} fill={`#${color}`} />
    </svg>
  );
}

function TeamsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-9" role="img" aria-label="Microsoft Teams">
      <circle cx="18" cy="7" r="2.6" fill="#7B83EB" />
      <path d="M15.5 10.5h6a1 1 0 0 1 1 1v4.3a3.8 3.8 0 0 1-3.8 3.8h-.4a3.8 3.8 0 0 1-3.8-3.8v-4.3a1 1 0 0 1 1-1z" fill="#7B83EB" />
      <rect x="2" y="6" width="12" height="12" rx="1.6" fill="#5059C9" />
      <path d="M5.4 9.2h5.4v1.5H8.9v5.2H7.3v-5.2H5.4z" fill="#fff" />
    </svg>
  );
}

const ITEMS = [
  { label: 'Discord', icon: <Brand path={siDiscord.path} color={siDiscord.hex} title="Discord" /> },
  { label: 'FiveM', icon: <Brand path={siFivem.path} color="F40552" title="FiveM" /> },
  { label: 'Teams', icon: <TeamsIcon /> },
  { label: 'OBS', icon: <Brand path={siObsstudio.path} color="FFFFFF" title="OBS Studio" /> },
  { label: 'Games', icon: <Gamepad2 className="size-9" /> },
  { label: 'And more', icon: <MoreHorizontal className="size-9 text-mist" /> },
];

export function Integrations() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-12">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 sm:gap-4">
        {ITEMS.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
            whileHover={{ y: -4 }}
            className="panel flex flex-col items-center gap-3 px-3 py-5 text-sm font-medium transition-colors hover:border-azure/40"
          >
            {item.icon}
            {item.label}
          </motion.div>
        ))}
      </div>
      <p className="mt-6 text-center text-mist">
        Anywhere you can choose a microphone, you can choose MicMix.
      </p>
    </section>
  );
}
