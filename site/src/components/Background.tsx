export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute -left-40 top-[-10%] h-[520px] w-[520px] rounded-full bg-azure/20 blur-[140px]" />
      <div className="absolute right-[-10%] top-[10%] h-[560px] w-[560px] rounded-full bg-violet/20 blur-[160px]" />
      <div className="absolute bottom-[-20%] left-[20%] h-[520px] w-[720px] rounded-full bg-cyan/10 blur-[160px]" />
      <svg
        className="absolute inset-x-0 bottom-0 h-[60vh] w-full opacity-40"
        viewBox="0 0 1440 600"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="wave" x1="0" x2="1">
            <stop offset="0" stopColor="#22d3ee" stopOpacity="0.5" />
            <stop offset="0.5" stopColor="#3b82f6" stopOpacity="0.5" />
            <stop offset="1" stopColor="#a855f7" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`M-100 ${380 + i * 40} C 300 ${240 + i * 30}, 600 ${520 - i * 20}, 900 ${360 + i * 25} S 1400 ${300 + i * 40}, 1600 ${420 + i * 20}`}
            fill="none"
            stroke="url(#wave)"
            strokeWidth={1.2}
            opacity={0.8 - i * 0.15}
          />
        ))}
      </svg>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_40%,var(--color-ink)_90%)]" />
    </div>
  );
}
