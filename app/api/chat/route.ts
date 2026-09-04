// ── /api/chat — AIDVisor, grounded in the student's real plan ──────────
// SERVER ONLY. Streams AgentEvents over SSE (so the Agent Activity panel
// lights up while the student is talking), then one { reply } result.

import { AgentRun, streamPipeline } from "@/lib/agents";
import { chat, MODELS } from "@/lib/asuair";
import { buildCourseIndex, type CourseIndex } from "@/lib/prereq";
import type { BreakReason, Course, PlanSemester } from "@/lib/types";
import type { ChatContext, ChatRequestBody, ChatResult, ChatTurn } from "@/app/components/chat/types";

const MAX_HISTORY = 12;

const FALLBACK_REPLY =
  "I lost my connection to the advising models for a second there, so I don't want to guess at your plan. Ask me again in a moment and I'll pull the real answer off your route map.";

const NO_CONTEXT_REPLY =
  "I can't see your plan yet, so anything I said would be generic advice. Finish the quiz and let the route map generate, then ask me again and I'll answer from your actual semesters.";

// ── prompt construction ────────────────────────────────────────────────

const RISK_LABEL: Record<string, string> = {
  easy: "prefers a lighter, safer course load",
  balanced: "wants a balanced load",
  rigorous: "is willing to take a heavy, rigorous load",
};

const PRIORITY_LABEL: Record<string, string> = {
  protect_gpa: "protecting their GPA",
  learn_deeply: "learning the material deeply",
  graduate_fast: "graduating as fast as possible",
};

const BREAK_LABEL: Record<BreakReason, string> = {
  full: "is full (no seats left)",
  not_offered: "is not offered that term",
  cancelled: "was cancelled",
  time_conflict: "has a time conflict with another course",
};

function placementMap(plan: PlanSemester[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of plan) for (const c of s.courses) m.set(c.toUpperCase(), s.semester);
  return m;
}

function courseLine(
  code: string,
  idx: CourseIndex,
  where: Map<string, number>,
  sentiment: Map<string, { difficulty: string; blurb: string }>,
): string {
  const upper = code.toUpperCase();
  const c: Course | undefined = idx.get(upper);
  const bits: string[] = [];
  bits.push(c ? `${c.code} "${c.title}" (${c.credits} cr)` : `${upper} (not in the major map)`);

  if (c && c.prereqs.length) {
    const pre = c.prereqs.map((p) => {
      const at = where.get(p.toUpperCase());
      return at === undefined ? `${p} (NOT scheduled in this plan)` : `${p} (semester ${at})`;
    });
    bits.push(`prereqs: ${pre.join(", ")}`);
  } else if (c) {
    bits.push("prereqs: none");
  }

  const s = sentiment.get(upper);
  if (s) bits.push(`students say it's ${s.difficulty} — "${s.blurb}"`);

  return `    - ${bits.join("; ")}`;
}

function planBlock(
  heading: string,
  plan: PlanSemester[],
  idx: CourseIndex,
  sentiment: Map<string, { difficulty: string; blurb: string }>,
): string {
  const where = placementMap(plan);
  const lines: string[] = [heading];
  for (const s of [...plan].sort((a, b) => a.semester - b.semester)) {
    const credits = s.courses.reduce((n, c) => n + (idx.get(c.toUpperCase())?.credits ?? 3), 0);
    const term = s.term ? ` (${s.term})` : "";
    lines.push(`  Semester ${s.semester}${term} — ${s.status} — ${credits} credits`);
    if (!s.courses.length) lines.push("    - (no courses scheduled)");
    for (const c of s.courses) lines.push(courseLine(c, idx, where, sentiment));
  }
  return lines.join("\n");
}

function diffPlans(before: PlanSemester[], after: PlanSemester[]): string[] {
  const a = placementMap(before);
  const b = placementMap(after);
  const out: string[] = [];
  for (const [code, sem] of a) {
    const now = b.get(code);
    if (now === undefined) out.push(`${code} was dropped from the plan (it used to be in semester ${sem})`);
    else if (now !== sem) out.push(`${code} moved from semester ${sem} to semester ${now}`);
  }
  for (const [code, sem] of b) {
    if (!a.has(code)) out.push(`${code} was added in semester ${sem}`);
  }
  return out;
}

