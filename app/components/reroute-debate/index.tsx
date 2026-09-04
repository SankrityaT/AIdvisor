"use client";

// ── The reroute debate ─────────────────────────────────────────────────
// Three reasoner personas were handed the SAME broken semester and ran
// CONCURRENTLY on the reasoner model. Each returned a valid
// reroute; a judge model picked one. This component renders that argument.
//
// Purely presentational: everything comes in through `result`, and the only
// thing that goes back out is `onApply(result.chosen)`. No fetching here.

import { useMemo, useState, type ReactNode } from "react";
import { MODELS } from "@/lib/models";
import type { FlowchartOutput, MajorMap, RerouteProposal, RerouteResult } from "@/lib/types";
import { BREAK_LABEL } from "@/lib/demo";

import ProposalCard from "./ProposalCard";
import { diffPlans, norm, safeIndex, termOf, type SemesterDiff } from "./diff";

/** The model the three reasoners and the judge actually run on. Mirrors
 *  MODELS.reasoner / MODELS.judge in lib/asuair.ts — which is SERVER ONLY
 *  and therefore cannot be imported from a client component. */
const REASONER_MODEL = MODELS.reasoner;
const JUDGE_MODEL = MODELS.judge;

const LANES = ["Reasoner A", "Reasoner B", "Reasoner C"];

/** Literal class strings so Tailwind can see them. Indexed by proposal count. */
const COLUMNS = ["", "", "sm:grid-cols-2", "sm:grid-cols-2 md:grid-cols-3"];

export interface RerouteDebateProps {
  result: RerouteResult;
  majorMap: MajorMap;
  /** Student accepts the winning reroute. Omit and no apply button renders. */
  onApply?: (chosen: FlowchartOutput) => void;
  className?: string;
}

// ── small pieces ───────────────────────────────────────────────────────

function Shell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={`rounded-2xl border border-ink-700 bg-ink-900/70 p-4 sm:p-5 ${className ?? ""}`}
      aria-label="Reroute debate"
    >
      {children}
    </section>
  );
}

/** Fan-out from the single break into three simultaneous lanes. */
function ParallelFan({ lanes }: { lanes: number }) {
  const stops = Array.from({ length: lanes }, (_, i) => ((i + 0.5) / lanes) * 300);
  return (
    <svg
      viewBox="0 0 300 44"
      preserveAspectRatio="none"
      className="hidden h-11 w-full md:block"
      aria-hidden="true"
    >
      <g stroke="#2ec4b6" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke">
        {stops.map((x, i) => (
          <path
            key={i}
            d={`M150 0 C 150 22, ${x} 22, ${x} 44`}
            strokeOpacity="0.55"
            strokeDasharray="5 5"
            vectorEffect="non-scaling-stroke"
            className="animate-dash"
          />
        ))}
      </g>
      {stops.map((x, i) => (
        <circle key={i} cx={x} cy={42} r="2.5" fill="#2ec4b6" vectorEffect="non-scaling-stroke" />
      ))}
      <circle cx="150" cy="2" r="3" fill="#ff6b4a" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function JudgeGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M11 2v2.2L4.4 6 2 13h7l-2.4-6.3L11 5.4V20H6v2h12v-2h-5V5.4l4.4 1.3L15 13h7l-2.4-7L13 4.2V2h-2Z" />
    </svg>
  );
}

// ── main ───────────────────────────────────────────────────────────────

