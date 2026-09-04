"use client";

// ── What-if drag validation ────────────────────────────────────────────
// Drag a course between semesters and get an INSTANT, deterministic verdict
// on whether every downstream prerequisite still holds — before committing.
//
// All truth comes from lib/prereq.ts (validateMove / buildCourseIndex).
// No model call, no async, no guessing. Zero dependencies: native HTML5 DnD
// plus a full keyboard fallback (select a stop, pick a target station).

import { useCallback, useMemo, useState } from "react";
import type { FlowchartOutput, MajorMap, PlanSemester } from "@/lib/types";
import {
  buildCourseIndex,
  creditLoad,
  validateMove,
  type CourseIndex,
  type Violation,
} from "@/lib/prereq";
import { termFor } from "@/lib/demo";

export interface WhatIfProps {
  flowchart: FlowchartOutput;
  majorMap: MajorMap;
  /** Fired with the new plan whenever the student accepts a valid move (and on Reset). */
  onCommit?: (plan: PlanSemester[]) => void;
  className?: string;
}

// ── verdict model ──────────────────────────────────────────────────────

type Verdict =
  | { kind: "ok"; code: string; semester: number }
  | { kind: "same"; code: string; semester: number }
  | { kind: "locked"; code: string; semester: number }
  | {
      kind: "blocked";
      code: string;
      semester: number;
      reason: string;
      /** "needs" = the moved course loses a prereq; "breaks" = it strands a later course. */
      mode: "needs" | "breaks";
      /** The other course involved — the one to name on screen. */
      culprit: string;
    };

interface Feedback {
  tone: "ok" | "bad" | "info";
  title: string;
  detail: string;
}

// ── helpers ────────────────────────────────────────────────────────────

/** Fallback catalog so a not-yet-loaded majorMap degrades instead of throwing. */
const EMPTY_MAP: MajorMap = { major: "", total_semesters: 0, semesters: [] };

function clonePlan(plan: PlanSemester[]): PlanSemester[] {
  return plan.map((s) => ({ ...s, courses: s.courses.map((c) => c.toUpperCase()) }));
}

function semesterOf(plan: PlanSemester[], code: string): number | null {
  const target = code.toUpperCase();
  for (const s of plan) {
    if (s.courses.some((c) => c.toUpperCase() === target)) return s.semester;
  }
  return null;
}

function stationLabel(s: PlanSemester): string {
  return s.term ?? termFor(s.semester);
}

// ── icons (inline SVG only — no emoji) ─────────────────────────────────

function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={`h-3.5 w-3.5 ${className}`} fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  );
}

function IconBlock({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={`h-3.5 w-3.5 ${className}`} fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="8" cy="8" r="5.75" />
      <path d="M4.4 11.6 11.6 4.4" />
    </svg>
  );
}

function IconLock({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={`h-3 w-3 ${className}`} fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.75 7V5.25a2.25 2.25 0 0 1 4.5 0V7" />
    </svg>
  );
}

function IconGrip({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 16" aria-hidden className={`h-3.5 w-2.5 ${className}`} fill="currentColor">
      <circle cx="2.5" cy="4" r="1.1" /><circle cx="7.5" cy="4" r="1.1" />
      <circle cx="2.5" cy="8" r="1.1" /><circle cx="7.5" cy="8" r="1.1" />
      <circle cx="2.5" cy="12" r="1.1" /><circle cx="7.5" cy="12" r="1.1" />
    </svg>
  );
}

function IconReset({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={`h-3.5 w-3.5 ${className}`} fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.6 8a5.4 5.4 0 1 0 1.7-3.95" />
      <path d="M2.2 2.4v3.2h3.2" />
    </svg>
  );
}

// ── course card ────────────────────────────────────────────────────────

interface StopCardProps {
  code: string;
  title: string;
  credits: number;
  locked: boolean;
  moved: boolean;
  dragging: boolean;
  selected: boolean;
  onSelect: (code: string) => void;
  onDragStart: (code: string) => void;
  onDragEnd: () => void;
}

