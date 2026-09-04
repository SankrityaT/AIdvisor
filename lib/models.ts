// ── ASU AIR model ids — the single source of truth ─────────────────────
// Pure data, safe to import from client components. lib/asuair.ts re-exports
// this so the server client and the UI can never drift apart.

export const MODELS = {
  curator: "devstral2-123b",
  planner: "devstral2-123b",
  critic: "glm-5-3-flash",
  reasoner: "qwen3-235b-a22b-instruct-2507",
  judge: "devstral2-123b",
  chat: "qwen38-27b",
  fast: "qwen3-coder-next",
  tts: "qwen3-tts-customvoice-1p7b",
  tts_fallback: "chatterbox",
  asr: "qwen3-asr-1p7b",
  asr_fallback: "whisper-large-v3",
} as const;
