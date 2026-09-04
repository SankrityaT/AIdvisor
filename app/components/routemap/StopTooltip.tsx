"use client";

import type { Difficulty } from "@/lib/types";

export interface StopTipData {
  code: string;
  title: string | null;
  credits: number | null;
  prereqs: string[];
  difficulty: Difficulty | null;
  blurb: string | null;
  why: string | null;
  breakNote: string | null;
  /** Viewport coordinates (position: fixed). */
  x: number;
  y: number;
  placement: "top" | "bottom";
}

const DIFFICULTY_COPY: Record<Difficulty, { label: string; className: string }> = {
  easy: { label: "Light lift", className: "text-teal" },
  medium: { label: "Steady pace", className: "text-gold" },
  hard: { label: "Heavy lift", className: "text-alert" },
};

/**
 * Fixed-position hover card. Self-contained on purpose: it only reads the
 * fields on StopTipData, so richer `relevance` data can be fed in later
 * without touching this file.
 */
export function StopTooltip({ tip }: { tip: StopTipData }) {
  const difficulty = tip.difficulty ? DIFFICULTY_COPY[tip.difficulty] : null;

  return (
    // Outer div owns the positioning transform; the inner div owns the
    // entrance animation. Keyframes end at `transform: none` and would
    // otherwise wipe out the -50%/-100% offset.
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 w-[288px]"
      style={{
        left: tip.x,
        top: tip.y,
        transform: `translate(-50%, ${tip.placement === "top" ? "-100%" : "0"})`,
      }}
    >
      <div className="animate-rise rounded-xl border border-ink-600 bg-ink-900/95 p-3.5 shadow-[0_18px_44px_-12px_rgba(0,0,0,.85)] backdrop-blur-sm">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-[13px] font-semibold tracking-tight text-gold">
            {tip.code}
          </span>
          {tip.credits !== null ? (
            <span className="font-mono text-[10px] text-mist">{tip.credits} cr</span>
          ) : null}
        </div>

        <p className="mt-0.5 text-[12px] leading-snug text-[#f4f1f7]">
          {tip.title ?? (
            <span className="italic text-mist">Not listed in the major map</span>
          )}
        </p>

        {tip.breakNote ? (
          <p className="mt-2 rounded-md border border-alert/40 bg-alert/10 px-2 py-1 font-mono text-[10px] tracking-wide text-alert">
            {tip.breakNote}
          </p>
        ) : null}

        {difficulty ? (
          <p className={`mt-2 font-mono text-[10px] tracking-wide ${difficulty.className}`}>
            {difficulty.label.toUpperCase()}
          </p>
        ) : null}

        {tip.blurb ? (
          <p className="mt-1 text-[12px] leading-relaxed text-mist">{tip.blurb}</p>
        ) : (
          <p className="mt-1 text-[12px] leading-relaxed text-mist/70 italic">
            No student notes for this stop yet.
          </p>
        )}

        {tip.why ? (
          <div className="mt-2.5 border-t border-ink-700 pt-2.5">
            <p className="font-mono text-[9px] tracking-[0.14em] text-gold-600">
              WHY THIS CLASS
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#e9e4ef]">{tip.why}</p>
          </div>
        ) : null}

        {tip.prereqs.length > 0 ? (
          <div className="mt-2.5 border-t border-ink-700 pt-2.5">
            <p className="font-mono text-[9px] tracking-[0.14em] text-mist/70">REQUIRES</p>
            <p className="mt-1 font-mono text-[11px] text-mist">
              {tip.prereqs.join("  ·  ")}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default StopTooltip;
