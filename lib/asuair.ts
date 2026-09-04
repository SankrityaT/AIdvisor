// ── ASU AIR gateway client (SERVER ONLY) ───────────────────────────────
// Never import this from a "use client" component. The API key is read
// from process.env.OPENAI_API_KEY and must never reach the browser.
//
// Verified working against https://openai.rc.asu.edu/v1 :
//   chat/completions          qwen38-27b, devstral2-123b, qwen3-coder-next,
//                             glm-5-3-flash, qwen3-235b-a22b-thinking-2507
//   audio/speech      (TTS)   qwen3-tts-customvoice-1p7b  (~6s)
//   audio/transcriptions(ASR) qwen3-asr-1p7b              (~0.8s)

const BASE = process.env.ASU_AIR_BASE_URL ?? "https://openai.rc.asu.edu/v1";

/** Real ASU AIR model ids, mapped to the role each agent plays. */
export { MODELS } from "./models";
import { MODELS } from "./models";

export class ASUAirError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ASUAirError";
  }
}

function apiKey(): string {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new ASUAirError("OPENAI_API_KEY is not set in the environment");
  return k;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

/** One chat completion against ASU AIR. Returns assistant text content. */
export async function chat(opts: ChatOptions): Promise<string> {
  const { model, messages, json, temperature = 0.4, maxTokens = 2000, timeoutMs = 90_000 } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) {
      throw new ASUAirError(`${model} -> HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status);
    }
    const data = await res.json();
    // NOTE: thinking models also return `reasoning_content`; `content` is the clean answer.
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new ASUAirError(`${model} returned no content`);
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/** Pull a JSON object out of a model response, tolerating fences and prose. */
export function extractJSON<T = unknown>(raw: string): T {
  const cleaned = raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // fall through to brace/bracket scanning
  }
  const start = cleaned.search(/[[{]/);
  if (start !== -1) {
    const open = cleaned[start];
    const close = open === "{" ? "}" : "]";
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < cleaned.length; i++) {
      const c = cleaned[i];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === open) depth++;
      else if (c === close && --depth === 0) {
        return JSON.parse(cleaned.slice(start, i + 1)) as T;
      }
    }
  }
  throw new ASUAirError(`Could not parse JSON from model output: ${raw.slice(0, 200)}`);
}

/** Chat that must return JSON, with one automatic retry on parse failure. */
export async function chatJSON<T>(opts: ChatOptions): Promise<T> {
  const raw = await chat({ ...opts, json: true });
  try {
    return extractJSON<T>(raw);
  } catch {
    const retry = await chat({
      ...opts,
      json: true,
      temperature: 0,
      messages: [
        ...opts.messages,
        { role: "assistant", content: raw.slice(0, 500) },
        { role: "user", content: "That was not valid JSON. Reply with ONLY the raw JSON object, no prose, no code fences." },
      ],
    });
    return extractJSON<T>(retry);
  }
}

/** Text -> speech. Returns mp3 bytes. Falls back to chatterbox if the fast model fails. */
export async function speak(text: string, voice = "alloy"): Promise<ArrayBuffer> {
  for (const model of [MODELS.tts, MODELS.tts_fallback]) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), model === MODELS.tts ? 45_000 : 120_000);
      try {
        const res = await fetch(`${BASE}/audio/speech`, {
          method: "POST",
          signal: ctrl.signal,
          headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, input: text, voice }),
        });
        if (!res.ok) throw new ASUAirError(`TTS ${model} HTTP ${res.status}`, res.status);
        return await res.arrayBuffer();
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      if (model === MODELS.tts_fallback) throw err;
    }
  }
  throw new ASUAirError("All TTS models failed");
}

/** Speech -> text. Falls back to whisper-large-v3. */
export async function transcribe(audio: Blob, filename = "input.webm"): Promise<string> {
  let lastErr: unknown;
  for (const model of [MODELS.asr, MODELS.asr_fallback]) {
    try {
      const form = new FormData();
      form.append("file", audio, filename);
      form.append("model", model);
      const res = await fetch(`${BASE}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey()}` },
        body: form,
      });
      if (!res.ok) throw new ASUAirError(`ASR ${model} HTTP ${res.status}`, res.status);
      const data = await res.json();
      if (typeof data?.text === "string") return data.text;
      throw new ASUAirError(`ASR ${model} returned no text`);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new ASUAirError("All ASR models failed");
}
