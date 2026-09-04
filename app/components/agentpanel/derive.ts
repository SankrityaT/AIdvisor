// ── Pure derivation of panel state from the real AgentEvent log ───────
//
// No timers, no fabrication: everything below is computed from events the
// server actually emitted around real ASU AIR calls.

import type { AgentEvent, AgentKey } from "@/lib/types";

export type EntryStatus = "active" | "done" | "error";

/** One agent invocation: a `start` event, plus its `done`/`error` if it landed. */
export interface AgentEntry {
  id: string;
  agent: AgentKey;
  label: string;
  model: string;
  detail?: string;
  status: EntryStatus;
  startedAt: number;
  endedAt?: number;
  /** Real elapsed ms reported by lib/agents.ts (done/error only). */
  ms?: number;
}

/** Entries that overlapped in wall-clock time ran concurrently. */
export interface EntryCluster {
  id: string;
  parallel: boolean;
  entries: AgentEntry[];
}

/** One pipeline run (plan generation, a reroute, a chat answer, …). */
export interface RunGroup {
  id: string;
  title: string;
  startedAt: number;
  endedAt?: number;
  active: boolean;
  entryCount: number;
  clusters: EntryCluster[];
}

/** Two runs are separated when nothing was in flight for this long. */
export const RUN_GAP_MS = 1500;

/**
 * Minimum wall-clock overlap before two agents are drawn as concurrent.
 * Back-to-back sequential steps can share a millisecond; genuinely
 * parallel calls overlap for seconds.
 */
export const PARALLEL_OVERLAP_MS = 150;

const endOf = (e: AgentEntry): number =>
  e.status === "active" ? Number.POSITIVE_INFINITY : e.endedAt ?? e.startedAt;

/**
 * Fold the append-only event log into one entry per agent invocation.
 * A `start` with no matching `done`/`error` stays `active`. Matching is
 * FIFO per agent key so the same agent can legitimately be in flight twice.
 */
export function buildEntries(events: AgentEvent[]): AgentEntry[] {
  const entries: AgentEntry[] = [];
  const open = new Map<AgentKey, number[]>();

  events.forEach((event, i) => {
    if (event.phase === "start") {
      entries.push({
        id: `${event.agent}-${event.at}-${i}`,
        agent: event.agent,
        label: event.label,
        model: event.model,
        detail: event.detail,
        status: "active",
        startedAt: event.at,
      });
      const queue = open.get(event.agent);
      if (queue) queue.push(entries.length - 1);
      else open.set(event.agent, [entries.length - 1]);
      return;
    }

    const status: EntryStatus = event.phase === "error" ? "error" : "done";
    const index = open.get(event.agent)?.shift();

    if (index === undefined) {
      // A terminal event with no visible start (log truncated / frame lost).
      // Render it honestly rather than dropping real telemetry.
      const ms = event.ms;
      entries.push({
        id: `${event.agent}-${event.at}-${i}`,
        agent: event.agent,
        label: event.label,
        model: event.model,
        detail: event.detail,
        status,
        startedAt: typeof ms === "number" ? event.at - ms : event.at,
        endedAt: event.at,
        ms,
      });
      return;
    }

    const entry = entries[index];
    entry.status = status;
    entry.endedAt = event.at;
    entry.ms = typeof event.ms === "number" ? event.ms : Math.max(0, event.at - entry.startedAt);
    if (event.detail) entry.detail = event.detail;
  });

  return entries;
}

/** Split entries into runs on a quiet gap (nothing in flight). */
export function groupByRun(entries: AgentEntry[], gapMs: number = RUN_GAP_MS): AgentEntry[][] {
  const runs: AgentEntry[][] = [];
  let current: AgentEntry[] | null = null;
  let lastEnd = Number.NEGATIVE_INFINITY;

  for (const entry of entries) {
    // NaN (Infinity - Infinity) means something was still active: never split.
    if (!current || entry.startedAt - lastEnd > gapMs) {
      current = [];
      runs.push(current);
      lastEnd = Number.NEGATIVE_INFINITY;
    }
    current.push(entry);
    lastEnd = Math.max(lastEnd, endOf(entry));
  }

  return runs;
}

/** Bundle entries whose live intervals overlapped — these ran in parallel. */
export function clusterConcurrent(
  entries: AgentEntry[],
  overlapMs: number = PARALLEL_OVERLAP_MS,
): EntryCluster[] {
  const clusters: EntryCluster[] = [];
  let current: AgentEntry[] | null = null;
  let clusterEnd = Number.NEGATIVE_INFINITY;

  for (const entry of entries) {
    const overlap = Math.min(endOf(entry), clusterEnd) - entry.startedAt;
    if (current && overlap > overlapMs) {
      current.push(entry);
      clusterEnd = Math.max(clusterEnd, endOf(entry));
      continue;
    }
    current = [entry];
    clusters.push({ id: entry.id, parallel: false, entries: current });
    clusterEnd = endOf(entry);
  }

  for (const cluster of clusters) cluster.parallel = cluster.entries.length > 1;
  return clusters;
}

/** Name a run from the agents it actually contains. */
export function runTitle(entries: AgentEntry[]): string {
  const keys = new Set<AgentKey>(entries.map((e) => e.agent));
  const hasPersona =
    keys.has("persona_speed") || keys.has("persona_workload") || keys.has("persona_career");

  if (hasPersona || keys.has("judge") || keys.has("analyst")) return "Reroute";
  if (keys.has("planner") || keys.has("curator") || keys.has("critic")) return "Route generation";
  if (keys.has("handoff")) return "Advisor handoff";
  if (keys.has("relevance")) return "Course relevance";
  if (keys.has("narrator")) return "Outlook";
  if (keys.has("chat")) return "AIVISOR answer";
  return "Agent run";
}

/** Full derivation: log -> grouped, clustered runs (oldest first). */
export function deriveRuns(entries: AgentEntry[]): RunGroup[] {
  return groupByRun(entries).map((runEntries) => {
    const active = runEntries.some((e) => e.status === "active");
    const ends = runEntries
      .filter((e) => e.status !== "active")
      .map((e) => e.endedAt ?? e.startedAt);
    return {
      id: `run-${runEntries[0].id}`,
      title: runTitle(runEntries),
      startedAt: runEntries[0].startedAt,
      endedAt: active || ends.length === 0 ? undefined : Math.max(...ends),
      active,
      entryCount: runEntries.length,
      clusters: clusterConcurrent(runEntries),
    };
  });
}

/** Human duration: "840ms", "4.2s", "1m 06s". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 950) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  return `${mins}m ${String(Math.floor(seconds % 60)).padStart(2, "0")}s`;
}

/** Wall-clock stamp for a run header. Client-only (locale/timezone). */
export function formatClock(at: number): string {
  return new Date(at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}
