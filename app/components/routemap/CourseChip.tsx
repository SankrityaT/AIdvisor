"use client";

import type { Difficulty } from "@/lib/types";
import { breakLabel, LAYOUT, type StopModel } from "./geometry";

const PIP_CLASS: Record<Difficulty, string> = {
  easy: "bg-teal",
  medium: "bg-gold",
  hard: "bg-alert",
};

export interface CourseChipProps {
  stop: StopModel;
  /** Absolute position on the board. */
  left: number;
  top: number;
  /** Staggers the entrance animation for newly added stops. */
  index?: number;
  onSelect?: (code: string) => void;
  onShowTip?: (stop: StopModel, el: HTMLElement) => void;
  onHideTip?: () => void;
}

/**
 * A single stop on the line. Fixed width/height by design — the SVG branch
 * ticks are drawn against the same pixel grid.
 */
export function CourseChip({
  stop,
  left,
  top,
  index = 0,
  onSelect,
  onShowTip,
  onHideTip,
}: CourseChipProps) {
  const isRemoved = stop.kind === "removed";
  const isAdded = stop.kind === "added";
  const isBroken = Boolean(stop.broken);
  const struck = isRemoved || isBroken;

  // Accent bar + code colour carry the state at a distance.
  let shell = "border-ink-700 bg-ink-850 hover:border-gold/50";
  let accent = "bg-gold/70";
  let codeTone = "text-gold-200";

  if (isBroken) {
    shell = "border-alert/55 bg-alert/10 hover:border-alert";
    accent = "bg-alert";
    codeTone = "text-alert";
  }
  if (isAdded) {
    shell = "border-teal/60 bg-teal/10 hover:border-teal";
    accent = "bg-teal";
    codeTone = "text-teal";
  }
  if (isRemoved) {
    shell = "border-ink-700/70 bg-ink-900/60 hover:border-ink-600";
    accent = isBroken ? "bg-alert/70" : "bg-ink-600";
    codeTone = isBroken ? "text-alert/80" : "text-mist/80";
  }

  return (
    <button
      type="button"
      onClick={() => onSelect?.(stop.code)}
      onMouseEnter={(e) => onShowTip?.(stop, e.currentTarget)}
      onFocus={(e) => onShowTip?.(stop, e.currentTarget)}
      onMouseLeave={onHideTip}
      onBlur={onHideTip}
      aria-label={`${stop.code}${stop.title ? `, ${stop.title}` : ""}${
        isRemoved ? ", removed from this semester" : ""
      }${isAdded ? ", newly added" : ""}${
        stop.broken ? `, ${breakLabel(stop.broken.status).toLowerCase()}` : ""
      }`}
      className={[
        "group absolute flex flex-col justify-center gap-1 overflow-hidden rounded-lg border pl-3.5 pr-2.5 text-left",
        "transition-[transform,border-color,background-color] duration-200 outline-none",
        "focus-visible:ring-2 focus-visible:ring-gold/70",
        shell,
        isRemoved ? "opacity-55" : "",
        // `rise` fills to `transform: none`, so it can't share a chip with a
        // hover translate — added chips get the entrance instead of the lift.
        isAdded ? "animate-rise" : "hover:-translate-y-px",
      ].join(" ")}
      style={{
        left,
        top,
        width: LAYOUT.CHIP_W,
        height: LAYOUT.CHIP_H,
        animationDelay: isAdded ? `${90 + index * 70}ms` : undefined,
      }}
    >
      <span className={`absolute inset-y-0 left-0 w-[3px] ${accent}`} aria-hidden />

      <span className="flex items-center gap-1.5">
        <span
          className={`h-[7px] w-[7px] shrink-0 rounded-full ${
            stop.sentiment
              ? PIP_CLASS[stop.sentiment.difficulty]
              : "bg-transparent ring-1 ring-ink-600"
          }`}
          aria-hidden
        />
        <span
          className={[
            "font-mono text-[12.5px] font-semibold tracking-tight",
            codeTone,
            struck ? "line-through decoration-[1.5px]" : "",
          ].join(" ")}
        >
          {stop.code}
        </span>

        <span className="ml-auto flex items-center gap-1.5 pl-1">
          {stop.broken ? (
            <span className="rounded-[4px] bg-alert/20 px-1.5 py-[1px] font-mono text-[8.5px] font-bold tracking-[0.08em] text-alert">
              {breakLabel(stop.broken.status)}
            </span>
          ) : isAdded ? (
            <span className="rounded-[4px] bg-teal/20 px-1.5 py-[1px] font-mono text-[8.5px] font-bold tracking-[0.08em] text-teal">
              NEW
            </span>
          ) : stop.credits !== null ? (
            <span className="font-mono text-[9.5px] text-mist/70">{stop.credits} cr</span>
          ) : null}
        </span>
      </span>

      <span
        className={[
          "block truncate text-[11px] leading-tight",
          isRemoved ? "text-mist/60 line-through" : "text-mist",
        ].join(" ")}
      >
        {stop.title ?? <span className="italic text-mist/50">Unlisted course</span>}
      </span>
    </button>
  );
}

export default CourseChip;
