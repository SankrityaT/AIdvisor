"use client";

// ── Agent Activity panel ──────────────────────────────────────────────
//
// Renders REAL pipeline telemetry. Every row, label, model id and duration
// below comes from an `AgentEvent` that `lib/agents.ts` emitted around an
// actual ASU AIR call and streamed over SSE. Nothing here simulates,
// schedules or delays activity; the only timer is a 100ms tick that keeps
// the elapsed readout of an already-running agent honest.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { AgentEvent } from "@/lib/types";
import {
  buildEntries,
  deriveRuns,
  formatClock,
  formatDuration,
  type AgentEntry,
  type EntryCluster,
  type RunGroup,
} from "./derive";
import { IDLE_STAGES, ROSTER, ROSTER_MODEL_COUNT, roleOf } from "./roster";

export interface AgentPanelProps {
  /** Append-only telemetry log the lead maintains. */
  events: AgentEvent[];
  /** A pipeline request is currently in flight. */
  running?: boolean;
  className?: string;
  /** Narrow variant for a sidebar. */
  compact?: boolean;
}

/** Newest N agent invocations kept on screen. */
const MAX_ENTRIES = 40;
/** Newest N runs kept on screen. */
const MAX_RUNS = 4;
/** How often the elapsed readout of an already-running agent is refreshed. */
const TICK_MS = 100;

// Hydration-safe "are we on the client yet" flag, used only to defer
// locale-formatted clock times until after mount.
const noopSubscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

export default function AgentPanel({
  events,
  running = false,
  className = "",
  compact = false,
}: AgentPanelProps) {
  const entries = useMemo(() => buildEntries(events), [events]);
  const activeCount = entries.reduce((n, e) => (e.status === "active" ? n + 1 : n), 0);
  const hasActive = activeCount > 0;

  // Live elapsed readout for agents that are genuinely still running.
  // This is the only timer in the panel and it invents nothing: it just
  // re-reads the clock while a real agent is still in flight.
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!hasActive) return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, TICK_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [hasActive]);

  // Locale time strings only after mount, so SSR and client agree.
  const mounted = useSyncExternalStore(noopSubscribe, onClient, onServer);

  const visible = useMemo(
    () => (entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries),
    [entries],
  );
  const allRuns = useMemo(() => deriveRuns(visible), [visible]);
  const runs = allRuns.length > MAX_RUNS ? allRuns.slice(-MAX_RUNS) : allRuns;
  const hiddenEntries =
    entries.length - runs.reduce((n, r) => n + r.entryCount, 0);

  const modelCount = useMemo(
    () => new Set(events.map((e) => e.model)).size,
    [events],
  );
  const errorCount = entries.reduce((n, e) => (e.status === "error" ? n + 1 : n), 0);

  // Keep newest activity in view unless the judge scrolled up to read.
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [events.length, activeCount]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 72;
  };

  const status = hasActive
    ? `${activeCount} agent${activeCount === 1 ? "" : "s"} working`
    : running
      ? "Pipeline starting"
      : entries.length > 0
        ? "Idle — last run complete"
        : "Idle";

  return (
    <section
      className={`flex flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-850/90 ${className}`}
      aria-label="Agent activity"
    >
      <header className="flex items-start justify-between gap-3 border-b border-ink-700 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-[3px]">
            <HeaderDot active={hasActive} pending={running} failed={errorCount > 0} />
          </span>
          <div className="leading-tight">
            <h2 className="text-[13px] font-semibold tracking-wide text-white/90">
              Agent activity
            </h2>
            <p
              className={`text-[11px] ${hasActive ? "text-gold" : "text-mist"}`}
              aria-live="polite"
            >
              {status}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right leading-tight">
          <p className="font-mono text-[10px] text-mist/80">
            {events.length > 0 ? `${modelCount} ASU AIR model${modelCount === 1 ? "" : "s"}` : "ASU AIR"}
          </p>
          <p className="text-[10px] text-mist/60">
            {events.length > 0 ? `${entries.length} agent call${entries.length === 1 ? "" : "s"}` : "multi-agent pipeline"}
          </p>
        </div>
      </header>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={`overflow-y-auto px-3 py-3 ${compact ? "max-h-[280px]" : "max-h-[440px]"}`}
        role="log"
        aria-live="polite"
      >
        {entries.length === 0 ? (
          <IdleRoster compact={compact} running={running} />
        ) : (
          <div className="flex flex-col gap-4">
            {hiddenEntries > 0 && (
              <p className="px-1 text-[10px] text-mist/50">
                {hiddenEntries} earlier agent call{hiddenEntries === 1 ? "" : "s"} not shown
              </p>
            )}
            {runs.map((run) => (
              <RunSection
                key={run.id}
                run={run}
                now={now}
                mounted={mounted}
                compact={compact}
              />
            ))}
          </div>
        )}
      </div>

      {!compact && entries.length > 0 && (
        <footer className="border-t border-ink-700 px-4 py-2">
          <p className="text-[10px] text-mist/70">
            Live telemetry from the real pipeline — each row is one ASU AIR call.
            {errorCount > 0 && (
              <span className="text-alert">
                {" "}
                {errorCount} call{errorCount === 1 ? "" : "s"} failed.
              </span>
            )}
          </p>
        </footer>
      )}
    </section>
  );
}

