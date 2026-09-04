// ── Why-this-class relevance ───────────────────────────────────────────
// One batched pass over every course in the student's plan, producing a
// single concrete sentence per course tied to their stated career goal.
// Streamed as SSE so the Agent Activity panel shows the real step.
//
// This endpoint is an ENHANCEMENT: on any failure it returns { items: [] }
// so the tooltip simply does not appear. It must never block the demo.

import { streamPipeline } from "@/lib/agents";
import { chatJSON, MODELS } from "@/lib/asuair";
import { buildCourseIndex, type CourseIndex } from "@/lib/prereq";
import type {
  CourseRelevance,
  CourseSentiment,
  MajorMap,
  QuizAnswers,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

interface RelevanceBody {
  quiz?: QuizAnswers;
  codes?: string[];
  majorMap?: MajorMap;
  sentiment?: CourseSentiment[];
}

/** Max courses per model call. Chunks run concurrently, so wall time stays near one call. */
const CHUNK = 8;
/** Hard ceiling so a malformed request can't fan out into a huge job. */
const MAX_CODES = 48;

const GENERIC = [
  /useful for your career/i,
  /important foundation/i,
  /essential (skill|foundation|building block)/i,
  /will help you succeed/i,
  /key part of your degree/i,
  /valuable for any (job|career|role)/i,
  /^this (course|class) (is|will) (very )?(important|useful|helpful)/i,
];

const SYSTEM = `You are a blunt, experienced ASU academic advisor who has also shipped real work in industry.
A student tells you their career goal. For each course you are given, you give ONE concrete reason that specific course matters for THAT specific goal.

RULES
1. Exactly one sentence, 14-30 words, second person ("you").
2. Name something actually taught in the course - a technique, artifact or idea (grammars, pointers, race conditions, normalization, gradient descent, hypothesis tests, requirement interviews) - and connect it to a concrete task, tool, artifact or interview moment inside the student's stated goal.
3. NEVER generic. These are failures: "useful for your career", "important foundation", "builds essential skills", "will help you succeed", "a key part of your degree".
4. General-education courses still get an honest, specific link (public speaking -> design reviews and customer demos), not inflated hype.
5. Vary the sentence shape across the list. Do not reuse one skeleton.
6. Different goals must read differently. Compare, for the same course CSE355:
   goal "software engineering career" -> "Automata theory is what regex engines and parsers are actually built on, and you will hit both fast in compiler and infrastructure work."
   goal "cybersecurity" -> "Formal grammars are how you reason about parser differentials and catastrophic-backtracking regexes, two bug classes that turn up constantly in security review."

OUTPUT
Return ONLY raw JSON: {"items":[{"code":"CSE355","why":"..."}]}
One entry for every course you were given, using the exact course codes. No markdown, no extra keys, no commentary.`;

function cleanWhy(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let why = raw.replace(/\s+/g, " ").replace(/^["'\s]+|["'\s]+$/g, "").trim();
  if (why.length < 30) return null;
  if (GENERIC.some((re) => re.test(why))) return null;
  if (why.length > 260) why = `${why.slice(0, 257).replace(/\s+\S*$/, "").trimEnd()}...`;
  if (!/[.!?]$/.test(why)) why += ".";
  return why;
}

/** One batched model call over a slice of the plan. */
async function relevanceChunk(
  quiz: QuizAnswers,
  lines: string[],
  codes: string[],
): Promise<CourseRelevance[]> {
  const parsed = await chatJSON<{ items?: Array<{ code?: unknown; why?: unknown }> }>({
    model: MODELS.fast,
    temperature: 0.5,
    maxTokens: 3000,
    timeoutMs: 90_000,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          `Student goal: ${quiz.goal || "a strong technical career"}`,
          `Major: ${quiz.major}`,
          `They care most about: ${quiz.priority ?? "learn_deeply"} (risk tolerance: ${quiz.risk_tolerance ?? "balanced"}).`,
          "",
          `Courses (${codes.length}) - return one entry for each:`,
          ...lines,
        ].join("\n"),
      },
    ],
  });

  const wanted = new Set(codes);
  const out: CourseRelevance[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(parsed?.items) ? parsed.items : []) {
    const code = typeof item?.code === "string" ? item.code.trim().toUpperCase().replace(/\s+/g, "") : "";
    if (!wanted.has(code) || seen.has(code)) continue;
    const why = cleanWhy(item?.why);
    if (!why) continue;
    seen.add(code);
    out.push({ code, why });
  }
  return out;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as RelevanceBody;
  const quiz = body.quiz;
  const majorMap = body.majorMap;

  // Normalize + dedupe the requested codes.
  const codes = Array.from(
    new Set(
      (Array.isArray(body.codes) ? body.codes : [])
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.trim().toUpperCase().replace(/\s+/g, ""))
        .filter(Boolean),
    ),
  ).slice(0, MAX_CODES);

  if (!quiz?.major || codes.length === 0) {
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return streamPipeline(async (run) => {
    try {
      const items = await run.step(
        "relevance",
        async () => {
          const idx: CourseIndex = majorMap ? buildCourseIndex(majorMap) : new Map();
          const describe = (code: string) => {
            const c = idx.get(code);
            return c
              ? `${code} - ${c.title} (${c.credits} cr)`
              : `${code} - (title not in major map; infer from the course code)`;
          };

          const chunks: string[][] = [];
          for (let i = 0; i < codes.length; i += CHUNK) chunks.push(codes.slice(i, i + CHUNK));

          const settled = await Promise.allSettled(
            chunks.map((chunk) => relevanceChunk(quiz, chunk.map(describe), chunk)),
          );

          const merged: CourseRelevance[] = [];
          const seen = new Set<string>();
          for (const r of settled) {
            if (r.status !== "fulfilled") continue;
            for (const item of r.value) {
              if (seen.has(item.code)) continue;
              seen.add(item.code);
              merged.push(item);
            }
          }
          if (merged.length === 0) throw new Error("No usable relevance lines came back");
          return merged;
        },
        `${codes.length} courses -> ${quiz.goal || "career goal"}`,
      );
      return { items };
    } catch {
      // Never fail the frame: the tooltip is an enhancement, not a blocker.
      return { items: [] as CourseRelevance[] };
    }
  });
}
