// ── Advisor handoff — the honest fallback ──────────────────────────────
// When no valid reroute exists, Compass stops pretending and writes the
// student a one-page advisor-prep note: what broke, which prereq chains it
// blocks, exactly which reroutes were attempted and why each failed, and
// the ONE question only a human advisor can answer.
//
// Every fact in the note is computed deterministically from the plan and
// the prereq graph first; the reasoner only turns those facts into prose.
// If the model is slow or degraded, the deterministic note ships instead —
// it is shorter, but it is never vague.

import { streamPipeline } from "@/lib/agents";
import { chatJSON, MODELS } from "@/lib/asuair";
import { loadData } from "@/lib/data";
import { buildCourseIndex, creditLoad, type CourseIndex } from "@/lib/prereq";
import { canPlace } from "@/lib/solver";
import { termFor } from "@/lib/demo";
import type {
  AdvisorHandoff,
  BreakReason,
  BrokenCourse,
  DisruptionEvent,
  FlowchartOutput,
  MajorMap,
  PlanSemester,
  QuizAnswers,
  RerouteResult,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// ── Break vocabulary ───────────────────────────────────────────────────

const REASON: Record<BreakReason, string> = {
  full: "the section is full — no seats and no waitlist movement",
  not_offered: "it is not offered",
  cancelled: "the section was cancelled",
  time_conflict: "it collides with another required course in the same block",
};

const REASON_SHORT: Record<BreakReason, string> = {
  full: "full",
  not_offered: "not offered",
  cancelled: "cancelled",
  time_conflict: "time conflict",
};

// ── Deterministic fact extraction ──────────────────────────────────────

function placementOf(plan: PlanSemester[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of plan) for (const c of s.courses) m.set(c.toUpperCase(), s.semester);
  return m;
}

function directDependents(code: string, idx: CourseIndex): string[] {
  const target = code.toUpperCase();
  const out: string[] = [];
  for (const [c, course] of idx) {
    if (course.prereqs.some((p) => p.toUpperCase() === target)) out.push(c);
  }
  return out;
}

/** Everything downstream of `code`, breadth-first, so the blast radius is real. */
function downstream(code: string, idx: CourseIndex): string[] {
  const seen = new Set<string>();
  const queue = [code.toUpperCase()];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const d of directDependents(cur, idx)) {
      if (!seen.has(d)) {
        seen.add(d);
        queue.push(d);
      }
    }
  }
  return [...seen];
}

function planWithout(plan: PlanSemester[], code: string): PlanSemester[] {
  const target = code.toUpperCase();
  return plan.map((s) => ({ ...s, courses: s.courses.filter((c) => c.toUpperCase() !== target) }));
}

/** Why `code` cannot legally sit in semester `sem`, in one clause. */
function whyNot(code: string, sem: number, plan: PlanSemester[], idx: CourseIndex): string {
  const target = code.toUpperCase();
  const course = idx.get(target);
  if (!course) return `${target} is not in the major map`;
  const at = placementOf(plan);
  for (const p of course.prereqs) {
    const pre = p.toUpperCase();
    const preAt = at.get(pre);
    if (preAt === undefined) return `its prerequisite ${pre} is not scheduled anywhere in the plan`;
    if (preAt >= sem) return `its prerequisite ${pre} sits in semester ${preAt}`;
  }
  for (const d of directDependents(target, idx)) {
    const dAt = at.get(d);
    if (dAt !== undefined && dAt <= sem) {
      return `${d} in semester ${dAt} (${termFor(dAt)}) requires ${target} first`;
    }
  }
  return `semester ${sem} is not part of this plan`;
}

interface BrokenFact {
  code: string;
  title: string;
  reason: string;
  reasonShort: string;
  blocks: Array<{ code: string; semester?: number }>;
  legalSemesters: number[];
  blockedBecause: string[]; // "semester 4 (Spring 2027): CSE310 ... requires CSE355 first"
}

