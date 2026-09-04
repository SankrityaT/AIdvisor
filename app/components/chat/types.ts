// ── Chat feature types ─────────────────────────────────────────────────
// Owned by the chat agent. Pure types only — no runtime code, no
// "use client", so both the client panel and the API route can import
// this with `import type` and stay on their own side of the wire.

import type {
  AgentEvent,
  CourseSentiment,
  DisruptionEvent,
  FlowchartOutput,
  MajorMap,
  QuizAnswers,
  RerouteResult,
} from "@/lib/types";

export type ChatRole = "user" | "assistant";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

/**
 * Everything AIVISOR is allowed to know about this student.
 * The lead passes this straight through from page.tsx state.
 */
export interface ChatContext {
  quiz: QuizAnswers;
  flowchart: FlowchartOutput;
  majorMap: MajorMap;
  sentiment: CourseSentiment[];
  disruption?: DisruptionEvent | null;
  reroute?: RerouteResult | null;
}

/** POST body accepted by /api/chat. */
export interface ChatRequestBody {
  messages: ChatTurn[];
  context: ChatContext;
}

/** Final `result` frame emitted by /api/chat. */
export interface ChatResult {
  reply: string;
}

export interface ChatPanelProps {
  context: ChatContext;
  onAgentEvent?: (e: AgentEvent) => void;
  suggestions?: string[];
  externalMessage?: { text: string; nonce: number } | null;
  onAssistantReply?: (text: string) => void;
}
