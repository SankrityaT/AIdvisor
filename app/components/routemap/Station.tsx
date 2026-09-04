"use client";

import type { SemesterStatus } from "@/lib/types";
import { LAYOUT, type StationModel } from "./geometry";

const STATUS_COPY: Record<SemesterStatus, string> = {
  done: "COMPLETE",
  current: "IN PROGRESS",
  future: "PLANNED",
};

export interface StationProps {
  station: StationModel;
  /** Highlights the whole station when its semester changed in a reroute. */
  rerouted?: boolean;
}

/**
 * The label block that sits above the line for one semester station.
 * Positioned absolutely against the same pixel grid as the SVG node.
 */
export function Station({ station, rerouted }: StationProps) {
  const changed = rerouted ?? station.changed;
  const accent = changed ? "text-teal" : station.status === "future" ? "text-mist" : "text-gold";

  return (
    <div
      className="absolute select-none"
      style={{
        left: station.x - 4,
        top: LAYOUT.LINE_Y - 74,
        width: LAYOUT.CHIP_W + LAYOUT.CHIP_OFFSET_X,
      }}
    >
      <div className="flex items-center gap-1.5">
        <span className={`font-mono text-[9px] font-bold tracking-[0.16em] ${accent}`}>
          {String(station.semester).padStart(2, "0")}
        </span>
        <span className="h-px flex-1 bg-ink-700" aria-hidden />
        {station.hasBreak ? (
          <span className="rounded-[3px] bg-alert/20 px-1 py-[1px] font-mono text-[8px] font-bold tracking-[0.1em] text-alert">
            BREAK
          </span>
        ) : changed ? (
          <span className="rounded-[3px] bg-teal/20 px-1 py-[1px] font-mono text-[8px] font-bold tracking-[0.1em] text-teal">
            REROUTED
          </span>
        ) : null}
      </div>

      <p
        className={`mt-1.5 text-[15px] font-semibold leading-none tracking-tight ${
          station.status === "future" ? "text-[#d9d3e2]" : "text-[#f4f1f7]"
        }`}
      >
        {station.term ?? `Semester ${station.semester}`}
      </p>

      <p className="mt-1.5 font-mono text-[9.5px] tracking-[0.1em] text-mist/70">
        {STATUS_COPY[station.status] ?? "PLANNED"}
        {station.credits > 0 ? ` · ${station.credits} CR` : ""}
      </p>
    </div>
  );
}

export default Station;
