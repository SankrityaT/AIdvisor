import { requestAirText } from "../src/air.js";
import { buildChatGrounding, fallbackChatAnswer } from "../src/chat.js";
import { handleJson, jsonSuccess, parseJson, preflight } from "../src/http.js";
import { chatRequestSchema } from "../src/schemas.js";

export function OPTIONS(request: Request): Response {
  return preflight(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleJson(request, async () => {
    const input = await parseJson(request, chatRequestSchema);
    const context = {
      message: input.message,
      quizAnswers: input.quizAnswers,
      activePlan: input.activePlan,
      disruption: input.disruption
    };

    try {
      const air = await requestAirText({
        role: "text",
        system:
          "You are Compass, a concise academic planning assistant. Answer in at most three sentences using only the supplied JSON context. This is a simplified core pathway, not a certified degree audit. If the context does not answer the question, say so.",
        user: JSON.stringify({
          question: input.message,
          recentConversation: input.history,
          grounding: buildChatGrounding(context)
        })
      });
      return jsonSuccess(request, { answer: air.text }, { source: "air", model: air.model });
    } catch (error) {
      return jsonSuccess(
        request,
        { answer: fallbackChatAnswer(context) },
        {
          source: "fallback",
          fallbackReason: error instanceof Error ? error.message : "AIR unavailable"
        }
      );
    }
  });
}
