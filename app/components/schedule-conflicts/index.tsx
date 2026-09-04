"use client";

// ── Schedule time conflicts ────────────────────────────────────────────
// Secondary panel. The student states a couple of plain time preferences;
// we check every un-finished stop on their route against a mocked catalog
// of meeting times and name anything that would break, before real
// registration would. Presentational + self-contained.

import { useEffect, useMemo, useRef, useState } from "react";
import type { FlowchartOutput, MajorMap } from "@/lib/types";
import { termFor } from "@/lib/demo";
import rawSlots from "./data-local/mocked-time-slots.json";
import {
  coursesMissingSlots,
  findConflicts,
  formatSlot,
  type ScheduleConflict,
  type TimeConstraints,
  type TimeSlot,
} from "./validate";

const SLOTS = rawSlots as Record<string, TimeSlot>;

export interface ScheduleConflictsProps {
  flowchart: FlowchartOutput;
  majorMap: MajorMap;
  className?: string;
  onConflictsChange?: (conflicts: ScheduleConflict[]) => void;
}

const START_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Any time" },
  { value: "08:00", label: "8:00 AM" },
  { value: "09:00", label: "9:00 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "11:00", label: "11:00 AM" },
];

const END_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Any time" },
  { value: "15:00", label: "3:00 PM" },
  { value: "17:00", label: "5:00 PM" },
  { value: "18:00", label: "6:00 PM" },
  { value: "19:00", label: "7:00 PM" },
];

const SELECT_CLASS =
  "w-full appearance-none rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 pr-8 " +
  "text-sm text-white outline-none transition focus:border-gold/70 focus:ring-1 focus:ring-gold/40";

function ClockIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 7.5V12l3 1.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8.4 12.3l2.4 2.4 4.8-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist"
    >
      <path
        d="M6 9.5l6 5.5 6-5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ScheduleConflicts({
  flowchart,
  majorMap,
  className = "",
  onConflictsChange,
}: ScheduleConflictsProps) {
  const [earliestStart, setEarliestStart] = useState<string>("10:00");
  const [latestEnd, setLatestEnd] = useState<string>("");
  const [noFriday, setNoFriday] = useState(false);

  const plan = useMemo(
    () => (Array.isArray(flowchart?.plan) ? flowchart.plan : []),
    [flowchart],
  );

  const titles = useMemo(() => {
    const map: Record<string, string> = {};
    for (const sem of majorMap?.semesters ?? []) {
      for (const c of sem?.courses ?? []) if (c?.code) map[c.code] = c.title;
    }
    return map;
  }, [majorMap]);

  const constraints: TimeConstraints = useMemo(
    () => ({
      earliestStart: earliestStart || undefined,
      latestEnd: latestEnd || undefined,
      noFriday,
    }),
    [earliestStart, latestEnd, noFriday],
  );

  const anyConstraint = Boolean(earliestStart || latestEnd || noFriday);

  const conflicts = useMemo(
    () => findConflicts(plan, constraints, SLOTS),
    [plan, constraints],
  );

  const missing = useMemo(() => coursesMissingSlots(plan, SLOTS), [plan]);

  // Report upward without letting an inline callback prop cause a render loop.
  const cbRef = useRef(onConflictsChange);
  useEffect(() => {
    cbRef.current = onConflictsChange;
  });
  // Compare by value, not identity: an unstable `flowchart` prop would
  // otherwise re-fire this every parent render (and loop a parent that
  // stores the result in state).
  const lastSig = useRef<string | null>(null);
  useEffect(() => {
    const sig = JSON.stringify(conflicts);
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    cbRef.current?.(conflicts);
  }, [conflicts]);

  const hasPlan = plan.length > 0;

  return (
    <section
      className={`rounded-2xl border border-ink-700 bg-ink-900/70 p-5 ${className}`}
      aria-label="Schedule time conflicts"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 text-gold">
            <ClockIcon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-white">
              Schedule fit
            </h2>
            <p className="text-xs text-mist">
              Your time preferences, checked against the route before registration.
            </p>
          </div>
        </div>
        {hasPlan && anyConstraint ? (
          <span
            className={
              conflicts.length
                ? "shrink-0 rounded-full border border-alert/50 bg-alert/10 px-2.5 py-1 text-xs font-semibold text-alert"
                : "shrink-0 rounded-full border border-teal/50 bg-teal/10 px-2.5 py-1 text-xs font-semibold text-teal"
            }
          >
            {conflicts.length ? `${conflicts.length} conflict${conflicts.length > 1 ? "s" : ""}` : "Clear"}
          </span>
        ) : null}
      </header>

      {/* controls */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-mist">
            No class before
          </span>
          <span className="relative block">
            <select
              className={SELECT_CLASS}
              value={earliestStart}
              onChange={(e) => setEarliestStart(e.target.value)}
            >
              {START_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-ink-850">
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronIcon />
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-mist">
            Nothing after
          </span>
          <span className="relative block">
            <select
              className={SELECT_CLASS}
              value={latestEnd}
              onChange={(e) => setLatestEnd(e.target.value)}
            >
              {END_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-ink-850">
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronIcon />
          </span>
        </label>

        <div className="block">
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-mist">
            Fridays
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={noFriday}
            onClick={() => setNoFriday((v) => !v)}
            className={
              "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition " +
              (noFriday
                ? "border-gold/60 bg-gold/10 text-gold"
                : "border-ink-700 bg-ink-850 text-mist hover:border-ink-600")
            }
          >
            <span>{noFriday ? "Keep Fridays free" : "Fridays are fine"}</span>
            <span
              className={
                "ml-3 h-4 w-7 shrink-0 rounded-full p-0.5 transition " +
                (noFriday ? "bg-gold/70" : "bg-ink-600")
              }
            >
              <span
                className={
                  "block h-3 w-3 rounded-full bg-ink-950 transition-transform " +
                  (noFriday ? "translate-x-3" : "translate-x-0")
                }
              />
            </span>
          </button>
        </div>
      </div>

      {/* results */}
      <div className="mt-4">
        {!hasPlan ? (
          <p className="rounded-xl border border-dashed border-ink-700 bg-ink-850/60 px-4 py-6 text-center text-sm text-mist">
            Your route hasn&rsquo;t been built yet — answer the quiz and the schedule
            check will run against it.
          </p>
        ) : !anyConstraint ? (
          <p className="rounded-xl border border-dashed border-ink-700 bg-ink-850/60 px-4 py-6 text-center text-sm text-mist">
            Pick a preference above and we&rsquo;ll flag every stop on your route that
            fights it.
          </p>
        ) : conflicts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-teal/30 bg-teal/5 px-4 py-4">
            <CheckIcon className="h-5 w-5 shrink-0 text-teal" />
            <p className="text-sm text-mist">
              <span className="font-medium text-teal">No conflicts.</span> Every
              upcoming course on your route fits these preferences.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {conflicts.map((c, i) => (
              <li
                key={`${c.semester}-${c.code}-${c.constraint}`}
                className="animate-rise overflow-hidden rounded-xl border border-ink-700 bg-ink-850/70"
                style={{ animationDelay: `${Math.min(i, 6) * 45}ms` }}
              >
                <div className="flex gap-3 border-l-2 border-alert px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-mono text-sm font-semibold text-white">
                        {c.code}
                      </span>
                      <span className="truncate text-xs text-mist">
                        {titles[c.code] ?? "Course"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-mist">
                      <span className="font-mono text-[11px] text-gold-200">
                        {formatSlot(SLOTS[c.code])}
                      </span>
                      <span className="mx-1.5 text-ink-600">·</span>
                      Semester {c.semester} · {termFor(c.semester)}
                    </p>
                    <p className="mt-1.5 text-xs text-mist/90">{c.detail}</p>
                  </div>
                  <span className="h-fit shrink-0 rounded-md border border-alert/40 bg-alert/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-alert">
                    {c.constraint}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {hasPlan && missing.length > 0 ? (
          <p className="mt-3 text-[11px] text-mist/70">
            No published meeting time yet for {missing.join(", ")} — not checked.
          </p>
        ) : null}
      </div>
    </section>
  );
}

export { findConflicts, formatSlot } from "./validate";
export type { ScheduleConflict, TimeConstraints, TimeSlot } from "./validate";
