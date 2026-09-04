"use client";

// ── Advisor handoff document ───────────────────────────────────────────
// The honest fallback. When AIDvisor genuinely cannot reroute, this is the
// artifact the student walks into advising with: one page, printable, and
// deliberately LIGHT — paper, not app chrome — so it reads as a document
// meant to leave the screen.
//
// Presentational only. Data in via props, print reported via onPrint.
// `children` is the slot the lead fills with the email-draft component.

import { useCallback, type CSSProperties, type ReactNode } from "react";
import { consumePipeline } from "@/lib/agents";
import type {
  AdvisorHandoff,
  AgentEvent,
  DisruptionEvent,
  FlowchartOutput,
  MajorMap,
  QuizAnswers,
  RerouteResult,
} from "@/lib/types";

// ── Public API ─────────────────────────────────────────────────────────

export interface HandoffInput {
  quiz: QuizAnswers;
  flowchart: FlowchartOutput;
  disruption: DisruptionEvent;
  reroute?: RerouteResult | null;
  majorMap: MajorMap;
}

export interface AdvisorHandoffProps {
  handoff: AdvisorHandoff | null;
  loading?: boolean;
  onPrint?: () => void;
  className?: string;
  children?: ReactNode;
}

const DOC_ID = "compass-handoff-doc";

/**
 * POST the dead-end context to /api/handoff and stream real agent telemetry
 * back through `onAgentEvent`. Never rejects: if the route or the model is
 * unreachable, a specific note is composed locally from the same data.
 */
export async function fetchHandoff(
  input: HandoffInput,
  onAgentEvent?: (e: AgentEvent) => void,
): Promise<AdvisorHandoff> {
  try {
    const raw = await consumePipeline("/api/handoff", input, (e) => {
      try {
        onAgentEvent?.(e);
      } catch {
        /* a listener throwing must not kill the stream */
      }
    });
    const candidate =
      (raw as { handoff?: AdvisorHandoff } | null)?.handoff ??
      (raw as AdvisorHandoff | null);
    if (candidate && typeof candidate.situation === "string" && candidate.situation.trim()) {
      return normalize(candidate, input);
    }
  } catch {
    /* fall through */
  }
  return localFallback(input);
}

// ── Fallbacks so the panel is never blank ──────────────────────────────

const BREAK_TEXT: Record<string, string> = {
  full: "the section is full",
  not_offered: "it is not offered",
  cancelled: "the section was cancelled",
  time_conflict: "it conflicts with another required course",
};

function normalize(h: AdvisorHandoff, input: HandoffInput): AdvisorHandoff {
  return {
    student_name: h.student_name?.trim() || input.quiz.name?.trim() || "This student",
    major: h.major?.trim() || input.quiz.major,
    situation: h.situation.trim(),
    what_broke: Array.isArray(h.what_broke) ? h.what_broke.filter(Boolean) : [],
    what_was_tried: Array.isArray(h.what_was_tried) ? h.what_was_tried.filter(Boolean) : [],
    open_question: h.open_question?.trim() || "",
    generated_at: h.generated_at || new Date().toISOString(),
  };
}

/** Client-side note built from the same facts, used only if the route fails. */
function localFallback(input: HandoffInput): AdvisorHandoff {
  const { quiz, flowchart, disruption, reroute } = input;
  const broken = disruption.broken ?? [];
  const codes = broken.map((b) => b.code.toUpperCase());
  const tried = (reroute?.proposals ?? []).map((p) => {
    const v = (p.violations ?? [])
      .filter(Boolean)
      .map((line) => line.trim().replace(/[.;,\s]+$/, ""))
      .filter(Boolean);
    return v.length
      ? `${p.label} (graduation ${p.graduation_target}): rejected by the prerequisite validator — ${v.slice(0, 2).join("; ")}.`
      : `${p.label} (graduation ${p.graduation_target}): ${p.tradeoff || "no move set kept every prerequisite strictly earlier."}`;
  });

  return {
    student_name: quiz.name?.trim() || "This student",
    major: quiz.major,
    situation:
      `${quiz.name?.trim() || "This student"} is on a ${quiz.major} route targeting ${flowchart.graduation_target}. ` +
      `Semester ${disruption.semester} broke at registration (${codes.join(", ") || "required coursework unavailable"}), and no prerequisite-legal reroute holds that graduation date. ` +
      `This needs an advisor decision, not another plan.`,
    what_broke: broken.length
      ? broken.map(
          (b) =>
            `${b.code.toUpperCase()} — ${BREAK_TEXT[b.status] ?? "it is unavailable"} in semester ${disruption.semester}, which blocks everything downstream of it.`,
        )
      : [`Semester ${disruption.semester} could not be filled as planned.`],
    what_was_tried: tried.length
      ? tried
      : ["Every prerequisite-legal placement in a later semester was tested; none held the graduation date."],
    open_question: codes.length
      ? `Can ${codes.join(" or ")} be cleared for semester ${disruption.semester} by petition, substitution, or a capacity override — and if not, which requirement should slip so ${flowchart.graduation_target} is protected?`
      : `Which blocked requirement can be met by petition or substitution so ${flowchart.graduation_target} holds?`,
    generated_at: new Date().toISOString(),
  };
}

// ── Print scoping: only the document leaves the browser ────────────────

const PRINT_CSS = `
@media print {
  html, body { height: auto !important; overflow: visible !important; background: #ffffff !important; }
  :has(#${DOC_ID}) { overflow: visible !important; max-height: none !important; height: auto !important; }
  body * { visibility: hidden !important; }
  #${DOC_ID}, #${DOC_ID} * { visibility: visible !important; }
  #${DOC_ID} {
    position: absolute !important;
    top: 0 !important; left: 0 !important;
    width: 100% !important; max-width: none !important;
    margin: 0 !important; padding: 0 !important;
    border: 0 !important; border-radius: 0 !important;
    box-shadow: none !important;
    background: #ffffff !important;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .cmps-noprint, .cmps-noprint * { display: none !important; visibility: hidden !important; }
  @page { margin: 16mm; }
}
`;

