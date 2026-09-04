import { speakWithAir } from "../../src/air.js";
import { corsHeaders, handleJson, jsonSuccess, parseJson, preflight } from "../../src/http.js";
import { speakRequestSchema } from "../../src/schemas.js";

export function OPTIONS(request: Request): Response {
  return preflight(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleJson(request, async () => {
    const input = await parseJson(request, speakRequestSchema);
    try {
      const speech = await speakWithAir(input.text, input.voice);
      return new Response(speech.audio, {
        status: 200,
        headers: {
          ...corsHeaders(request),
          "Content-Type": speech.contentType,
          "Cache-Control": "no-store",
          "X-Compass-Source": "air",
          "X-Compass-Model": speech.model
        }
      });
    } catch (error) {
      return jsonSuccess(
        request,
        { text: input.text, audioAvailable: false },
        {
          source: "fallback",
          fallbackReason: error instanceof Error ? error.message : "AIR unavailable"
        }
      );
    }
  });
}
