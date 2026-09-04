"use client";

// ── VoiceControl ───────────────────────────────────────────────────────
// Push-to-talk mic + spoken replies for AIVISOR.
//   • click to start, click again to stop (auto-stops at 15s)
//   • POSTs the clip to /api/voice/transcribe, hands text back via onTranscript
//   • speaks answers via /api/voice/speak when speakText.nonce changes
// All ASU AIR access lives in those routes. This file never touches the
// gateway and never throws: every failure degrades to an inline note.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export interface VoiceProps {
  /** Recognised speech, handed to the lead to push into the conversation. */
  onTranscript: (text: string) => void;
  /** Bump `nonce` to speak `text`. The same nonce is never spoken twice. */
  speakText?: { text: string; nonce: number } | null;
  /** True while audio is actually playing — drives the mascot. */
  onSpeakingChange?: (speaking: boolean) => void;
  disabled?: boolean;
}

type Status = "idle" | "listening" | "thinking";

/** Never leave a permanent "listening…" state on stage. */
const MAX_RECORD_MS = 15_000;
const TRANSCRIBE_TIMEOUT_MS = 25_000;
const MIN_BLOB_BYTES = 1_000;

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

/** Hydration-safe "are we on the client yet" flag. */
const neverSubscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

function voiceSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const type of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type;
    } catch {
      /* Safari has thrown here historically — just try the next one. */
    }
  }
  return ""; // let the browser choose its default container
}

function extFor(mimeType: string): string {
  const t = (mimeType || "").toLowerCase();
  if (t.includes("mp4") || t.includes("m4a") || t.includes("aac")) return "mp4";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("wav")) return "wav";
  if (t.includes("mpeg")) return "mp3";
  return "webm";
}