function brokenFacts(
  broken: BrokenCourse[],
  plan: PlanSemester[],
  idx: CourseIndex,
  disruptedSemester: number,
): BrokenFact[] {
  const lastSemester = plan.length ? Math.max(...plan.map((s) => s.semester)) : disruptedSemester;
  const at = placementOf(plan);
  return broken.map((b) => {
    const code = b.code.toUpperCase();
    const course = idx.get(code);
    const trial = planWithout(plan, code);
    const legal: number[] = [];
    const blockedBecause: string[] = [];
    for (let sem = disruptedSemester + 1; sem <= lastSemester; sem++) {
      if (!trial.some((s) => s.semester === sem)) continue;
      if (canPlace(code, sem, trial, idx)) legal.push(sem);
      else blockedBecause.push(`semester ${sem} (${termFor(sem)}): ${whyNot(code, sem, trial, idx)}`);
    }
    return {
      code,
      title: course?.title ?? code,
      reason: REASON[b.status] ?? "it is unavailable",
      reasonShort: REASON_SHORT[b.status] ?? "unavailable",
      blocks: downstream(code, idx).map((d) => ({ code: d, semester: at.get(d) })),
      legalSemesters: legal,
      blockedBecause,
    };
  });
}

function chainLine(f: BrokenFact): string {
  if (!f.blocks.length) return `No other course in this major map lists ${f.code} as a prerequisite.`;
  const parts = f.blocks
    .slice(0, 5)
    .map((d) => (d.semester ? `${d.code} (semester ${d.semester}, ${termFor(d.semester)})` : d.code));
  return `${f.code} gates ${parts.join(", ")}.`;
}

/** Join validator clauses without run-ons or double punctuation. */
function joinClauses(parts: string[]): string {
  const cleaned = parts.map((p) => p.trim().replace(/[.;,\s]+$/, "")).filter(Boolean);
  return cleaned.length ? `${cleaned.join("; ")}.` : "";
}

function attemptLines(reroute: RerouteResult | null | undefined, facts: BrokenFact[]): string[] {
  const out: string[] = [];
  for (const p of reroute?.proposals ?? []) {
    const violations = (p.violations ?? []).filter(Boolean);
    const head = `${p.label} (graduation ${p.graduation_target})`;
    if (p.valid && !violations.length) {
      out.push(`${head}: validated clean, but was not adopted — ${p.tradeoff || "tradeoff not recorded"}.`);
    } else if (violations.length) {
      out.push(`${head}: rejected by the prerequisite validator — ${joinClauses(violations.slice(0, 2))}`);
    } else {
      out.push(`${head}: rejected — no move set kept every prerequisite strictly earlier${p.tradeoff ? ` (${p.tradeoff})` : ""}.`);
    }
  }
  // Deterministic placement search — every later semester was actually tested.
  for (const f of facts) {
    if (f.legalSemesters.length) {
      const slots = f.legalSemesters.map((s) => `semester ${s} (${termFor(s)})`).join(" or ");
      const blocker = f.blockedBecause[0] ? ` Every other later term is blocked — e.g. ${f.blockedBecause[0]}.` : "";
      out.push(`${f.code} was tested in every later semester; it is prerequisite-legal only in ${slots}.${blocker}`);
    } else if (f.blockedBecause.length) {
      out.push(
        `${f.code} was tested in every later semester and rejected in all of them — ${f.blockedBecause.slice(0, 2).join("; ")}.`,
      );
    } else {
      out.push(`${f.code} has no later semester left in this plan — the route ends before another offering of it.`);
    }
  }
  // If several broken courses collapse into the same single legal slot, say so —
  // that collision is usually the real reason nothing validated.
  const single = facts.filter((f) => f.legalSemesters.length === 1);
  if (single.length > 1 && new Set(single.map((f) => f.legalSemesters[0])).size === 1) {
    const slot = single[0].legalSemesters[0];
    out.push(
      `${single.map((f) => f.code).join(" and ")} both collapse into the same single legal slot, semester ${slot} (${termFor(slot)}) — one term cannot absorb both without an exception.`,
    );
  }
  return out;
}

