"use client";

// ── AIDvisor — app shell and integration ───────────────────────────────
// Owned by the lead. Every feature component is presentational; all shared
// state and all pipeline calls live here.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { consumePipeline } from "@/lib/agents";
import { DEMO_DISRUPTION } from "@/lib/demo";
import type {
  AdvisorHandoff, AgentEvent, CourseRelevance, CourseSentiment, DisruptionEvent,
  FlowchartOutput, MajorMap, PlanSemester, QuizAnswers, RerouteResult,
} from "@/lib/types";

import Quiz from "@/app/components/quiz";
import RouteMap from "@/app/components/routemap";
import AIDvisor, { type MascotState } from "@/app/components/mascot";
import AgentPanel from "@/app/components/agentpanel";
import ChatPanel from "@/app/components/chat";
import VoiceControl from "@/app/components/voice";
import ConfidenceMeter from "@/app/components/confidence";
import { computeConfidence } from "@/app/components/confidence/scoring";
import RerouteDebate from "@/app/components/reroute-debate";
import SeniorNarrative, { fetchNarrative } from "@/app/components/senior-narrative";
import { fetchRelevance } from "@/app/components/why-this-class";
import AdvisorHandoffDoc, { fetchHandoff } from "@/app/components/advisor-handoff";
import AdvisorEmailDraft from "@/app/components/advisor-email";
import WhatIfBoard from "@/app/components/whatif";
import ScheduleConflicts from "@/app/components/schedule-conflicts";

type Stage = "quiz" | "app";
type Tool = "route" | "whatif" | "schedule" | "handoff";

/** Render children into a slot a child component reserved via data-slot. */
function SlotPortal({ selector, children }: { selector: string; children: React.ReactNode }) {
  const [node, setNode] = useState<Element | null>(null);
  useEffect(() => {
    let raf = 0;
    const find = () => {
      const el = document.querySelector(selector);
      if (el) setNode(el);
      else raf = requestAnimationFrame(find);
    };
    find();
    return () => cancelAnimationFrame(raf);
  }, [selector]);
  return node ? createPortal(children, node) : null;
}

