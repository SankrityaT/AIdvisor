"use client";

// ── Graduation Confidence — the demo instrument ────────────────────────
// Purely presentational. Takes a ConfidenceSnapshot, animates the number
// from wherever it currently sits to the new value over ~900ms, drives the
// arc gauge off the exact same animated value, and reacts to the direction
// of the change: a shake + coral flash on a drop, a satisfied settle on a
// recovery. Respects prefers-reduced-motion by dropping the shake while
// keeping the count.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ConfidenceSnapshot } from "@/lib/types";

export interface ConfidenceProps {
  snapshot: ConfidenceSnapshot;
  className?: string;
}

// Geometry: a 270° arc, gap at the bottom, like a speedometer.
const CX = 90;
const CY = 90;
const R = 70;
const CIRC = 2 * Math.PI * R;
const SWEEP = 0.75;
const ARC = CIRC * SWEEP;
const START_DEG = 135; // SVG 0° is 3 o'clock; 135° puts the start at 7:30
const DURATION = 900;

// Mirrors the @theme tokens in app/globals.css (gold / alert / teal / mist).
const ACCENT: Record<
  ConfidenceSnapshot["state"],
  { hex: string; label: string; chip: string; glow: string }
> = {
  stable: {
    hex: "#ffc627",
    label: "On track",
    chip: "border-gold/40 bg-gold/10 text-gold",
    glow: "rgba(255,198,39,.30)",
  },
  at_risk: {
    hex: "#ff6b4a",
    label: "At risk",
    chip: "border-alert/50 bg-alert/10 text-alert",
    glow: "rgba(255,107,74,.34)",
  },
  recovered: {
    hex: "#2ec4b6",
    label: "Rerouted — back on track",
    chip: "border-teal/50 bg-teal/10 text-teal",
    glow: "rgba(46,196,182,.30)",
  },
};

const KEYFRAMES = `
@keyframes cmps-shake {
  0%,100% { transform: translate3d(0,0,0) }
  10% { transform: translate3d(-8px,0,0) }
  24% { transform: translate3d(7px,0,0) }
  38% { transform: translate3d(-5px,0,0) }
  54% { transform: translate3d(4px,0,0) }
  70% { transform: translate3d(-2px,0,0) }
  86% { transform: translate3d(1px,0,0) }
}
@keyframes cmps-flash {
  0%   { box-shadow: 0 0 0 0 rgba(255,107,74,0);   background-color: rgba(255,107,74,0) }
  16%  { box-shadow: 0 0 0 5px rgba(255,107,74,.30); background-color: rgba(255,107,74,.10) }
  100% { box-shadow: 0 0 0 26px rgba(255,107,74,0); background-color: rgba(255,107,74,0) }
}
@keyframes cmps-settle {
  0%   { transform: scale(1) }
  34%  { transform: scale(1.055) }
  66%  { transform: scale(.986) }
  100% { transform: scale(1) }
}
@keyframes cmps-badge {
  from { opacity: 0; transform: translateY(7px) scale(.88) }
  to   { opacity: 1; transform: none }
}
.cmps-shake  { animation: cmps-shake .62s cubic-bezier(.36,.07,.19,.97) both }
.cmps-flash  { animation: cmps-flash .95s ease-out both }
.cmps-settle { animation: cmps-settle .8s cubic-bezier(.2,.9,.2,1) both }
.cmps-badge  { animation: cmps-badge .45s cubic-bezier(.2,.8,.2,1) both }
@media (prefers-reduced-motion: reduce) {
  .cmps-shake, .cmps-flash, .cmps-settle { animation: none }
}
`;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

interface Impulse {
  dir: "drop" | "rise";
  amount: number;
  n: number;
}

