// ── Deterministic plan solver — the safety net under the AI ────────────
// SHARED. Read-only to feature agents.
//
// Every AI proposal is validated against lib/prereq.ts. If the models are
// slow, degraded, or produce something invalid, these functions still yield
// a correct plan so the on-stage demo cannot faceplant.

import type { BrokenCourse, FlowchartOutput, MajorMap, PlanSemester } from "./types";
import { buildCourseIndex, creditLoad, validatePlan, type CourseIndex } from "./prereq";
import { graduationFor, statusFor, termFor } from "./demo";

/** Courses that list `code` as a prerequisite. */
function dependents(code: string, idx: CourseIndex): string[] {
  const target = code.toUpperCase();
  const out: string[] = [];
  for (const [c, course] of idx) {
    if (course.prereqs.some((p) => p.toUpperCase() === target)) out.push(c);
  }
  return out;
}

function placement(plan: PlanSemester[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of plan) for (const c of s.courses) m.set(c.toUpperCase(), s.semester);
  return m;
}

/** Can `code` legally sit in semester `sem`, given everything else in `plan`? */
export function canPlace(code: string, sem: number, plan: PlanSemester[], idx: CourseIndex): boolean {
  const target = code.toUpperCase();
  const course = idx.get(target);
  if (!course) return false;
  const at = placement(plan);
  for (const p of course.prereqs) {
    const pre = at.get(p.toUpperCase());
    if (pre === undefined || pre >= sem) return false;
  }
  for (const d of dependents(target, idx)) {
    const dAt = at.get(d);
    if (dAt !== undefined && dAt <= sem) return false;
  }
  return true;
}

/** The major map's own ordering — valid by construction. */
export function baselinePlan(map: MajorMap): FlowchartOutput {
  const plan: PlanSemester[] = map.semesters.map((s) => ({
    semester: s.semester,
    term: termFor(s.semester),
    courses: s.courses.map((c) => c.code.toUpperCase()),
    status: statusFor(s.semester),
  }));
  return {
    graduation_target: graduationFor(map.total_semesters),
    plan,
    rationale: "Standard ASU major-map sequence.",
  };
}

export interface RerouteSolution {
  plan: PlanSemester[];
  moves: string[];        // human-readable description of each change
  graduation: string;
}

/**
 * Repair a plan after courses become unavailable, without pushing graduation.
 * Strategy: lift broken courses to the earliest legal later semester, then
 * pull eligible later courses forward to refill the disrupted semester.
 */
export function deterministicReroute(
  plan: PlanSemester[],
  map: MajorMap,
  broken: BrokenCourse[],
  disruptedSemester: number,
): RerouteSolution | null {
  const idx = buildCourseIndex(map);
  const lastSemester = Math.max(...plan.map((s) => s.semester));
  const next: PlanSemester[] = plan.map((s) => ({ ...s, courses: [...s.courses] }));
  const moves: string[] = [];
  const brokenCodes = broken.map((b) => b.code.toUpperCase());

  const semOf = (n: number) => next.find((s) => s.semester === n);

  // 1. Remove every broken course from the disrupted semester.
  const src = semOf(disruptedSemester);
  if (!src) return null;
  src.courses = src.courses.filter((c) => !brokenCodes.includes(c.toUpperCase()));

  // 2. Re-place each broken course in the earliest legal later semester.
  for (const b of broken) {
    const code = b.code.toUpperCase();
    let placed = false;
    for (let sem = disruptedSemester + 1; sem <= lastSemester; sem++) {
      const target = semOf(sem);
      if (!target) continue;
      if (canPlace(code, sem, next, idx)) {
        target.courses.push(code);
        moves.push(
          `${code} was ${b.status === "full" ? "full" : "not offered"} — moved to semester ${sem} (${termFor(sem)}).`,
        );
        placed = true;
        break;
      }
    }
    if (!placed) return null; // genuine dead end
  }

  // 3. Refill the disrupted semester by pulling forward eligible later courses,
  //    preferring the nearest semester so we don't hollow out the back half.
  const targetSize = (plan.find((s) => s.semester === disruptedSemester)?.courses.length ?? 3);
  for (let guard = 0; guard < 8 && (semOf(disruptedSemester)?.courses.length ?? 0) < targetSize; guard++) {
    let moved = false;
    for (let sem = disruptedSemester + 1; sem <= lastSemester && !moved; sem++) {
      const donor = semOf(sem);
      if (!donor || donor.courses.length <= 1) continue;
      for (const cand of [...donor.courses]) {
        const code = cand.toUpperCase();
        if (brokenCodes.includes(code)) continue;
        const trial: PlanSemester[] = next.map((s) => ({
          ...s,
          courses: s.courses.filter((c) => c.toUpperCase() !== code),
        }));
        trial.find((s) => s.semester === disruptedSemester)!.courses.push(code);
        if (validatePlan(trial, idx).length === 0) {
          donor.courses = donor.courses.filter((c) => c.toUpperCase() !== code);
          semOf(disruptedSemester)!.courses.push(code);
          moves.push(`${code} pulled forward from semester ${sem} to keep semester ${disruptedSemester} full.`);
          moved = true;
          break;
        }
      }
    }
    if (!moved) break;
  }

  // 4. Drop any semester left empty at the tail, then confirm graduation holds.
  while (next.length && next[next.length - 1].courses.length === 0) next.pop();
  const violations = validatePlan(next, idx);
  if (violations.length) return null;

  const newLast = Math.max(...next.map((s) => s.semester));
  if (newLast > lastSemester) return null; // graduation slipped — not acceptable

  return { plan: next, moves, graduation: graduationFor(newLast) };
}