function loadLine(plan: PlanSemester[], idx: CourseIndex, semester: number): string {
  const load = creditLoad(plan, idx)[semester];
  return typeof load === "number" ? `${load} credits` : "credit load unknown";
}

// ── The deterministic note (also the fallback) ─────────────────────────

interface Facts {
  studentName: string;
  major: string;
  term: string;
  semester: number;
  gradTarget: string;
  facts: BrokenFact[];
  attempts: string[];
  goal: string;
  priority: string;
  currentCourses: string[];
  loadText: string;
}

/** The exception that would actually unblock this specific failure. */
function remedyFor(b: BrokenFact): string {
  switch (b.reasonShort) {
    case "full":
      return "a departmental capacity override into the closed section";
    case "not offered":
      return "an approved substitution or a petition to satisfy the requirement another way";
    case "cancelled":
      return "a substitution, or confirmation that a replacement section will run";
    case "time conflict":
      return "a section swap or an approved schedule exception";
    default:
      return "a petition or substitution";
  }
}

function deterministicHandoff(f: Facts): AdvisorHandoff {
  const brokenSummary = f.facts.length
    ? f.facts.map((b) => `${b.code} (${b.reasonShort})`).join(" and ")
    : "Required coursework for that term";

  const situation =
    `${f.studentName} is scheduled for ${f.term} (semester ${f.semester}, ${f.loadText}) on a ${f.major} route targeting ${f.gradTarget}. ` +
    `${brokenSummary} fell through at registration, and no prerequisite-legal reroute holds ${f.gradTarget} without advisor authority. ` +
    `The blocked chains are listed below; the student is asking for a decision, not a plan.`;

  const what_broke = f.facts.map(
    (b) => `${b.code} — ${b.title}: in ${f.term}, ${b.reason}. ${chainLine(b)}`,
  );

  const openTarget = f.facts[0];
  const asks = f.facts.map((b) => `${b.code} via ${remedyFor(b)}`);
  const open_question = openTarget
    ? `Can ${f.term} be cleared — ${asks.join(", and ")}? ` +
      `Without that, ${openTarget.blocks[0]?.code ?? "the downstream sequence"} cannot be taken on schedule and ${f.gradTarget} slips a full term.`
    : `Which of the blocked requirements can be met by petition or substitution so ${f.gradTarget} holds?`;

  return {
    student_name: f.studentName,
    major: f.major,
    situation,
    what_broke,
    what_was_tried: f.attempts.length ? f.attempts : ["No reroute proposals were produced before escalation."],
    open_question,
    generated_at: new Date().toISOString(),
  };
}

// ── Model output hygiene ───────────────────────────────────────────────

