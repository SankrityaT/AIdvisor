// ── Graduation Confidence — scoring ────────────────────────────────────
// Owned by the confidence agent. Pure and dependency-free: type-only
// imports, no React, no fetch, no npm packages. Safe to call on the server
// or the client, and easy to explain out loud to a judge.
//
// THE FORMULA IN ONE BREATH
//   Start at 94. Subtract for every course that broke (and for how much of
//   the route hangs off it). Subtract if the graduation date slipped.
//   Subtract for prerequisite violations. Subtract a little for terms that
//   are overloaded or stacked with hard courses. Then hand almost all of it
//   back the moment a validated reroute holds the graduation date.
//
//   score = 94
//         − 7                     if a disruption is still unresolved
//         − 16 × broken courses   (only while unresolved)
//         − 2  × downstream courses that depend on them   (max 6)
//         − 10                    if the graduation term slipped
//         − 8  × courses whose prerequisites are out of order (max 24)
//         − workload strain: 1.5/credit over 18, +2 per term with 3+ hard
//                            courses (max 6 combined)
//         − 3 (+1 per rerouted course, max 2)  once rerouted: residual risk
//         + 2                     if that reroute is prereq-clean and the
//                                 graduation date held
//
// Demo bands this produces: healthy 88–94, two courses broken 45–55,
// validated reroute that holds the date 85–92.

import type {
  BrokenCourse,
  ConfidenceSnapshot,
  Course,
  CourseSentiment,
  FlowchartOutput,
  MajorMap,
  PlanSemester,
} from "@/lib/types";

// ── Tunables (exported so the formula is inspectable, not magic) ───────
export const CONFIDENCE_BASE = 94;

export const CONFIDENCE_WEIGHTS = {
  unresolvedDisruption: 7,
  perBrokenCourse: 16,
  downstreamPerCourse: 2,
  downstreamPerBrokenCap: 3, // at most 3 dependents counted per broken course
  downstreamCap: 6,
  graduationSlip: 10,
  prereqViolation: 8,
  prereqViolationCap: 24,
  overCreditThreshold: 18,
  overCreditPerCredit: 1.5,
  hardCoursesPerTerm: 3,
  hardTermPenalty: 2,
  workloadCap: 6,
  rerouteResidual: 3,
  rerouteResidualPerBroken: 1,
  rerouteResidualCap: 2,
  validRerouteCredit: 2,
} as const;

// ── Public shapes ──────────────────────────────────────────────────────
export interface ConfidenceInput {
  flowchart: FlowchartOutput;
  majorMap: MajorMap;
  sentiment?: CourseSentiment[];
  broken?: BrokenCourse[]; // non-empty => disrupted
  rerouted?: boolean;
  originalGraduation?: string; // to detect slippage
}

/** One line of the arithmetic, so the score can be audited on stage. */
export interface ConfidenceFactor {
  key: string;
  delta: number; // negative = penalty, positive = credit, 0 = healthy note
  reason: string;
}

export interface ConfidenceDetail extends ConfidenceSnapshot {
  factors: ConfidenceFactor[];
}

// ── Small pure helpers ─────────────────────────────────────────────────
const up = (s: string) => String(s ?? "").trim().toUpperCase();
const clamp01to100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function listOf(codes: string[], max = 2): string {
  if (codes.length === 0) return "";
  if (codes.length === 1) return codes[0];
  if (codes.length <= max) {
    return `${codes.slice(0, -1).join(", ")} and ${codes[codes.length - 1]}`;
  }
  return `${codes.slice(0, max).join(", ")} and ${codes.length - max} more`;
}

const BREAK_PHRASE: Record<string, string> = {
  full: "is full",
  not_offered: "is not offered that term",
  cancelled: "was cancelled",
  time_conflict: "collides with another class",
};

function courseIndex(map: MajorMap): Map<string, Course> {
  const idx = new Map<string, Course>();
  for (const sem of map?.semesters ?? []) {
    for (const c of sem.courses ?? []) idx.set(up(c.code), c);
  }
  return idx;
}

