import { useEffect, useRef, useState } from 'react';
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

const DESIGN_WIDTH = 1040;
const DESIGN_HEIGHT = 500;

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
        className="origin-top-left"
        style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT, transform: `scale(${scale})` }}
      >
        <Window />
      </div>
    </div>
  );
}

function Window() {
  return (
    <div className="flex h-full w-full flex-col rounded-xl border border-line bg-[#0c1224] p-4 text-white shadow-[0_20px_60px_-30px_rgb(0_0_0/0.8)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LogoMark size={30} />
          <Wordmark className="text-xl" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-1.5">
            <span className="size-2.5 rounded-full bg-emerald-400" />
            <div className="leading-tight">
              <div className="text-sm font-semibold">LIVE</div>
              <div className="text-[10px] text-mist">Your mic is on air</div>
            </div>
          </div>
          <div className="flex size-9 items-center justify-center rounded-lg border border-line text-mist">
            <Settings className="size-4" />
          </div>
          <div className="ml-2 flex items-center gap-4 pr-1 text-mist">
            <Minus className="size-4" />
            <Square className="size-3.5" />
            <X className="size-4" />
          </div>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[260px_1fr_280px] gap-3">
        <MixerPanel />
        <MusicPanel />
        <SoundboardPanel />
      </div>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-lg border border-line bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Fader({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex size-8 items-center justify-center rounded-md bg-white/5 text-mist">{icon}</div>
      <div className="flex-1">
        <div className="mb-1.5 text-sm">{label}</div>
        <div className="relative h-1.5 rounded-full bg-white/10">
          <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${value}%` }} />
          <div
            className="absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full border border-line bg-white"
            style={{ left: `calc(${value}% - 7px)` }}
          />
        </div>
      </div>
      <div className="w-10 text-right text-sm tabular-nums text-mist">{value}%</div>
    </div>
  );
}

function MixerPanel() {
  return (
    <Panel title="Mixer">
      <Fader icon={<Mic className="size-4" />} label="Mic" value={82} />
      <Fader icon={<Music2 className="size-4" />} label="Music" value={65} />
      <Fader icon={<LayoutGrid className="size-4" />} label="Pads" value={78} />
      <div className="my-2 flex items-center justify-between rounded-md border border-line px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <AudioLines className="size-4 text-mist" />
          Duck music while talking
        </div>
        <div className="relative h-5 w-9 rounded-full bg-accent">
          <div className="absolute right-0.5 top-0.5 size-4 rounded-full bg-white" />
        </div>
      </div>
      <Fader icon={<AudioLines className="size-4" />} label="Master" value={100} />
    </Panel>
  );
}

function MusicPanel() {
  return (
    <Panel title="Music">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center justify-center gap-2 rounded-md border border-accent/60 bg-accent/10 py-2 text-sm font-medium">
          <span className="flex h-4 w-6 items-center justify-center rounded bg-red-500 text-[8px]">
            <Play className="size-2.5 fill-white" />
          </span>
          YouTube
        </div>
        <div className="flex items-center justify-center gap-2 rounded-md border border-line py-2 text-sm text-mist">
          <FileAudio className="size-4" />
          Local File
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between rounded-md border border-line bg-black/30 px-3 py-2 text-xs text-mist">
        <span className="truncate">https://www.youtube.com/watch?v=...</span>
        <Link2 className="size-3.5 shrink-0" />
      </div>
      <div className="mt-3 flex gap-3">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-md bg-[#1b2440]">
          <div className="absolute inset-x-0 bottom-0 flex h-10 items-end justify-center gap-1 px-3 pb-2">
            {[6, 12, 9, 16, 10, 14, 7, 12].map((h, i) => (
              <span key={i} className="w-1.5 rounded-t bg-white/60" style={{ height: h + 8 }} />
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="truncate text-sm font-medium">Midnight Drive (Lyrics)</div>
          <div className="text-xs text-mist">TrendingTracks</div>
          <div className="mt-3 h-1.5 rounded-full bg-white/10">
            <div className="relative h-full w-[15%] rounded-full bg-accent">
              <div className="absolute -right-1.5 top-1/2 size-3.5 -translate-y-1/2 rounded-full border border-line bg-white" />
            </div>
          </div>
          <div className="mt-1 flex justify-between text-[10px] tabular-nums text-mist">
            <span>0:36</span>
            <span>3:57</span>
          </div>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between px-2 pt-3 text-mist">
        <Shuffle className="size-4" />
        <SkipBack className="size-5" />
        <div className="flex size-11 items-center justify-center rounded-full bg-accent text-white">
          <Play className="size-5 fill-white" />
        </div>
        <SkipForward className="size-5" />
        <Repeat className="size-4" />
      </div>
    </Panel>
  );
}

const PADS = ['Airhorn', 'Laugh', 'Applause', 'Bruh', 'Siren', 'Explosion'];

function SoundboardPanel() {
  return (
    <Panel
      title="Soundboard"
      action={<span className="rounded-md border border-line px-2 py-0.5 text-xs text-mist">Edit</span>}
    >
      <div className="grid grid-cols-3 gap-2">
        {PADS.map((label, i) => (
          <div
            key={label}
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-md border border-line bg-white/[0.03] text-[11px]"
          >
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] tabular-nums text-mist">F{i + 1}</span>
            {label}
          </div>
        ))}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line text-[11px] text-mist"
          >
            <Plus className="size-4" />
            Add
          </div>
        ))}
      </div>
    </Panel>
  );
}