export interface Move { code: string; to_semester: number }

/**
 * Apply a set of AI-proposed course moves to a plan, then validate.
 * Returns null if the result violates the prereq graph or slips graduation.
 */
export function applyMoves(
  plan: PlanSemester[], map: MajorMap, moves: Move[], pullForward: string[] = [],
): PlanSemester[] | null {
  const idx = buildCourseIndex(map);
  const lastSemester = Math.max(...plan.map((s) => s.semester));
  const next: PlanSemester[] = plan.map((s) => ({ ...s, courses: [...s.courses] }));

  for (const mv of moves) {
    const code = mv.code?.toUpperCase();
    if (!code || !idx.has(code)) return null;
    if (!Number.isInteger(mv.to_semester) || mv.to_semester < 1 || mv.to_semester > lastSemester) return null;
    for (const s of next) s.courses = s.courses.filter((c) => c.toUpperCase() !== code);
    const dest = next.find((s) => s.semester === mv.to_semester);
    if (!dest) return null;
    dest.courses.push(code);
  }

  for (const raw of pullForward) {
    const code = raw?.toUpperCase();
    if (!code || !idx.has(code)) continue;
    if (moves.some((m) => m.code?.toUpperCase() === code)) continue;
    const at = next.find((s) => s.courses.some((c) => c.toUpperCase() === code));
    if (!at) continue;
    for (let sem = 1; sem < at.semester; sem++) {
      const trial: PlanSemester[] = next.map((s) => ({
        ...s, courses: s.courses.filter((c) => c.toUpperCase() !== code),
      }));
      trial.find((s) => s.semester === sem)?.courses.push(code);
      if (validatePlan(trial, idx).length === 0) {
        at.courses = at.courses.filter((c) => c.toUpperCase() !== code);
        next.find((s) => s.semester === sem)!.courses.push(code);
        break;
      }
    }
  }

  while (next.length && next[next.length - 1].courses.length === 0) next.pop();
  if (validatePlan(next, idx).length) return null;
  if (Math.max(...next.map((s) => s.semester)) > lastSemester) return null;
  return next;
}

export type RerouteStrategy = "earliest" | "lightest" | "career";

/**
 * Persona-flavoured deterministic reroutes. Three valid plans that genuinely
 * differ in strategy, so the debate shows real alternatives even when a model
 * is slow or all three converge on the same obvious answer.
 *
 *  earliest — push broken courses to the soonest legal slot and refill the gap
 *             hard, keeping momentum toward graduation.
 *  lightest — park broken courses in the least-loaded legal semester and refill
 *             sparingly, so the disrupted term gets easier.
 *  career   — soonest legal slot, but refill by pulling forward the courses that
 *             matter most for the student's stated goal.
 */
