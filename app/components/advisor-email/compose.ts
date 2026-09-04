// ── Advisor email composer (pure, deterministic) ──────────────────────
// No React, no fetch, no model call. Split out from index.tsx so it can be
// imported and tested on its own. index.tsx re-exports composeEmail.

import type { AdvisorEmail, AdvisorHandoff } from "@/lib/types";

/* ── text helpers (pure) ─────────────────────────────────────────────── */

const COURSE_RE = /\b[A-Z]{2,4}\s?\d{3}[A-Z]?\b/g;
const TERM_RE = /\b(?:Fall|Spring|Summer|Winter)\s+20\d{2}\b/;
const EMAIL_RE = /[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+/;
const SIMPLE_NAME = /^\p{L}[\p{L}'’.\- ]*$/u;
const WORD_BUDGET = 200;

function clean(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** Markdown emphasis has no place in a plain-text email. */
function stripMarkdown(s: string): string {
  return clean(s).replace(/\*\*|__|`|\*/g, "");
}

/** Strip a leading bullet / numbering and any markdown emphasis. */
function stripBullet(s: string): string {
  return stripMarkdown(clean(s).replace(/^(?:[-*•·–—]+|\d+[.)])\s+/, ""));
}

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sentence(s: string): string {
  const t = clean(s);
  if (!t) return "";
  const c = capitalizeFirst(t);
  return /[.!?]$/.test(c) ? c : `${c}.`;
}

function truncate(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  const cut = s.slice(0, maxChars);
  const space = cut.lastIndexOf(" ");
  const base = space > maxChars * 0.5 ? cut.slice(0, space) : cut;
  return `${base.replace(/[,;:\-\s]+$/, "")}...`;
}

/** First `n` sentences of a blob, then a hard character cap. */
function firstSentences(s: string, n: number, maxChars: number): string {
  const t = clean(s);
  if (!t) return "";
  // Join with "" — each captured part keeps its own leading space, so " " here
  // would double every inter-sentence gap (and split "(Jr.)" into "(Jr. )").
  const parts = t.match(/[^.!?]+[.!?]*/g);
  const joined = parts ? parts.slice(0, n).join("").trim() : t;
  return truncate(joined, maxChars);
}

export function countWords(s: string): number {
  const m = s.trim().match(/\S+/g);
  return m ? m.length : 0;
}

/** "A", "A and B", "A, B and C" */
function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Unique course codes, in first-seen order, whitespace normalised. */
function courseCodes(sources: string[]): string[] {
  const out: string[] = [];
  for (const raw of sources) {
    const hits = clean(raw).match(COURSE_RE);
    if (!hits) continue;
    for (const hit of hits) {
      const code = hit.replace(/\s+/g, "");
      if (!out.includes(code)) out.push(code);
    }
  }
  return out;
}

/**
 * The course a "what broke" line is ABOUT — the code it leads with, not the
 * downstream codes it goes on to mention. The handoff writes lines like
 * "CSE355 — Theory: not offered. CSE355 gates CSE310, CSE460." — CSE310 is
 * downstream, not broken, so it must never reach the subject as unavailable.
 */
function leadCode(line: string): string | null {
  const whole = clean(line);
  const head = whole.split(/[—–:(]/)[0];
  const hit = (head.match(COURSE_RE) ?? whole.match(COURSE_RE))?.[0];
  return hit ? hit.replace(/\s+/g, "") : null;
}

/** Codes for the subject line: one per broken course, situation as fallback. */
function brokenCodes(brokeLines: string[], situation: string): string[] {
  const out: string[] = [];
  for (const line of brokeLines) {
    const code = leadCode(line);
    if (code && !out.includes(code)) out.push(code);
  }
  return out.length ? out : courseCodes([situation]);
}

/** Shorten to a whole sentence where possible; ellipsis is the last resort. */
function shorten(s: string, maxChars: number): string {
  const t = clean(s);
  return t.length <= maxChars ? t : firstSentences(t, 1, maxChars);
}

function article(word: string): string {
  return /^[aeiou]/i.test(word.trim()) ? "an" : "a";
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The handoff narrates the student in the third person ("Maya is scheduled
 * for Fall 2026"); this email is written BY them, so that has to flip or the
 * draft reads like a case file rather than something a student sent.
 */
function firstPerson(text: string, name: string): string {
  let t = clean(text);
  // Only rewrite around a plain name. Anything with brackets or punctuation
  // ("O'Brien (Jr.)") would leave a dangling fragment, which is worse than
  // leaving the sentence in the third person.
  const plain = SIMPLE_NAME.test(name);
  const parts = plain ? [name, name.split(" ")[0]] : [];
  const names = [...new Set(parts.filter((n) => n.length > 1))];
  for (const n of names) {
    t = t.replace(new RegExp(`\\b${escapeRe(n)}(?:'s)?\\b`, "g"), (m) =>
      m.endsWith("'s") ? "my" : "I",
    );
  }
  t = t.replace(/\bthe student(?:'s)?\b/gi, (m) => (m.toLowerCase().endsWith("'s") ? "my" : "I"));
  return t
    .replace(/\bI is\b/g, "I am")
    .replace(/\bI has\b/g, "I have")
    .replace(/\bI does\b/g, "I do")
    .replace(/\bI needs\b/g, "I need")
    .replace(/\bI wants\b/g, "I want")
    .replace(/\bI plans\b/g, "I plan")
    .replace(/\bI takes\b/g, "I take");
}

function findTerm(sources: string[]): string | null {
  for (const raw of sources) {
    const hit = clean(raw).match(TERM_RE);
    if (hit) return hit[0];
  }
  return null;
}

/** "Computer Science, BS" → "Computer Science" (reads better mid-sentence). */
function majorPhrase(major: string): string {
  return clean(major).replace(/[,\s]+\(?(?:B\.?S\.?E?|B\.?A\.?|M\.?S\.?)\)?\.?$/i, "");
}

/** The single thing being asked for, compressed for the subject line. */
function askPhrase(openQuestion: string): string {
  const q = clean(openQuestion).toLowerCase();
  if (/substitut|swap|equivalent|alternate course|alternative course/.test(q))
    return "request to discuss a substitution";
  if (/override|permission number|force[- ]?add|seat|waitlist/.test(q))
    return "request for an override";
  if (/waiv|petition|appeal/.test(q)) return "request to discuss a petition";
  if (/prereq|pre-req/.test(q)) return "request to discuss a prerequisite exception";
  if (/graduat|on time|delay|push back/.test(q)) return "request to stay on track to graduate";
  if (/summer|online|icourse/.test(q)) return "request to discuss other sections";
  return "request to discuss options";
}

/* ── the composer ────────────────────────────────────────────────────── */

interface BodyOptions {
  /** how many sentences of the handoff situation to keep (0 drops it) */
  situation: 0 | 1 | 2;
  items: number;
  /** per-bullet character budget */
  chars: number;
  /** character budget for the ask */
  question: number;
}

export function composeEmail(handoff: AdvisorHandoff, studentName?: string): AdvisorEmail {
  const realName = clean(studentName) || clean(handoff?.student_name);
  const name = realName || "A student";
  const rawMajor = clean(handoff?.major);
  const major = majorPhrase(rawMajor);

  const broke = (handoff?.what_broke ?? []).map(stripBullet).filter(Boolean);
  const tried = (handoff?.what_was_tried ?? []).map(stripBullet).filter(Boolean);

  const situation = stripMarkdown(clean(handoff?.situation));
  const question = stripMarkdown(clean(handoff?.open_question));

  const codes = brokenCodes(broke, situation);
  const term = findTerm([situation, ...broke, ...tried]);

  /* ── subject ───────────────────────────────────────────────────── */
  let head: string;
  if (codes.length === 0) {
    head = "Course conflict I cannot resolve";
  } else if (codes.length <= 3) {
    head = `${joinList(codes)} unavailable`;
  } else {
    head = `${codes.slice(0, 2).join(", ")} and ${codes.length - 2} other courses unavailable`;
  }
  const subject = truncate(
    `${head} - ${term ? `${term} schedule` : "next term's schedule"}, ${askPhrase(question)}`,
    110,
  );

  /* ── body ──────────────────────────────────────────────────────── */
  const termPhrase = term ? `my ${term} registration` : "my registration for next semester";

  const build = (opts: BodyOptions): string => {
    const blocks: string[] = ["Dear Academic Advisor,"];

    const intro = major
      ? `My name is ${name} and I am ${article(major)} ${major} major.`
      : `My name is ${name}.`;
    blocks.push(`${intro} I have hit a wall with ${termPhrase} and I would really value your advice.`);

    if (opts.situation > 0 && situation) {
      blocks.push(
        sentence(
          firstPerson(
            firstSentences(situation, opts.situation, opts.situation > 1 ? 260 : 180),
            realName,
          ),
        ),
      );
    }

    if (broke.length) {
      const lines = broke.slice(0, opts.items).map((b) => `- ${shorten(b, opts.chars)}`);
      blocks.push(`Here is what is blocking me:\n${lines.join("\n")}`);
    }

    if (tried.length) {
      const lines = tried.slice(0, opts.items).map((t) => `- ${shorten(t, opts.chars)}`);
      blocks.push(`I tried to work around it myself first:\n${lines.join("\n")}`);
    }

    if (question) {
      blocks.push(sentence(firstPerson(shorten(question, opts.question), realName)));
    }

    blocks.push(
      "Could we meet for a few minutes this week, or would you rather reply with what you recommend? I can work around your schedule.",
    );
    blocks.push(`Thank you for your time,\n${name}`);

    return blocks.join("\n\n");
  };

  // Degrade by dropping whole items, never by cutting a sentence in half —
  // the ask in particular has to survive intact or the email is pointless.
  const tiers: BodyOptions[] = [
    { situation: 2, items: 3, chars: 220, question: 240 },
    { situation: 1, items: 3, chars: 220, question: 240 },
    { situation: 0, items: 3, chars: 220, question: 240 },
    { situation: 0, items: 3, chars: 160, question: 240 },
    { situation: 0, items: 2, chars: 160, question: 200 },
    { situation: 0, items: 2, chars: 130, question: 160 },
  ];

  let body = build(tiers[tiers.length - 1]);
  for (const tier of tiers) {
    const candidate = build(tier);
    if (countWords(candidate) <= WORD_BUDGET) {
      body = candidate;
      break;
    }
  }

  const to_hint = rawMajor ? `Your ${rawMajor} academic advisor` : "Your academic advisor";

  return { to_hint, subject, body };
}

/* ── mailto ──────────────────────────────────────────────────────────── */

export function mailtoHref(email: AdvisorEmail): string {
  const match = clean(email.to_hint).match(EMAIL_RE);
  const to = match ? match[0] : "";
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
    email.subject,
  )}&body=${encodeURIComponent(email.body)}`;
}