export default function RerouteDebate({ result, majorMap, onApply, className }: RerouteDebateProps) {
  // Keyed on the result object, so a second "Simulate Registration" run resets
  // the button instead of leaving it stuck on "Reroute applied".
  const [appliedFor, setAppliedFor] = useState<RerouteResult | null>(null);
  const applied = appliedFor === result;

  const idx = useMemo(() => safeIndex(majorMap), [majorMap]);

  const proposals: RerouteProposal[] = useMemo(
    () => (Array.isArray(result?.proposals) ? result.proposals.filter(Boolean) : []),
    [result],
  );

  const broken = useMemo(
    () => (Array.isArray(result?.disruption?.broken) ? result.disruption.broken.filter(Boolean) : []),
    [result],
  );
  const brokenCodes = useMemo(() => broken.map((b) => norm(b.code)), [broken]);

  const disruptedSemester = result?.disruption?.semester ?? 0;

  // One diff per proposal, against the plan the student was on.
  const diffsByPersona = useMemo(() => {
    const m = new Map<string, SemesterDiff[]>();
    for (const p of proposals) m.set(p.persona, diffPlans(result?.previous_plan, p.plan, idx));
    return m;
  }, [proposals, result, idx]);

  // ── empty / degraded states — never a blank panel ──────────────────
  if (!result) {
    return (
      <Shell className={className}>
        <p className="text-sm text-mist">No reroute has been run yet.</p>
      </Shell>
    );
  }

  const deadEnd = Boolean(result.dead_end);
  const winnerPersona = String(result.winner ?? "");
  const winner = deadEnd ? undefined : proposals.find((p) => p.persona === winnerPersona);
  const hasWinner = Boolean(winner);

  const rationale =
    (result.judge_rationale ?? "").trim() ||
    (winner
      ? `${winner.label} holds graduation at ${winner.graduation_target}.`
      : "The judge did not return a rationale for this run.");

  const disruptedTerm = termOf(result.previous_plan, disruptedSemester);

  const handleApply = () => {
    if (!onApply || !result.chosen) return;
    onApply(result.chosen);
    setAppliedFor(result);
  };

  return (
    <Shell className={className}>
      {/* ── header: what broke, and who is arguing about it ───────── */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-gold">
            Reroute debate
          </h3>
          <p className="mt-1 text-sm text-mist">
            Three reasoners were handed the same broken semester and answered at the same time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {broken.length === 0 ? (
            <span className="rounded-md border border-ink-700 bg-ink-850 px-2 py-1 text-[11px] text-mist/70">
              No disruption recorded
            </span>
          ) : (
            broken.map((b) => (
              <span
                key={`${b.code}-${b.status}`}
                className="flex items-center gap-1.5 rounded-md border border-alert/45 bg-alert/10 px-2 py-1 font-mono text-[11px] text-alert"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-alert animate-pulse-slow" />
                {norm(b.code)}
                <span className="text-[10px] tracking-wider text-alert/75">
                  {BREAK_LABEL[b.status] ?? String(b.status).toUpperCase()}
                </span>
              </span>
            ))
          )}
        </div>
      </header>

      {/* ── the concurrency band ───────────────────────────────────── */}
      <div className="mt-4 rounded-xl border border-ink-800 bg-ink-950/40 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-[11px] text-mist/80">
            <span className="flex items-center gap-1 rounded-full border border-teal/40 bg-teal/10 px-2 py-0.5 font-semibold uppercase tracking-[0.12em] text-teal">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal animate-pulse-slow" />
              Ran concurrently
            </span>
            <span className="text-mist/60">
              Semester {disruptedSemester}
              {disruptedTerm ? ` · ${disruptedTerm}` : ""} broke — one input, {proposals.length || 3} simultaneous
              answers.
            </span>
          </span>
          <span className="font-mono text-[10.5px] text-mist/55">{REASONER_MODEL}</span>
        </div>
        <ParallelFan lanes={Math.max(proposals.length, 1)} />
      </div>

      {/* ── the three proposals ─────────────────────────────────────── */}
      {proposals.length === 0 ? (
        <div className="mt-4 rounded-xl border border-ink-700 bg-ink-950/40 p-4">
          <p className="text-sm text-mist">
            The reasoners returned no comparable proposals for this disruption.
          </p>
          {result.explanation && (
            <p className="mt-1.5 text-[12.5px] text-mist/70">{result.explanation}</p>
          )}
        </div>
      ) : (
        // All three enter together — no stagger, because they did not take turns.
        <div className={`mt-3 grid gap-3 animate-rise ${COLUMNS[Math.min(proposals.length, 3)]}`}>
          {proposals.map((p, i) => (
            <ProposalCard
              key={`${p.persona}-${i}`}
              proposal={p}
              lane={LANES[i] ?? `Reasoner ${i + 1}`}
              isWinner={!deadEnd && p.persona === winnerPersona}
              hasWinner={hasWinner}
              disruptedSemester={disruptedSemester}
              brokenCodes={brokenCodes}
              diffs={diffsByPersona.get(p.persona) ?? []}
            />
          ))}
        </div>
      )}

      {/* ── verdict, or escalation ──────────────────────────────────── */}
      {deadEnd ? (
        <div className="mt-4 rounded-xl border border-alert/50 bg-alert/10 p-4">
          <div className="flex items-center gap-2 text-alert">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M12 2 1.5 20.5h21L12 2Zm-1 6.5h2v6h-2v-6Zm0 7.5h2v2h-2v-2Z" />
            </svg>
            <h4 className="text-[12px] font-bold uppercase tracking-[0.16em]">
              Dead end — escalating to a human advisor
            </h4>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-white/85">
            {result.explanation?.trim() ||
              "No proposal preserves the graduation date without breaking a prerequisite."}
          </p>
          <p className="mt-2 text-[12px] text-mist/75">
            All three reasoners are shown above with the exact constraint each one hit. A handoff
            document is being prepared for a human advisor — nothing is applied automatically.
          </p>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-gold/35 bg-gradient-to-r from-gold/10 to-transparent p-4">
          <div className="flex items-center gap-2 text-gold">
            <JudgeGlyph />
            <span className="text-[11px] font-bold uppercase tracking-[0.16em]">Judge&rsquo;s verdict</span>
            <span className="font-mono text-[10.5px] font-normal normal-case tracking-normal text-mist/55">
              {JUDGE_MODEL}
            </span>
          </div>
          <p className="mt-2 text-[15px] leading-relaxed text-white/90">&ldquo;{rationale}&rdquo;</p>
          {winner && (
            <p className="mt-2 text-[12px] text-mist/75">
              Chose <span className="font-semibold text-gold-200">{winner.label}</span> — graduation
              holds at{" "}
              <span className="font-mono text-gold">{result.chosen?.graduation_target ?? winner.graduation_target}</span>
              . The other two were valid; they were not the best fit.
            </p>
          )}
        </div>
      )}

      {/* ── apply ───────────────────────────────────────────────────── */}
      {!deadEnd && onApply && result.chosen && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-mist/70">
            Applying replaces your route with the winning reroute.
          </p>
          <button
            type="button"
            onClick={handleApply}
            disabled={applied}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-gold/70 ${
              applied
                ? "cursor-default border border-teal/50 bg-teal/12 text-teal"
                : "bg-gold text-ink-950 hover:bg-gold-200"
            }`}
          >
            {applied ? (
              <>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M9.6 16.9 4.8 12l-1.7 1.7 6.5 6.5 14-14L21.9 4.5 9.6 16.9Z" />
                </svg>
                Reroute applied
              </>
            ) : (
              <>
                Apply this reroute
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M13.2 5 11.8 6.4 16.4 11H4v2h12.4l-4.6 4.6 1.4 1.4L20.2 12 13.2 5Z" />
                </svg>
              </>
            )}
          </button>
        </div>
      )}
    </Shell>
  );
}

export { ProposalCard };
export type { ProposalCardProps } from "./ProposalCard";
