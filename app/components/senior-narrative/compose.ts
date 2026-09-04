// ── Senior-narrative support: plan → concrete facts, and the deterministic
// fallback narrative. Pure TypeScript, no server imports, so BOTH the API
// route and the client component can use it. This is what guarantees the
// closing card of the demo is never empty and never generic.

import type { FlowchartOutput, MajorMap, QuizAnswers } from "@/lib/types";
import { termFor } from "@/lib/demo";

export interface FinalCourse {
  code: string;
  title: string;
  credits: number;
}

export interface FinalSemester {
  semester: number;
  term: string;
  courses: FinalCourse[];
}

export interface NarrativeInput {
  quiz: QuizAnswers;
  flowchart: FlowchartOutput;
  /** Optional on the client; the server falls back to the bundled major map. */
  majorMap?: MajorMap;
}

// ── plan → real courses ────────────────────────────────────────────────

function courseIndex(map?: MajorMap): Map<string, FinalCourse> {
  const idx = new Map<string, FinalCourse>();
  for (const sem of map?.semesters ?? []) {
    for (const c of sem.courses ?? []) {
      idx.set(String(c.code).toUpperCase(), {
        code: String(c.code).toUpperCase(),
        title: c.title ?? "",
        credits: typeof c.credits === "number" ? c.credits : 3,
      });
    }
  }
  return idx;
}

/**
 * The last `count` semesters of the plan that actually contain courses,
 * hydrated with real titles from the major map.
 */
export function finalSemesters(
  flowchart: FlowchartOutput | null | undefined,
  majorMap?: MajorMap,
  count = 2,
): FinalSemester[] {
  const idx = courseIndex(majorMap);
  const filled = (flowchart?.plan ?? [])
    .filter((s) => Array.isArray(s?.courses) && s.courses.length > 0)
    .slice()
    .sort((a, b) => a.semester - b.semester);

  return filled.slice(-count).map((s) => ({
    semester: s.semester,
    term: s.term || termFor(s.semester),
    courses: s.courses.map((raw) => {
      const code = String(raw).toUpperCase();
      return idx.get(code) ?? { code, title: "", credits: 3 };
    }),
  }));
}

/** "CSE485 — Computer Science Capstone Project I" labels for the UI chips. */
export function finalCourseLabels(
  flowchart: FlowchartOutput | null | undefined,
  majorMap?: MajorMap,
  count = 2,
): string[] {
  return finalSemesters(flowchart, majorMap, count).flatMap((s) =>
    s.courses.map((c) => (c.title ? `${c.code} — ${c.title}` : c.code)),
  );
}

export function finalCourseCodes(
  flowchart: FlowchartOutput | null | undefined,
  majorMap?: MajorMap,
  count = 2,
): string[] {
  return finalSemesters(flowchart, majorMap, count).flatMap((s) =>
    s.courses.map((c) => c.code),
  );
}

/** The capstone-ish course in the final stretch, if the plan has one. */
export function capstoneCourse(sems: FinalSemester[]): FinalCourse | null {
  const all = sems.flatMap((s) => s.courses);
  return (
    all.find((c) => /capstone|senior design|thesis/i.test(c.title)) ??
    all.find((c) => /^[A-Z]{2,4}4[89]\d$/.test(c.code)) ??
    null
  );
}

// ── graduation date → job-search timing ────────────────────────────────

export interface JobWindow {
  /** When applications realistically start. */
  apply: string;
  /** When the student wants it settled. */
  settle: string;
}

const MONTH_RE =
  /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i;

export function jobSearchWindow(graduationTarget: string): JobWindow {
  const m = MONTH_RE.exec(graduationTarget ?? "");
  if (!m) return { apply: "the fall recruiting cycle", settle: "the term before I finish" };
  const month = m[1].toLowerCase();
  const year = Number(m[2]);
  // Spring graduates hit the previous fall's cycle; December graduates work
  // the spring/summer window of their final year.
  if (["january", "february", "march", "april", "may", "june"].includes(month)) {
    return { apply: `September ${year - 1}`, settle: `February ${year}` };
  }
  return { apply: `February ${year}`, settle: `September ${year}` };
}

// ── the deterministic fallback narrative ───────────────────────────────