const HEDGE = /\b(i'?m sorry|i am sorry|i apologize|unfortunately|as an ai|regrettably|sadly)\b/i;

function cleanLine(s: unknown): string {
  if (typeof s !== "string") return "";
  const t = s.replace(/\s+/g, " ").trim();
  if (!t || t.length < 12) return "";
  if (HEDGE.test(t)) return "";
  return t;
}

function cleanList(v: unknown, fallback: string[], max = 6): string[] {
  const arr = Array.isArray(v) ? v.map(cleanLine).filter(Boolean) : [];
  return arr.length ? arr.slice(0, max) : fallback;
}

interface ModelOut {
  situation?: string;
  what_broke?: string[];
  what_was_tried?: string[];
  open_question?: string;
}

// ── Route ──────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    quiz?: QuizAnswers;
    flowchart?: FlowchartOutput;
    disruption?: DisruptionEvent;
    reroute?: RerouteResult | null;
    majorMap?: MajorMap;
  };

  if (!body.quiz || !body.flowchart || !body.disruption) {
    return new Response(
      JSON.stringify({ error: "Missing quiz, flowchart, or disruption" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const quiz = body.quiz;
  const flowchart = body.flowchart;
  const disruption = body.disruption;
  const reroute = body.reroute ?? null;

  return streamPipeline(async (run) => {
    const map = body.majorMap ?? (await loadData()).map;
    const idx = buildCourseIndex(map);
    const plan = flowchart.plan ?? [];
    const facts = brokenFacts(disruption.broken ?? [], plan, idx, disruption.semester);
    const attempts = attemptLines(reroute, facts);

    const base: Facts = {
      studentName: quiz.name?.trim() || "This student",
      major: quiz.major || map.major,
      term: termFor(disruption.semester),
      semester: disruption.semester,
      gradTarget: flowchart.graduation_target,
      facts,
      attempts,
      goal: quiz.goal,
      priority: quiz.priority.replace(/_/g, " "),
      currentCourses: plan.find((s) => s.semester === disruption.semester)?.courses ?? [],
      loadText: loadLine(plan, idx, disruption.semester),
    };

    const deterministic = deterministicHandoff(base);

    const factSheet =
`STUDENT: ${base.studentName} — ${base.major}
GOAL: ${base.goal}. Stated priority: ${base.priority}.
TERM IN TROUBLE: ${base.term} (semester ${base.semester}, currently ${base.loadText}: ${base.currentCourses.join(", ") || "—"})
GRADUATION TARGET AT RISK: ${base.gradTarget}

BROKEN COURSES (verified against the registrar state):
${facts.map((f) => `- ${f.code} "${f.title}" — ${f.reason}.\n  Downstream: ${chainLine(f)}\n  Legal later semesters: ${f.legalSemesters.length ? f.legalSemesters.map((s) => `${s} (${termFor(s)})`).join(", ") : "NONE"}\n  Rejected placements: ${f.blockedBecause.slice(0, 3).join(" | ") || "n/a"}\n  Exception that would unblock it: ${remedyFor(f)}`).join("\n")}

REROUTES ATTEMPTED AND PLACEMENT SEARCH (verdicts come from a deterministic prerequisite validator, not a model):
${attempts.map((a) => `- ${a}`).join("\n") || "- none recorded"}
${reroute?.judge_rationale ? `\nJUDGE NOTE: ${reroute.judge_rationale}` : ""}`;

    const generated = await run
      .step("handoff", () =>
        chatJSON<ModelOut>({
          model: MODELS.reasoner,
          temperature: 0.3,
          maxTokens: 1200,
          messages: [
            {
              role: "system",
              content:
                "You write the advisor-prep note a sharp, well-organized student brings to an academic advising appointment. " +
                "Every sentence names real course codes, semesters, and terms from the fact sheet. " +
                "Forbidden: apologies, 'unfortunately', 'I'm sorry', hedging, praise, generic study advice, any mention of AI, " +
                "and any suggestion the advisor 'reach out' or 'consider options'. " +
                "Assume the advisor reads this in 30 seconds and must make one decision. Reply ONLY with JSON.",
            },
            {
              role: "user",
              content:
`${factSheet}

Write the handoff note. Use ONLY facts above — invent no courses, terms, or policies.

Return JSON:
{
  "situation": "<2-3 sentences: who this student is, which term broke, what the graduation target is, and that no prerequisite-legal reroute holds it>",
  "what_broke": ["<one line per broken course: code, why it broke, and the exact downstream courses and semesters it blocks>"],
  "what_was_tried": ["<one line per attempted reroute: what was tried and the precise reason it failed — name the violated prerequisite or the semester that slipped>"],
  "open_question": "<ONE question the advisor alone can answer: a substitution petition, a prerequisite override, a closed-section capacity exception, or a credit-overload approval. Name the exact course codes and term, and state the consequence if the answer is no.>"
}`,
            },
          ],
        }),
      )
      .catch(() => null);

    const situation = cleanLine(generated?.situation) || deterministic.situation;
    const question = cleanLine(generated?.open_question) || deterministic.open_question;

    const handoff: AdvisorHandoff = {
      student_name: deterministic.student_name,
      major: deterministic.major,
      situation,
      what_broke: cleanList(generated?.what_broke, deterministic.what_broke),
      what_was_tried: cleanList(generated?.what_was_tried, deterministic.what_was_tried),
      open_question: question,
      generated_at: new Date().toISOString(),
    };

    return { handoff };
  });
}
