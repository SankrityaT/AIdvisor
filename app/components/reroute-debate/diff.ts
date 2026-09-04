// ── Plan diffing for the reroute debate ────────────────────────────────
// Pure, client-safe helpers. Only imports type-only / deterministic modules
// (lib/types, lib/prereq, lib/demo) — never lib/asuair or lib/pipeline.

import type { MajorMap, PlanSemester } from "@/lib/types";
import { buildCourseIndex, type CourseIndex } from "@/lib/prereq";
import { termFor } from "@/lib/demo";

export const norm = (code: unknown): string => String(code ?? "").trim().toUpperCase();

/** Never throws, even if the major map arrives malformed mid-demo. */
export function safeIndex(map: MajorMap | undefined | null): CourseIndex {
  try {
    if (!map || !Array.isArray(map.semesters)) return new Map();
    return buildCourseIndex(map);
  } catch {
    return new Map();
  }
}

export interface SemesterDiff {
  semester: number;
  term: string;
  before: string[];
  after: string[];
  removed: string[];
  added: string[];
  creditsBefore: number;
  creditsAfter: number;
  changed: boolean;
}

function codesBySemester(plan: PlanSemester[] | undefined): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const s of plan ?? []) {
    if (!s || typeof s.semester !== "number") continue;
    out.set(s.semester, (s.courses ?? []).map(norm).filter(Boolean));
  }
  return out;
}

function credits(codes: string[], idx: CourseIndex): number {
  return codes.reduce((sum, c) => sum + (idx.get(c)?.credits ?? 0), 0);
}

export function termOf(plan: PlanSemester[] | undefined, semester: number): string {
  const hit = (plan ?? []).find((s) => s?.semester === semester);
  return hit?.term ?? termFor(semester);
}

/**
 * Per-semester diff of `next` against `prev`. Returns every semester that
 * appears in either plan, in order, with `changed` flagged.
 */
export function diffPlans(
  prev: PlanSemester[] | undefined,
  next: PlanSemester[] | undefined,
  idx: CourseIndex,
): SemesterDiff[] {
  const a = codesBySemester(prev);
  const b = codesBySemester(next);
  const semesters = [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => x - y);

  return semesters.map((semester) => {
    const before = a.get(semester) ?? [];
    const after = b.get(semester) ?? [];
    const removed = before.filter((c) => !after.includes(c));
    const added = after.filter((c) => !before.includes(c));
    return {
      semester,
      term: termOf(next, semester) || termOf(prev, semester),
      before,
      after,
      removed,
      added,
      creditsBefore: credits(before, idx),
      creditsAfter: credits(after, idx),
      changed: removed.length > 0 || added.length > 0,
    };
  });
}

/** Which semester a course ended up in, or null if it left the plan entirely. */
export function landingSemester(code: string, plan: PlanSemester[] | undefined): number | null {
  const want = norm(code);
  for (const s of plan ?? []) {
    if ((s?.courses ?? []).some((c) => norm(c) === want)) return s.semester;
  }
  return null;
}

/** Total courses moved between semesters, for a one-glance "size of change". */
export function moveCount(diffs: SemesterDiff[]): number {
  return diffs.reduce((n, d) => n + d.added.length, 0);
}
