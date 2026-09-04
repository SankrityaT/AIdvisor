"use client";

/**
 * AIVISOR — the face of Compass.
 *
 * A cute little maroon-and-gold guide who *is* the AI academic advisor.
 * Renders a real Lottie animation per state when it loads, and a hand-drawn
 * animated SVG (FallbackMascot) whenever it does not. The fallback is the
 * default: nothing about the demo depends on Lottie succeeding.
 *
 * Presentational + self-contained. Props in, nothing out.
 */

import {
  Component,
  useEffect,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import FallbackMascot from "./FallbackMascot";

export type MascotState = "idle" | "thinking" | "alert" | "happy" | "speaking";

export interface AIVISORProps {
  /** Which mood to play. Default "idle". */
  state?: MascotState;
  /** Rendered size in px (square). Default 120. */
  size?: number;
  /** Optional line to show in a speech bubble above the character. */
  speech?: string;
  className?: string;
}

/** Minimal structural type for lottie-react's <Lottie> so we stay decoupled. */
type LottiePlayer = ComponentType<{
  src: object;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  style?: CSSProperties;
}>;

type Loaded = {
  Player: LottiePlayer;
  animations: Partial<Record<MascotState, object>>;
};

export default function AIVISOR({
  state = "idle",
  size = 120,
  speech,
  className,
}: AIVISORProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [lottieMod, animMod] = await Promise.all([
          import("lottie-react"),
          import("./animations"),
        ]);
        if (cancelled) return;

        // lottie-react v3 exports { Lottie }; older builds used a default.
        const mod = lottieMod as unknown as Record<string, unknown>;
        const Player = (mod.Lottie ?? mod.default) as LottiePlayer | undefined;
        const animations = (animMod.default ?? {}) as Partial<
          Record<MascotState, object>
        >;

        if (!Player || !isRenderable(animations.idle)) {
          setFailed(true);
          return;
        }
        setLoaded({ Player, animations });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const candidate = loaded?.animations[state];
  const data = isRenderable(candidate) ? candidate : undefined;
  const useLottie = !failed && loaded && data;

  const character = useLottie ? (
    // keyed on state: a new mood remounts the player (and clears a prior crash)
    <MascotBoundary key={state} fallback={<FallbackMascot state={state} size={size} />}>
      <loaded.Player
        src={data}
        loop
        autoplay
        style={{ width: size, height: size, display: "block" }}
      />
    </MascotBoundary>
  ) : (
    <FallbackMascot state={state} size={size} />
  );

  if (!speech) {
    return (
      <div
        className={joinClass("inline-flex items-center justify-center", className)}
        style={{ width: size, height: size }}
      >
        {character}
      </div>
    );
  }

  return (
    <div className={joinClass("inline-flex flex-col items-center gap-2", className)}>
      <SpeechBubble text={speech} />
      <div
        className="flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {character}
      </div>
    </div>
  );
}

/* ── speech bubble ────────────────────────────────────────────────────── */

export function SpeechBubble({ text }: { text: string }) {
  return (
    <div className="relative max-w-[16rem] animate-rise">
      <div className="rounded-2xl border border-gold/60 bg-ink-800 px-3.5 py-2 text-[13px] leading-snug text-mist shadow-lg shadow-black/30">
        {text}
      </div>
      {/* tail */}
      <div className="absolute left-1/2 top-full -mt-px h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-r border-b border-gold/60 bg-ink-800" />
    </div>
  );
}

/* ── error boundary: a broken Lottie must never take the demo down ────── */

class MascotBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { crashed: boolean }
> {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  render() {
    return this.state.crashed ? this.props.fallback : this.props.children;
  }
}

function joinClass(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** cheap shape check so a truncated/empty JSON falls back instead of rendering blank */
function isRenderable(data: unknown): data is object {
  if (!data || typeof data !== "object") return false;
  const a = data as { layers?: unknown; w?: unknown; h?: unknown };
  return Array.isArray(a.layers) && a.layers.length > 0 && typeof a.w === "number";
}

export { default as FallbackMascot } from "./FallbackMascot";
