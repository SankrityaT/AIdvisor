"use client";

// ── Why this class ─────────────────────────────────────────────────────
// Wraps any trigger element and, on hover / tap / keyboard focus, shows a
// one-sentence explanation of why that course matters for the student's
// stated career goal.
//
// Presentational + self-contained: data in via props, nothing global.
// If there is no relevance entry for `code` it renders `children` and
// nothing else — no wrapper behaviour, no dead tooltip.

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { consumePipeline } from "@/lib/agents";
import type {
  AgentEvent,
  CourseRelevance,
  CourseSentiment,
  Difficulty,
  MajorMap,
  QuizAnswers,
} from "@/lib/types";

// ── data helper the lead calls once per plan ───────────────────────────

export interface FetchRelevanceInput {
  quiz: QuizAnswers;
  codes: string[];
  majorMap: MajorMap;
  sentiment?: CourseSentiment[];
  /** Live Agent Activity telemetry. Optional. */
  onAgentEvent?: (e: AgentEvent) => void;
}

/**
 * Fetch "why this class" lines for a whole plan in one batched server pass.
 * Never throws — on any failure it resolves to `[]` and the tooltips simply
 * do not appear.
 */
export async function fetchRelevance(input: FetchRelevanceInput): Promise<CourseRelevance[]> {
  const { quiz, codes, majorMap, sentiment = [], onAgentEvent } = input;
  if (!quiz?.major || !Array.isArray(codes) || codes.length === 0) return [];
  try {
    const result = (await consumePipeline(
      "/api/relevance",
      { quiz, codes, majorMap, sentiment },
      (e) => onAgentEvent?.(e),
    )) as { items?: CourseRelevance[] } | undefined;
    const items = result?.items;
    if (!Array.isArray(items)) return [];
    return items.filter(
      (i): i is CourseRelevance =>
        !!i && typeof i.code === "string" && typeof i.why === "string" && i.why.trim().length > 0,
    );
  } catch {
    return [];
  }
}

/** Case-insensitive lookup helper — handy for the lead when merging data. */
export function relevanceFor(
  relevance: CourseRelevance[] | undefined,
  code: string,
): CourseRelevance | undefined {
  if (!relevance?.length || !code) return undefined;
  const key = code.trim().toUpperCase();
  return relevance.find((r) => r?.code?.trim().toUpperCase() === key);
}

// ── tooltip ────────────────────────────────────────────────────────────

const DIFFICULTY: Record<Difficulty, { label: string; className: string }> = {
  easy: { label: "LIGHT LIFT", className: "text-teal" },
  medium: { label: "STEADY PACE", className: "text-gold" },
  hard: { label: "HEAVY LIFT", className: "text-alert" },
};

const WIDTH = 300;
const GAP = 10;
const MARGIN = 12;
/** Only used for the very first frame, before the card can be measured. */
const EST_HEIGHT = 170;

/**
 * Tailwind emits `.block` BEFORE `.inline-block`, so a caller-supplied display
 * utility would silently lose to the one baked into the wrapper. When the
 * caller brings their own display class, we drop ours.
 */
const DISPLAY_UTIL =
  /(^|\s)(block|inline|inline-block|flex|inline-flex|grid|inline-grid|contents|flow-root|hidden)(\s|$)/;

interface Pos {
  left: number;
  top: number;
  placement: "top" | "bottom";
}

/** Layout effect on the client, plain effect during SSR (avoids the React warning). */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface WhyThisClassProps {
  relevance: CourseRelevance[];
  code: string;
  sentiment?: CourseSentiment;
  /** The trigger element to wrap. */
  children: React.ReactNode;
  /**
   * Extra classes on the wrapper span. It is `inline-block` by default; pass a
   * display utility (e.g. `"block w-full"`) and that one wins instead.
   */
  className?: string;
}