// ── Run group ─────────────────────────────────────────────────────────

export function RunSection({
  run,
  now,
  mounted,
  compact,
}: {
  run: RunGroup;
  now: number;
  mounted: boolean;
  compact: boolean;
}) {
  const total =
    run.endedAt !== undefined
      ? formatDuration(run.endedAt - run.startedAt)
      : run.active && now > 0
        ? formatDuration(Math.max(0, now - run.startedAt))
        : null;

  return (
    <section className="animate-rise">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
            run.active ? "text-gold" : "text-mist/70"
          }`}
        >
          {run.title}
        </span>
        <span className="h-px flex-1 bg-ink-700" aria-hidden />
        <span className="shrink-0 font-mono text-[10px] text-mist/55">
          {mounted ? formatClock(run.startedAt) : ""}
          {total ? ` · ${total}` : ""}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {run.clusters.map((cluster) =>
          cluster.parallel ? (
            <ParallelCluster key={cluster.id} cluster={cluster} now={now} compact={compact} />
          ) : (
            <AgentRow
              key={cluster.entries[0].id}
              entry={cluster.entries[0]}
              now={now}
              compact={compact}
            />
          ),
        )}
      </div>
    </section>
  );
}

// ── Concurrent agents ─────────────────────────────────────────────────

/**
 * Entries whose live intervals overlapped. Drawn as one bracketed block so
 * simultaneous work reads as parallel lanes, never as a queue.
 */
export function ParallelCluster({
  cluster,
  now,
  compact,
}: {
  cluster: EntryCluster;
  now: number;
  compact: boolean;
}) {
  const anyActive = cluster.entries.some((e) => e.status === "active");
  return (
    <div
      className={`rounded-lg border border-l-2 bg-ink-900/60 ${
        anyActive ? "border-ink-700 border-l-gold" : "border-ink-700 border-l-ink-600"
      }`}
    >
      <div className="flex items-center gap-1.5 px-2.5 pt-1.5">
        <ForkIcon className={anyActive ? "text-gold" : "text-mist/60"} />
        <span
          className={`text-[9px] font-semibold uppercase tracking-[0.12em] ${
            anyActive ? "text-gold" : "text-mist/60"
          }`}
        >
          {cluster.entries.length} agents in parallel
        </span>
      </div>
      <div className="flex flex-col gap-1 px-1 pb-1.5 pt-1">
        {cluster.entries.map((entry) => (
          <AgentRow key={entry.id} entry={entry} now={now} compact={compact} inCluster />
        ))}
      </div>
    </div>
  );
}

// ── One agent invocation ──────────────────────────────────────────────

export function AgentRow({
  entry,
  now,
  compact,
  inCluster = false,
}: {
  entry: AgentEntry;
  now: number;
  compact: boolean;
  inCluster?: boolean;
}) {
  const role = roleOf(entry.agent);
  const active = entry.status === "active";
  const failed = entry.status === "error";

  const elapsed = active
    ? now > 0
      ? formatDuration(Math.max(0, now - entry.startedAt))
      : null
    : entry.ms !== undefined
      ? formatDuration(entry.ms)
      : null;

  return (
    <div
      className={`flex items-start gap-2 rounded-md px-2 py-1.5 ${
        active ? "bg-gold/[0.06]" : failed ? "bg-alert/[0.06]" : inCluster ? "" : "bg-ink-900/40"
      }`}
    >
      <span className="mt-[3px] shrink-0">
        <StatusMark status={entry.status} />
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-[12px] leading-snug ${
            active ? "text-white/95" : failed ? "text-alert" : "text-mist"
          }`}
          title={`${role} — ${entry.label}`}
        >
          <span className={active ? "font-medium text-gold" : "font-medium text-white/70"}>
            {role}
          </span>
          <span className="text-mist/50"> · </span>
          {entry.label}
        </p>
        <p className="flex items-center gap-1.5 truncate font-mono text-[10px] leading-snug text-mist/70">
          <span className="truncate" title={entry.model}>
            {entry.model}
          </span>
          {failed && entry.detail && !compact && (
            <span className="truncate text-alert/80" title={entry.detail}>
              · {entry.detail}
            </span>
          )}
        </p>
      </div>

      <span
        className={`mt-[1px] shrink-0 font-mono text-[10px] tabular-nums ${
          active ? "text-gold" : failed ? "text-alert" : "text-mist/60"
        }`}
      >
        {failed ? (elapsed ? `failed ${elapsed}` : "failed") : elapsed ?? ""}
      </span>
    </div>
  );
}

