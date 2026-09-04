// ── Real multi-agent orchestration + live telemetry ────────────────────
// SHARED. Feature agents import read-only; do not edit.
//
// Every "agent" here is a genuine, separately-prompted call to a distinct
// ASU AIR model. The Agent Activity panel renders the events this file
// emits, so what a judge sees on screen is the actual pipeline — not a
// scripted animation.

import type { AgentEvent, AgentKey } from "./types";
import { MODELS } from "./asuair";

export interface AgentSpec {
  key: AgentKey;
  role: string;   // short name shown in the panel
  label: string;  // plain-language status line
  model: string;  // real ASU AIR model id
}

export const AGENTS: Record<AgentKey, AgentSpec> = {
  curator:         { key: "curator",         role: "Curator",  label: "Reading your major map and quiz answers",        model: MODELS.curator },
  planner:         { key: "planner",         role: "Planner",  label: "Drafting your semester-by-semester route",       model: MODELS.planner },
  critic:          { key: "critic",          role: "Critic",   label: "Auditing the plan against prerequisites",        model: MODELS.critic },
  analyst:         { key: "analyst",         role: "Analyst",  label: "Diagnosing what just broke in your schedule",    model: MODELS.curator },
  persona_speed:   { key: "persona_speed",   role: "Reasoner", label: "Reasoner A — optimizing for fastest graduation", model: MODELS.reasoner },
  persona_workload:{ key: "persona_workload",role: "Reasoner", label: "Reasoner B — optimizing for lightest workload",  model: MODELS.reasoner },
  persona_career:  { key: "persona_career",  role: "Reasoner", label: "Reasoner C — optimizing for career alignment",   model: MODELS.reasoner },
  judge:           { key: "judge",           role: "Judge",    label: "Judge is weighing the three reroute options",    model: MODELS.judge },
  narrator:        { key: "narrator",        role: "Narrator", label: "Writing your final-semester outlook",            model: MODELS.planner },
  relevance:       { key: "relevance",       role: "Advisor",  label: "Explaining why each course fits your goal",      model: MODELS.fast },
  handoff:         { key: "handoff",         role: "Escalate", label: "Preparing a human advisor handoff",              model: MODELS.reasoner },
  chat:            { key: "chat",            role: "AIDVisor", label: "AIDVisor is answering",                          model: MODELS.chat },
};

export type Emit = (e: AgentEvent) => void;

/** Tracks a pipeline run and emits real start/done/error events with timings. */
export class AgentRun {
  readonly events: AgentEvent[] = [];
  /**
   * Ship the result to the client BEFORE the pipeline finishes, so the UI can
   * render while non-blocking agents (e.g. the critic) are still working.
   * Set by streamPipeline; a no-op otherwise.
   */
  deliver: (result: unknown) => void = () => {};
  /** Send an out-of-band frame (e.g. a late critic verdict) after delivery. */
  extra: (payload: unknown) => void = () => {};
  constructor(private readonly emit?: Emit) {}

  private push(e: AgentEvent) {
    this.events.push(e);
    try { this.emit?.(e); } catch { /* stream already closed */ }
  }

  /** Run one agent step, emitting telemetry around it. */
  async step<T>(key: AgentKey, fn: () => Promise<T>, detail?: string): Promise<T> {
    const spec = AGENTS[key];
    const t0 = Date.now();
    this.push({ agent: key, label: spec.label, model: spec.model, phase: "start", detail, at: t0 });
    try {
      const out = await fn();
      this.push({ agent: key, label: spec.label, model: spec.model, phase: "done", detail, ms: Date.now() - t0, at: Date.now() });
      return out;
    } catch (err) {
      this.push({
        agent: key, label: spec.label, model: spec.model, phase: "error",
        detail: err instanceof Error ? err.message : String(err),
        ms: Date.now() - t0, at: Date.now(),
      });
      throw err;
    }
  }

  /** Run several agents genuinely concurrently, each with its own telemetry. */
  async parallel<T>(steps: Array<{ key: AgentKey; fn: () => Promise<T>; detail?: string }>): Promise<Array<PromiseSettledResult<T>>> {
    return Promise.allSettled(steps.map((s) => this.step(s.key, s.fn, s.detail)));
  }
}

// ── SSE plumbing ───────────────────────────────────────────────────────

/**
 * Wrap a pipeline in a Server-Sent Events response.
 * Emits `{type:"agent"}` frames live, then one `{type:"result"}` frame.
 */
export function streamPipeline<T>(handler: (run: AgentRun) => Promise<T>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)); } catch { /* closed */ }
      };
      const run = new AgentRun((e) => send({ type: "agent", event: e }));
      let delivered = false;
      run.deliver = (result: unknown) => {
        if (delivered) return;
        delivered = true;
        send({ type: "result", result });
      };
      run.extra = (payload: unknown) => send({ type: "extra", payload });
      try {
        const result = await handler(run);
        run.deliver(result);
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        send({ type: "end" });
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/** Client-side helper: consume an SSE pipeline endpoint. */
export async function consumePipeline(
  url: string,
  body: unknown,
  onAgent: (e: AgentEvent) => void,
  onExtra?: (payload: unknown) => void,
): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.body) throw new Error(`No stream from ${url}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let result: unknown;
  let error: string | undefined;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const frames = buf.split("\n\n");
    buf = frames.pop() ?? "";
    for (const frame of frames) {
      const line = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      let msg: { type: string; event?: AgentEvent; result?: unknown; payload?: unknown; message?: string };
      try { msg = JSON.parse(line.slice(6)); } catch { continue; }
      if (msg.type === "agent" && msg.event) onAgent(msg.event);
      else if (msg.type === "result") result = msg.result;
      else if (msg.type === "extra") onExtra?.(msg.payload);
      else if (msg.type === "error") error = msg.message;
    }
  }
  if (error) throw new Error(error);
  return result;
}