export default function ConfidenceMeter({ snapshot, className }: ConfidenceProps) {
  const target = Math.max(0, Math.min(100, Math.round(snapshot?.score ?? 0)));
  const state = snapshot?.state ?? "stable";
  const accent = ACCENT[state] ?? ACCENT.stable;
  const reduced = useReducedMotion();

  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const prevTargetRef = useRef<number | null>(null);
  const nonceRef = useRef(0);
  const [impulse, setImpulse] = useState<Impulse | null>(null);

  // Count from wherever the dial currently is to the new target. Interrupting
  // mid-flight is fine — we always start from the live displayed value, so a
  // drop → recover → drop again sequence stays continuous.
  useEffect(() => {
    const from = displayRef.current;
    const prev = prevTargetRef.current;
    prevTargetRef.current = target;

    const change = prev === null ? 0 : target - prev;
    if (Math.abs(change) >= 2) {
      nonceRef.current += 1;
      setImpulse({
        dir: change < 0 ? "drop" : "rise",
        amount: change,
        n: nonceRef.current,
      });
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const span = target - from;
    if (Math.abs(span) < 0.5) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }

    const ease = span < 0 ? easeInOutCubic : easeOutCubic;
    const start =
      typeof performance !== "undefined" ? performance.now() : Date.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const value = from + span * ease(t);
      displayRef.current = value;
      setDisplay(value);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        displayRef.current = target;
        setDisplay(target);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target]);

  // Let the shake / settle play once, then clear it.
  useEffect(() => {
    if (!impulse) return;
    const id = window.setTimeout(() => setImpulse(null), 1100);
    return () => window.clearTimeout(id);
  }, [impulse]);

  const pct = Math.max(0, Math.min(1, display / 100));
  const tipRad = ((START_DEG + 270 * pct) * Math.PI) / 180;
  const tipX = CX + R * Math.cos(tipRad);
  const tipY = CY + R * Math.sin(tipRad);

  const reasons = useMemo(
    () => (snapshot?.reasons ?? []).filter(Boolean).slice(0, 3),
    [snapshot],
  );

  const shakeClass =
    impulse && !reduced
      ? impulse.dir === "drop"
        ? "cmps-shake"
        : "cmps-settle"
      : "";

  return (
    <section
      aria-label="Graduation confidence"
      className={[
        "relative overflow-hidden rounded-2xl border border-ink-700 bg-ink-900/85 p-5 sm:p-6",
        className ?? "",
      ].join(" ")}
      style={{ "--cm-accent": accent.hex } as CSSProperties}
    >
      <style>{KEYFRAMES}</style>

      {/* coral wash that pulses once on a drop — visible from the back row */}
      <div
        aria-hidden
        key={impulse && impulse.dir === "drop" ? `flash-${impulse.n}` : "flash-idle"}
        className={
          impulse && impulse.dir === "drop" && !reduced
            ? "pointer-events-none absolute inset-0 cmps-flash rounded-2xl"
            : "pointer-events-none absolute inset-0 rounded-2xl"
        }
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(460px 190px at 10% -10%, ${accent.glow}, transparent 72%)`,
          transition: "background 500ms ease",
        }}
      />

      <div className="relative flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
        {/* ── gauge ─────────────────────────────────────────────── */}
        <div
          key={impulse ? `gauge-${impulse.n}` : "gauge-idle"}
          className={`relative shrink-0 ${shakeClass}`}
        >
          <svg
            viewBox="0 0 180 180"
            className="h-[152px] w-[152px]"
            role="meter"
            aria-valuenow={target}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${target} out of 100 — ${accent.label}`}
          >
            {/* unbuilt track */}
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="#2f2839"
              strokeWidth={11}
              strokeLinecap="round"
              strokeDasharray={`${ARC} ${CIRC}`}
              transform={`rotate(${START_DEG} ${CX} ${CY})`}
            />
            {/* the route line itself */}
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="var(--cm-accent)"
              strokeWidth={11}
              strokeLinecap="round"
              strokeDasharray={`${ARC * pct} ${CIRC}`}
              transform={`rotate(${START_DEG} ${CX} ${CY})`}
              style={{
                transition: "stroke 500ms ease",
                filter: `drop-shadow(0 0 7px ${accent.glow})`,
              }}
            />
            {/* the train, riding the tip of the line */}
            {pct > 0.01 && (
              <circle
                cx={tipX}
                cy={tipY}
                r={6.5}
                fill="#131117"
                stroke="var(--cm-accent)"
                strokeWidth={3.5}
                style={{ transition: "stroke 500ms ease" }}
              />
            )}
          </svg>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="font-sans text-[46px] font-semibold leading-none tracking-tight tabular-nums"
              style={{ color: accent.hex, transition: "color 500ms ease" }}
            >
              {Math.round(display)}
            </span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-mist/70">
              of 100
            </span>
          </div>
        </div>

        {/* ── copy ──────────────────────────────────────────────── */}
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-mist">
              Graduation Confidence
            </h2>
            {impulse && (
              <span
                key={`delta-${impulse.n}`}
                className={`cmps-badge rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                  impulse.dir === "drop"
                    ? "border-alert/50 bg-alert/10 text-alert"
                    : "border-teal/50 bg-teal/10 text-teal"
                }`}
              >
                {impulse.amount > 0 ? "+" : "−"}
                {Math.abs(impulse.amount)}
              </span>
            )}
          </div>

          <p
            aria-live="polite"
            className="mt-2 flex items-center justify-center gap-2 text-lg font-semibold text-white sm:justify-start"
          >
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{
                background: accent.hex,
                boxShadow: `0 0 10px ${accent.glow}`,
                transition: "background 500ms ease",
              }}
            />
            {accent.label}
          </p>

          <ul className="mt-3 space-y-1.5">
            {reasons.length > 0 ? (
              reasons.map((reason, i) => (
                <li
                  key={`${target}-${i}-${reason.slice(0, 24)}`}
                  className="animate-rise flex items-start gap-2 text-left text-[13px] leading-snug text-mist"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <span
                    aria-hidden
                    className="mt-[6px] inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: accent.hex, opacity: 0.85 }}
                  />
                  <span className="min-w-0">{reason}</span>
                </li>
              ))
            ) : (
              <li className="text-left text-[13px] leading-snug text-mist">
                Tracking prerequisites, term load, and the graduation date.
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

// NOTE: scoring.ts is deliberately NOT re-exported here. This file is a
// client module, and re-exporting would turn computeConfidence into a client
// reference that cannot run on the server. Import it directly:
//   import { computeConfidence } from "@/app/components/confidence/scoring";