export function strategicReroute(
  plan: PlanSemester[],
  map: MajorMap,
  broken: BrokenCourse[],
  disruptedSemester: number,
  strategy: RerouteStrategy,
  prefer: string[] = [],
): RerouteSolution | null {
  const idx = buildCourseIndex(map);
  const lastSemester = Math.max(...plan.map((s) => s.semester));
  const next: PlanSemester[] = plan.map((s) => ({ ...s, courses: [...s.courses] }));
  const moves: string[] = [];
  const brokenCodes = broken.map((b) => b.code.toUpperCase());
  const semOf = (n: number) => next.find((s) => s.semester === n);

  const src = semOf(disruptedSemester);
  if (!src) return null;
  const originalSize = src.courses.length;
  src.courses = src.courses.filter((c) => !brokenCodes.includes(c.toUpperCase()));

  for (const b of broken) {
    const code = b.code.toUpperCase();
    const legal: number[] = [];
    for (let sem = disruptedSemester + 1; sem <= lastSemester; sem++) {
      if (semOf(sem) && canPlace(code, sem, next, idx)) legal.push(sem);
    }
    if (!legal.length) return null;
    const pick =
      strategy === "lightest"
        ? legal.reduce((best, sem) => {
            const load = (s: number) => creditLoad(next, idx)[s] ?? 0;
            return load(sem) < load(best) ? sem : best;
          }, legal[0])
        : legal[0];
    semOf(pick)!.courses.push(code);
    moves.push(
      `${code} was ${b.status === "full" ? "full" : "not offered"} — moved to semester ${pick} (${termFor(pick)}).`,
    );
  }

  // Refill the disrupted semester according to the persona's appetite.
  const targetSize = strategy === "lightest" ? Math.max(1, originalSize - 1) : originalSize;
  for (let guard = 0; guard < 8 && (semOf(disruptedSemester)?.courses.length ?? 0) < targetSize; guard++) {
    let moved = false;
    const donors: Array<{ sem: number; code: string }> = [];
    for (let sem = disruptedSemester + 1; sem <= lastSemester; sem++) {
      const donor = semOf(sem);
      if (!donor || donor.courses.length <= 1) continue;
      for (const c of donor.courses) {
        if (!brokenCodes.includes(c.toUpperCase())) donors.push({ sem, code: c.toUpperCase() });
      }
    }
    if (strategy === "career" && prefer.length) {
      const rank = (code: string) => {
        const i = prefer.findIndex((p) => p.toUpperCase() === code);
        return i === -1 ? 999 : i;
      };
      donors.sort((a, b) => rank(a.code) - rank(b.code) || a.sem - b.sem);
    } else {
      donors.sort((a, b) => a.sem - b.sem);
    }
    for (const d of donors) {
      const trial: PlanSemester[] = next.map((s) => ({
        ...s, courses: s.courses.filter((c) => c.toUpperCase() !== d.code),
      }));
      trial.find((s) => s.semester === disruptedSemester)!.courses.push(d.code);
      if (validatePlan(trial, idx).length === 0) {
        semOf(d.sem)!.courses = semOf(d.sem)!.courses.filter((c) => c.toUpperCase() !== d.code);
        semOf(disruptedSemester)!.courses.push(d.code);
        moves.push(`${d.code} pulled forward from semester ${d.sem}.`);
        moved = true;
        break;
      }
    }
    if (!moved) break;
  }

  while (next.length && next[next.length - 1].courses.length === 0) next.pop();
  if (validatePlan(next, idx).length) return null;
  const newLast = Math.max(...next.map((s) => s.semester));
  if (newLast > lastSemester) return null;
  return { plan: next, moves, graduation: graduationFor(newLast) };
}

/** Stable signature for comparing two plans. */
export function planSignature(plan: PlanSemester[]): string {
  return plan
    .map((s) => `${s.semester}:${[...s.courses].map((c) => c.toUpperCase()).sort().join(",")}`)
    .join("|");
}
