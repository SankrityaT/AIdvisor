"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BrokenCourse,
  CourseRelevance,
  CourseSentiment,
  FlowchartOutput,
  MajorMap,
  PlanSemester,
} from "@/lib/types";

import { CourseChip } from "./CourseChip";
import { Legend } from "./Legend";
import { RouteLine, StationNode } from "./RouteLine";
import { Station } from "./Station";
import { StopTooltip, type StopTipData } from "./StopTooltip";
import { Terminus } from "./Terminus";
import { breakLabel, buildBoard, LAYOUT, normCode, type StopModel } from "./geometry";

export interface RouteMapProps {
  flowchart: FlowchartOutput;
  majorMap: MajorMap;
  sentiment?: CourseSentiment[];
  previousPlan?: PlanSemester[];
  broken?: BrokenCourse[];
  rerouted?: boolean;
  relevance?: CourseRelevance[];
  onSelectCourse?: (code: string) => void;
}

export default function RouteMap({
  flowchart,
  majorMap,
  sentiment,
  previousPlan,
  broken,
  rerouted,
  relevance,
  onSelectCourse,
}: RouteMapProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [tip, setTip] = useState<StopTipData | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const plan = useMemo(() => flowchart?.plan ?? [], [flowchart]);

  const board = useMemo(
    () => buildBoard({ plan, majorMap, sentiment, previousPlan, broken, relevance }),
    [plan, majorMap, sentiment, previousPlan, broken, relevance],
  );

  const brokenCount = broken?.length ?? 0;
  const isRerouted = Boolean(rerouted) || board.changedCount > 0;

  // ── scroll affordances ──────────────────────────────────────────────
  const syncEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 8,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 8,
    });
  }, []);

  useEffect(() => {
    syncEdges();
    window.addEventListener("resize", syncEdges);
    return () => window.removeEventListener("resize", syncEdges);
  }, [syncEdges, board.width]);

  const nudge = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * LAYOUT.PITCH * 2, behavior: "smooth" });
  };

  // Bring the interesting part of the line into view: the first rerouted or
  // broken semester, otherwise the current one.
  const focusX = useMemo(() => {
    const target =
      board.stations.find((s) => s.changed || s.hasBreak) ??
      board.stations.find((s) => s.status === "current");
    return target?.x ?? null;
  }, [board.stations]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || focusX === null) return;
    const left = Math.max(0, focusX - el.clientWidth / 2 + LAYOUT.CHIP_W / 2);
    el.scrollTo({ left, behavior: "smooth" });
    const id = window.setTimeout(syncEdges, 420);
    return () => window.clearTimeout(id);
  }, [focusX, isRerouted, syncEdges]);

  // ── tooltip ─────────────────────────────────────────────────────────
  const showTip = useCallback((stop: StopModel, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const above = rect.top > 300;
    const half = 150;
    const x = Math.min(
      Math.max(rect.left + rect.width / 2, half + 8),
      Math.max(half + 8, window.innerWidth - half - 8),
    );
    setTip({
      code: stop.code,
      title: stop.title,
      credits: stop.credits,
      prereqs: stop.prereqs,
      difficulty: stop.sentiment?.difficulty ?? null,
      blurb: stop.sentiment?.blurb ?? null,
      why: stop.relevance,
      breakNote: stop.broken
        ? `${breakLabel(stop.broken.status)} — this section fell through`
        : stop.kind === "removed"
          ? "Dropped from this semester by the reroute"
          : stop.kind === "added"
            ? "Placed here by the reroute"
            : null,
      x,
      y: above ? rect.top - 10 : rect.bottom + 10,
      placement: above ? "top" : "bottom",
    });
  }, []);

  const hideTip = useCallback(() => setTip(null), []);

  // A content signature, not object identity: the lead may pass inline array
  // literals, which would otherwise rebuild `board` on every render and kill
  // the tooltip the instant it opens.
  const dataKey = useMemo(
    () =>
      board.stations
        .map((s) => `${s.semester}:${s.stops.map((t) => t.code + t.kind).join(",")}`)
        .join("|"),
    [board],
  );

  // Never let a tooltip survive a real data swap (e.g. mid-reroute).
  // Reset during render on key change — React's recommended alternative to
  // calling setState inside an effect, which cascades an extra render.
  const [lastDataKey, setLastDataKey] = useState(dataKey);
  if (lastDataKey !== dataKey) {
    setLastDataKey(dataKey);
    setTip(null);
  }

  const majorLabel = majorMap?.major ?? "Degree plan";
  const semesterCount = board.stations.length;

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-ink-700 bg-ink-950"
      aria-label="Degree route map"
    >
      {/* ── header ─────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-ink-800 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-block h-[3px] w-6 rounded-full bg-maroon" aria-hidden />
            <p className="font-mono text-[9.5px] font-bold tracking-[0.22em] text-mist">
              ROUTE MAP
            </p>
          </div>
          <h2 className="mt-1.5 truncate text-lg font-semibold tracking-tight text-[#f4f1f7]">
            {majorLabel}
          </h2>
          <p className="mt-0.5 font-mono text-[10px] tracking-[0.08em] text-mist/75">
            {semesterCount} {semesterCount === 1 ? "STATION" : "STATIONS"}
            {board.totalCredits > 0 ? ` · ${board.totalCredits} CREDITS` : ""}
            {brokenCount > 0 ? ` · ${brokenCount} DISRUPTED` : ""}
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Legend rerouted={isRerouted} hasBreak={brokenCount > 0} />
          {semesterCount > 0 ? (
            <div className="flex items-center gap-1.5">
              <ScrollButton
                direction="left"
                disabled={!edges.left}
                onClick={() => nudge(-1)}
              />
              <ScrollButton
                direction="right"
                disabled={!edges.right}
                onClick={() => nudge(1)}
              />
            </div>
          ) : null}
        </div>
      </header>

      {/* ── the line ───────────────────────────────────────────────── */}
      {semesterCount === 0 ? (
        <EmptyRoute graduationTarget={flowchart?.graduation_target} />
      ) : (
        <div className="relative">
          <div
            ref={scrollerRef}
            onScroll={syncEdges}
            className="overflow-x-auto overflow-y-hidden overscroll-x-contain"
          >
            <div
              className="relative"
              style={{ width: board.width, height: board.height }}
            >
              <RouteLine
                stations={board.stations}
                terminusX={board.terminusX}
                width={board.width}
                height={board.height}
              />

              {board.stations.map((station) => (
                <div key={`station-${station.semester}`}>
                  <Station station={station} />
                  {station.stops.map((stop, i) => (
                    <CourseChip
                      key={`${station.semester}-${normCode(stop.code)}-${stop.row}`}
                      stop={stop}
                      left={station.x + LAYOUT.CHIP_OFFSET_X}
                      top={stop.y}
                      index={i}
                      onSelect={onSelectCourse}
                      onShowTip={showTip}
                      onHideTip={hideTip}
                    />
                  ))}
                </div>
              ))}

              <Terminus
                x={board.terminusX}
                graduationTarget={flowchart?.graduation_target ?? ""}
                major={majorLabel}
                rerouted={isRerouted}
              />
            </div>
          </div>

          {/* edge fades — pure affordance, never eat pointer events */}
          <div
            className={`pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-ink-950 to-transparent transition-opacity duration-300 ${
              edges.left ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden
          />
          <div
            className={`pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-ink-950 to-transparent transition-opacity duration-300 ${
              edges.right ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden
          />
        </div>
      )}

      {flowchart?.rationale ? (
        <footer className="border-t border-ink-800 px-5 py-3">
          <p className="max-w-3xl text-[12px] leading-relaxed text-mist">
            {flowchart.rationale}
          </p>
        </footer>
      ) : null}

      {tip ? <StopTooltip tip={tip} /> : null}
    </section>
  );
}

function ScrollButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "left" ? "Scroll route back" : "Scroll route forward"}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-ink-700 bg-ink-900 text-mist transition-colors hover:border-gold/60 hover:text-gold disabled:pointer-events-none disabled:opacity-25"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <path
          d={direction === "left" ? "M7.5 2 3.5 6l4 4" : "M4.5 2 8.5 6l-4 4"}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function EmptyRoute({ graduationTarget }: { graduationTarget?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14">
      <svg width="260" height="46" viewBox="0 0 260 46" aria-hidden>
        <line
          x1="12"
          y1="23"
          x2="248"
          y2="23"
          className="stroke-ink-700"
          strokeWidth="4"
          strokeDasharray="8 10"
          strokeLinecap="round"
        />
        <circle cx="12" cy="23" r="7" className="fill-ink-950 stroke-ink-600" strokeWidth="3" />
        <circle cx="248" cy="23" r="9" className="fill-ink-950 stroke-gold/50" strokeWidth="3" />
      </svg>
      <p className="mt-5 text-sm font-medium text-[#f4f1f7]">No route plotted yet</p>
      <p className="mt-1 max-w-sm text-center text-[12px] leading-relaxed text-mist">
        Answer the quiz and AIVISOR will lay down the line — one station per
        semester, all the way to the terminus.
      </p>
      {graduationTarget ? (
        <p className="mt-4 rounded-lg border border-gold/30 px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] text-gold">
          TARGET · {graduationTarget.toUpperCase()}
        </p>
      ) : null}
    </div>
  );
}

export { CourseChip, Legend, RouteLine, Station, StationNode, StopTooltip, Terminus };
export { buildBoard, LAYOUT, mergeSemesterStops, normCode, breakLabel } from "./geometry";
export type {
  BoardModel,
  StationModel,
  StopKind,
  StopModel,
} from "./geometry";
export type { CourseChipProps } from "./CourseChip";
export type { StationProps } from "./Station";
export type { StopTipData } from "./StopTooltip";
export type { TerminusProps } from "./Terminus";
export type { RouteLineProps } from "./RouteLine";
export type { LegendProps } from "./Legend";
