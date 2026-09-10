// Brand mark from the MicMix brand package (public/brand/micmix-mark.svg).
export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src={import.meta.env.BASE_URL + 'brand/micmix-mark.svg'}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`rounded-[22%] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`}>
      <span className="text-white">Mic</span>
      <span className="text-gradient">Mix</span>
    </span>
  );
}

export function WindowsIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M3 5.5 11 4.4v7.1H3zM12 4.2 21 3v8.5h-9zM3 12.5h8v7.1L3 18.5zM12 12.5h9V21l-9-1.2z" />
    </svg>
  );
}
