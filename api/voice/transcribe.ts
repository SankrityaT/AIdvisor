import { getAirConfig, transcribeWithAir } from "../../src/air.js";
import { AppError } from "../../src/errors.js";
import {
  handleJson,
  isOriginAllowed,
  jsonError,
  jsonSuccess,
  preflight
} from "../../src/http.js";

const MAX_AUDIO_BYTES = 4_000_000;
const SUPPORTED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3"
]);

export function OPTIONS(request: Request): Response {
  return preflight(request);
}

export async function POST(request: Request): Promise<Response> {
  if (!isOriginAllowed(request)) {
    return jsonError(request, new AppError(403, "ORIGIN_NOT_ALLOWED", "Origin is not allowed"));
  }

  return handleJson(request, async () => {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 4_400_000) {
      throw new AppError(413, "PAYLOAD_TOO_LARGE", "Audio upload exceeds 4 MB");
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new AppError(400, "INVALID_MULTIPART", "Expected a multipart audio upload");
    }
    const value = form.get("file");
    if (!(value instanceof File)) {
      throw new AppError(400, "AUDIO_REQUIRED", "A file field named 'file' is required");
    }
    if (value.size === 0 || value.size > MAX_AUDIO_BYTES) {
      throw new AppError(413, "PAYLOAD_TOO_LARGE", "Audio file must be between 1 byte and 4 MB");
    }
    if (!SUPPORTED_AUDIO_TYPES.has(value.type)) {
      throw new AppError(415, "UNSUPPORTED_AUDIO", "Use WebM, WAV, or MP3 audio");
    }

    try {
      const transcript = await transcribeWithAir(value);
      return jsonSuccess(
        request,
        { transcript: transcript.text },
        { source: "air", model: transcript.model }
      );
    } catch (error) {
      const config = getAirConfig();
      throw new AppError(
        503,
        "TRANSCRIPTION_UNAVAILABLE",
        "Voice transcription is temporarily unavailable",
        config.apiKey && error instanceof Error ? error.message : undefined
      );
    }
  });
}