export default function Page() {
  const [stage, setStage] = useState<Stage>("quiz");
  const [tool, setTool] = useState<Tool>("route");

  const [quiz, setQuiz] = useState<QuizAnswers | null>(null);
  const [majorMap, setMajorMap] = useState<MajorMap | null>(null);
  const [sentiment, setSentiment] = useState<CourseSentiment[]>([]);

  const [flowchart, setFlowchart] = useState<FlowchartOutput | null>(null);
  const [baseGraduation, setBaseGraduation] = useState<string>("");
  const [previousPlan, setPreviousPlan] = useState<PlanSemester[] | undefined>();

  const [disruption, setDisruption] = useState<DisruptionEvent | null>(null);
  const [reroute, setReroute] = useState<RerouteResult | null>(null);
  const [applied, setApplied] = useState(false);

  const [relevance, setRelevance] = useState<CourseRelevance[]>([]);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [handoff, setHandoff] = useState<AdvisorHandoff | null>(null);
  const [handoffLoading, setHandoffLoading] = useState(false);

  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [speaking, setSpeaking] = useState(false);
  const [voiceQuestion, setVoiceQuestion] = useState<{ text: string; nonce: number } | null>(null);
  const [speakText, setSpeakText] = useState<{ text: string; nonce: number } | null>(null);
  const nonce = useRef(0);

  const pushEvent = useCallback((e: AgentEvent) => setEvents((prev) => [...prev, e]), []);

  // ── mascot mood follows the actual app state ─────────────────────────
  const mascot: MascotState = speaking
    ? "speaking"
    : busy
      ? "thinking"
      : disruption && !applied
        ? "alert"
        : applied
          ? "happy"
          : "idle";

  const mascotLine = busy
    ? "Working on it…"
    : disruption && !applied
      ? "Two of your classes just fell through."
      : applied
        ? "Rerouted — your graduation date held."
        : undefined;

  // ── 1. quiz -> multi-agent plan generation ───────────────────────────
  const handleQuiz = useCallback(async (answers: QuizAnswers) => {
    setQuiz(answers);
    setBusy(true);
    setError(null);
    try {
      const result = (await consumePipeline("/api/plan", { quiz: answers }, pushEvent)) as
        | { flowchart: FlowchartOutput; map: MajorMap; sentiment: CourseSentiment[] }
        | undefined;
      if (!result?.flowchart) throw new Error("The planner did not return a route.");
      setFlowchart(result.flowchart);
      setBaseGraduation(result.flowchart.graduation_target);
      setMajorMap(result.map);
      setSentiment(result.sentiment ?? []);
      setStage("app");

      // Non-blocking enrichment — the map is already on screen.
      const codes = result.flowchart.plan.flatMap((s) => s.courses);
      void fetchRelevance({ quiz: answers, codes, majorMap: result.map, sentiment: result.sentiment ?? [], onAgentEvent: pushEvent })
        .then(setRelevance)
        .catch(() => {});
      setNarrativeLoading(true);
      void fetchNarrative({ quiz: answers, flowchart: result.flowchart, majorMap: result.map }, pushEvent)
        .then(setNarrative)
        .catch(() => {})
        .finally(() => setNarrativeLoading(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plan generation failed.");
    } finally {
      setBusy(false);
    }
  }, [pushEvent]);

  // ── 2. the scripted disruption -> reroute debate ─────────────────────
  const simulateRegistration = useCallback(async () => {
    if (!quiz || !flowchart) return;
    setDisruption(DEMO_DISRUPTION);
    setApplied(false);
    setReroute(null);
    setBusy(true);
    setError(null);
    setTool("route");
    try {
      const result = (await consumePipeline(
        "/api/reroute",
        { quiz, flowchart, disruption: DEMO_DISRUPTION },
        pushEvent,
      )) as RerouteResult | undefined;
      if (!result) throw new Error("The reroute pipeline returned nothing.");
      setReroute(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reroute failed.");
    } finally {
      setBusy(false);
    }
  }, [quiz, flowchart, pushEvent]);

  const applyReroute = useCallback((chosen: FlowchartOutput) => {
    setPreviousPlan(flowchart?.plan);
    setFlowchart(chosen);
    setApplied(true);
  }, [flowchart]);

  // ── the honest dead-end path ─────────────────────────────────────────
  const triggerDeadEnd = useCallback(async () => {
    if (!quiz || !flowchart || !majorMap) return;
    const disrupt = disruption ?? DEMO_DISRUPTION;
    setDisruption(disrupt);
    setTool("handoff");
    setBusy(true);
    setHandoffLoading(true);
    try {
      const dead = (await consumePipeline(
        "/api/reroute",
        { quiz, flowchart, disruption: disrupt, forceDeadEnd: true },
        pushEvent,
      )) as RerouteResult | undefined;
      if (dead) setReroute(dead);
      const doc = await fetchHandoff(
        { quiz, flowchart, disruption: disrupt, reroute: dead ?? null, majorMap },
        pushEvent,
      );
      setHandoff(doc);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Handoff generation failed.");
    } finally {
      setBusy(false);
      setHandoffLoading(false);
    }
  }, [quiz, flowchart, majorMap, disruption, pushEvent]);

  // ── voice <-> chat bridge ────────────────────────────────────────────
  const handleTranscript = useCallback((text: string) => {
    nonce.current += 1;
    setVoiceQuestion({ text, nonce: nonce.current });
  }, []);
  const handleAssistantReply = useCallback((text: string) => {
    nonce.current += 1;
    setSpeakText({ text, nonce: nonce.current });
  }, []);

  const confidence = useMemo(() => {
    if (!flowchart || !majorMap) return null;
    return computeConfidence({
      flowchart, majorMap, sentiment,
      broken: disruption?.broken,
      rerouted: applied,
      originalGraduation: baseGraduation || undefined,
    });
  }, [flowchart, majorMap, sentiment, disruption, applied, baseGraduation]);

  const chatContext = useMemo(() => {
    if (!quiz || !flowchart || !majorMap) return null;
    return { quiz, flowchart, majorMap, sentiment, disruption, reroute };
  }, [quiz, flowchart, majorMap, sentiment, disruption, reroute]);

  // ── quiz stage ───────────────────────────────────────────────────────
  if (stage === "quiz" || !flowchart || !majorMap || !quiz) {
    return (
      <main className="min-h-screen px-6 py-10">
        <Quiz onComplete={handleQuiz} submitting={busy} />
        <SlotPortal selector="[data-slot='mascot']">
          <AIDvisor state={busy ? "thinking" : "idle"} size={busy ? 44 : 80} />
        </SlotPortal>
        {error && (
          <p className="mx-auto mt-6 max-w-2xl rounded-xl border border-alert/40 bg-alert/10 px-4 py-3 text-sm text-alert">
            {error}
          </p>
        )}
        {events.length > 0 && (
          <div className="mx-auto mt-8 max-w-2xl">
            <AgentPanel events={events} running={busy} compact />
          </div>
        )}
      </main>
    );
  }

  const finalCourses = flowchart.plan.slice(-2).flatMap((s) => s.courses);

  return (
    <main className="min-h-screen px-5 py-6 lg:px-8">
      {/* header */}
      <header className="mb-6 flex flex-wrap items-center gap-5 border-b border-ink-700 pb-5">
        <AIDvisor state={mascot} size={72} speech={mascotLine} />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-gold">AIDvisor</h1>
          <p className="text-sm text-mist">
            {quiz.name ?? "Sun Devil"} · {quiz.major} · goal: {quiz.goal}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {confidence && <ConfidenceMeter snapshot={confidence} />}
          <button
            onClick={simulateRegistration}
            disabled={busy}
            className="rounded-xl border border-alert/60 bg-alert/15 px-4 py-2.5 text-sm font-semibold text-alert transition hover:bg-alert/25 disabled:opacity-40"
          >
            Simulate Registration
          </button>
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-xl border border-alert/40 bg-alert/10 px-4 py-3 text-sm text-alert">{error}</p>
      )}

      {/* tool tabs */}
      <nav className="mb-5 flex flex-wrap gap-2">
        {([
          ["route", "Route map"],
          ["whatif", "What if"],
          ["schedule", "Time conflicts"],
          ["handoff", "Advisor handoff"],
        ] as Array<[Tool, string]>).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTool(key)}
            className={`rounded-lg border px-3.5 py-1.5 text-sm transition ${
              tool === key
                ? "border-gold bg-gold/15 text-gold"
                : "border-ink-700 text-mist hover:border-maroon-300 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* main column */}
        <div className="min-w-0 space-y-5">
          {tool === "route" && (
            <>
              <RouteMap
                flowchart={flowchart}
                majorMap={majorMap}
                sentiment={sentiment}
                previousPlan={previousPlan}
                broken={disruption?.broken}
                rerouted={applied}
                relevance={relevance}
              />
              {reroute && (
                <RerouteDebate
                  result={reroute}
                  majorMap={majorMap}
                  onApply={applyReroute}
                />
              )}
              <SeniorNarrative
                narrative={narrative}
                loading={narrativeLoading}
                graduationTarget={flowchart.graduation_target}
                finalCourses={finalCourses}
              />
            </>
          )}

          {tool === "whatif" && (
            <WhatIfBoard
              flowchart={flowchart}
              majorMap={majorMap}
              onCommit={(plan) => setFlowchart({ ...flowchart, plan })}
            />
          )}

          {tool === "schedule" && <ScheduleConflicts flowchart={flowchart} majorMap={majorMap} />}

          {tool === "handoff" && (
            <div className="space-y-4">
              {reroute?.dead_end && (
                <RerouteDebate result={reroute} majorMap={majorMap} />
              )}
              {!handoff && !handoffLoading && (
                <div className="rounded-2xl border border-ink-700 bg-ink-900/70 p-6">
                  <h2 className="text-lg font-semibold text-gold">When AIDvisor can&apos;t solve it</h2>
                  <p className="mt-2 max-w-2xl text-sm text-mist">
                    Sometimes there is no valid reroute. Rather than apologise, AIDvisor writes the
                    advisor a briefing the student can act on immediately — and a ready-to-send email.
                  </p>
                  <button
                    onClick={triggerDeadEnd}
                    disabled={busy}
                    className="mt-4 rounded-xl border border-maroon-300 bg-maroon/30 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon/50 disabled:opacity-40"
                  >
                    Simulate a dead end
                  </button>
                </div>
              )}
              <AdvisorHandoffDoc handoff={handoff} loading={handoffLoading}>
                <AdvisorEmailDraft handoff={handoff} studentName={quiz.name} />
              </AdvisorHandoffDoc>
            </div>
          )}
        </div>

        {/* sidebar */}
        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <AgentPanel events={events} running={busy} />
          <VoiceControl
            onTranscript={handleTranscript}
            speakText={speakText}
            onSpeakingChange={setSpeaking}
            disabled={busy}
          />
          {chatContext && (
            <div className="h-[520px]">
              <ChatPanel
                context={chatContext}
                onAgentEvent={pushEvent}
                externalMessage={voiceQuestion}
                onAssistantReply={handleAssistantReply}
              />
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
