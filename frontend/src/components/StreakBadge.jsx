import { Flame } from 'lucide-react';

export default function StreakBadge({ current = 0, best = 0, compact = false }) {
  if (compact) {
    return (
      <div
        data-testid="streak-badge-compact"
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 border text-xs font-sans font-semibold tracking-wide transition ${
          current > 0
            ? 'border-gold/60 bg-gold/15 text-gold'
            : 'border-foreground/20 text-foreground/50'
        }`}
      >
        <Flame
          size={14}
          strokeWidth={1.6}
          className={current > 0 ? 'animate-pulse' : ''}
          fill={current > 0 ? 'currentColor' : 'none'}
        />
        <span>{current}</span>
      </div>
    );
  }

  return (
    <div
      data-testid="streak-badge"
      className="rounded-2xl border border-gold/25 bg-gradient-to-br from-navy-light/60 via-navy/40 to-navy-dark p-5 flex items-center gap-4 overflow-hidden relative"
    >
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-gold/10 blur-2xl pointer-events-none" />
      <div
        className={`relative w-16 h-16 shrink-0 rounded-full border-2 flex items-center justify-center ${
          current > 0 ? 'border-gold animate-glow' : 'border-foreground/20'
        }`}
      >
        <Flame
          size={28}
          strokeWidth={1.4}
          className={current > 0 ? 'text-gold' : 'text-foreground/40'}
          fill={current > 0 ? 'currentColor' : 'none'}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.2em] text-gold/70 font-sans font-semibold">
          Sua ofensiva
        </p>
        <p className="font-serif text-3xl text-foreground leading-none mt-1">
          <span data-testid="streak-current">{current}</span>{' '}
          <span className="text-base text-foreground/60 font-sans">{current === 1 ? 'dia' : 'dias'}</span>
        </p>
        {best > 0 && (
          <p className="text-[11px] text-foreground/55 font-sans mt-1.5">
            Recorde: <span data-testid="streak-best" className="text-gold/85">{best}</span> dia{best === 1 ? '' : 's'}
          </p>
        )}
      </div>
    </div>
  );
}