function StopCard({
  code, title, credits, locked, moved, dragging, selected,
  onSelect, onDragStart, onDragEnd,
}: StopCardProps) {
  const shell = locked
    ? "border-ink-800 bg-ink-950/70 text-mist/60"
    : moved
      ? "border-teal/60 bg-teal/10 hover:border-teal"
      : "border-ink-700 bg-ink-850 hover:border-gold/60";

  const accent = locked ? "bg-ink-600" : moved ? "bg-teal" : "bg-gold/70";
  const codeTone = locked ? "text-mist/70" : moved ? "text-teal" : "text-gold-200";

  return (
    <div
      draggable={!locked}
      role="button"
      tabIndex={locked ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={locked || undefined}
      aria-label={
        locked
          ? `${code}, ${title}, completed and locked`
          : `${code}, ${title}. Drag to another semester, or press Enter to pick a destination.`
      }
      onClick={() => { if (!locked) onSelect(code); }}
      onKeyDown={(e) => {
        if (locked) return;
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(code); }
      }}
      onDragStart={(e) => {
        if (locked) { e.preventDefault(); return; }
        e.dataTransfer.setData("text/plain", code);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(code);
      }}
      onDragEnd={onDragEnd}
      className={[
        "group relative flex select-none items-center gap-2 overflow-hidden rounded-lg border py-2 pl-3 pr-2",
        "outline-none transition-[border-color,background-color,transform,opacity] duration-150",
        locked ? "cursor-default" : "cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-gold/70",
        selected ? "ring-2 ring-gold" : "",
        dragging ? "opacity-40" : "",
        shell,
      ].join(" ")}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
      <div className="min-w-0 flex-1">
        <div className={`font-mono text-xs font-semibold tracking-wide ${codeTone}`}>{code}</div>
        <div className="truncate text-[11px] leading-tight text-mist/80" title={title}>{title}</div>
      </div>
      <span className="shrink-0 text-[10px] tabular-nums text-mist/50">{credits}cr</span>
      {locked
        ? <IconLock className="shrink-0 text-mist/40" />
        : <IconGrip className="shrink-0 text-mist/30 transition-colors group-hover:text-gold/60" />}
    </div>
  );
}

// ── main board ─────────────────────────────────────────────────────────

