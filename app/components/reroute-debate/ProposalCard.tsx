"use client";

// ── One reasoner's proposal in the reroute debate ──────────────────────
// Presentational only. The winner is elevated in gold; the other two stay
// fully legible and are labelled as valid-but-not-chosen, because that
// framing is the point: three real options existed, one was selected.

import type { ReactNode } from "react";
import type { RerouteProposal } from "@/lib/types";
import { landingSemester, type SemesterDiff } from "./diff";

const PERSONA_ICON: Record<string, ReactNode> = {
  // fastest graduation — a bolt
  speed: <path d="M13 2 4 13.2h5.6L8.9 22 18 10.8h-5.6L13 2Z" />,
  // lightest workload — descending bars
  workload: (
    <>
      <rect x="3" y="5" width="18" height="2.4" rx="1.2" />
      <rect x="3" y="10.8" width="12" height="2.4" rx="1.2" />
      <rect x="3" y="16.6" width="6" height="2.4" rx="1.2" />
    </>
  ),
  // career fit — a target
  career: (
    <>
      <circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="1.4" />
    </>
  ),
};

function PersonaGlyph({ persona }: { persona: string }) {
  const glyph = PERSONA_ICON[persona] ?? PERSONA_ICON.speed;
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
      {glyph}
    </svg>
  );
}

function Chip({ tone, children }: { tone: "removed" | "added" | "kept"; children: ReactNode }) {
  const cls =
    tone === "removed"
      ? "border-ink-600 bg-ink-900/70 text-mist/70 line-through decoration-alert/70"
      : tone === "added"
        ? "border-teal/55 bg-teal/12 text-teal"
        : "border-ink-700 bg-ink-850 text-mist";
  return (
    <span className={`rounded-md border px-1.5 py-0.5 font-mono text-[11px] leading-4 ${cls}`}>
      {children}
    </span>
  );
}

export interface ProposalCardProps {
  proposal: RerouteProposal;
  /** "Reasoner A" / "B" / "C" — the concurrent lane this ran in. */
  lane: string;
  isWinner: boolean;
  /** false during a dead end — nobody won, so nobody is elevated. */
  hasWinner: boolean;
  disruptedSemester: number;
  brokenCodes: string[];
  /** Diff of this proposal's plan against result.previous_plan. */
  diffs: SemesterDiff[];
}

