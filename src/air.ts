import { AppError } from "./errors.js";

export interface AirTextResult {
  text: string;
  model: string;
}

export interface AirConfig {
  baseUrl: string;
  apiKey?: string;
  textModel: string;
  reasonerModel: string;
  asrModel: string;
  ttsModel: string;
}

export function getAirConfig(): AirConfig {
  return {
    baseUrl: (process.env.AIR_BASE_URL ?? "https://openai.rc.asu.edu/v1").replace(/\/$/, ""),
    apiKey: process.env.AIR_API_KEY,
    textModel: process.env.AIR_TEXT_MODEL ?? "glm-5-3-flash",
    reasonerModel:
      process.env.AIR_REASONER_MODEL ?? "qwen3-235b-a22b-thinking-2507",
    asrModel: process.env.AIR_ASR_MODEL ?? "qwen3-asr-1p7b",
    ttsModel: process.env.AIR_TTS_MODEL ?? "qwen3-tts-customvoice-1p7b"
  };
}

function requireApiKey(config: AirConfig): string {
  if (!config.apiKey) {
    throw new AppError(503, "AIR_NOT_CONFIGURED", "AIR is not configured");
  }
  return config.apiKey;
}

async function fetchAir(
  path: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const config = getAirConfig();
  const apiKey = requireApiKey(config);

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...init.headers
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Network request failed";
    throw new AppError(503, "AIR_UNAVAILABLE", "AIR request failed", reason);
  }

  if (!response.ok) {
    throw new AppError(
      503,
      "AIR_UNAVAILABLE",
      `AIR returned HTTP ${response.status}`
    );
  }
  return response;
}

export async function requestAirText(options: {
  role: "text" | "reasoner";
  system: string;
  user: string;
}): Promise<AirTextResult> {
  const config = getAirConfig();
  const model = options.role === "reasoner" ? config.reasonerModel : config.textModel;
  const response = await fetchAir(
    "/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.user }
        ],
        temperature: 0.2,
        max_tokens: 220
      })
    },
    20_000
  );

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new AppError(503, "AIR_INVALID_RESPONSE", "AIR returned no text");
  }

  return { text: content.trim(), model };
}

export async function transcribeWithAir(file: File): Promise<{ text: string; model: string }> {
  const config = getAirConfig();
  const body = new FormData();
  body.append("file", file, file.name || "recording.webm");
  body.append("model", config.asrModel);

  const response = await fetchAir(
    "/audio/transcriptions",
    { method: "POST", body },
    15_000
  );
  const payload = (await response.json()) as { text?: unknown };
  if (typeof payload.text !== "string" || payload.text.trim().length === 0) {
    throw new AppError(503, "AIR_INVALID_RESPONSE", "AIR returned no transcript");
  }
  return { text: payload.text.trim(), model: config.asrModel };
}

export async function speakWithAir(
  text: string,
  voice?: string
): Promise<{ audio: ArrayBuffer; contentType: string; model: string }> {
  const config = getAirConfig();
  const response = await fetchAir(
    "/audio/speech",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.ttsModel,
        input: text,
        voice: voice ?? "ballad",
        response_format: "mp3"
      })
    },
    15_000
  );
  return {
    audio: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") ?? "audio/mpeg",
    model: config.ttsModel
  };
}
