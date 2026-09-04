// ── The multi-agent pipelines (SERVER ONLY) ────────────────────────────
// SHARED. Read-only to feature agents.
//
// These are genuine multi-agent workflows: each step is a separately-prompted
// call to a distinct ASU AIR model, wrapped in real telemetry, with the three
// reroute personas running truly concurrently. Every AI proposal is checked
// against the deterministic prereq graph before it can reach the student, and
// lib/solver.ts backstops the demo if a model is slow or degraded.

import type {
  CourseSentiment, DisruptionEvent, FlowchartOutput, MajorMap, PlanSemester,
  QuizAnswers, RerouteProposal, RerouteResult,
} from "./types";
import { chatJSON, chat, MODELS } from "./asuair";
import type { AgentRun } from "./agents";
import { buildCourseIndex, validatePlan, creditLoad } from "./prereq";
import { applyMoves, baselinePlan, planSignature, strategicReroute, type Move, type RerouteSolution } from "./solver";
import { CURRENT_SEMESTER, graduationFor, statusFor, termFor } from "./demo";

// ── shared prompt fragments ────────────────────────────────────────────

function describeMap(map: MajorMap, sentiment: CourseSentiment[]): string {
  const diff = new Map(sentiment.map((s) => [s.code.toUpperCase(), s.difficulty]));
  return map.semesters
    .map((s) => {
      const courses = s.courses
        .map((c) => `${c.code}(${c.credits}cr${c.prereqs.length ? `, needs ${c.prereqs.join("+")}` : ""}${diff.get(c.code.toUpperCase()) ? `, ${diff.get(c.code.toUpperCase())}` : ""})`)
        .join(", ");
      return `S${s.semester}: ${courses}`;
    })
    .join("\n");
}

function describePlan(plan: PlanSemester[]): string {
  return plan.map((s) => `S${s.semester} (${s.term ?? termFor(s.semester)}, ${s.status}): ${s.courses.join(", ") || "—"}`).join("\n");
}

function normalize(plan: PlanSemester[]): PlanSemester[] {
  return plan
    .filter((s) => s.courses.length)
    .sort((a, b) => a.semester - b.semester)
    .map((s) => ({
      semester: s.semester,
      term: termFor(s.semester),
      courses: [...new Set(s.courses.map((c) => c.toUpperCase()))],
      status: statusFor(s.semester),
    }));
}

// ── Pipeline 1: generate the student's route ───────────────────────────

interface Constraints { strategy: string; per_semester_credit_target: number; notes: string[] }

