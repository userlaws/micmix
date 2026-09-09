import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Mic,
  Music2,
  LayoutGrid,
  AudioLines,
  Settings,
  Link2,
  FileAudio,
  Play,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Plus,
  Minus,
  Square,
  X,
} from 'lucide-react';
import { LogoMark, Wordmark } from './Logo';

const DESIGN_WIDTH = 860;
const DESIGN_HEIGHT = 540;

/** Renders the fixed-size mockup and scales it to the width of its parent. */
export function AppMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / DESIGN_WIDTH));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full overflow-hidden" style={{ height: DESIGN_HEIGHT * scale }}>
      <div
        className="origin-top-left will-change-transform [backface-visibility:hidden]"
        style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT, transform: `scale(${scale})` }}
      >
        <Window />
      </div>
    </div>
  );
}

function Window() {
  return (
    <div className="relative h-full w-full rounded-[22px] bg-gradient-to-b from-[#0d1326] to-[#090d1b] p-[1px] shadow-[0_40px_120px_-30px_rgb(59_130_246/0.45)]">
      <div className="absolute inset-0 rounded-[22px] bg-gradient-to-r from-cyan/40 via-azure/40 to-violet/40 opacity-70" />
      <div className="relative flex h-full w-full flex-col rounded-[21px] bg-[#0a0f1f] p-4 text-white ring-1 ring-white/10">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark size={40} />
            <Wordmark className="text-2xl" />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="relative flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-3 rounded-full bg-emerald-400" />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-bold">LIVE</div>
                <div className="text-[10px] text-mist">Your mic is on air</div>
              </div>
            </div>
            <div className="flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <Settings className="size-5" />
            </div>
            <div className="ml-2 flex items-center gap-4 pr-1 text-mist">
              <Minus className="size-4" />
              <Square className="size-3.5" />
              <X className="size-4" />
            </div>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-[230px_1fr_250px] gap-3">
          <MixerPanel />
          <MusicPanel />
          <SoundboardPanel />
        </div>
      </div>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="panel flex flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-base font-semibold">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Fader({ icon, label, value, delay = 0 }: { icon: React.ReactNode; label: string; value: number; delay?: number }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex size-8 items-center justify-center rounded-lg bg-azure/15 text-cyan">{icon}</div>
      <div className="flex-1">
        <div className="mb-1.5 text-sm font-medium">{label}</div>
        <div className="relative h-1.5 rounded-full bg-white/10">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan to-azure"
            initial={{ width: 0 }}
            animate={{ width: `${value}%` }}
            transition={{ duration: 0.8, delay, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgb(59_130_246/0.9)]"
            initial={{ left: 0 }}
            animate={{ left: `calc(${value}% - 7px)` }}
            transition={{ duration: 0.8, delay, ease: 'easeOut' }}
          />
        </div>
      </div>
      <div className="w-10 text-right text-sm font-semibold tabular-nums">{value}%</div>
    </div>
  );
}

function MixerPanel() {
  return (
    <Panel title="Mixer">
      <Fader icon={<Mic className="size-4" />} label="Mic" value={82} delay={0.1} />
      <Fader icon={<Music2 className="size-4" />} label="Music" value={65} delay={0.2} />
      <Fader icon={<LayoutGrid className="size-4" />} label="Pads" value={78} delay={0.3} />
      <div className="my-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <AudioLines className="size-4 text-cyan" />
          Duck music while talking
        </div>
        <div className="relative h-5 w-9 rounded-full bg-azure">
          <div className="absolute right-0.5 top-0.5 size-4 rounded-full bg-white" />
        </div>
      </div>
      <Fader icon={<AudioLines className="size-4" />} label="Master" value={100} delay={0.4} />
    </Panel>
  );
}

function MusicPanel() {
  return (
    <Panel title="Music">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center justify-center gap-2 rounded-xl border border-azure/50 bg-azure/15 py-2 text-sm font-medium">
          <span className="flex h-4 w-6 items-center justify-center rounded bg-red-500 text-[8px]">
            <Play className="size-2.5 fill-white" />
          </span>
          YouTube
        </div>
        <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2 text-sm font-medium text-mist">
          <FileAudio className="size-4" />
          Local File
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-mist">
        <span className="truncate">https://www.youtube.com/watch?v=...</span>
        <Link2 className="size-3.5 shrink-0" />
      </div>
      <div className="mt-3 flex gap-3">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-violet via-azure to-pink">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(255_255_255/0.35),transparent_45%)]" />
          <div className="absolute inset-x-0 bottom-0 flex h-10 items-end justify-center gap-1 px-3 pb-2">
            {[6, 12, 9, 16, 10, 14, 7, 12].map((h, i) => (
              <motion.span
                key={i}
                className="w-1.5 origin-bottom rounded-t bg-white/80"
                style={{ height: h + 8 }}
                animate={{ scaleY: [h / (h + 8), 1, h / (h + 8)] }}
                transition={{ repeat: Infinity, duration: 0.9 + i * 0.07, ease: 'easeInOut' }}
              />
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="truncate text-sm font-semibold">Midnight Drive (Lyrics)</div>
          <div className="text-xs text-mist">TrendingTracks</div>
          <div className="mt-3 h-1.5 rounded-full bg-white/10">
            <div className="relative h-full w-[15%] rounded-full bg-gradient-to-r from-cyan to-azure">
              <div className="absolute -right-1.5 top-1/2 size-3.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgb(59_130_246/0.9)]" />
            </div>
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-mist tabular-nums">
            <span>0:36</span>
            <span>3:57</span>
          </div>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between px-2 pt-3 text-mist">
        <Shuffle className="size-4" />
        <SkipBack className="size-5" />
        <div className="flex size-12 items-center justify-center rounded-full bg-azure/20 ring-2 ring-azure shadow-[0_0_24px_rgb(59_130_246/0.6)]">
          <Play className="size-5 fill-white text-white" />
        </div>
        <SkipForward className="size-5" />
        <Repeat className="size-4" />
      </div>
    </Panel>
  );
}

const PADS = [
  { label: 'Airhorn', emoji: '📣' },
  { label: 'Laugh', emoji: '😆' },
  { label: 'Applause', emoji: '👏' },
  { label: 'Bruh', emoji: '💀' },
  { label: 'Siren', emoji: '🚨' },
  { label: 'Explosion', emoji: '💥' },
];

function SoundboardPanel() {
  return (
    <Panel
      title="Soundboard"
      action={<span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs">Edit</span>}
    >
      <div className="grid grid-cols-3 gap-2">
        {PADS.map((pad, i) => (
          <motion.div
            key={pad.label}
            whileHover={{ scale: 1.05 }}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 text-[11px] font-medium"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05 }}
          >
            <span className="text-2xl leading-none">{pad.emoji}</span>
            {pad.label}
          </motion.div>
        ))}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/15 text-[11px] text-mist"
          >
            <Plus className="size-5" />
            Add
          </div>
        ))}
      </div>
    </Panel>
  );
}
