"use client";

// ── Senior-year narrative — the terminus card ──────────────────────────
// The emotional closing beat: the end of the route line, rendered as a
// destination placard plus a first-person paragraph about the student's
// final year. Purely presentational — the text arrives via props. The
// lead calls `fetchNarrative` (below) and hands the result back down.

import type { AgentEvent, FlowchartOutput, MajorMap, QuizAnswers } from "@/lib/types";
import { consumePipeline } from "@/lib/agents";
import { composeFallbackNarrative, type NarrativeInput } from "./compose";

export type { NarrativeInput } from "./compose";
export { finalCourseLabels } from "./compose";

export interface SeniorNarrativeProps {
  narrative: string | null;
  loading?: boolean;
  graduationTarget: string;
  finalCourses?: string[];
  className?: string;
}

const SERIF = 'ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif';

const KEYFRAMES = `
@keyframes snar-shimmer { from { background-position: -420px 0 } to { background-position: 420px 0 } }
.snar-bar {
  background-color: rgba(255,255,255,.05);
  background-image: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,198,39,.16) 45%, rgba(255,255,255,0) 90%);
  background-size: 420px 100%;
  background-repeat: no-repeat;
  animation: snar-shimmer 1.4s linear infinite;
}
@media (prefers-reduced-motion: reduce) { .snar-bar { animation: none } }
`;

/** The route line arriving at its final node. */
function TerminusMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 16" className={className} aria-hidden focusable="false">
      <line
        x1="0" y1="8" x2="40" y2="8"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray="7 5" opacity="0.55"
      />
      <circle cx="52" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="52" cy="8" r="2.4" fill="currentColor" />
    </svg>
  );
}

function Placard({ graduationTarget }: { graduationTarget: string }) {
  return (
    <div className="shrink-0 rounded-xl border border-gold/35 bg-ink-950/70 px-4 py-2.5 text-right shadow-[0_0_44px_-18px_rgba(255,198,39,.75)]">
      <p className="font-mono text-[9px] font-bold tracking-[0.18em] text-gold-600">
        ARRIVING
      </p>
      <p className="mt-1 text-[20px] font-semibold leading-none tracking-tight text-gold">
        {graduationTarget?.trim() || "TBD"}
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {["100%", "96%", "88%", "62%"].map((w, i) => (
        <div
          key={i}
          className="snar-bar h-4 rounded-full"
          style={{ width: w, animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  );
}

export default function SeniorNarrative({
  narrative,
  loading = false,
  graduationTarget,
  finalCourses,
  className = "",
}: SeniorNarrativeProps) {
  const text = (narrative ?? "").trim();
  const stops = (finalCourses ?? []).filter(Boolean).slice(0, 8);
  const showSkeleton = loading && !text;
  // A re-fetch after a reroute keeps the previous paragraph on screen; without
  // this the card would present a narrative about the OLD route as current.
  const refreshing = loading && !!text;

  return (
    <section
      className={`animate-rise relative overflow-hidden rounded-2xl border border-ink-700 bg-gradient-to-br from-maroon/45 via-ink-900 to-ink-950 ${className}`}
      aria-label="Senior year outlook"
      aria-busy={loading || undefined}
    >
      <style>{KEYFRAMES}</style>

      {/* gold hairline — the last inch of the route line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />

      <div className="p-5 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 text-gold">
              <TerminusMark className="h-3.5 w-14" />
              <p className="font-mono text-[9px] font-bold tracking-[0.2em] text-gold-600">
                END OF THE LINE
              </p>
            </div>
            <h2 className="mt-2 text-sm font-semibold tracking-tight text-white">
              Your final year, in your words
            </h2>
          </div>
          <Placard graduationTarget={graduationTarget} />
        </header>

        <div className="mt-5 min-h-[7rem]">
          {showSkeleton ? (
            <>
              <Skeleton />
              <p
                className="mt-4 font-mono text-[10px] tracking-[0.14em] text-mist/70"
                role="status"
                aria-live="polite"
              >
                NARRATOR IS WRITING YOUR FINAL-SEMESTER OUTLOOK…
              </p>
            </>
          ) : text ? (
            <>
              <p
                key={text.slice(0, 24)}
                className={`animate-rise text-[17px] leading-[1.7] text-white/90 transition-opacity duration-300 sm:text-[19px] sm:leading-[1.72] ${
                  refreshing ? "opacity-40" : ""
                }`}
                style={{ fontFamily: SERIF }}
              >
                {text}
              </p>
              {refreshing ? (
                <p
                  className="mt-4 font-mono text-[10px] tracking-[0.14em] text-mist/70"
                  role="status"
                  aria-live="polite"
                >
                  NARRATOR IS REWRITING YOUR OUTLOOK FOR THE NEW ROUTE…
                </p>
              ) : null}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-ink-700 bg-ink-950/40 px-4 py-6 text-center">
              <p className="text-[13px] leading-relaxed text-mist">
                Once your route is built, this is where your last two semesters
                get described the way you would tell a friend about them.
              </p>
            </div>
          )}
        </div>

        {stops.length > 0 ? (
          <footer className="mt-5 border-t border-ink-700/70 pt-4">
            <p className="font-mono text-[9px] font-bold tracking-[0.18em] text-mist/60">
              FINAL STOPS
            </p>
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {stops.map((c) => (
                <li
                  key={c}
                  className="rounded-md border border-ink-700 bg-ink-850/70 px-2 py-1 font-mono text-[10px] text-mist"
                >
                  {c}
                </li>
              ))}
            </ul>
          </footer>
        ) : null}
      </div>
    </section>
  );
}

// ── data fetch ─────────────────────────────────────────────────────────

interface NarrativeResult {
  narrative?: string;
  graduation_target?: string;
  final_courses?: string[];
  source?: string;
}

/**
 * Run the narrator pipeline. Streams real agent telemetry through
 * `onAgentEvent` and resolves to the paragraph. Never rejects: if the
 * route or the network fails, a deterministic narrative composed from the
 * student's own plan is returned so the closing card is never empty.
 */
export async function fetchNarrative(
  input: NarrativeInput,
  onAgentEvent?: (e: AgentEvent) => void,
): Promise<string> {
  try {
    const result = (await consumePipeline(
      "/api/narrative",
      {
        quiz: input.quiz,
        flowchart: input.flowchart,
        majorMap: input.majorMap,
      },
      (e: AgentEvent) => onAgentEvent?.(e),
    )) as NarrativeResult | undefined;

    const text = (result?.narrative ?? "").trim();
    if (text) return text;
  } catch {
    // fall through to the deterministic narrative
  }
  return composeFallbackNarrative(input);
}

// Re-exported for convenience so the lead can type the call site without
// importing from two places.
export type { FlowchartOutput, MajorMap, QuizAnswers };