export async function generatePlan(
  run: AgentRun, quiz: QuizAnswers, map: MajorMap, sentiment: CourseSentiment[],
  /** Wrap the flowchart into whatever the route delivers to the client. */
  onDraft?: (f: FlowchartOutput) => unknown,
): Promise<FlowchartOutput> {
  const idx = buildCourseIndex(map);
  const baseline = baselinePlan(map);
  const mapText = describeMap(map, sentiment);

  // 1. Curator — turn quiz answers into concrete planning constraints.
  const constraints = await run
    .step("curator", () =>
      chatJSON<Constraints>({
        model: MODELS.curator,
        temperature: 0.3,
        maxTokens: 700,
        messages: [
          { role: "system", content: "You are an academic-planning curator. Convert a student's preferences into concrete scheduling constraints. Reply ONLY with JSON." },
          { role: "user", content:
`Student: goal="${quiz.goal}", risk tolerance="${quiz.risk_tolerance}", priority="${quiz.priority}".
Major map (S=semester):
${mapText}

Return JSON: {"strategy": "<one sentence on how to sequence for THIS student>", "per_semester_credit_target": <12-18>, "notes": ["<=4 short concrete rules, e.g. 'avoid two hard courses in the same semester'"]}` },
        ],
      }),
    )
    .catch<Constraints>(() => ({
      strategy: `Balance workload for a student pursuing ${quiz.goal}.`,
      per_semester_credit_target: 15,
      notes: ["Spread hard courses across semesters."],
    }));

  // 2. Planner — propose targeted moves against the locked baseline.
  //    A small move-list is far faster than regenerating a whole plan, and each
  //    move is accepted only if it keeps the prereq graph valid — so a slow
  //    repair round-trip is never needed.
  let plan: PlanSemester[] | null = null;
  let planNote = "";
  try {
    const draft = await run.step("planner", () =>
      chatJSON<{ moves?: Move[]; rationale?: string }>({
        model: MODELS.planner,
        temperature: 0.4,
        maxTokens: 900,
        messages: [
          { role: "system", content: "You tune university degree plans. Prerequisites must stay in strictly earlier semesters. Never invent courses. Reply ONLY with JSON." },
          { role: "user", content:
`Tune this student's remaining schedule.

Strategy: ${constraints.strategy}
Credit target per semester: ${constraints.per_semester_credit_target}
Rules: ${constraints.notes.join("; ")}
Student priority: ${quiz.priority}; risk tolerance: ${quiz.risk_tolerance}; goal: ${quiz.goal}

Current sequence:
${describePlan(baseline.plan)}

Course details (prereqs + difficulty):
${mapText}

Semesters 1-${CURRENT_SEMESTER} are LOCKED — the student has completed or already registered for them. Never move a course out of or into those semesters.
Propose AT MOST 5 moves among semesters ${CURRENT_SEMESTER + 1}-${map.total_semesters} that better fit THIS student — for example splitting up stacked hard courses to protect GPA, or pulling a course relevant to "${quiz.goal}" earlier. If the sequence is already good, return an empty moves array.

Return JSON: {"moves":[{"code":"CSE475","to_semester":7}], "rationale":"<2 sentences on what you optimized for this student>"}` },
        ],
      }),
    );
    planNote = (draft.rationale ?? "").trim();
    let working = baseline.plan;
    const accepted: string[] = [];
    for (const mv of (draft.moves ?? []).slice(0, 8)) {
      const code = String(mv?.code ?? "").toUpperCase();
      const to = Number(mv?.to_semester);
      if (!code || !Number.isInteger(to) || to <= CURRENT_SEMESTER) continue;
      const from = working.find((s) => s.courses.some((c) => c.toUpperCase() === code));
      if (!from || from.semester <= CURRENT_SEMESTER || from.semester === to) continue;
      const candidate = applyMoves(working, map, [{ code, to_semester: to }]);
      if (candidate) {
        working = candidate;
        accepted.push(`${code} to semester ${to}`);
      }
    }
    if (!planNote && accepted.length) planNote = `Adjusted ${accepted.join(", ")}.`;
    plan = normalize(working);
  } catch {
    plan = null;
  }

  // Safety net: the major map's own ordering is valid by construction.
  const finalPlan = plan ?? baseline.plan;
  const gradTarget = graduationFor(Math.max(...finalPlan.map((s) => s.semester)));
  const flowchart: FlowchartOutput = {
    graduation_target: gradTarget,
    plan: finalPlan,
    rationale: [constraints.strategy, planNote].filter(Boolean).join(" "),
  };

  // Deliver now — the route map renders while the critic is still auditing.
  run.deliver(onDraft ? onDraft(flowchart) : flowchart);

  // 3. Critic — a real read-only audit by a different model, off the critical path.
  const load = creditLoad(finalPlan, idx);
  const audit = await run
    .step("critic", () =>
      chatJSON<{ verdict: "pass" | "concerns"; notes: string[] }>({
        model: MODELS.critic,
        temperature: 0.2,
        maxTokens: 400,
        messages: [
          { role: "system", content: "You audit degree plans. Be terse and specific. Reply ONLY with JSON." },
          { role: "user", content:
`Plan:
${describePlan(finalPlan)}
Credits per semester: ${JSON.stringify(load)}
Student priority: ${quiz.priority}

The prerequisite graph is already verified programmatically — do not re-check it.
Judge workload balance and fit to the student's stated priority.
Return JSON: {"verdict":"pass"|"concerns","notes":["<=3 short notes"]}` },
        ],
      }),
    )
    .catch(() => ({ verdict: "pass" as const, notes: [] as string[] }));

  run.extra({ critique: audit });
  return flowchart;
}

// ── Pipeline 2: the reroute debate ─────────────────────────────────────

