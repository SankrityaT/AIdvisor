// ── Schedule time conflicts — pure validator ───────────────────────────
// Zero runtime dependencies (type-only import). Deterministic: same plan +
// same constraints + same slots => same conflicts, in the same order.

import type { PlanSemester } from "@/lib/types";

/** Meeting pattern for one course. Days use M / T / W / Th / F. */
export interface TimeSlot {
  days: string[];
  start: string; // "HH:MM", 24h
  end: string;   // "HH:MM", 24h
}

/** Simple student-stated time preferences. All optional. */
export interface TimeConstraints {
  /** "HH:MM" — nothing may START before this. */
  earliestStart?: string;
  /** true => no course may meet on Friday. */
  noFriday?: boolean;
  /** "HH:MM" — nothing may END after this. */
  latestEnd?: string;
}

export interface ScheduleConflict {
  code: string;
  semester: number;
  /** Human label of the rule that was broken, e.g. "No classes before 10:00 AM". */
  constraint: string;
  /** One sentence naming the actual meeting time and by how much it misses. */
  detail: string;
}

const DAY_ORDER = ["M", "T", "W", "Th", "F", "S", "Su"];

/** "09:30" -> 570. Returns null for anything unparseable. */
export function toMinutes(hhmm: string | undefined | null): number | null {
  if (typeof hhmm !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** 570 -> "9:30 AM". */
export function formatTime(hhmm: string): string {
  const mins = toMinutes(hhmm);
  if (mins === null) return hhmm;
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** ["M","W","F"] -> "MWF". Unknown day tokens are kept as written. */
export function formatDays(days: string[] | undefined): string {
  if (!Array.isArray(days) || days.length === 0) return "TBA";
  const sorted = [...days].sort((a, b) => {
    const ia = DAY_ORDER.indexOf(a);
    const ib = DAY_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return sorted.join("");
}

/** "MWF 8:00 AM – 8:50 AM" */
export function formatSlot(slot: TimeSlot | undefined): string {
  if (!slot) return "Time TBA";
  return `${formatDays(slot.days)} ${formatTime(slot.start)} – ${formatTime(slot.end)}`;
}

function gapLabel(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function meetsOnFriday(slot: TimeSlot): boolean {
  return Array.isArray(slot.days) && slot.days.some((d) => d === "F");
}

/**
 * Flag every course in `plan` whose meeting time breaks a stated preference.
 *
 * Semesters marked "done" are skipped — finished coursework can't be
 * rescheduled, so surfacing it would be noise. A course with no published
 * time slot is skipped silently (see `coursesMissingSlots`).
 *
 * A course that breaks two rules yields two conflicts, one per rule.
 * Output is ordered by semester, then start time, then course code.
 */
export function findConflicts(
  plan: PlanSemester[],
  constraints: TimeConstraints,
  slots: Record<string, TimeSlot>,
): ScheduleConflict[] {
  if (!Array.isArray(plan) || plan.length === 0) return [];
  if (!constraints) return [];

  const earliest = toMinutes(constraints.earliestStart);
  const latest = toMinutes(constraints.latestEnd);
  const noFriday = constraints.noFriday === true;
  if (earliest === null && latest === null && !noFriday) return [];

  const table = slots || {};
  const out: Array<ScheduleConflict & { _sort: number }> = [];

  for (const sem of plan) {
    if (!sem || sem.status === "done") continue;
    const codes = Array.isArray(sem.courses) ? sem.courses : [];

    for (const code of codes) {
      const slot = table[code];
      if (!slot) continue;

      const startMin = toMinutes(slot.start);
      const endMin = toMinutes(slot.end);
      const sortKey = startMin ?? 0;
      const when = formatSlot(slot);

      if (earliest !== null && startMin !== null && startMin < earliest) {
        out.push({
          code,
          semester: sem.semester,
          constraint: `No classes before ${formatTime(constraints.earliestStart as string)}`,
          detail: `Meets ${when} — starts ${gapLabel(earliest - startMin)} too early.`,
          _sort: sortKey,
        });
      }

      if (noFriday && meetsOnFriday(slot)) {
        out.push({
          code,
          semester: sem.semester,
          constraint: "No Friday classes",
          detail: `Meets ${when} — includes a Friday session.`,
          _sort: sortKey,
        });
      }

      if (latest !== null && endMin !== null && endMin > latest) {
        out.push({
          code,
          semester: sem.semester,
          constraint: `Nothing after ${formatTime(constraints.latestEnd as string)}`,
          detail: `Meets ${when} — runs ${gapLabel(endMin - latest)} too late.`,
          _sort: sortKey,
        });
      }
    }
  }

  out.sort(
    (a, b) =>
      a.semester - b.semester ||
      a._sort - b._sort ||
      a.code.localeCompare(b.code) ||
      a.constraint.localeCompare(b.constraint),
  );

  return out.map((c) => ({
    code: c.code,
    semester: c.semester,
    constraint: c.constraint,
    detail: c.detail,
  }));
}

/**
 * Course codes in the plan (excluding "done" semesters) that have no
 * published meeting time. Lets the UI say so instead of quietly ignoring them.
 */
export function coursesMissingSlots(
  plan: PlanSemester[],
  slots: Record<string, TimeSlot>,
): string[] {
  if (!Array.isArray(plan)) return [];
  const table = slots || {};
  const missing = new Set<string>();
  for (const sem of plan) {
    if (!sem || sem.status === "done") continue;
    const codes = Array.isArray(sem.courses) ? sem.courses : [];
    for (const code of codes) if (!table[code]) missing.add(code);
  }
  return [...missing].sort();
}
