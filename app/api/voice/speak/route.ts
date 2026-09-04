// ── POST /api/voice/speak ──────────────────────────────────────────────
// JSON { text: string } -> mp3 bytes (audio/mpeg).
// Any failure returns 204 No Content so the client silently skips audio
// rather than surfacing an error mid-demo.

import { speak } from "@/lib/asuair";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** TTS latency scales with input length; keep spoken replies short. */
const MAX_CHARS = 600;
/** Bail out before the slow chatterbox fallback can stall the demo. */
const SPEAK_TIMEOUT_MS = 30_000;

/** 204 = "no audio this time"; the client just skips playback. */
function noAudio(): Response {
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Strip markdown so the model doesn't read asterisks and hashes aloud. */
function plainify(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}[-*+]\s+/gm, "")
    .replace(/[*_~>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cap length, preferring the last sentence boundary inside the budget. */
function capForSpeech(raw: string, limit = MAX_CHARS): string {
  const text = plainify(raw);
  if (text.length <= limit) return text;

  const window = text.slice(0, limit);
  const lastSentence = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
    window.lastIndexOf(".\n"),
  );
  // Only honour a sentence break if it keeps a useful amount of the answer.
  if (lastSentence > limit * 0.5) return window.slice(0, lastSentence + 1).trim();

  const lastSpace = window.lastIndexOf(" ");
  const cut = lastSpace > limit * 0.5 ? window.slice(0, lastSpace) : window;
  return `${cut.trim()}...`;
}

export async function POST(req: Request): Promise<Response> {
  let text: string;
  try {
    const body = (await req.json()) as { text?: unknown };
    if (typeof body?.text !== "string") return noAudio();
    text = capForSpeech(body.text);
  } catch {
    return noAudio();
  }

  if (!text) return noAudio();

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`TTS timed out after ${SPEAK_TIMEOUT_MS}ms`)),
        SPEAK_TIMEOUT_MS,
      );
    });
    // speak() already falls back qwen3-tts-customvoice-1p7b -> chatterbox.
    const tts = speak(text);
    tts.catch(() => {}); // swallow a late rejection if the timeout won the race
    const audio = await Promise.race([tts, timeout]);

    if (!audio || audio.byteLength === 0) return noAudio();

    return new Response(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[voice/speak]", err instanceof Error ? err.message : err);
    return noAudio();
  } finally {
    if (timer) clearTimeout(timer);
  }
}