function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Small building blocks ──────────────────────────────────────────────

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c1d40]">
        {label}
      </h3>
      {children}
    </section>
  );
}

function Bullets({ items, marker }: { items: string[]; marker: string }) {
  if (!items.length) {
    return <p className="text-[13px] italic text-[#6d6577]">Nothing recorded.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed text-[#241f2c]">
          <span
            aria-hidden
            className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full"
            style={{ background: marker }}
          />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function PrinterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="7" rx="1" />
    </svg>
  );
}

function RouteMark() {
  // A broken route line: gold planned track, coral break, maroon terminus.
  return (
    <svg viewBox="0 0 96 16" width="96" height="16" aria-hidden>
      <line x1="4" y1="8" x2="44" y2="8" stroke="#d19c00" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="56" y1="8" x2="92" y2="8" stroke="#c9c2d0" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 5" />
      <circle cx="4" cy="8" r="3.5" fill="#8c1d40" />
      <path d="M46 4 L54 12 M54 4 L46 12" stroke="#ff6b4a" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="92" cy="8" r="3" fill="none" stroke="#c9c2d0" strokeWidth="2" />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────

export default function AdvisorHandoffDoc({
  handoff,
  loading = false,
  onPrint,
  className = "",
  children,
}: AdvisorHandoffProps) {
  const handlePrint = useCallback(() => {
    try {
      onPrint?.();
    } catch {
      /* a reporting callback must not block printing */
    }
    if (typeof window !== "undefined") window.print();
  }, [onPrint]);

  // ── Loading ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`rounded-2xl border border-ink-700 bg-ink-900 p-5 ${className}`}>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-alert animate-pulse-slow" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-alert">
            Escalating to a human advisor
          </p>
        </div>
        <p className="mt-2 text-[13px] text-mist">
          Writing the handoff note — what broke, what was tried, and the one question left.
        </p>
        <div className="mt-5 space-y-3">
          {[92, 78, 85, 60].map((w, i) => (
            <div
              key={i}
              className="h-3 rounded bg-ink-800 animate-pulse-slow"
              style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Empty ───────────────────────────────────────────────────────────
  if (!handoff) {
    return (
      <div className={`rounded-2xl border border-dashed border-ink-700 bg-ink-900/60 p-5 ${className}`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mist">
          Advisor handoff
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-mist">
          Nothing to hand off. This document is generated only when no valid reroute exists —
          AIDvisor writes the advisor prep note instead of guessing.
        </p>
      </div>
    );
  }

  const brokeCount = handoff.what_broke.length;

  return (
    <div className={className}>
      <style>{PRINT_CSS}</style>

      {/* toolbar — screen only */}
      <div className="cmps-noprint mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-alert" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-alert">
            No valid reroute — advisor handoff
          </p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-lg border border-maroon-300/40 bg-maroon px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-maroon-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <PrinterIcon />
          Print / save as PDF
        </button>
      </div>

      {/* the document itself — light on purpose */}
      <article
        id={DOC_ID}
        className="animate-rise overflow-hidden rounded-2xl bg-[#faf8f5] text-[#241f2c] shadow-[0_18px_40px_-24px_rgba(0,0,0,.85)] ring-1 ring-black/10"
        style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" } as CSSProperties}
      >
        <div className="h-1.5 w-full bg-[#8c1d40]" />

        <div className="px-6 py-6 sm:px-8 sm:py-7">
          {/* header */}
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e2dcd4] pb-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8c1d40]">
                AIDvisor · Advisor handoff
              </p>
              <h2 className="mt-1.5 text-2xl font-semibold leading-tight tracking-tight text-[#171319]">
                {handoff.student_name}
              </h2>
              <p className="mt-0.5 text-[13px] text-[#5b5366]">{handoff.major}</p>
            </div>
            <div className="text-right">
              <RouteMark />
              <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#8a8194]">Generated</p>
              <p className="text-[12px] tabular-nums text-[#5b5366]" suppressHydrationWarning>
                {stamp(handoff.generated_at)}
              </p>
            </div>
          </header>

          {/* body */}
          <Section label="Situation">
            <p className="text-[14px] leading-relaxed text-[#241f2c]">{handoff.situation}</p>
          </Section>

          <Section label={`What broke${brokeCount ? ` (${brokeCount})` : ""}`}>
            <Bullets items={handoff.what_broke} marker="#ff6b4a" />
          </Section>

          <Section label="What was tried">
            <Bullets items={handoff.what_was_tried} marker="#8c1d40" />
          </Section>

          <Section label="Open question for the advisor">
            <div className="rounded-lg border-l-[3px] border-[#8c1d40] bg-[#f3ede4] px-4 py-3">
              <p className="text-[14px] font-medium leading-relaxed text-[#1d1822]">
                {handoff.open_question || "Which blocked requirement can be met by petition or substitution?"}
              </p>
            </div>
          </Section>

          <footer className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-[#e2dcd4] pt-3">
            <p className="text-[10.5px] leading-snug text-[#8a8194]">
              Prepared by AIDvisor from the student&rsquo;s major map and live registration state.
              Prerequisite conclusions are validated deterministically, not inferred.
            </p>
            <p className="text-[10.5px] uppercase tracking-[0.14em] text-[#a49bad]">ASU · AIDvisor</p>
          </footer>
        </div>
      </article>

      {/* slot: email draft, screen only */}
      {children ? <div className="cmps-noprint mt-4">{children}</div> : null}
    </div>
  );
}