// ── Idle state ────────────────────────────────────────────────────────

export function IdleRoster({ compact, running }: { compact: boolean; running: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-[11px] leading-relaxed text-mist">
        {running
          ? "Pipeline starting — agents will report here as they run."
          : "No agents have run yet."}{" "}
        {ROSTER_MODEL_COUNT} distinct ASU AIR models take a turn:
      </p>

      {IDLE_STAGES.map((stage) => (
        <div key={stage.title}>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mist/60">
              {stage.title}
            </span>
            <span className="h-px flex-1 bg-ink-700" aria-hidden />
          </div>

          {compact ? (
            <p className="px-1 text-[11px] text-mist/80">
              {stage.keys.map((key) => ROSTER[key].role).join(" · ")}
              {stage.note && <span className="text-mist/50"> — {stage.note}</span>}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {stage.keys.map((key) => (
                <li key={key} className="flex items-baseline gap-2 px-1">
                  <span className="w-[74px] shrink-0 text-[11px] text-white/60">
                    {ROSTER[key].role}
                  </span>
                  <span className="truncate font-mono text-[10px] text-mist/55" title={ROSTER[key].model}>
                    {ROSTER[key].model}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {stage.note && !compact && (
            <p className="mt-1 px-1 text-[10px] text-mist/50">{stage.note}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Marks (inline SVG only — no emoji) ────────────────────────────────

function HeaderDot({
  active,
  pending,
  failed,
}: {
  active: boolean;
  pending: boolean;
  failed: boolean;
}) {
  if (active) {
    return (
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/50" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
      </span>
    );
  }
  return (
    <span
      className={`block h-2 w-2 rounded-full ${
        pending ? "animate-pulse-slow bg-gold/60" : failed ? "bg-alert/70" : "bg-ink-600"
      }`}
      aria-hidden
    />
  );
}

function StatusMark({ status }: { status: AgentEntry["status"] }) {
  if (status === "active") {
    return (
      <span className="relative flex h-[7px] w-[7px]" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/50" />
        <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-gold animate-pulse-slow" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <svg viewBox="0 0 12 12" className="h-3 w-3 text-alert" fill="none" aria-hidden>
        <path
          d="M3 3l6 6M9 3l-6 6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3 text-mist/45" fill="none" aria-hidden>
      <path
        d="M2.5 6.3l2.3 2.3 4.7-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ForkIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 12" className={`h-3 w-3 ${className}`} fill="none" aria-hidden>
      <path
        d="M2 6h2.5M4.5 6c2 0 2-4 4-4H12M4.5 6h7.5M4.5 6c2 0 2 4 4 4H12"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
