import { requestAirText } from "../src/air.js";
import { handleJson, jsonSuccess, parseJson, preflight } from "../src/http.js";
import { rerouteRegistrationScenario } from "../src/reroute.js";
import { rerouteRequestSchema } from "../src/schemas.js";

export function OPTIONS(request: Request): Response {
  return preflight(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleJson(request, async () => {
    const input = await parseJson(request, rerouteRequestSchema);
    const result = rerouteRegistrationScenario(input.currentPlan);

    try {
      const air = await requestAirText({
        role: "reasoner",
        system:
          "You are Compass. Explain this already-validated schedule reroute in one clear sentence. Mention the two disruptions, what moved, and that graduation is unchanged. Never propose different moves.",
        user: JSON.stringify({
          graduationTarget: result.newPlan.graduationTarget,
          disruptions: result.disruptions,
          changes: result.changes
        })
      });
      return jsonSuccess(
        request,
        { ...result, explanation: air.text },
        { source: "air", model: air.model }
      );
    } catch (error) {
      return jsonSuccess(request, result, {
        source: "fallback",
        fallbackReason: error instanceof Error ? error.message : "AIR unavailable"
      });
    }
  });
}
