// ── Static roster metadata for the Agent Activity panel ───────────────
//
// WHY THIS FILE EXISTS: the panel is a "use client" component, so it may
// NOT import `lib/agents.ts` — that module pulls in `lib/asuair.ts`, which
// is SERVER ONLY. So the display-only bits of `AGENTS` (role name + model
// id) are mirrored here.
//
// This mirror is used for exactly two things:
//   1. the idle state, before any run has happened;
//   2. the short role name shown in front of a live event's label.
//
// It is NEVER used to invent activity. Every rendered row, label, model id
// and duration comes from a real `AgentEvent` emitted by `lib/agents.ts`.
// If a live event carries a model id that differs from the mirror below,
// the event wins — the panel always renders `event.model`.
//
// Mirrors AGENTS in lib/agents.ts / MODELS in lib/asuair.ts (2026-09).

import { MODELS } from "@/lib/models";
import type { AgentKey } from "@/lib/types";

export interface RosterEntry {
  key: AgentKey;
  role: string;
  label: string;
  model: string;
}

export const ROSTER: Record<AgentKey, RosterEntry> = {
  curator: {
    key: "curator",
    role: "Curator",
    label: "Reading your major map and quiz answers",
    model: MODELS.curator,
  },
  planner: {
    key: "planner",
    role: "Planner",
    label: "Drafting your semester-by-semester route",
    model: MODELS.planner,
  },
  critic: {
    key: "critic",
    role: "Critic",
    label: "Auditing the plan against prerequisites",
    model: MODELS.critic,
  },
  analyst: {
    key: "analyst",
    role: "Analyst",
    label: "Diagnosing what just broke in your schedule",
    model: MODELS.curator,
  },
  persona_speed: {
    key: "persona_speed",
    role: "Reasoner A",
    label: "Optimizing for fastest graduation",
    model: MODELS.reasoner,
  },
  persona_workload: {
    key: "persona_workload",
    role: "Reasoner B",
    label: "Optimizing for lightest workload",
    model: MODELS.reasoner,
  },
  persona_career: {
    key: "persona_career",
    role: "Reasoner C",
    label: "Optimizing for career alignment",
    model: MODELS.reasoner,
  },
  judge: {
    key: "judge",
    role: "Judge",
    label: "Weighing the three reroute options",
    model: MODELS.judge,
  },
  narrator: {
    key: "narrator",
    role: "Narrator",
    label: "Writing your final-semester outlook",
    model: MODELS.planner,
  },
  relevance: {
    key: "relevance",
    role: "Advisor",
    label: "Explaining why each course fits your goal",
    model: MODELS.fast,
  },
  handoff: {
    key: "handoff",
    role: "Escalate",
    label: "Preparing a human advisor handoff",
    model: MODELS.reasoner,
  },
  chat: {
    key: "chat",
    role: "AIVISOR",
    label: "Answering your question",
    model: MODELS.chat,
  },
};

/** Short display name for an agent key, tolerant of keys added later. */
export function roleOf(key: string): string {
  const entry = ROSTER[key as AgentKey];
  if (entry) return entry.role;
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export interface RosterStage {
  title: string;
  keys: AgentKey[];
  note?: string;
}

/** How the roster is presented before anything has run. */
export const IDLE_STAGES: RosterStage[] = [
  {
    title: "Route generation",
    keys: ["curator", "planner", "critic"],
  },
  {
    title: "Reroute",
    keys: ["analyst", "persona_speed", "persona_workload", "persona_career", "judge"],
    note: "3 reasoners run at the same time",
  },
  {
    title: "Along the way",
    keys: ["relevance", "narrator", "handoff", "chat"],
  },
];

/** Distinct ASU AIR models across the whole roster. */
export const ROSTER_MODEL_COUNT = new Set(
  Object.values(ROSTER).map((entry) => entry.model),
).size;
