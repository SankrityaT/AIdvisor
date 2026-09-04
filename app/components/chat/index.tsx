"use client";

// ── AIVISOR chat panel ────────────────────────────────────────────────
// Presentational + self-contained. Talks to /api/chat over the shared SSE
// pipeline so the lead's Agent Activity panel lights up during chat.
// NOTE: never import lib/asuair here — that is server-only.

import { useCallback, useEffect, useRef, useState } from "react";
import { consumePipeline } from "@/lib/agents";
import type { AgentEvent } from "@/lib/types";
import type { ChatPanelProps, ChatResult, ChatTurn } from "./types";

export type { ChatPanelProps, ChatContext, ChatTurn, ChatResult } from "./types";

const DEFAULT_SUGGESTIONS = [
  "Why is CSE355 in this semester?",
  "What's my hardest semester?",
  "Can I still graduate on time?",
];

const ERROR_REPLY =
  "I couldn't reach the advising models just then. Give it a second and ask me again — I don't want to guess at your plan.";

interface Bubble extends ChatTurn {
  id: number;
  failed?: boolean;
}

let bubbleId = 0;

export default function ChatPanel({
  context,
  onAgentEvent,
  suggestions,
  externalMessage,
  onAssistantReply,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Latest-value refs so `send` can stay referentially stable — the
  // externalMessage effect depends on it and must not re-fire on renders.
  const messagesRef = useRef<Bubble[]>([]);
  const busyRef = useRef(false);
  const contextRef = useRef(context);
  const onAgentEventRef = useRef(onAgentEvent);
  const onAssistantReplyRef = useRef(onAssistantReply);

  useEffect(() => {
    contextRef.current = context;
    onAgentEventRef.current = onAgentEvent;
    onAssistantReplyRef.current = onAssistantReply;
  });

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const commit = useCallback((next: Bubble[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busyRef.current) return;

      const outgoing: Bubble[] = [...messagesRef.current, { id: bubbleId++, role: "user", content: text }];
      commit(outgoing);
      setInput("");
      setError(null);
      busyRef.current = true;
      setBusy(true);

      try {
        const result = (await consumePipeline(
          "/api/chat",
          {
            // failed bubbles are UI-only noise — never feed them back as history
            messages: outgoing.filter((m) => !m.failed).map(({ role, content }) => ({ role, content })),
            context: contextRef.current,
          },
          (e: AgentEvent) => onAgentEventRef.current?.(e),
        )) as ChatResult | undefined;

        const reply = (result?.reply ?? "").trim() || ERROR_REPLY;
        commit([...messagesRef.current, { id: bubbleId++, role: "assistant", content: reply }]);
        onAssistantReplyRef.current?.(reply);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Chat request failed");
        commit([
          ...messagesRef.current,
          { id: bubbleId++, role: "assistant", content: ERROR_REPLY, failed: true },
        ]);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [commit],
  );

  // Voice input feeds questions in here. Fire once per nonce, never on an
  // unrelated re-render.
  const lastNonce = useRef<number | null>(null);
  useEffect(() => {
    if (!externalMessage) return;
    const { text, nonce } = externalMessage;
    if (lastNonce.current === nonce) return;
    lastNonce.current = nonce;
    if (text.trim()) void send(text);
  }, [externalMessage, send]);

  const chips = suggestions && suggestions.length ? suggestions : DEFAULT_SUGGESTIONS;
  const empty = messages.length === 0;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
      {/* header */}
      <header className="flex items-center gap-3 border-b border-ink-700 px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-full border border-maroon/60 bg-maroon/25">
          <CompassMark className="h-4 w-4 text-gold" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-white">AIVISOR</h2>
          <p className="truncate text-xs text-mist">
            Answers come from your route, not the internet
          </p>
        </div>
        <span
          className={`ml-auto flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] uppercase tracking-wider ${
            busy ? "border-gold/40 bg-gold/10 text-gold" : "border-ink-700 bg-ink-850 text-mist"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${busy ? "animate-pulse-slow bg-gold" : "bg-teal"}`}
          />
          {busy ? "Thinking" : "Ready"}
        </span>
      </header>

      {/* transcript */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {empty ? (
          <div className="animate-rise space-y-3 rounded-xl border border-ink-700 bg-ink-850/60 p-4">
            <p className="text-sm text-white">
              Ask me anything about{" "}
              <span className="text-gold">your</span> route to graduation.
            </p>
            <p className="text-xs leading-relaxed text-mist">
              I can see every semester on your map, the prerequisites behind each stop, and what
              other students said about these courses.
            </p>
          </div>
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="animate-rise flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm border border-gold/35 bg-gold/12 px-3.5 py-2.5 text-sm leading-relaxed text-gold-200">
                  {m.content}
                </p>
              </div>
            ) : (
              <div key={m.id} className="animate-rise flex items-start gap-2.5">
                <div
                  data-slot="mascot-small"
                  className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border border-maroon/60 bg-maroon/25"
                >
                  <CompassMark data-slot-fallback className="h-3.5 w-3.5 text-gold" />
                </div>
                <div className="min-w-0">
                  <p
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm border px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.failed
                        ? "border-alert/45 bg-alert/10 text-white"
                        : "border-maroon/50 bg-maroon/20 text-white"
                    }`}
                  >
                    {m.content}
                  </p>
                </div>
              </div>
            ),
          )
        )}

        {busy ? (
          <div className="flex items-start gap-2.5">
            <div
              data-slot="mascot-small"
              className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border border-maroon/60 bg-maroon/25"
            >
              <CompassMark data-slot-fallback className="h-3.5 w-3.5 text-gold" />
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-maroon/50 bg-maroon/20 px-3.5 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-pulse-slow rounded-full bg-gold"
                  style={{ animationDelay: `${i * 0.22}s` }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* suggestions */}
      {empty && !busy ? (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => void send(c)}
              className="rounded-full border border-ink-700 bg-ink-850 px-3 py-1.5 text-xs text-mist transition-colors hover:border-gold/50 hover:text-gold"
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="mx-4 mb-2 rounded-lg border border-alert/40 bg-alert/10 px-3 py-2 text-xs text-alert">
          {error}
        </p>
      ) : null}

      {/* composer */}
      <form
        className="flex items-center gap-2 border-t border-ink-700 px-3 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          placeholder={busy ? "AIVISOR is thinking…" : "Ask about your plan…"}
          aria-label="Ask AIVISOR about your plan"
          className="min-w-0 flex-1 rounded-xl border border-ink-700 bg-ink-850 px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-mist/70 focus:border-gold/50 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/40 bg-gold/15 text-gold transition-colors hover:bg-gold/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
            <path
              d="M4 12h14M12 5l7 7-7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>
    </section>
  );
}

function CompassMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M15.5 8.5l-2 5-5 2 2-5 5-2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
