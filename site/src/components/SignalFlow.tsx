import { motion, useReducedMotion } from 'motion/react';
import { Mic, Music2, LayoutGrid, Gamepad2 } from 'lucide-react';
import { siDiscord, siFivem } from 'simple-icons';
import { LogoMark } from './Logo';

/*
 * Animated routing diagram: three sources on the left feed the MicMix node, which feeds the apps on
 * the right. Lines and travelling dots are SVG (native <animateMotion>, so they keep running without
 * JavaScript); the chips are HTML positioned over the same coordinate space so icons stay crisp.
 */
const W = 520;
const H = 360;
const CX = 260;
const CY = 180;
const LEFT_X = 92;
const RIGHT_X = 428;
const ROWS = [64, 180, 296];

const curve = (x1: number, y1: number, x2: number, y2: number) => {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
};

const SOURCES = [
  { label: 'Your mic', icon: <Mic className="size-4" />, color: '#00e5ff' },
  { label: 'YouTube & files', icon: <Music2 className="size-4" />, color: '#a855ff' },
  { label: 'Soundboard', icon: <LayoutGrid className="size-4" />, color: '#f59e0b' },
];

const TARGETS = [
  { label: 'Discord', icon: <BrandIcon path={siDiscord.path} /> },
  { label: 'FiveM', icon: <BrandIcon path={siFivem.path} /> },
  { label: 'Any game', icon: <Gamepad2 className="size-4" /> },
];

function BrandIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

function Chip({ x, y, icon, label, delay }: { x: number; y: number; icon: React.ReactNode; label: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-white/12 bg-[#0e1730] px-3.5 py-2 text-[13px] font-medium text-white shadow-[0_8px_24px_-12px_rgb(0_0_0/0.8)]"
      style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}
    >
      <span className="text-mist">{icon}</span>
      {label}
    </motion.div>
  );
}

export function SignalFlow() {
  const reduced = useReducedMotion();
  const inbound = ROWS.map((y) => curve(LEFT_X + 60, y, CX - 44, CY));
  const outbound = ROWS.map((y) => curve(CX + 44, CY, RIGHT_X - 56, y));

  return (
    <div className="relative mx-auto w-full max-w-[520px]" style={{ aspectRatio: `${W} / ${H}` }} aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id="flow-out" x1="0" x2="1">
            <stop offset="0" stopColor="#1478ff" />
            <stop offset="1" stopColor="#2dd4bf" />
          </linearGradient>
        </defs>
        {[...inbound, ...outbound].map((d, i) => (
          <path key={i} d={d} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth={1.5} />
        ))}
        {!reduced &&
          inbound.map((d, i) => (
            <circle key={'in' + i} r={3.5} fill={SOURCES[i].color} opacity={0}>
              <animateMotion dur="2.4s" begin={`${i * 0.5}s`} repeatCount="indefinite" path={d} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.4s" begin={`${i * 0.5}s`} repeatCount="indefinite" />
            </circle>
          ))}
        {!reduced &&
          outbound.map((d, i) => (
            <circle key={'out' + i} r={3.5} fill="url(#flow-out)" opacity={0}>
              <animateMotion dur="2.4s" begin={`${1.2 + i * 0.5}s`} repeatCount="indefinite" path={d} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.4s" begin={`${1.2 + i * 0.5}s`} repeatCount="indefinite" />
            </circle>
          ))}
      </svg>

      {SOURCES.map((s, i) => (
        <Chip key={s.label} x={LEFT_X} y={ROWS[i]} icon={s.icon} label={s.label} delay={0.3 + i * 0.08} />
      ))}
      {TARGETS.map((t, i) => (
        <Chip key={t.label} x={RIGHT_X} y={ROWS[i]} icon={t.icon} label={t.label} delay={0.7 + i * 0.08} />
      ))}

      {/* Centre node: the MicMix mark with two slow rings so the hub reads as "live". */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${(CX / W) * 100}%`, top: `${(CY / H) * 100}%` }}
      >
        {!reduced &&
          [0, 1].map((i) => (
            <motion.span
              key={i}
              className="absolute inset-0 rounded-[26%] border border-accent/50"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 1.9, opacity: 0 }}
              transition={{ duration: 2.6, delay: i * 1.3, repeat: Infinity, ease: 'easeOut' }}
            />
          ))}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5, ease: 'easeOut' }}
          className="relative rounded-[26%] shadow-[0_10px_40px_-10px_rgb(20_120_255/0.6)]"
        >
          <LogoMark size={88} />
        </motion.div>
      </div>
    </div>
  );
}
