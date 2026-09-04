// The reroute debate: analyst -> three concurrent reasoner personas -> judge.
// Every proposal is validated against the real prereq graph before it ships.
import { streamPipeline } from "@/lib/agents";
import { reroutePlan } from "@/lib/pipeline";
import { loadData } from "@/lib/data";
import { DEMO_DISRUPTION } from "@/lib/demo";
import type { DisruptionEvent, FlowchartOutput, QuizAnswers } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    quiz?: QuizAnswers;
    flowchart?: FlowchartOutput;
    disruption?: DisruptionEvent;
    forceDeadEnd?: boolean;
  };
  if (!body.quiz || !body.flowchart) {
    return new Response(JSON.stringify({ error: "Missing quiz or flowchart" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }
  const disruption = body.disruption ?? DEMO_DISRUPTION;
  return streamPipeline(async (run) => {
    const { map, sentiment } = await loadData();
    return reroutePlan(run, body.quiz!, map, sentiment, body.flowchart!, disruption, body.forceDeadEnd ?? false);
  });
}