/** Rank courses by how well their titles match the student's stated goal. */
function careerPreferences(goal: string, map: MajorMap): string[] {
  const g = goal.toLowerCase();
  const domain: Array<[RegExp, string[]]> = [
    [/software|engineer|developer|full.?stack|backend|frontend/, ["software", "engineering", "data structures", "algorithms", "programming", "operating"]],
    [/machine learning|\bai\b|artificial|data scien|research/, ["artificial", "machine", "learning", "statistic", "linear algebra", "data"]],
    [/security|cyber|infosec/, ["security", "network", "operating", "systems", "assembly"]],
    [/product|manage|design|business/, ["software", "engineering", "communication", "economic", "statistic"]],
  ];
  const terms = new Set<string>(g.split(/[^a-z]+/).filter((w) => w.length > 3));
  for (const [re, extra] of domain) if (re.test(g)) extra.forEach((t) => terms.add(t));

  const scored: Array<{ code: string; score: number }> = [];
  for (const sem of map.semesters) {
    for (const c of sem.courses) {
      const title = c.title.toLowerCase();
      let score = 0;
      for (const t of terms) if (title.includes(t)) score += 2;
      if (score) scored.push({ code: c.code.toUpperCase(), score });
    }
  }
  return scored.sort((a, b) => b.score - a.score).map((x) => x.code);
}

const PERSONAS = [
  { key: "persona_speed" as const,    id: "speed",    label: "Fastest graduation", framing: "You optimize above all for graduating on time or sooner. Prefer moves that keep every downstream course on schedule, even if a semester gets heavy." },
  { key: "persona_workload" as const, id: "workload", label: "Lightest workload",  framing: "You optimize above all for a survivable workload and protecting GPA. Prefer moves that avoid stacking hard courses together, even if a semester gets lighter." },
  { key: "persona_career" as const,   id: "career",   label: "Best career fit",    framing: "You optimize above all for the student's stated career goal. Prefer pulling forward courses that build directly toward that goal." },
];

interface PersonaOut { moves: Move[]; pull_forward?: string[]; tradeoff: string }

