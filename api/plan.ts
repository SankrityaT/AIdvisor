import { requestAirText } from "../src/air.js";
import { handleJson, jsonSuccess, parseJson, preflight } from "../src/http.js";
import { assertValidPlan, buildBaselinePlan, fallbackPlanExplanation } from "../src/planner.js";
import { planRequestSchema } from "../src/schemas.js";

export function OPTIONS(request: Request): Response {
  return preflight(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleJson(request, async () => {
    const quiz = await parseJson(request, planRequestSchema);
    const plan = buildBaselinePlan(quiz);
    assertValidPlan(plan);
    const fallback = fallbackPlanExplanation(quiz);

    try {
      const air = await requestAirText({
        role: "text",
        system:
          "You are Compass, an ASU academic planning assistant. Write one concise sentence explaining why the supplied already-validated core pathway fits the student. Do not change courses, promise degree certification, or invent facts.",
        user: JSON.stringify({ quizAnswers: quiz, plan })
      });
      return jsonSuccess(
        request,
        { plan, explanation: air.text },
        { source: "air", model: air.model }
      );
    } catch (error) {
      return jsonSuccess(
        request,
        { plan, explanation: fallback },
        {
          source: "fallback",
          fallbackReason: error instanceof Error ? error.message : "AIR unavailable"
        }
      );
    }
  });
}
