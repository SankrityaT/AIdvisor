"use client";

export interface OptionCardProps {
  /** 1-based position — doubles as the keyboard shortcut shown on the card. */
  index: number;
  label: string;
  hint?: string;
  /** Small pill on the right, e.g. "coming soon". */
  note?: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export function OptionCard({
  index,
  label,
  hint,
  note,
  selected = false,
  disabled = false,
  onSelect,
}: OptionCardProps) {
  const shell = disabled
    ? "cursor-not-allowed border-ink-800 bg-ink-900/40 opacity-55"
    : selected
      ? "border-gold bg-gold/10 shadow-[0_0_28px_-8px_rgba(255,198,39,0.75)]"
      : "border-ink-700 bg-ink-850/70 hover:border-maroon-300 hover:bg-ink-800";

  const badge = disabled
    ? "border-ink-800 bg-ink-900 text-mist/50"
    : selected
      ? "border-gold/60 bg-gold/15 text-gold"
      : "border-ink-700 bg-ink-900 text-mist";

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onSelect}
      className={`group flex w-full items-start gap-3.5 rounded-xl border px-4 py-3.5 text-left transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 ${shell}`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border font-mono text-[11px] transition-colors ${badge}`}
      >
        {index}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium leading-snug text-white/95 sm:text-base">
          {label}
        </span>
        {hint ? (
          <span className="mt-0.5 block text-[13px] leading-snug text-mist">
            {hint}
          </span>
        ) : null}
      </span>

      {note ? (
        <span className="mt-0.5 shrink-0 rounded-full border border-ink-700 px-2 py-0.5 text-[10px] uppercase tracking-wider text-mist/70">
          {note}
        </span>
      ) : null}

      {selected && !disabled ? (
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-gold"
        >
          <path
            d="M4.5 10.5l3.6 3.6L15.5 6.7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </button>
  );
}

export default OptionCard;
