// ── Route map geometry + diff model ───────────────────────────────────
// Pure, dependency-free helpers. Deterministic pixel geometry means the
// SVG route line and the absolutely-positioned HTML stops always agree
// without any DOM measurement.

import type {
  BrokenCourse,
  Course,
  CourseRelevance,
  CourseSentiment,
  MajorMap,
  PlanSemester,
  SemesterStatus,
} from "@/lib/types";

/** Fixed pixel grid the line and the stops are both laid out on. */
export const LAYOUT = {
  PAD_X: 56, // gap before the first station
  PITCH: 250, // horizontal distance between station centres
  LINE_Y: 96, // y of the main route line
  NODE_R: 13, // station node radius
  CHIP_OFFSET_X: 22, // gap from the drop spine to the chip's left edge
  CHIPS_TOP: 154, // y of the first stop's top edge
  CHIP_W: 210,
  CHIP_H: 60,
  CHIP_GAP: 10,
  TERMINUS_W: 262,
  BOTTOM_PAD: 40,
  MIN_ROWS: 3,
} as const;

export type StopKind = "planned" | "added" | "removed";

export interface StopModel {
  /** Course code as it appears in the plan. */
  code: string;
  /** Title from the major map, or null when the code is unknown. */
  title: string | null;
  credits: number | null;
  prereqs: string[];
  kind: StopKind;
  broken: BrokenCourse | null;
  sentiment: CourseSentiment | null;
  relevance: string | null;
  /** Row index within this station's stop stack. */
  row: number;
  /** Absolute y of the stop's top edge on the board. */
  y: number;
}

export interface StationModel {
  semester: number;
  term?: string;
  status: SemesterStatus;
  /** Absolute x of the station node centre. */
  x: number;
  stops: StopModel[];
  /** Credits for the courses actually in the current plan. */
  credits: number;
  /** True when this semester gained or lost a course vs. previousPlan. */
  changed: boolean;
  /** True when any stop here is flagged broken. */
  hasBreak: boolean;
}

export interface BoardModel {
  stations: StationModel[];
  /** x of the terminus node. */
  terminusX: number;
  width: number;
  height: number;
  totalCredits: number;
  changedCount: number;
}

/** "cse 355" / "CSE355" -> "CSE355" so lookups never miss on formatting. */
export function normCode(code: string): string {
  return code.replace(/\s+/g, "").toUpperCase();
}

/** Flatten a major map into a code -> Course index. */
export function indexCourses(majorMap: MajorMap | undefined): Map<string, Course> {
  const index = new Map<string, Course>();
  for (const semester of majorMap?.semesters ?? []) {
    for (const course of semester.courses ?? []) {
      if (course?.code) index.set(normCode(course.code), course);
    }
  }
  return index;
}

function toLookup<T extends { code: string }>(rows: T[] | undefined): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows ?? []) {
    if (row?.code) map.set(normCode(row.code), row);
  }
  return map;
}

interface MergedStop {
  code: string;
  kind: StopKind;
}

/**
 * Merge a semester's previous course list into its current one so a reroute
 * reads as an in-place swap: a dropped course stays where it was (struck
 * through) and its replacement lands directly beneath it.
 */
export function mergeSemesterStops(
  current: string[],
  previous: string[] | null,
): MergedStop[] {
  const asPlanned = (codes: string[]): MergedStop[] =>
    codes.map((code) => ({ code, kind: "planned" as const }));

  if (!previous) return asPlanned(current);

  const currentByNorm = new Map(current.map((code) => [normCode(code), code]));
  const previousNorms = new Set(previous.map(normCode));

  const dropped = previous.filter((code) => !currentByNorm.has(normCode(code)));
  const gained = current.filter((code) => !previousNorms.has(normCode(code)));

  // Identical semester -> no diff at all.
  if (dropped.length === 0 && gained.length === 0) return asPlanned(current);

  const out: MergedStop[] = [];
  const queue = [...gained];

  for (const code of previous) {
    const kept = currentByNorm.get(normCode(code));
    if (kept !== undefined) {
      out.push({ code: kept, kind: "planned" });
      continue;
    }
    out.push({ code, kind: "removed" });
    const replacement = queue.shift();
    if (replacement !== undefined) out.push({ code: replacement, kind: "added" });
  }

  for (const code of queue) out.push({ code, kind: "added" });
  return out;
}