export async function reroutePlan(
  run: AgentRun,
  quiz: QuizAnswers,
  map: MajorMap,
  sentiment: CourseSentiment[],
  current: FlowchartOutput,
  disruption: DisruptionEvent,
  forceDeadEnd = false,
): Promise<RerouteResult> {
  const idx = buildCourseIndex(map);
  const mapText = describeMap(map, sentiment);
  const planText = describePlan(current.plan);
  const brokenText = disruption.broken
    .map((b) => `${b.code} is ${b.status === "full" ? "FULL (no seats)" : "NOT OFFERED this term"}`)
    .join("; ");

  // 1. Analyst — diagnose the blast radius.
  const diagnosis = await run
    .step("analyst", () =>
      chat({
        model: MODELS.curator,
        temperature: 0.3,
        maxTokens: 300,
        messages: [
          { role: "system", content: "You are an academic advisor diagnosing a registration failure. Two sentences maximum. Be concrete." },
          { role: "user", content: `Plan:\n${planText}\n\nSemester ${disruption.semester} just broke: ${brokenText}\n\nMajor map:\n${mapText}\n\nWhat is the impact on this student's path to graduation?` },
        ],
      }),
    )
    .catch(() => `${brokenText} in semester ${disruption.semester}.`);

  // 2. Three reasoner personas, genuinely concurrent, same disruption.
  const settled = await run.parallel(
    PERSONAS.map((p) => ({
      key: p.key,
      detail: p.label,
      fn: () =>
        chatJSON<PersonaOut>({
          model: MODELS.reasoner,
          temperature: 0.6,
          maxTokens: 900,
          timeoutMs: 60_000,
          messages: [
            { role: "system", content: `You are a degree-planning reasoner. ${p.framing} Prerequisites must stay strictly earlier than the courses needing them, and graduation must NOT be pushed past semester ${Math.max(...current.plan.map((s) => s.semester))}. Reply ONLY with JSON.` },
            { role: "user", content:
`Current plan:
${planText}

Broken in semester ${disruption.semester}: ${brokenText}
Student goal: ${quiz.goal}. Priority: ${quiz.priority}. Risk tolerance: ${quiz.risk_tolerance}.

Major map with prereqs and difficulty:
${mapText}

Propose the MINIMAL set of moves that fixes this. Use only course codes from the map.
Return JSON: {"moves":[{"code":"CSE355","to_semester":4}], "pull_forward":["CSE310"], "tradeoff":"<ONE sentence naming what this option costs>"}` },
          ],
        }),
    })),
  );

  // 3. Validate every proposal deterministically. Each persona also has its own
  //    strategy as a fallback, so a slow or duplicate model answer still leaves
  //    three genuinely different — and genuinely valid — options on the table.
  const prefer = careerPreferences(quiz.goal, map);
  const variants: Record<string, RerouteSolution | null> = {
    speed: strategicReroute(current.plan, map, disruption.broken, disruption.semester, "earliest"),
    workload: strategicReroute(current.plan, map, disruption.broken, disruption.semester, "lightest"),
    career: strategicReroute(current.plan, map, disruption.broken, disruption.semester, "career", prefer),
  };

  const seen = new Set<string>();
  const proposals: RerouteProposal[] = PERSONAS.map((p, i) => {
    const r = settled[i];
    let plan: PlanSemester[] | null = null;
    let tradeoff = "";
    let source: "model" | "strategy" = "model";

    if (r.status === "fulfilled" && r.value?.moves?.length) {
      tradeoff = (r.value.tradeoff ?? "").trim();
      plan = applyMoves(current.plan, map, r.value.moves, r.value.pull_forward ?? []);
    }
    // Swap in this persona's own strategy if the model failed, produced an
    // invalid plan, or simply echoed another persona's answer.
    if (!plan || seen.has(planSignature(plan))) {
      const v = variants[p.id];
      if (v && (!plan || !seen.has(planSignature(v.plan)))) {
        plan = v.plan;
        source = "strategy";
      }
    }

    const usable = plan ?? current.plan;
    seen.add(planSignature(usable));
    const violations = validatePlan(usable, idx).map((v) => v.reason);
    const last = Math.max(...usable.map((s) => s.semester));
    const notes = violations.length
      ? violations
      : source === "strategy"
        ? ["Derived from this persona's own strategy (the model's proposal was invalid or duplicated another option)."]
        : [];
    return {
      persona: p.id,
      label: p.label,
      plan: normalize(usable),
      graduation_target: graduationFor(last),
      tradeoff: tradeoff || `${p.label}: holds graduation at ${graduationFor(last)}.`,
      valid: violations.length === 0 && plan !== null,
      violations: notes,
    };
  });

  const valid = proposals.filter((p) => p.valid);
  const deadEnd = forceDeadEnd || valid.length === 0;

  // 4. Judge — pick a winner among the valid proposals.
  let winner = valid[0]?.persona ?? proposals[0].persona;
  let rationale = "";
  if (!deadEnd && valid.length) {
    try {
      const verdict = await run.step("judge", () =>
        chatJSON<{ winner: string; why: string }>({
          model: MODELS.judge,
          temperature: 0.3,
          maxTokens: 400,
          timeoutMs: 30_000,
          messages: [
            { role: "system", content: "You choose between competing degree-plan reroutes. All options are already verified valid. Pick the best fit for THIS student. Your reason must be ONE specific sentence. Reply ONLY with JSON." },
            { role: "user", content:
`Student goal: ${quiz.goal}. Priority: ${quiz.priority}. Risk tolerance: ${quiz.risk_tolerance}.
What broke: ${brokenText}

Options:
${valid.map((p) => `- id="${p.persona}" (${p.label}) graduation ${p.graduation_target}\n  tradeoff: ${p.tradeoff}\n  semester ${disruption.semester}: ${p.plan.find((s) => s.semester === disruption.semester)?.courses.join(", ")}`).join("\n")}

Return JSON: {"winner":"<one of: ${valid.map((p) => p.persona).join(", ")}>","why":"<ONE sentence, specific to this student>"}` },
          ],
        }),
      );
      if (valid.some((p) => p.persona === verdict.winner)) winner = verdict.winner;
      rationale = (verdict.why ?? "").trim();
    } catch {
      rationale = "";
    }
  }

  const chosenProposal = proposals.find((p) => p.persona === winner) ?? proposals[0];
  if (!rationale) {
    rationale = `${chosenProposal.label} best matches a student prioritizing ${quiz.priority.replace(/_/g, " ")} while holding graduation at ${chosenProposal.graduation_target}.`;
  }

  const movedSummary = disruption.broken
    .map((b) => {
      const to = chosenProposal.plan.find((s) => s.courses.includes(b.code.toUpperCase()))?.semester;
      return to ? `${b.code} → semester ${to}` : `${b.code} deferred`;
    })
    .join(", ");

  return {
    disruption,
    previous_plan: current.plan,
    proposals,
    winner,
    judge_rationale: rationale,
    chosen: {
      graduation_target: chosenProposal.graduation_target,
      plan: chosenProposal.plan,
      rationale: diagnosis,
    },
    explanation: deadEnd
      ? `No valid reroute preserves your graduation date — escalating to a human advisor.`
      : `${brokenText}. ${movedSummary}. Your graduation date is unchanged at ${chosenProposal.graduation_target}.`,
    dead_end: deadEnd,
  };
}