function list(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function name(c: FinalCourse): string {
  return c.title ? `${c.code} (${c.title})` : c.code;
}

/**
 * Locally-composed closing narrative. Never generic: it names the student's
 * actual final-semester courses, their real graduation target and their own
 * stated goal. Used when the model is slow, unreachable, or vague.
 */
export function composeFallbackNarrative(input: NarrativeInput): string {
  const { quiz, flowchart, majorMap } = input;
  const grad = (flowchart?.graduation_target || "").trim() || "my target term";
  // Trailing punctuation would double up against the closing period, since the
  // goal is spliced in as the last clause of the last sentence.
  const goal =
    (quiz?.goal || "").trim().replace(/[.!?…]+$/, "").trim() ||
    "the work I actually want to do";
  const { apply, settle } = jobSearchWindow(grad);

  const sems = finalSemesters(flowchart, majorMap, 2);
  const last = sems[sems.length - 1];
  const prior = sems.length > 1 ? sems[0] : undefined;

  const sentences: string[] = [];

  if (prior && prior.courses.length) {
    const priorNames = prior.courses.slice(0, 2).map(name);
    sentences.push(
      `By ${prior.term} the prerequisite chains are finally behind me and my week comes down to ${list(priorNames)}.`,
    );
  }

  if (last && last.courses.length) {
    // The anchor must come from the FINAL semester, not from the one before.
    const anchor = capstoneCourse([last]) ?? last.courses[0];
    const rest = last.courses
      .filter((c) => c.code !== anchor.code)
      .slice(0, 2)
      .map(name);
    sentences.push(
      `${last.term} is where it all lands: ${name(anchor)} is the project I actually ship — the one thing I can put in front of a hiring manager` +
        (rest.length ? `, with ${list(rest)} filling out my last credits.` : "."),
    );
  }

  if (!sentences.length) {
    sentences.push(
      `My last two terms are a short runway — a lighter schedule, one real project, and no prerequisite left to clear.`,
    );
  }

  sentences.push(
    `That is what makes the job search survivable: I start applying in ${apply}, interview while the project is still in motion, and I want an offer signed by ${settle} instead of during finals week.`,
  );
  // Colon-appositive so any phrasing of the student's goal stays grammatical.
  sentences.push(
    `I walk out in ${grad} with something I built end to end and a résumé pointed exactly where I said I wanted it: ${goal}.`,
  );

  return sentences.join(" ");
}

// ── model-output hygiene ───────────────────────────────────────────────

/** Strip fences, labels, think-blocks and stray quotes; collapse whitespace. */
export function tidyNarrative(raw: string): string {
  let text = (raw ?? "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/^\s*(narrative|answer|output|paragraph)\s*:\s*/i, "")
    .replace(/^[\s>*-]+/gm, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Unwrap a fully-quoted answer.
  if (/^["'“”][\s\S]*["'“”]$/.test(text)) text = text.slice(1, -1).trim();

  // Keep it to at most 5 sentences, as demanded.
  const parts = text.match(/[^.!?]+[.!?]+(?:["'”)]+)?/g);
  if (parts && parts.length > 5) text = parts.slice(0, 5).join(" ");

  return text.replace(/\s+/g, " ").trim();
}

function squash(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Which of `codes` the text genuinely names (tolerates "CSE 485"). */
export function mentionedCourses(text: string, codes: string[]): string[] {
  const hay = squash(text);
  return codes.filter((c) => hay.includes(squash(c)));
}

const FILLER =
  /(you will graduate|you'll graduate|exciting opportunit|sky is the limit|bright future|dream job|endless possibilit|world is your oyster|great job waiting)/i;

/**
 * The concreteness gate. A narrative only ships from the model if it is
 * first-person, the right length, and actually names the student's courses.
 */
export function isConcrete(text: string, codes: string[]): boolean {
  if (!text || text.length < 90) return false;
  if (FILLER.test(text)) return false;
  if (!/\b(I|I'm|I've|my|My)\b/.test(text)) return false;
  const sentences = (text.match(/[.!?]+/g) ?? []).length;
  if (sentences < 3) return false;
  const needed = Math.min(2, new Set(codes).size);
  return mentionedCourses(text, codes).length >= needed;
}