export default function VoiceControl({
  onTranscript,
  speakText,
  onSpeakingChange,
  disabled = false,
}: VoiceProps) {
  const mounted = useSyncExternalStore(neverSubscribe, onClient, onServer);

  const [status, setStatus] = useState<Status>("idle");
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);

  // Callbacks live in a ref so an inline arrow from the parent can never
  // re-fire the speak effect.
  const cbRef = useRef({ onTranscript, onSpeakingChange });
  useEffect(() => {
    cbRef.current = { onTranscript, onSpeakingChange };
  });

  const mountedRef = useRef(false);
  const mutedRef = useRef(false);
  const speakingRef = useRef(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcribeAbortRef = useRef<AbortController | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const ringRef = useRef<HTMLSpanElement | null>(null);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const speakAbortRef = useRef<AbortController | null>(null);
  const lastNonceRef = useRef<number | null>(null);

  // ── speaking flag, mirrored to the parent ────────────────────────────
  const flagSpeaking = useCallback((value: boolean) => {
    if (speakingRef.current === value) return;
    speakingRef.current = value;
    if (mountedRef.current) setSpeaking(value);
    try {
      cbRef.current.onSpeakingChange?.(value);
    } catch {
      /* the parent's handler must never break voice */
    }
  }, []);

  // ── teardown helpers ─────────────────────────────────────────────────
  const releaseStream = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (ringRef.current) ringRef.current.style.transform = "scale(1)";
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx) void ctx.close().catch(() => {});
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((t) => t.stop());
  }, []);

  const stopPlayback = useCallback(() => {
    const el = audioElRef.current;
    audioElRef.current = null;
    if (el) {
      el.onended = null;
      el.onerror = null;
      try {
        el.pause();
      } catch {
        /* ignore */
      }
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    flagSpeaking(false);
  }, [flagSpeaking]);

  // ── lifecycle: mark mounted, tear everything down on unmount ─────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      transcribeAbortRef.current?.abort();
      speakAbortRef.current?.abort();
      try {
        recorderRef.current?.stop();
      } catch {
        /* ignore */
      }
      recorderRef.current = null;
      releaseStream();
      stopPlayback();
    };
  }, [releaseStream, stopPlayback]);

  // ── live input level, written straight to the DOM (no re-renders) ────
  const startMeter = useCallback((stream: MediaStream) => {
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!audioCtxRef.current) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const scale = 1 + Math.min(rms * 3.2, 0.9);
        if (ringRef.current) {
          ringRef.current.style.transform = `scale(${scale.toFixed(3)})`;
          ringRef.current.style.opacity = String(Math.min(0.35 + rms * 2.2, 1));
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      /* the meter is decoration — recording still works without it */
    }
  }, []);

  // ── transcription ────────────────────────────────────────────────────
  const sendForTranscription = useCallback(async (blob: Blob) => {
    const controller = new AbortController();
    transcribeAbortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);

    try {
      const form = new FormData();
      form.append("audio", blob, `question.${extFor(blob.type)}`);
      const res = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      const text = typeof data.text === "string" ? data.text.trim() : "";

      if (!mountedRef.current) return;
      if (!text) {
        setNote("I didn't catch that — try once more.");
        return;
      }
      setHeard(text);
      setNote(null);
      cbRef.current.onTranscript(text);
    } catch {
      if (mountedRef.current) {
        setNote("Voice is unavailable right now — you can type your question.");
      }
    } finally {
      clearTimeout(timer);
      transcribeAbortRef.current = null;
      if (mountedRef.current) setStatus("idle");
    }
  }, []);

  const handleRecorderStop = useCallback(
    (mimeType: string) => {
      releaseStream();
      const parts = chunksRef.current;
      chunksRef.current = [];
      const blob = new Blob(parts, { type: mimeType || "audio/webm" });

      if (blob.size < MIN_BLOB_BYTES) {
        if (mountedRef.current) {
          setStatus("idle");
          setNote("That was too quick — hold the mic a beat longer.");
        }
        return;
      }
      if (mountedRef.current) setStatus("thinking");
      void sendForTranscription(blob);
    },
    [releaseStream, sendForTranscription],
  );

  // ── recording control ────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (!rec) {
      releaseStream();
      if (mountedRef.current) setStatus("idle");
      return;
    }
    try {
      if (rec.state !== "inactive") rec.stop();
      else handleRecorderStop(rec.mimeType);
    } catch {
      releaseStream();
      if (mountedRef.current) setStatus("idle");
    }
  }, [handleRecorderStop, releaseStream]);

  const startRecording = useCallback(async () => {
    if (disabled) return;
    setNote(null);
    setNeedsTap(false);
    stopPlayback(); // barge-in: talking over the reply stops the reply
    speakAbortRef.current?.abort();

    if (!voiceSupported()) {
      setBlockedReason("This browser can't record audio — type your question instead.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (!mountedRef.current) return;
      setBlockedReason(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Microphone access is off. Allow it in the browser, or type your question."
          : "No microphone available — you can type your question instead.",
      );
      return;
    }

    if (!mountedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;

    try {
      const mime = pickMimeType();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];

      rec.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => handleRecorderStop(rec.mimeType || mime);
      rec.onerror = () => {
        recorderRef.current = null;
        releaseStream();
        if (mountedRef.current) {
          setStatus("idle");
          setNote("Recording hiccuped — give it another try.");
        }
      };

      rec.start();
      setBlockedReason(null);
      setStatus("listening");
      stopTimerRef.current = setTimeout(() => stopRecording(), MAX_RECORD_MS);
      startMeter(stream);
    } catch {
      releaseStream();
      if (mountedRef.current) {
        setStatus("idle");
        setNote("Couldn't start recording here — type your question instead.");
      }
    }
  }, [disabled, handleRecorderStop, releaseStream, startMeter, stopPlayback, stopRecording]);

  const toggleRecording = useCallback(() => {
    if (status === "listening") stopRecording();
    else if (status === "idle") void startRecording();
  }, [startRecording, status, stopRecording]);

  // ── spoken replies ───────────────────────────────────────────────────
  const playReply = useCallback(
    async (text: string) => {
      const controller = new AbortController();
      speakAbortRef.current?.abort();
      speakAbortRef.current = controller;
      stopPlayback();

      try {
        const res = await fetch("/api/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });
        // 204 = the server chose to skip audio. Stay silent, no error UI.
        if (!res.ok || res.status === 204) return;

        const blob = await res.blob();
        if (controller.signal.aborted || !mountedRef.current || blob.size === 0) return;

        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        const el = new Audio(url);
        audioElRef.current = el;
        el.onended = () => stopPlayback();
        el.onerror = () => stopPlayback();

        flagSpeaking(true);
        try {
          await el.play();
        } catch {
          // Autoplay policy blocked it — offer a one-tap play instead.
          flagSpeaking(false);
          if (mountedRef.current) setNeedsTap(true);
        }
      } catch {
        flagSpeaking(false); // network/abort — silently skip the audio
      }
    },
    [flagSpeaking, stopPlayback],
  );

  const nonce = speakText?.nonce ?? null;
  const pendingText = speakText?.text ?? "";
  useEffect(() => {
    if (nonce === null) return;
    if (lastNonceRef.current === nonce) return;
    lastNonceRef.current = nonce; // consume it either way

    const text = pendingText.trim();
    if (!text) return;
    if (mutedRef.current) return; // deliberately silent
    void playReply(text);
  }, [nonce, pendingText, playReply]);

  const handleMuteToggle = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) {
      speakAbortRef.current?.abort();
      stopPlayback();
      setNeedsTap(false);
    }
  }, [stopPlayback]);

  const tapToPlay = useCallback(() => {
    setNeedsTap(false);
    const el = audioElRef.current;
    if (!el) return;
    flagSpeaking(true);
    void el.play().catch(() => flagSpeaking(false));
  }, [flagSpeaking]);

  // ── render ───────────────────────────────────────────────────────────
  const listening = status === "listening";
  const thinking = status === "thinking";
  // Assume support until hydrated so server and client markup agree.
  const supported = mounted ? voiceSupported() : true;
  const blockedNote =
    blockedReason ?? (!supported ? "This browser can't record audio — type your question instead." : null);
  const blocked = blockedNote !== null;
  const micDisabled = disabled || thinking || !mounted || (blocked && !supported);
  const shownNote = note ?? blockedNote;

  const label = !mounted
    ? "Starting up…"
    : blocked && !listening && !thinking
      ? "Voice unavailable"
      : listening
        ? "Listening — tap to send"
        : thinking
          ? "Transcribing…"
          : speaking
            ? "AIVISOR is speaking"
            : "Tap to ask out loud";

  return (
    <section className="rounded-2xl border border-ink-700 bg-ink-900/70 p-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-gold">Ask AIVISOR</h3>
          <p className="text-xs text-mist">Speak your question, hear the answer.</p>
        </div>
        <button
          type="button"
          onClick={handleMuteToggle}
          aria-pressed={!muted}
          aria-label={muted ? "Turn spoken replies on" : "Turn spoken replies off"}
          title={muted ? "Spoken replies off" : "Spoken replies on"}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
            muted
              ? "border-ink-600 bg-ink-850 text-mist hover:text-white"
              : "border-gold/40 bg-gold/10 text-gold hover:bg-gold/20"
          }`}
        >
          {muted ? <IconSpeakerOff /> : <IconSpeakerOn />}
        </button>
      </header>

      <div className="flex items-center gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
          <span
            ref={ringRef}
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 rounded-full border-2 border-alert transition-opacity duration-200 ${
              listening ? "opacity-70" : "opacity-0"
            }`}
            style={{ transform: "scale(1)" }}
          />
          {listening && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 animate-pulse-slow rounded-full bg-alert/20"
            />
          )}
          <button
            type="button"
            onClick={toggleRecording}
            disabled={micDisabled}
            aria-label={listening ? "Stop recording and send" : "Start recording your question"}
            aria-pressed={listening}
            className={`relative flex h-14 w-14 items-center justify-center rounded-full border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 ${
              listening
                ? "border-alert bg-alert text-ink-950"
                : micDisabled
                  ? "border-ink-600 bg-ink-850 text-ink-600"
                  : "border-gold/50 bg-gold/15 text-gold hover:bg-gold/25"
            }`}
          >
            {thinking ? <IconThinking /> : listening ? <IconStop /> : <IconMic />}
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <p
            role="status"
            aria-live="polite"
            className={`text-sm font-medium ${
              listening ? "text-alert" : blocked ? "text-mist" : "text-white"
            }`}
          >
            {label}
          </p>

          {heard && !listening && (
            <p className="mt-1 truncate text-xs text-mist" title={heard}>
              You asked: “{heard}”
            </p>
          )}

          {shownNote && <p className="mt-1 text-xs text-alert/90">{shownNote}</p>}

          {needsTap && (
            <button
              type="button"
              onClick={tapToPlay}
              className="mt-2 rounded-lg border border-teal/50 bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal hover:bg-teal/20"
            >
              Tap to hear the reply
            </button>
          )}

          {muted && !shownNote && <p className="mt-1 text-xs text-mist">Spoken replies are off.</p>}
        </div>
      </div>
    </section>
  );
}

// ── icons (inline SVG only — no emoji) ─────────────────────────────────
function IconMic() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
    </svg>
  );
}

function IconStop() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
    </svg>
  );
}

function IconThinking() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="animate-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" strokeOpacity="0.25" />
      <path d="M20.5 12a8.5 8.5 0 0 0-8.5-8.5" />
    </svg>
  );
}

function IconSpeakerOn() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" />
      <path d="M15.5 9a4 4 0 0 1 0 6" />
      <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  );
}

function IconSpeakerOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" />
      <path d="m16 9.5 5 5" />
      <path d="m21 9.5-5 5" />
    </svg>
  );
}