export default function WhyThisClass({
  relevance,
  code,
  sentiment,
  children,
  className,
}: WhyThisClassProps) {
  const entry = useMemo(() => relevanceFor(relevance, code), [relevance, code]);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false); // opened by tap/click
  const [pos, setPos] = useState<Pos | null>(null);
  const [needsTabStop, setNeedsTabStop] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const tipId = useId();

  // Only take a tab stop if the wrapped trigger isn't already focusable.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const focusable = el.querySelector(
      'a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])',
    );
    setNeedsTabStop(!focusable);
  }, [children]);

  const place = useCallback(() => {
    const el = wrapRef.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(WIDTH, vw - MARGIN * 2);
    const left = Math.min(Math.max(r.left + r.width / 2 - w / 2, MARGIN), Math.max(MARGIN, vw - w - MARGIN));
    // Measure the rendered card; the estimate only covers the first frame.
    const h = cardRef.current?.offsetHeight || EST_HEIGHT;
    const above = r.top - GAP - MARGIN;
    const below = vh - r.bottom - GAP - MARGIN;
    // Prefer above; drop below only when below genuinely has more room.
    const placement: Pos["placement"] = above >= h || above >= below ? "top" : "bottom";
    const raw = placement === "top" ? r.top - GAP - h : r.bottom + GAP;
    // Clamp so a tall card can never be clipped by either viewport edge.
    const top = Math.min(Math.max(raw, MARGIN), Math.max(MARGIN, vh - h - MARGIN));
    setPos({ left, top, placement });
  }, []);

  const show = useCallback(() => {
    place();
    setOpen(true);
  }, [place]);

  const hide = useCallback(() => {
    setOpen(false);
    setPinned(false);
  }, []);

  // Keep the card glued to the trigger while it is open. Runs as a layout
  // effect so the first pass — the one that measures the real card height —
  // lands before paint instead of visibly jumping.
  useIsoLayoutEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, place]);

  // Escape closes; an outside tap closes a pinned card.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hide();
        wrapRef.current?.focus?.();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) hide();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, hide]);

  // No explanation for this course: render the trigger untouched.
  if (!entry) return <>{children}</>;

  const extra = className ?? "";
  const wrapClass = [
    "relative cursor-help rounded-md outline-none focus-visible:ring-2 focus-visible:ring-gold/70",
    DISPLAY_UTIL.test(extra) ? "" : "inline-block",
    extra,
  ]
    .filter(Boolean)
    .join(" ");

  const difficulty = sentiment?.difficulty ? DIFFICULTY[sentiment.difficulty] : null;

  const card = (
    <div
      id={tipId}
      ref={cardRef}
      role="tooltip"
      className="pointer-events-none fixed z-[60]"
      style={{
        left: pos?.left ?? -9999,
        // `top` is the real top edge: placement + clamping happen in place(),
        // so no transform is needed here (and none can fight animate-rise).
        top: pos?.top ?? -9999,
        width: WIDTH,
        maxWidth: "calc(100vw - 24px)",
        visibility: pos ? "visible" : "hidden",
      }}
    >
      <div className="animate-rise rounded-xl border border-ink-700 border-l-2 border-l-gold bg-ink-800/97 p-3 shadow-[0_18px_44px_-12px_rgba(0,0,0,.85)] backdrop-blur-sm">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
            Why this class
          </span>
          <span className="font-mono text-[10px] tracking-tight text-mist">{entry.code}</span>
        </div>

        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#f4f1f7]">{entry.why}</p>

        {difficulty ? (
          <p className={`mt-2 font-mono text-[9.5px] tracking-[0.12em] ${difficulty.className}`}>
            {difficulty.label}
          </p>
        ) : null}

        {sentiment?.blurb ? (
          <p className="mt-1 line-clamp-3 text-[11.5px] leading-snug text-mist">{sentiment.blurb}</p>
        ) : null}
      </div>
    </div>
  );

  return (
    <span
      ref={wrapRef}
      className={wrapClass}
      tabIndex={needsTabStop ? 0 : undefined}
      aria-describedby={open ? tipId : undefined}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") show();
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse" && !pinned) setOpen(false);
      }}
      onClick={() => {
        if (pinned && open) hide();
        else {
          setPinned(true);
          show();
        }
      }}
      onFocusCapture={show}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hide();
      }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
          e.preventDefault();
          if (open) hide();
          else {
            setPinned(true);
            show();
          }
        }
      }}
    >
      {children}
      {/* `open` only ever flips from a real user event, so document exists. */}
      {open && typeof document !== "undefined" ? createPortal(card, document.body) : null}
    </span>
  );
}
