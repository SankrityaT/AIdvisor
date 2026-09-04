// ── Demo persona + the scripted disruption ─────────────────────────────
// SHARED. Read-only to feature agents.

import type { DisruptionEvent, QuizAnswers, PlanSemester } from "./types";

/** Semester 1 is Fall 2025; the student is currently in semester 3 (Fall 2026). */
export const START_YEAR = 2025;
export const CURRENT_SEMESTER = 3;

export function termFor(semester: number): string {
  const i = semester - 1;
  const isFall = i % 2 === 0;
  const year = START_YEAR + Math.floor(i / 2);
  return isFall ? `Fall ${year}` : `Spring ${year + 1}`;
}

/** Graduation month/year implied by the last semester in a plan. */
export function graduationFor(lastSemester: number): string {
  const t = termFor(lastSemester);
  return t.startsWith("Fall") ? `December ${t.split(" ")[1]}` : `May ${t.split(" ")[1]}`;
}

export function statusFor(semester: number): PlanSemester["status"] {
  if (semester < CURRENT_SEMESTER) return "done";
  if (semester === CURRENT_SEMESTER) return "current";
  return "future";
}

export const DEMO_QUIZ: QuizAnswers = {
  name: "Sun Devil",
  major: "Computer Science, BS",
  goal: "software engineering career",
  risk_tolerance: "balanced",
  priority: "protect_gpa",
};

/** The exact scripted break, per the spec. Deterministic — never random. */
export const DEMO_DISRUPTION: DisruptionEvent = {
  semester: CURRENT_SEMESTER,
  broken: [
    { code: "CSE355", status: "full" },
    { code: "CSE240", status: "not_offered" },
  ],
};

export const BREAK_LABEL: Record<string, string> = {
  full: "FULL",
  not_offered: "NOT OFFERED",
  cancelled: "CANCELLED",
  time_conflict: "TIME CONFLICT",
};