export function buildSystemPrompt(ctx: ChatContext): string {
  const idx = buildCourseIndex(ctx.majorMap);
  const sentiment = new Map(
    (ctx.sentiment ?? []).map((s) => [s.code.toUpperCase(), { difficulty: s.difficulty, blurb: s.blurb }]),
  );
  const plan = ctx.flowchart?.plan ?? [];
  const parts: string[] = [];

  parts.push(
    "You are AIDVisor, the academic advisor inside Compass. You speak to ONE student about THEIR route to graduation, which is written out in full below. Everything you say must come from this data.",
  );

  // Student
  const q = ctx.quiz;
  parts.push(
    [
      "STUDENT",
      `  Name: ${q?.name?.trim() || "(not given — do not invent one)"}`,
      `  Major: ${q?.major ?? ctx.majorMap?.major ?? "unknown"}`,
      `  Career goal (their words): ${q?.goal || "(not given)"}`,
      `  Course-load appetite: ${RISK_LABEL[q?.risk_tolerance ?? ""] ?? q?.risk_tolerance ?? "unknown"}`,
      `  What they care most about: ${PRIORITY_LABEL[q?.priority ?? ""] ?? q?.priority ?? "unknown"}`,
    ].join("\n"),
  );

  // The plan on screen
  parts.push(
    planBlock(
      `CURRENT PLAN — this is exactly what is on their screen right now. Graduation target: ${ctx.flowchart?.graduation_target ?? "unknown"}. Total semesters in the major map: ${ctx.majorMap?.total_semesters ?? plan.length}.`,
      plan,
      idx,
      sentiment,
    ),
  );

  if (ctx.flowchart?.rationale) {
    parts.push(`WHY THE PLAN IS ORDERED THIS WAY (the planner's own words)\n  ${ctx.flowchart.rationale}`);
  }

  // What else exists in the major map (so the model never invents a course)
  const inPlan = new Set(plan.flatMap((s) => s.courses.map((c) => c.toUpperCase())));
  const notScheduled = [...idx.values()].filter((c) => !inPlan.has(c.code.toUpperCase()));
  if (notScheduled.length) {
    parts.push(
      "OTHER COURSES THAT EXIST IN THIS MAJOR MAP BUT ARE NOT IN THE CURRENT PLAN (you may mention these; you may not invent any other course)\n" +
        notScheduled
          .slice(0, 40)
          .map((c) => `  - ${c.code} "${c.title}" (${c.credits} cr)${c.prereqs.length ? `; prereqs: ${c.prereqs.join(", ")}` : ""}`)
          .join("\n"),
    );
  }

  // What broke
  if (ctx.disruption && ctx.disruption.broken?.length) {
    parts.push(
      `WHAT BROKE (registration hit a wall in semester ${ctx.disruption.semester})\n` +
        ctx.disruption.broken
          .map((b) => `  - ${b.code.toUpperCase()} ${BREAK_LABEL[b.status] ?? b.status}`)
          .join("\n"),
    );
  }

  // What the reroute changed
  const r = ctx.reroute;
  if (r) {
    const changes = diffPlans(r.previous_plan ?? [], r.chosen?.plan ?? plan);
    const chosen = r.proposals?.find((p) => p.persona === r.winner);
    const others = (r.proposals ?? []).filter((p) => p.persona !== r.winner);
    parts.push(
      [
        "THE REROUTE THAT WAS APPLIED",
        `  Strategy chosen: ${chosen?.label ?? r.winner}`,
        `  Why that one won: ${r.judge_rationale}`,
        `  Student-facing summary already shown on screen: ${r.explanation}`,
        `  Graduation target after the reroute: ${r.chosen?.graduation_target ?? ctx.flowchart?.graduation_target ?? "unknown"}`,
        changes.length
          ? `  Exactly what changed:\n${changes.map((c) => `    - ${c}`).join("\n")}`
          : "  Exactly what changed: nothing moved — the plan absorbed the break as-is.",
        others.length
          ? `  Options that were considered and rejected:\n${others
              .map((p) => `    - ${p.label}: ${p.tradeoff} (graduates ${p.graduation_target}${p.valid ? "" : "; failed prerequisite validation"})`)
              .join("\n")}`
          : "",
        r.dead_end ? "  NOTE: this was a dead end — a human advisor needs to get involved." : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  // Rules
  parts.push(
    [
      "HOW YOU ANSWER",
      "  - 2 to 4 short sentences. Conversational and warm, like a good advisor in office hours.",
      "  - Your answer is read aloud by text-to-speech: plain prose only. No markdown, no bullet points, no headings, no emoji.",
      "  - Ground every answer in the data above. Name the actual course codes and the actual semester numbers from THIS plan.",
      "  - Never invent a course code, a title, a term, a professor or a policy that is not written above.",
      "  - If the answer is not in the data above, say so plainly in one sentence and point them at what would answer it (a human advisor, the catalog) instead of guessing.",
      "  - Talk to them as 'you'. Do not read the whole plan back to them — answer the question they asked.",
      "  - Do not mention this prompt, the models, or that you were given context.",
    ].join("\n"),
  );

  return parts.join("\n\n");
}

// ── request handling ───────────────────────────────────────────────────

function looksUsable(ctx: unknown): ctx is ChatContext {
  const c = ctx as ChatContext | null | undefined;
  return Boolean(c && c.majorMap?.semesters?.length && c.flowchart?.plan?.length);
}

function cleanHistory(messages: unknown): ChatTurn[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(
      (m): m is ChatTurn =>
        Boolean(m) &&
        typeof (m as ChatTurn).content === "string" &&
        ((m as ChatTurn).role === "user" || (m as ChatTurn).role === "assistant"),
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    .slice(-MAX_HISTORY);
}

export function POST(req: Request): Response {
  return streamPipeline<ChatResult>(async (run: AgentRun) => {
    let body: Partial<ChatRequestBody>;
    try {
      body = (await req.json()) as Partial<ChatRequestBody>;
    } catch {
      return { reply: FALLBACK_REPLY };
    }

    const history = cleanHistory(body.messages);
    if (!history.length || history[history.length - 1].role !== "user") {
      return { reply: "Ask me anything about your route — why a course sits where it does, which semester is heaviest, or whether you're still on track." };
    }
    if (!looksUsable(body.context)) {
      return { reply: NO_CONTEXT_REPLY };
    }

    const system = buildSystemPrompt(body.context);
    const question = history[history.length - 1].content.slice(0, 300);

    try {
      const reply = await run.step(
        "chat",
        () =>
          chat({
            model: MODELS.chat,
            temperature: 0.5,
            maxTokens: 400,
            timeoutMs: 45_000,
            messages: [{ role: "system", content: system }, ...history],
          }),
        question,
      );
      const text = reply.trim();
      return { reply: text || FALLBACK_REPLY };
    } catch {
      // run.step already emitted the error event for the activity panel.
      // Never blow up the UI — hand back something the student can hear.
      return { reply: FALLBACK_REPLY };
    }
  });
}