/** prereq code -> courses that directly require it. */
function dependentsIndex(map: MajorMap): Map<string, string[]> {
  const deps = new Map<string, string[]>();
  for (const sem of map?.semesters ?? []) {
    for (const c of sem.courses ?? []) {
      for (const p of c.prereqs ?? []) {
        const key = up(p);
        const arr = deps.get(key);
        if (arr) arr.push(up(c.code));
        else deps.set(key, [up(c.code)]);
      }
    }
  }
  return deps;
}

/** Every scheduled course that transitively depends on `code`. */
function downstreamOf(
  code: string,
  deps: Map<string, string[]>,
  scheduled: Set<string>,
): string[] {
  const seen = new Set<string>([up(code)]);
  const out: string[] = [];
  const queue = [...(deps.get(up(code)) ?? [])];
  while (queue.length) {
    const next = queue.shift() as string;
    if (seen.has(next)) continue;
    seen.add(next);
    if (scheduled.has(next)) out.push(next);
    for (const child of deps.get(next) ?? []) if (!seen.has(child)) queue.push(child);
  }
  return out;
}

const MONTHS: Array<[string, number]> = [
  ["january", 1], ["february", 2], ["march", 3], ["april", 4], ["may", 5],
  ["june", 6], ["july", 7], ["august", 8], ["september", 9], ["october", 10],
  ["november", 11], ["december", 12],
];
const SEASONS: Array<[string, number]> = [
  ["spring", 5], ["summer", 8], ["fall", 12], ["autumn", 12], ["winter", 12],
];

/**
 * "December 2027" / "Fall 2027" / "Spring 2028" -> a sortable integer.
 * Returns null when the term cannot be parsed.
 */
export function termOrder(term?: string): number | null {
  if (!term) return null;
  const t = term.toLowerCase();
  const year = t.match(/(?:19|20)\d{2}/);
  if (!year) return null;
  let month = 0;
  for (const [name, n] of MONTHS) if (t.includes(name)) { month = n; break; }
  if (!month) for (const [name, n] of SEASONS) if (t.includes(name)) { month = n; break; }
  if (!month) month = 6;
  return Number(year[0]) * 12 + month;
}

function graduationSlipped(current: string, original?: string): boolean {
  if (!original) return false;
  const a = termOrder(original);
  const b = termOrder(current);
  if (a !== null && b !== null) return b > a;
  return up(original) !== up(current);
}

// ── Prerequisite check (recomputed locally so this file stays pure) ────
interface PrereqIssue { course: string; missing: string; semester: number; label: string }

function prereqIssues(
  plan: PlanSemester[],
  idx: Map<string, Course>,
  labelFor: (s: PlanSemester) => string,
): PrereqIssue[] {
  const placement = new Map<string, number>();
  for (const s of plan) for (const c of s.courses ?? []) placement.set(up(c), s.semester);

  const issues: PrereqIssue[] = [];
  for (const s of plan) {
    for (const raw of s.courses ?? []) {
      const code = up(raw);
      const course = idx.get(code);
      if (!course) continue; // unknown course is not a prereq violation
      for (const p of course.prereqs ?? []) {
        const pre = up(p);
        const at = placement.get(pre);
        if (at === undefined || at >= s.semester) {
          issues.push({ course: code, missing: pre, semester: s.semester, label: labelFor(s) });
        }
      }
    }
  }
  return issues;
}

