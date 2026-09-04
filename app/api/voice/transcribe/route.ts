// ── POST /api/voice/transcribe ─────────────────────────────────────────
// multipart/form-data, field "audio" -> { text: string }
// NEVER throws at the client: every failure path returns HTTP 200 with
// { text: "", error } so the voice UI can degrade instead of exploding.

import { transcribe } from "@/lib/asuair";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hard ceiling so the stage demo can never sit on a hung request. */
const TRANSCRIBE_TIMEOUT_MS = 25_000;
/** Anything smaller than this is a mis-click, not speech. */
const MIN_AUDIO_BYTES = 800;

export interface TranscribeResponse {
  text: string;
  error?: string;
}

/** ASR back ends sniff the container off the filename, so keep it honest. */
function filenameFor(type: string): string {
  const t = (type || "").toLowerCase();
  if (t.includes("mp4") || t.includes("m4a") || t.includes("aac")) return "input.mp4";
  if (t.includes("ogg")) return "input.ogg";
  if (t.includes("wav") || t.includes("wave")) return "input.wav";
  if (t.includes("mpeg") || t.includes("mp3")) return "input.mp3";
  return "input.webm";
}

function ok(body: TranscribeResponse): Response {
  return Response.json(body, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request): Promise<Response> {
  let audio: Blob;

  try {
    const form = await req.formData();
    const field = form.get("audio");
    if (!field || typeof field === "string") {
      return ok({ text: "", error: "No audio field in the request." });
    }
    audio = field;
  } catch {
    return ok({ text: "", error: "Could not read the uploaded audio." });
  }

  if (audio.size < MIN_AUDIO_BYTES) {
    return ok({ text: "", error: "Recording was too short to transcribe." });
  }

  const filename = filenameFor(audio.type);

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Transcription timed out after ${TRANSCRIBE_TIMEOUT_MS}ms`)),
        TRANSCRIBE_TIMEOUT_MS,
      );
    });
    // transcribe() already falls back qwen3-asr-1p7b -> whisper-large-v3.
    const asr = transcribe(audio, filename);
    asr.catch(() => {}); // swallow a late rejection if the timeout won the race
    const text = await Promise.race([asr, timeout]);
    const clean = (text ?? "").trim();
    if (!clean) return ok({ text: "", error: "No speech detected." });
    return ok({ text: clean });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[voice/transcribe]", message);
    return ok({ text: "", error: message.slice(0, 200) });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