export default function WhatIfBoard({ flowchart, majorMap, onCommit, className = "" }: WhatIfProps) {
  // Both props are required by the type, but the lead wires them from async
  // pipeline output. A prop that has not landed yet must degrade to the empty
  // panel, never throw mid-demo.
  const idx: CourseIndex = useMemo(
    () => buildCourseIndex(majorMap ?? EMPTY_MAP),
    [majorMap],
  );
  const incoming: PlanSemester[] = useMemo(() => flowchart?.plan ?? [], [flowchart]);

  const [working, setWorking] = useState<PlanSemester[]>(() => clonePlan(incoming));
  const [dragCode, setDragCode] = useState<string | null>(null);
  const [hoverSem, setHoverSem] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [moved, setMoved] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Never mutate the prop — re-sync a fresh working copy when it changes
  // identity. Adjusted during render (React's documented "reset state when a
  // prop changes" pattern) rather than in an effect: an effect would paint one
  // frame of the stale board before correcting itself, which on a projector
  // reads as a flicker when a reroute lands mid-demo.
  const [syncedFrom, setSyncedFrom] = useState<FlowchartOutput>(flowchart);
  if (syncedFrom !== flowchart) {
    setSyncedFrom(flowchart);
    setWorking(clonePlan(flowchart?.plan ?? []));
    setDragCode(null);
    setHoverSem(null);
    setSelected(null);
    setMoved([]);
    setFeedback(null);
  }

  const credits = useMemo(() => creditLoad(working, idx), [working, idx]);
  const dirty = moved.length > 0;
  const catalogEmpty = idx.size === 0;

  /** Deterministic, synchronous verdict for one hypothetical move. */
  const evaluate = useCallback(
    (code: string, sem: number): Verdict => {
      const dest = working.find((s) => s.semester === sem);
      if (!dest || dest.status === "done") return { kind: "locked", code, semester: sem };
      if (semesterOf(working, code) === sem) return { kind: "same", code, semester: sem };

      const res = validateMove(working, idx, code, sem);
      if (res.ok) return { kind: "ok", code, semester: sem };

      const v: Violation | undefined = res.violations[0];
      const upper = code.toUpperCase();
      // If the moved course is itself the offender it LOST a prereq; otherwise
      // it stranded a later course that depends on it.
      const selfBroke = !v || v.course.toUpperCase() === upper;
      return {
        kind: "blocked",
        code,
        semester: sem,
        mode: selfBroke ? "needs" : "breaks",
        culprit: (selfBroke ? v?.missing : v?.course) ?? "a prerequisite",
        reason: v?.reason ?? `${code} cannot sit in semester ${sem} without breaking the prerequisite chain.`,
      };
    },
    [working, idx],
  );

  const hoverVerdict = useMemo(
    () => (dragCode && hoverSem !== null ? evaluate(dragCode, hoverSem) : null),
    [dragCode, hoverSem, evaluate],
  );

  /** Verdicts for every station, for the keyboard destination menu. */
  const menuVerdicts = useMemo(() => {
    if (!selected) return [];
    return working.map((s) => ({ sem: s, verdict: evaluate(selected, s.semester) }));
  }, [selected, working, evaluate]);

  const commitMove = useCallback(
    (code: string, sem: number) => {
      const upper = code.toUpperCase();
      const next: PlanSemester[] = working.map((s) => ({
        ...s,
        courses: s.courses.filter((c) => c.toUpperCase() !== upper),
      }));
      const dest = next.find((s) => s.semester === sem);
      if (!dest) return;
      dest.courses = [...dest.courses, upper];

      const load = creditLoad(next, idx)[sem] ?? 0;
      setWorking(next);
      setMoved((prev) => (prev.includes(upper) ? prev : [...prev, upper]));
      setSelected(null);
      setFeedback({
        tone: "ok",
        title: `${upper} moved to ${stationLabel(dest)}`,
        detail: `Every downstream prerequisite still holds. ${stationLabel(dest)} now carries ${load} credits.`,
      });
      onCommit?.(next);
    },
    [working, idx, onCommit],
  );

  const refuse = useCallback((v: Verdict) => {
    if (v.kind === "blocked") {
      setFeedback({
        tone: "bad",
        title: `${v.code} can't move to semester ${v.semester}`,
        detail: v.reason,
      });
    } else if (v.kind === "locked") {
      setFeedback({
        tone: "bad",
        title: `Semester ${v.semester} is already complete`,
        detail: "Finished semesters are locked — the past is fixed. Pick a current or future station.",
      });
    } else if (v.kind === "same") {
      setFeedback({
        tone: "info",
        title: `${v.code} is already in semester ${v.semester}`,
        detail: "Drop it on a different station to test a change.",
      });
    }
  }, []);

  const handleDrop = useCallback(
    (sem: number, codeFromEvent: string | null) => {
      const code = (codeFromEvent || dragCode || "").toUpperCase();
      setDragCode(null);
      setHoverSem(null);
      if (!code) return;
      const v = evaluate(code, sem);
      if (v.kind === "ok") commitMove(code, sem);
      else refuse(v);
    },
    [dragCode, evaluate, commitMove, refuse],
  );

  const handleReset = useCallback(() => {
    const fresh = clonePlan(incoming);
    setWorking(fresh);
    setMoved([]);
    setSelected(null);
    setDragCode(null);
    setHoverSem(null);
    setFeedback({
      tone: "info",
      title: "Reset to the planned route",
      detail: "All what-if moves discarded.",
    });
    if (dirty) onCommit?.(fresh);
  }, [incoming, dirty, onCommit]);

  // ── empty state ──────────────────────────────────────────────────────
  if (!working.length) {
    return (
      <section className={`rounded-2xl border border-ink-700 bg-ink-900/70 p-6 ${className}`}>
        <h2 className="text-sm font-semibold tracking-wide text-gold-200">What-if mode</h2>
        <p className="mt-2 max-w-md text-sm text-mist">
          No route yet. Once your plan is generated you can drag any stop to a different
          station and AIDvisor will tell you instantly whether the prerequisite chain survives.
        </p>
      </section>
    );
  }

  // ── verdict bar content ──────────────────────────────────────────────
  let barTone = "border-ink-700 bg-ink-850 text-mist";
  let barTitle = "Drag a stop to another station";
  let barDetail = "AIDvisor checks every downstream prerequisite before you let go. Keyboard: focus a stop and press Enter.";

  if (hoverVerdict) {
    if (hoverVerdict.kind === "ok") {
      barTone = "border-teal/60 bg-teal/10 text-teal";
      barTitle = `Valid — ${hoverVerdict.code} can move to semester ${hoverVerdict.semester}`;
      barDetail = "Release to commit. Prerequisite chain stays intact.";
    } else if (hoverVerdict.kind === "blocked") {
      barTone = "border-alert/60 bg-alert/10 text-alert";
      barTitle =
        hoverVerdict.mode === "breaks"
          ? `Blocked — moving ${hoverVerdict.code} there would strand ${hoverVerdict.culprit}`
          : `Blocked — ${hoverVerdict.code} would sit before its prerequisite ${hoverVerdict.culprit}`;
      barDetail = hoverVerdict.reason;
    } else if (hoverVerdict.kind === "same") {
      barTone = "border-gold/40 bg-gold/5 text-gold-200";
      barTitle = `${hoverVerdict.code} is already here`;
      barDetail = "Drop it on a different station to test a change.";
    } else {
      barTone = "border-ink-600 bg-ink-850 text-mist";
      barTitle = `Semester ${hoverVerdict.semester} is locked`;
      barDetail = "Completed semesters cannot be changed.";
    }
  } else if (feedback) {
    barTone =
      feedback.tone === "ok" ? "border-teal/60 bg-teal/10 text-teal"
      : feedback.tone === "bad" ? "border-alert/60 bg-alert/10 text-alert"
      : "border-gold/40 bg-gold/5 text-gold-200";
    barTitle = feedback.title;
    barDetail = feedback.detail;
  }

  return (
    <section className={`rounded-2xl border border-ink-700 bg-ink-900/70 p-4 sm:p-5 ${className}`}>
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-gold-200">What-if mode</h2>
          <p className="mt-0.5 text-xs text-mist/80">
            Move a stop between stations. Every prerequisite is re-checked instantly — no guessing.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          disabled={!dirty}
          className={[
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            "outline-none focus-visible:ring-2 focus-visible:ring-gold/70",
            dirty
              ? "border-maroon-300/50 bg-maroon/25 text-gold-200 hover:border-gold/60 hover:bg-maroon/40"
              : "cursor-not-allowed border-ink-700 bg-ink-850 text-mist/40",
          ].join(" ")}
        >
          <IconReset />
          Reset route
        </button>
      </div>

      {catalogEmpty && (
        <p className="mt-3 rounded-lg border border-alert/50 bg-alert/10 px-3 py-2 text-xs text-alert">
          Course catalog unavailable — prerequisite validation is running blind. Moves are not verified.
        </p>
      )}

      {/* live verdict bar */}
      <div
        aria-live="polite"
        className={`mt-3 flex min-h-[52px] items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${barTone}`}
      >
        <span className="mt-0.5 shrink-0">
          {hoverVerdict?.kind === "ok" || feedback?.tone === "ok"
            ? <IconCheck />
            : hoverVerdict?.kind === "blocked" || hoverVerdict?.kind === "locked" || feedback?.tone === "bad"
              ? <IconBlock />
              : <IconGrip className="h-3.5 w-2.5" />}
        </span>
        <div className="min-w-0">
          <div className="text-xs font-semibold">{barTitle}</div>
          <div className="mt-0.5 text-[11px] leading-snug opacity-85">{barDetail}</div>
        </div>
      </div>

      {/* board */}
      <div className="mt-4 overflow-x-auto pb-2">
        <div className="relative flex min-w-max gap-3 pt-1">
          <div aria-hidden className="pointer-events-none absolute left-6 right-6 top-[15px] h-px bg-gold/25" />

          {working.map((s) => {
            const locked = s.status === "done";
            // Locked stations still light the verdict bar on hover, but never
            // take on droppable styling — the past must not look reachable.
            const isHover = !locked && dragCode !== null && hoverSem === s.semester;
            const v = isHover ? hoverVerdict : null;

            let col = "border-ink-700 bg-ink-900/60";
            if (locked) col = "border-ink-800 bg-ink-950/50";
            if (isHover) {
              col =
                v?.kind === "ok" ? "border-teal bg-teal/10 ring-2 ring-teal/40"
                : v?.kind === "blocked" ? "border-alert bg-alert/10 ring-2 ring-alert/40"
                : v?.kind === "same" ? "border-gold/50 bg-gold/5"
                : "border-ink-600 bg-ink-850";
            }

            const receivedMove = s.courses.some((c) => moved.includes(c.toUpperCase()));
            const dot =
              isHover && v?.kind === "ok" ? "border-teal bg-teal"
              : isHover && v?.kind === "blocked" ? "border-alert bg-alert"
              : locked ? "border-ink-600 bg-ink-800"
              : receivedMove ? "border-teal bg-teal"
              : "border-gold bg-ink-900";

            return (
              <div
                key={s.semester}
                onDragOver={(e) => {
                  if (!dragCode) return;
                  if (locked) {
                    // No preventDefault → a completed semester is genuinely not
                    // droppable. Still narrate why in the verdict bar.
                    if (hoverSem !== s.semester) setHoverSem(s.semester);
                    return;
                  }
                  // Accept the drop even when the verdict is "blocked". Setting
                  // dropEffect to "none" here would make the browser swallow the
                  // drop event entirely, so a refused move would silently snap
                  // back and the explanation would vanish the instant the
                  // student let go. The refusal — and the specific prerequisite
                  // that broke — has to survive the release.
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (hoverSem !== s.semester) setHoverSem(s.semester);
                }}
                onDragLeave={(e) => {
                  const to = e.relatedTarget as Node | null;
                  if (to && e.currentTarget.contains(to)) return;
                  setHoverSem((prev) => (prev === s.semester ? null : prev));
                }}
                onDrop={(e) => {
                  if (locked) return;
                  e.preventDefault();
                  let code: string | null = null;
                  try { code = e.dataTransfer.getData("text/plain") || null; } catch { code = null; }
                  handleDrop(s.semester, code);
                }}
                className={`w-[190px] shrink-0 rounded-xl border p-2.5 transition-[border-color,background-color,box-shadow] duration-150 ${col}`}
              >
                {/* station dot on the route rail */}
                <div className="relative flex h-7 items-center justify-center">
                  <span className={`relative z-10 h-3 w-3 rounded-full border-2 transition-colors ${dot}`} />
                </div>

                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-mist/60">
                      Sem {s.semester}
                    </div>
                    <div className="truncate text-xs font-semibold text-gold-200">{stationLabel(s)}</div>
                  </div>
                  <span className="shrink-0 text-[10px] tabular-nums text-mist/50">
                    {credits[s.semester] ?? 0}cr
                  </span>
                </div>

                {locked && (
                  <div className="mb-2 inline-flex items-center gap-1 rounded-md border border-ink-700 bg-ink-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-mist/60">
                    <IconLock /> Complete
                  </div>
                )}
                {s.status === "current" && (
                  <div className="mb-2 inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gold">
                    You are here
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  {s.courses.length === 0 && (
                    <div className="rounded-lg border border-dashed border-ink-700 px-2 py-3 text-center text-[11px] text-mist/50">
                      No stops
                    </div>
                  )}
                  {s.courses.map((raw) => {
                    const code = raw.toUpperCase();
                    const course = idx.get(code);
                    return (
                      <StopCard
                        key={code}
                        code={code}
                        title={course?.title ?? "Course"}
                        credits={course?.credits ?? 3}
                        locked={locked}
                        moved={moved.includes(code)}
                        dragging={dragCode === code}
                        selected={selected === code}
                        onSelect={(c) => {
                          setFeedback(null);
                          setSelected((prev) => (prev === c ? null : c));
                        }}
                        onDragStart={(c) => { setFeedback(null); setSelected(null); setDragCode(c); }}
                        onDragEnd={() => { setDragCode(null); setHoverSem(null); }}
                      />
                    );
                  })}
                </div>

                {/* live drop affordance, shown before release */}
                {isHover && (
                  <div
                    className={[
                      "mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-dashed px-2 py-2 text-[11px] font-semibold",
                      v?.kind === "ok" ? "border-teal bg-teal/10 text-teal"
                        : v?.kind === "blocked" ? "border-alert bg-alert/10 text-alert"
                        : "border-ink-600 text-mist",
                    ].join(" ")}
                  >
                    {v?.kind === "ok" ? <><IconCheck /> Drop to confirm</>
                      : v?.kind === "blocked"
                        ? <><IconBlock /> {v.mode === "breaks" ? `Strands ${v.culprit}` : `Needs ${v.culprit}`}</>
                        : <>Already here</>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* keyboard / no-drag fallback */}
      {selected && (
        <div className="mt-3 animate-rise rounded-xl border border-gold/40 bg-ink-850 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-mist">
              Move <span className="font-mono font-semibold text-gold-200">{selected}</span> to which station?
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-md border border-ink-700 px-2 py-1 text-[11px] text-mist outline-none transition-colors hover:border-ink-600 hover:text-gold-200 focus-visible:ring-2 focus-visible:ring-gold/70"
            >
              Cancel
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {menuVerdicts.map(({ sem, verdict }) => {
              const tone =
                verdict.kind === "ok" ? "border-teal/60 bg-teal/10 text-teal hover:border-teal"
                : verdict.kind === "blocked" ? "border-alert/50 bg-alert/10 text-alert hover:border-alert"
                : verdict.kind === "same" ? "border-gold/50 bg-gold/10 text-gold-200"
                : "border-ink-700 bg-ink-900 text-mist/45";
              return (
                <button
                  key={sem.semester}
                  type="button"
                  disabled={verdict.kind === "locked"}
                  title={
                    verdict.kind === "blocked" ? verdict.reason
                    : verdict.kind === "locked" ? "Completed semester — locked"
                    : verdict.kind === "same" ? "Already in this semester"
                    : `Valid: move ${selected} to ${stationLabel(sem)}`
                  }
                  onClick={() => {
                    if (verdict.kind === "ok") commitMove(selected, sem.semester);
                    else refuse(verdict);
                  }}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                    "outline-none focus-visible:ring-2 focus-visible:ring-gold/70",
                    verdict.kind === "locked" ? "cursor-not-allowed" : "",
                    tone,
                  ].join(" ")}
                >
                  {verdict.kind === "ok" && <IconCheck />}
                  {verdict.kind === "blocked" && <IconBlock />}
                  {verdict.kind === "locked" && <IconLock />}
                  Sem {sem.semester}
                  <span className="opacity-70">· {stationLabel(sem)}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-mist/70">
            Teal stations are safe. Coral stations break a prerequisite — pick one to see exactly which.
          </p>
        </div>
      )}

      {/* legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] uppercase tracking-wide text-mist/55">
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-gold" /> Planned</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-teal" /> Moved in what-if</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-alert" /> Breaks a prereq</span>
        <span className="inline-flex items-center gap-1.5"><IconLock className="text-mist/55" /> Locked (complete)</span>
      </div>
    </section>
  );
}
