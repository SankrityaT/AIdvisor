// ── Deterministic prerequisite validation ──────────────────────────────
// SHARED. Feature agents import read-only; do not edit.
// This is the ground truth that keeps the LLM honest — every AI-proposed
// plan is checked against this before it is ever shown to the student.

import type { Course, MajorMap, PlanSemester } from "./types";

export type CourseIndex = Map<string, Course>;

export function buildCourseIndex(map: MajorMap): CourseIndex {
  const idx: CourseIndex = new Map();
  for (const sem of map.semesters) {
    for (const c of sem.courses) idx.set(c.code.toUpperCase(), c);
  }
  return idx;
}

export interface Violation {
  course: string;
  semester: number;
  missing: string;
  reason: string;
}

/**
 * Check every course in `plan` against the prereq graph.
 * A course is valid only if each prereq appears in a STRICTLY EARLIER semester.
 */
export function validatePlan(plan: PlanSemester[], idx: CourseIndex): Violation[] {
  const violations: Violation[] = [];
  const placement = new Map<string, number>();
  for (const s of plan) {
    for (const code of s.courses) placement.set(code.toUpperCase(), s.semester);
  }
  for (const s of plan) {
    for (const raw of s.courses) {
      const code = raw.toUpperCase();
      const course = idx.get(code);
      if (!course) continue; // unknown course: not a prereq violation, reported separately
      for (const p of course.prereqs) {
        const pre = p.toUpperCase();
        const at = placement.get(pre);
        if (at === undefined) {
          violations.push({
            course: code, semester: s.semester, missing: pre,
            reason: `${code} requires ${pre}, which is not scheduled anywhere in the plan.`,
          });
        } else if (at >= s.semester) {
          violations.push({
            course: code, semester: s.semester, missing: pre,
            reason: `${code} is in semester ${s.semester} but its prerequisite ${pre} is in semester ${at} — prerequisites must come strictly earlier.`,
          });
        }
      }
    }
  }
  return violations;
}

/** Courses referenced by a plan that do not exist in the major map. */
export function unknownCourses(plan: PlanSemester[], idx: CourseIndex): string[] {
  const out = new Set<string>();
  for (const s of plan) {
    for (const c of s.courses) if (!idx.get(c.toUpperCase())) out.add(c.toUpperCase());
  }
  return [...out];
}

/** Validate a single hypothetical move (used by the what-if drag feature). */
export function validateMove(
  plan: PlanSemester[], idx: CourseIndex, code: string, toSemester: number,
): { ok: boolean; violations: Violation[] } {
  const target = code.toUpperCase();
  const next: PlanSemester[] = plan.map((s) => ({
    ...s,
    courses: s.courses.filter((c) => c.toUpperCase() !== target),
  }));
  const dest = next.find((s) => s.semester === toSemester);
  if (!dest) {
    return { ok: false, violations: [{ course: target, semester: toSemester, missing: "-", reason: `Semester ${toSemester} is not part of this plan.` }] };
  }
  dest.courses = [...dest.courses, target];
  const violations = validatePlan(next, idx);
  // Only surface violations actually caused by, or affecting, the moved course.
  const relevant = violations.filter((v) => v.course === target || v.missing === target);
  return { ok: relevant.length === 0, violations: relevant.length ? relevant : violations.slice(0, 3) };
}

/** Total credits per semester, for workload balance checks. */
export function creditLoad(plan: PlanSemester[], idx: CourseIndex): Record<number, number> {
  const out: Record<number, number> = {};
  for (const s of plan) {
    out[s.semester] = s.courses.reduce((n, c) => n + (idx.get(c.toUpperCase())?.credits ?? 3), 0);
  }
  return out;
}