// ── The scorer ─────────────────────────────────────────────────────────
export function computeConfidenceDetail(input: ConfidenceInput): ConfidenceDetail {
  const W = CONFIDENCE_WEIGHTS;
  const plan: PlanSemester[] = input.flowchart?.plan ?? [];
  const idx = courseIndex(input.majorMap);
  const deps = dependentsIndex(input.majorMap);
  const broken = (input.broken ?? []).filter((b) => b && b.code);
  const rerouted = Boolean(input.rerouted);
  const disrupted = broken.length > 0;

  const labelFor = (s: PlanSemester) =>
    s.term && s.term.trim() ? s.term.trim() : `semester ${s.semester}`;

  const scheduled = new Set<string>();
  const semesterOf = new Map<string, PlanSemester>();
  for (const s of plan) {
    for (const c of s.courses ?? []) {
      scheduled.add(up(c));
      if (!semesterOf.has(up(c))) semesterOf.set(up(c), s);
    }
  }

  const factors: ConfidenceFactor[] = [];

  // 1 ── prerequisite integrity
  const issues = prereqIssues(plan, idx, labelFor);
  const offenders = [...new Set(issues.map((i) => i.course))];
  const prereqPenalty = Math.min(
    offenders.length * W.prereqViolation,
    W.prereqViolationCap,
  );

  // 2 ── workload strain on terms that have not happened yet
  const hard = new Set(
    (input.sentiment ?? []).filter((s) => s.difficulty === "hard").map((s) => up(s.code)),
  );
  const loads = plan
    .filter((s) => s.status !== "done")
    .map((s) => {
      const codes = (s.courses ?? []).map(up);
      const credits = codes.reduce((n, c) => n + (idx.get(c)?.credits ?? 3), 0);
      const hardHere = codes.filter((c) => hard.has(c));
      const over = Math.max(0, credits - W.overCreditThreshold) * W.overCreditPerCredit;
      const stacked = hardHere.length >= W.hardCoursesPerTerm ? W.hardTermPenalty : 0;
      return { label: labelFor(s), credits, hard: hardHere, penalty: over + stacked, over, stacked };
    });
  const workloadPenalty = Math.min(
    loads.reduce((n, l) => n + l.penalty, 0),
    W.workloadCap,
  );
  const worstLoad = [...loads].sort(
    (a, b) => b.penalty - a.penalty || b.credits - a.credits,
  )[0];

  // 3 ── the disruption itself
  const rankedBreaks = broken
    .map((b) => {
      const code = up(b.code);
      const down = downstreamOf(code, deps, scheduled);
      const counted = Math.min(down.length, W.downstreamPerBrokenCap);
      return {
        code, status: b.status, down, counted,
        where: semesterOf.get(code),
        downPenalty: 0, // filled in below, greedily, under the global cap
      };
    })
    .sort((a, b) => b.down.length - a.down.length);

  // Spend the downstream budget on the most load-bearing breaks first, so the
  // per-break numbers shown in `factors` add up to the score exactly.
  let downstreamBudget: number = W.downstreamCap;
  for (const b of rankedBreaks) {
    b.downPenalty = Math.min(b.counted * W.downstreamPerCourse, downstreamBudget);
    downstreamBudget -= b.downPenalty;
  }
  const downstreamPenalty = W.downstreamCap - downstreamBudget;

  const unresolvedPenalty = disrupted && !rerouted ? W.unresolvedDisruption : 0;
  const brokenPenalty = disrupted && !rerouted ? broken.length * W.perBrokenCourse : 0;
  const liveDownstreamPenalty = disrupted && !rerouted ? downstreamPenalty : 0;

  // 4 ── did the finish line move?
  const currentGrad = input.flowchart?.graduation_target ?? "";
  const slipped = graduationSlipped(currentGrad, input.originalGraduation);
  const slipPenalty = slipped ? W.graduationSlip : 0;

  // 5 ── reroute residual + the credit for a reroute that actually holds
  const reroutePenalty = rerouted
    ? W.rerouteResidual +
      Math.min(broken.length * W.rerouteResidualPerBroken, W.rerouteResidualCap)
    : 0;
  const rerouteHolds = rerouted && offenders.length === 0 && !slipped;
  const rerouteCredit = rerouteHolds ? W.validRerouteCredit : 0;

  const score = clamp01to100(
    CONFIDENCE_BASE -
      prereqPenalty -
      workloadPenalty -
      unresolvedPenalty -
      brokenPenalty -
      liveDownstreamPenalty -
      slipPenalty -
      reroutePenalty +
      rerouteCredit,
  );

  // ── state ────────────────────────────────────────────────────────────
  let state: ConfidenceSnapshot["state"];
  if (rerouted) state = !slipped && score >= 70 ? "recovered" : "at_risk";
  else if (disrupted || score < 65) state = "at_risk";
  else state = "stable";

  // ── reasons, in narrative order, each tied to the real input ─────────
  const push = (key: string, delta: number, reason: string) =>
    factors.push({ key, delta, reason });

  if (rerouted) {
    push(
      "reroute_valid",
      rerouteCredit,
      rerouteHolds
        ? `Reroute validated — every prerequisite still resolves in order and graduation stays ${currentGrad || "on target"}.`
        : `Reroute is in place, but it still needs cleanup before the route is fully trusted.`,
    );
    if (slipped) {
      push(
        "slip",
        -slipPenalty,
        `Graduation moves from ${input.originalGraduation} to ${currentGrad} on the new route.`,
      );
    }
    if (rankedBreaks.length) {
      const codes = rankedBreaks.map((b) => b.code);
      push(
        "residual",
        -reroutePenalty,
        `${codes.length} rerouted ${codes.length === 1 ? "stop" : "stops"} (${listOf(codes, 3)}) still carry some re-registration risk.`,
      );
    }
  } else if (disrupted) {
    for (const b of rankedBreaks.slice(0, 3)) {
      const phrase = BREAK_PHRASE[b.status] ?? "is unavailable";
      if (b.down.length > 0) {
        push(
          `broken_${b.code}`,
          -(W.perBrokenCourse + b.downPenalty),
          `${b.code} ${phrase} — ${b.down.length} downstream ${b.down.length === 1 ? "course depends" : "courses depend"} on it (${listOf(b.down)}).`,
        );
      } else {
        push(
          `broken_${b.code}`,
          -W.perBrokenCourse,
          b.where
            ? `${b.code} ${phrase} — it is a stop in ${b.where.term && b.where.term.trim() ? b.where.term.trim() : `semester ${b.where.semester}`} with no replacement yet.`
            : `${b.code} ${phrase} and has no replacement yet.`,
        );
      }
    }
    if (slipped) {
      push(
        "slip",
        -slipPenalty,
        `Graduation slips from ${input.originalGraduation} to ${currentGrad}.`,
      );
    }
    push(
      "unresolved",
      -unresolvedPenalty,
      `No approved reroute yet — ${broken.length} ${broken.length === 1 ? "stop is" : "stops are"} still blocked on the route.`,
    );
  } else if (scheduled.size === 0) {
    push("empty", 0, "No route built yet — answer the quiz to generate a plan.");
  } else {
    push(
      "prereq_clean",
      0,
      `All ${scheduled.size} scheduled ${scheduled.size === 1 ? "course clears its prerequisites" : "courses clear their prerequisites"} in order.`,
    );
    push(
      "on_target",
      0,
      currentGrad
        ? `Graduation target ${currentGrad} is intact across ${plan.length} ${plan.length === 1 ? "semester" : "semesters"}.`
        : `Every stop on the route is currently open.`,
    );
  }

  // shared tail: structural problems always get said out loud
  if (offenders.length > 0) {
    const first = issues[0];
    push(
      "prereq",
      -prereqPenalty,
      offenders.length === 1
        ? `${first.course} sits in ${first.label} but its prerequisite ${first.missing} is not completed earlier.`
        : `${offenders.length} courses are out of prerequisite order, starting with ${first.course} in ${first.label} (needs ${first.missing}).`,
    );
  }

  if (workloadPenalty > 0 && worstLoad) {
    if (worstLoad.over > 0) {
      push(
        "workload",
        -workloadPenalty,
        `${worstLoad.label} carries ${worstLoad.credits} credits — above a sustainable 18-credit term.`,
      );
    } else {
      push(
        "workload",
        -workloadPenalty,
        `${worstLoad.label} stacks ${worstLoad.hard.length} hard courses (${listOf(worstLoad.hard)}).`,
      );
    }
  } else if (state === "stable" && worstLoad) {
    push(
      "balanced",
      0,
      `Heaviest term is ${worstLoad.label} at ${worstLoad.credits} credits — a manageable load.`,
    );
  }

  const reasons = factors.map((f) => f.reason).slice(0, 5);
  return { score, reasons, state, factors };
}

/**
 * Graduation Confidence, 0–100, with the two or three sentences that
 * explain it. Pure — same input always gives the same snapshot.
 */
export function computeConfidence(input: ConfidenceInput): ConfidenceSnapshot {
  const { score, reasons, state } = computeConfidenceDetail(input);
  return { score, reasons, state };
}

export default computeConfidence;
