// Multi-agent plan generation, streamed as SSE so the Agent Activity panel
// renders real telemetry while the pipeline runs.
import { streamPipeline, jsonPipeline } from "@/lib/agents";
import type { AgentRun } from "@/lib/agents";
import { generatePlan } from "@/lib/pipeline";
import { loadData } from "@/lib/data";
import type { QuizAnswers } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { quiz?: QuizAnswers };
  const quiz = body.quiz;
  if (!quiz?.major) {
    return new Response(JSON.stringify({ error: "Missing quiz answers" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }
  const noStream = new URL(req.url).searchParams.get("stream") === "off";
  const pipeline = async (run: AgentRun) => {
    const { map, sentiment } = await loadData();
    const flowchart = await generatePlan(run, quiz, map, sentiment, (f) => ({ flowchart: f, map, sentiment }));
    return { flowchart, map, sentiment };
  };
  return noStream ? jsonPipeline(pipeline) : streamPipeline(pipeline);
}