export interface BuildBoardInput {
  plan: PlanSemester[];
  majorMap?: MajorMap;
  sentiment?: CourseSentiment[];
  previousPlan?: PlanSemester[];
  broken?: BrokenCourse[];
  relevance?: CourseRelevance[];
}

/** Turn props into laid-out stations + stops with absolute pixel positions. */
export function buildBoard({
  plan,
  majorMap,
  sentiment,
  previousPlan,
  broken,
  relevance,
}: BuildBoardInput): BoardModel {
  const courses = indexCourses(majorMap);
  const sentimentBy = toLookup(sentiment);
  const brokenBy = toLookup(broken);
  const relevanceBy = toLookup(relevance);

  const previousBySemester = new Map<number, string[]>();
  for (const semester of previousPlan ?? []) {
    previousBySemester.set(semester.semester, semester.courses ?? []);
  }
  const hasPrevious = (previousPlan?.length ?? 0) > 0;

  const rowPitch = LAYOUT.CHIP_H + LAYOUT.CHIP_GAP;
  let maxRows: number = LAYOUT.MIN_ROWS;
  let totalCredits = 0;
  let changedCount = 0;

  const stations: StationModel[] = plan.map((semester, i) => {
    const currentCodes = semester.courses ?? [];
    const previousCodes = hasPrevious
      ? (previousBySemester.get(semester.semester) ?? null)
      : null;
    const merged = mergeSemesterStops(currentCodes, previousCodes);

    let changed = false;
    let hasBreak = false;
    let credits = 0;

    const stops: StopModel[] = merged.map((entry, row) => {
      const key = normCode(entry.code);
      const course = courses.get(key) ?? null;
      // A course the reroute *moved into* this semester is not broken here —
      // rescheduling it is precisely how the break got solved. Only stops
      // still sitting where they broke (or dropped from there) stay coral.
      const brokenEntry = entry.kind === "added" ? null : (brokenBy.get(key) ?? null);
      if (entry.kind !== "planned") changed = true;
      if (brokenEntry) hasBreak = true;
      if (entry.kind !== "removed" && course) credits += course.credits ?? 0;

      return {
        code: entry.code,
        title: course?.title ?? null,
        credits: course?.credits ?? null,
        prereqs: course?.prereqs ?? [],
        kind: entry.kind,
        broken: brokenEntry,
        sentiment: sentimentBy.get(key) ?? null,
        relevance: relevanceBy.get(key)?.why ?? null,
        row,
        y: LAYOUT.CHIPS_TOP + row * rowPitch,
      };
    });

    if (stops.length > maxRows) maxRows = stops.length;
    if (changed) changedCount += 1;
    totalCredits += credits;

    return {
      semester: semester.semester,
      term: semester.term,
      status: semester.status,
      x: LAYOUT.PAD_X + i * LAYOUT.PITCH,
      stops,
      credits,
      changed,
      hasBreak,
    };
  });

  const terminusX = LAYOUT.PAD_X + stations.length * LAYOUT.PITCH;
  const stackHeight = LAYOUT.CHIPS_TOP + maxRows * rowPitch + LAYOUT.BOTTOM_PAD;
  // The terminus card needs headroom even when semesters are sparse.
  const height = Math.max(stackHeight, LAYOUT.CHIPS_TOP + 168 + LAYOUT.BOTTOM_PAD);

  return {
    stations,
    terminusX,
    width: terminusX + LAYOUT.TERMINUS_W + LAYOUT.PAD_X,
    height,
    totalCredits,
    changedCount,
  };
}

/**
 * A segment is "rerouted" when either of the semesters it connects changed,
 * so the teal path visibly runs *through* the disrupted stretch of the line.
 */
export function segmentIsRerouted(
  stations: StationModel[],
  fromIndex: number,
): boolean {
  const a = stations[fromIndex];
  const b = stations[fromIndex + 1];
  return Boolean(a?.changed) || Boolean(b?.changed);
}

export function breakLabel(status: BrokenCourse["status"]): string {
  switch (status) {
    case "full":
      return "FULL";
    case "not_offered":
      return "NOT OFFERED";
    case "cancelled":
      return "CANCELLED";
    case "time_conflict":
      return "TIME CONFLICT";
    default:
      return "UNAVAILABLE";
  }
}
