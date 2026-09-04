// ── Senior-year narrative (SERVER ONLY) ────────────────────────────────
// The closing beat of the demo: a first-person paragraph about what this
// student's final year actually looks like, grounded in the real course
// codes and titles from the last two semesters of THEIR plan.
//
// Streamed as SSE so the Agent Activity panel shows the Narrator running.
// This route never returns an error to the UI: if the model is slow, down,
// or vague, a deterministic locally-composed narrative — still naming real
// courses — is returned instead.

import { streamPipeline } from "@/lib/agents";
import { chat, MODELS } from "@/lib/asuair";
import { loadData } from "@/lib/data";
import type { FlowchartOutput, MajorMap, QuizAnswers } from "@/lib/types";
import {
  capstoneCourse,
  composeFallbackNarrative,
  finalCourseCodes,
  finalCourseLabels,
  finalSemesters,
  isConcrete,
  jobSearchWindow,
  tidyNarrative,
  type FinalCourse,
} from "@/app/components/senior-narrative/compose";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  quiz?: QuizAnswers;
  flowchart?: FlowchartOutput;
  majorMap?: MajorMap;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const quiz = body.quiz;
  const flowchart = body.flowchart;

  if (!quiz?.major || !flowchart?.plan?.length) {
    return new Response(
      JSON.stringify({ error: "Missing quiz answers or flowchart plan" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  return streamPipeline(async (run) => {
    // Titles make the narrative specific, so fall back to the bundled major
    // map if the caller did not send one.
    let map: MajorMap | undefined = body.majorMap?.semesters?.length ? body.majorMap : undefined;
    if (!map) {
      try {
        map = (await loadData()).map;
      } catch {
        map = undefined;
      }
    }

    const sems = finalSemesters(flowchart, map, 2);
    const codes = finalCourseCodes(flowchart, map, 2);
    const labels = finalCourseLabels(flowchart, map, 2);
    const grad = flowchart.graduation_target || "";
    const { apply, settle } = jobSearchWindow(grad);
    const lastTerm = sems[sems.length - 1]?.term ?? "my final semester";
    // Search the final semester FIRST and keep the term the capstone actually
    // sits in. Taking the first hit across the whole stretch picks Capstone I
    // (a term early) and then asks the model to describe it as the work of the
    // FINAL term — which is how a factually wrong sentence reaches the stage.
    let capstone: { term: string; course: FinalCourse } | null = null;
    for (let i = sems.length - 1; i >= 0 && !capstone; i--) {
      const hit = capstoneCourse([sems[i]]);
      if (hit) capstone = { term: sems[i].term, course: hit };
    }
    const projectTerm = capstone?.term ?? lastTerm;
    const fallback = composeFallbackNarrative({ quiz, flowchart, majorMap: map });

    const planText = sems
      .map(
        (s) =>
          `${s.term} (semester ${s.semester}): ` +
          s.courses
            .map((c) => (c.title ? `${c.code} — ${c.title} (${c.credits}cr)` : c.code))
            .join("; "),
      )
      .join("\n");

    let narrative = fallback;
    let source: "model" | "fallback" = "fallback";

    try {
      narrative = await run.step(
        "narrator",
        async () => {
          const raw = await chat({
            model: MODELS.planner,
            temperature: 0.6,
            maxTokens: 600,
            timeoutMs: 60_000,
            messages: [
              {
                role: "system",
                content:
                  "You write short, vivid, first-person reflections for university students about their final year of a degree plan. " +
                  "Plain prose only: no lists, no headings, no markdown, no quotation marks around the answer. " +
                  "You are given the student's real schedule and you must stay inside it — never invent a course.",
              },
              {
                role: "user",
                content:
`I am a student in ${quiz.major}. My stated goal: "${quiz.goal}".
My graduation target is ${grad || "my final term"}.
My priority is "${quiz.priority}" and my risk tolerance is "${quiz.risk_tolerance}".

These are the last two semesters of my plan, exactly as scheduled:
${planText || "(no courses scheduled)"}
${capstone ? `The capstone/project course is ${capstone.course.code} — ${capstone.course.title}, and it is scheduled in ${capstone.term}.` : ""}

Write 3 to 5 sentences in MY voice (first person, "I"), describing what my final year actually looks like.

Hard requirements:
- Name at least TWO of the exact course codes listed above and say concretely why each one matters to me.
- Be specific about the capstone/project work in ${projectTerm}: what I am actually building or shipping, not that it "exists".
- State when I start applying for jobs relative to ${grad || "graduation"} — name a real month or term (around ${apply} is realistic, with offers settled by ${settle}) — and why that timing works with this schedule.
- End on what I concretely walk away with, tied to "${quiz.goal}".

Forbidden: second person, bullet points, headings, emoji, and generic filler such as "you will graduate and get a great job", "exciting opportunities ahead", "the sky is the limit", or any sentence that would be equally true of a different student's plan.

Output ONLY the paragraph.`,
              },
            ],
          });

          const text = tidyNarrative(raw);
          if (!isConcrete(text, codes)) {
            // Fails the gate -> honest error telemetry, deterministic fallback.
            throw new Error("Narrative was too generic or missed the plan's real courses");
          }
          return text;
        },
        lastTerm,
      );
      source = "model";
    } catch {
      narrative = fallback;
      source = "fallback";
    }

    return {
      narrative,
      graduation_target: grad,
      final_courses: labels,
      source,
    };
  });
}