export function ProposalCard({
  proposal,
  lane,
  isWinner,
  hasWinner,
  disruptedSemester,
  brokenCodes,
  diffs,
}: ProposalCardProps) {
  const hit = diffs.find((d) => d.semester === disruptedSemester);
  const violations = (proposal.violations ?? []).filter(Boolean);

  // Landing semesters for the broken courses already get their own row above,
  // so strip them here — "Also moved" should only carry what is genuinely new.
  const otherChanges = diffs
    .filter((d) => d.semester !== disruptedSemester)
    .map((d) => ({ ...d, added: d.added.filter((c) => !brokenCodes.includes(c)) }))
    .filter((d) => d.removed.length > 0 || d.added.length > 0);

  const shell = isWinner
    ? "border-gold/70 bg-gradient-to-b from-gold/10 to-ink-900/80 shadow-[0_0_0_1px_rgba(255,198,39,.35),0_18px_40px_-24px_rgba(255,198,39,.55)]"
    : "border-ink-700 bg-ink-900/70 hover:border-ink-600";

  return (
    <article
      className={`relative flex h-full flex-col gap-3 rounded-xl border p-4 transition-colors ${shell}`}
      aria-label={`${proposal.label}${isWinner ? " — chosen by the judge" : ""}`}
    >
      {isWinner && (
        <span className="absolute -top-2.5 left-4 flex items-center gap-1 rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-950 shadow">
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden="true">
            <path d="M9.6 16.9 4.8 12l-1.7 1.7 6.5 6.5 14-14L21.9 4.5 9.6 16.9Z" />
          </svg>
          Chosen
        </span>
      )}

      {/* lane + persona */}
      <header className="flex items-start justify-between gap-2 pt-1">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-mist/60">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${isWinner ? "bg-gold" : "bg-ink-600"}`} />
            {lane}
          </div>
          <h4
            className={`mt-1 flex items-center gap-2 text-sm font-semibold ${
              isWinner ? "text-gold-200" : "text-white/85"
            }`}
          >
            <PersonaGlyph persona={proposal.persona} />
            <span className="truncate">{proposal.label || proposal.persona}</span>
          </h4>
        </div>
      </header>

      {/* tradeoff — the one sentence this persona is arguing */}
      <p className={`text-[12.5px] leading-relaxed ${isWinner ? "text-white/80" : "text-mist"}`}>
        &ldquo;{proposal.tradeoff || "No tradeoff stated."}&rdquo;
      </p>

      {/* graduation target */}
      <div className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-950/50 px-2.5 py-1.5">
        <span className="text-[10px] uppercase tracking-[0.14em] text-mist/60">Graduates</span>
        <span className={`font-mono text-xs font-semibold ${isWinner ? "text-gold" : "text-white/80"}`}>
          {proposal.graduation_target || "—"}
        </span>
      </div>

      {/* what changed in the disrupted semester */}
      <div className="rounded-lg border border-ink-700 bg-ink-950/40 p-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] uppercase tracking-[0.14em] text-mist/60">
            Semester {disruptedSemester}
            {hit?.term ? ` · ${hit.term}` : ""}
          </span>
          {hit && (hit.creditsBefore > 0 || hit.creditsAfter > 0) && (
            <span className="font-mono text-[10px] text-mist/55">
              {hit.creditsBefore}→{hit.creditsAfter} cr
            </span>
          )}
        </div>

        {!hit || (!hit.removed.length && !hit.added.length) ? (
          <p className="mt-2 text-[11.5px] text-mist/70">No change to this semester.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {hit.removed.length > 0 && (
              <div className="flex items-start gap-1.5">
                <span className="mt-0.5 font-mono text-[11px] leading-4 text-alert/80" aria-hidden="true">
                  −
                </span>
                <span className="sr-only">Removed:</span>
                <div className="flex flex-wrap gap-1">
                  {hit.removed.map((c) => (
                    <Chip key={c} tone="removed">
                      {c}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
            {hit.added.length > 0 && (
              <div className="flex items-start gap-1.5">
                <span className="mt-0.5 font-mono text-[11px] leading-4 text-teal" aria-hidden="true">
                  +
                </span>
                <span className="sr-only">Added:</span>
                <div className="flex flex-wrap gap-1">
                  {hit.added.map((c) => (
                    <Chip key={c} tone="added">
                      {c}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* where each broken course landed */}
      {brokenCodes.length > 0 && (
        <ul className="space-y-1">
          {brokenCodes.map((code) => {
            const to = landingSemester(code, proposal.plan);
            const term = to ? diffs.find((d) => d.semester === to)?.term : undefined;
            return (
              <li key={code} className="flex items-center gap-1.5 font-mono text-[11px] text-mist/80">
                <span className="text-alert/85 line-through decoration-alert/60">{code}</span>
                <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-mist/50" fill="currentColor" aria-hidden="true">
                  <path d="M13.2 5 11.8 6.4 16.4 11H4v2h12.4l-4.6 4.6 1.4 1.4L20.2 12 13.2 5Z" />
                </svg>
                {to ? (
                  <span className="text-teal">
                    S{to}
                    {term ? ` · ${term}` : ""}
                  </span>
                ) : (
                  <span className="text-mist/60">deferred</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* everything else that moved */}
      {otherChanges.length > 0 && (
        <div className="border-t border-ink-800/80 pt-2">
          <div className="text-[10px] uppercase tracking-[0.14em] text-mist/50">Also moved</div>
          <ul className="mt-1 space-y-0.5">
            {otherChanges.slice(0, 3).map((d) => (
              <li key={d.semester} className="font-mono text-[11px] text-mist/75">
                <span className="text-mist/55">S{d.semester}</span>{" "}
                {d.removed.map((c) => (
                  <span key={c} className="mr-1 text-mist/60 line-through decoration-alert/50">
                    −{c}
                  </span>
                ))}
                {d.added.map((c) => (
                  <span key={c} className="mr-1 text-teal">
                    +{c}
                  </span>
                ))}
              </li>
            ))}
            {otherChanges.length > 3 && (
              <li className="text-[11px] text-mist/50">+{otherChanges.length - 3} more semesters touched</li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-auto pt-1">
        {/* honest note: this proposal needed deterministic repair */}
        {violations.length > 0 && (
          <div className="mb-2 flex items-start gap-1.5 rounded-md border border-ink-700 bg-ink-950/60 px-2 py-1.5">
            <svg viewBox="0 0 24 24" className="mt-px h-3 w-3 shrink-0 text-gold-600" fill="currentColor" aria-hidden="true">
              <path d="M12 2 1.5 20.5h21L12 2Zm0 5.5 6.6 11.5H5.4L12 7.5Zm-1 3v4h2v-4h-2Zm0 5.5v2h2v-2h-2Z" />
            </svg>
            <p className="text-[10.5px] leading-snug text-mist/65">
              {violations.slice(0, 2).join(" ")}
              {violations.length > 2 ? ` (+${violations.length - 2} more)` : ""}
            </p>
          </div>
        )}

        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
            isWinner
              ? "border-gold/50 bg-gold/12 text-gold"
              : proposal.valid
                ? "border-ink-600 bg-ink-850 text-mist/70"
                : "border-alert/40 bg-alert/10 text-alert/80"
          }`}
        >
          {isWinner
            ? "Judge’s pick"
            : proposal.valid
              ? hasWinner
                ? "Valid · not chosen"
                : "Valid alternative"
              : "No valid route"}
        </span>
      </div>
    </article>
  );
}

export default ProposalCard;
