"use client";

/**
 * FallbackMascot — AIVISOR drawn as pure inline SVG + CSS keyframes.
 *
 * This is the guaranteed-shippable version of the character. `index.tsx`
 * renders it whenever the Lottie JSON is missing, still loading, or throws.
 * It must look good entirely on its own — assume a judge sees only this.
 *
 * Self-contained: no Tailwind classes needed for the drawing itself, no
 * external assets, no state, no effects. Safe to SSR.
 */

import { useId } from "react";

export type MascotState = "idle" | "thinking" | "alert" | "happy" | "speaking";

export interface FallbackMascotProps {
  state?: MascotState;
  size?: number;
  className?: string;
}

/* ── palette (mirrors the @theme tokens in app/globals.css) ───────────── */
const MAROON_LIGHT = "#a52a55";
const MAROON = "#8c1d40";
const MAROON_DEEP = "#6b1531";
const MAROON_RIM = "#540f26";
const BLUSH = "#e2588c";
const GOLD = "#ffc627";
const GOLD_LIGHT = "#ffe89a";
const GOLD_DEEP = "#d19c00";
const ALERT = "#ff6b4a";
const EYE_WHITE = "#fdf6fa";
const INK = "#1a0d16";

export default function FallbackMascot({
  state = "idle",
  size = 120,
  className,
}: FallbackMascotProps) {
  const raw = useId();
  const uid = `aidv${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
  const bodyGrad = `${uid}-body`;
  const tuftGrad = `${uid}-tuft`;
  const smileClip = `${uid}-smile`;

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`AIVISOR, ${state}`}
      style={{ overflow: "visible", display: "block" }}
    >
      <style>{CSS}</style>

      <defs>
        <linearGradient id={bodyGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={MAROON_LIGHT} />
          <stop offset="62%" stopColor={MAROON} />
          <stop offset="100%" stopColor={MAROON_DEEP} />
        </linearGradient>
        <linearGradient id={tuftGrad} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={GOLD_DEEP} />
          <stop offset="70%" stopColor={GOLD} />
          <stop offset="100%" stopColor={GOLD_LIGHT} />
        </linearGradient>
        <clipPath id={smileClip}>
          <path d="M47 75 Q60 93 73 75 Z" />
        </clipPath>
      </defs>

      {/* soft ground glow */}
      <ellipse
        cx="60"
        cy="111"
        rx="30"
        ry="6"
        fill={MAROON}
        opacity="0.4"
        className="aidv-shadow"
      />

      <g className={`aidv-root aidv-${state}`}>
        {/* gold feet */}
        <ellipse cx="48" cy="103" rx="9" ry="5.5" fill={GOLD_DEEP} />
        <ellipse cx="72" cy="103" rx="9" ry="5.5" fill={GOLD_DEEP} />
        <ellipse cx="48" cy="102" rx="9" ry="5.5" fill={GOLD} />
        <ellipse cx="72" cy="102" rx="9" ry="5.5" fill={GOLD} />

        <g className="aidv-body">
          {/* little arms */}
          <ellipse
            cx="25"
            cy="76"
            rx="7"
            ry="10"
            fill={MAROON_DEEP}
            transform="rotate(20 25 76)"
            className="aidv-arm aidv-arm-l"
          />
          <ellipse
            cx="95"
            cy="76"
            rx="7"
            ry="10"
            fill={MAROON_DEEP}
            transform="rotate(-20 95 76)"
            className="aidv-arm aidv-arm-r"
          />

          {/* gold sprout */}
          <g className="aidv-tuft">
            <path
              d="M60 38 C55 28 56.5 16 62.5 9 C67.5 17 67 29 62.5 38 Z"
              fill={`url(#${tuftGrad})`}
            />
            <circle cx="64" cy="8" r="3" fill={GOLD_LIGHT} />
          </g>

          {/* body */}
          <ellipse
            cx="60"
            cy="68"
            rx="37"
            ry="35"
            fill={`url(#${bodyGrad})`}
            stroke={MAROON_RIM}
            strokeWidth="1.5"
          />
          {/* gloss */}
          <ellipse
            cx="44"
            cy="47"
            rx="15"
            ry="9"
            fill="#ffffff"
            opacity="0.14"
            transform="rotate(-24 44 47)"
          />

          {/* cheeks */}
          <ellipse cx="32" cy="79" rx="7.5" ry="4.6" fill={BLUSH} opacity="0.55" />
          <ellipse cx="88" cy="79" rx="7.5" ry="4.6" fill={BLUSH} opacity="0.55" />

          <Face state={state} smileClip={smileClip} />
        </g>

        <Props state={state} />
      </g>
    </svg>
  );
}

/* ── face ─────────────────────────────────────────────────────────────── */

function Face({ state, smileClip }: { state: MascotState; smileClip: string }) {
  if (state === "happy") {
    return (
      <g>
        {/* joyful closed arcs */}
        <path
          d="M39 68 Q47 56 55 68"
          fill="none"
          stroke={INK}
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M65 68 Q73 56 81 68"
          fill="none"
          stroke={INK}
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        {/* open grin */}
        <path d="M47 75 Q60 93 73 75 Z" fill={INK} />
        <g clipPath={`url(#${smileClip})`}>
          <ellipse cx="60" cy="88" rx="7" ry="5" fill={BLUSH} />
        </g>
      </g>
    );
  }

  if (state === "alert") {
    return (
      <g className="aidv-face-alert">
        <Eye cx="47" wide pupilR={3.6} gazeX={0} gazeY={-1} />
        <Eye cx="73" wide pupilR={3.6} gazeX={0} gazeY={-1} />
        {/* worried brows — inner ends raised */}
        <path
          d="M37 49 L52 43"
          stroke={INK}
          strokeWidth="3.2"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M83 49 L68 43"
          stroke={INK}
          strokeWidth="3.2"
          strokeLinecap="round"
          opacity="0.85"
        />
        {/* small surprised mouth */}
        <ellipse cx="60" cy="83" rx="5" ry="6" fill={INK} className="aidv-mouth-o" />
      </g>
    );
  }

  if (state === "thinking") {
    return (
      <g>
        <Eye cx="47" gazeX={2.5} gazeY={-3} />
        <Eye cx="73" gazeX={2.5} gazeY={-3} />
        {/* one raised brow */}
        <path
          d="M67 46 L80 43.5"
          stroke={INK}
          strokeWidth="2.8"
          strokeLinecap="round"
          opacity="0.6"
        />
        {/* small pondering mouth */}
        <path
          d="M53 81 Q59 78 65 80"
          fill="none"
          stroke={INK}
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      </g>
    );
  }

  if (state === "speaking") {
    return (
      <g>
        <Eye cx="47" />
        <Eye cx="73" />
        <ellipse
          cx="60"
          cy="82"
          rx="6.5"
          ry="6"
          fill={INK}
          className="aidv-mouth-talk"
        />
      </g>
    );
  }

  /* idle */
  return (
    <g>
      <Eye cx="47" blink />
      <Eye cx="73" blink />
      <path
        d="M52 78 Q60 86 68 78"
        fill="none"
        stroke={INK}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </g>
  );
}

function Eye({
  cx,
  blink,
  wide,
  pupilR = 5,
  gazeX = 0,
  gazeY = 0,
}: {
  cx: string;
  blink?: boolean;
  wide?: boolean;
  pupilR?: number;
  gazeX?: number;
  gazeY?: number;
}) {
  const x = Number(cx);
  const ry = wide ? 12.5 : 11;
  const rx = wide ? 10.8 : 10;
  return (
    <g className={blink ? "aidv-eye aidv-blink" : "aidv-eye"} style={{ transformOrigin: `${x}px 64px` }}>
      <ellipse cx={x} cy="64" rx={rx} ry={ry} fill={EYE_WHITE} />
      <circle cx={x + gazeX} cy={65 + gazeY} r={pupilR} fill={INK} />
      <circle cx={x + gazeX - 1.8} cy={63 + gazeY} r={pupilR * 0.42} fill="#ffffff" />
      <circle
        cx={x + gazeX + 1.9}
        cy={67 + gazeY}
        r={pupilR * 0.24}
        fill={GOLD}
        opacity="0.9"
      />
    </g>
  );
}

/* ── per-state props floating around the character ────────────────────── */

function Props({ state }: { state: MascotState }) {
  if (state === "thinking") {
    return (
      <g className="aidv-think">
        <circle cx="90" cy="36" r="3.2" fill={GOLD} className="aidv-dot aidv-dot-1" />
        <circle cx="100" cy="27" r="4.4" fill={GOLD} className="aidv-dot aidv-dot-2" />
        <circle cx="112" cy="16" r="5.6" fill={GOLD_LIGHT} className="aidv-dot aidv-dot-3" />
      </g>
    );
  }

  if (state === "alert") {
    return (
      <g className="aidv-bang">
        <rect x="93" y="12" width="6" height="15" rx="3" fill={ALERT} />
        <circle cx="96" cy="32" r="3.2" fill={ALERT} />
      </g>
    );
  }

  if (state === "happy") {
    return (
      <g>
        <path d={star(100, 30, 6)} fill={GOLD} className="aidv-spark aidv-spark-1" />
        <path d={star(20, 36, 5)} fill={GOLD_LIGHT} className="aidv-spark aidv-spark-2" />
        <path d={star(104, 74, 4.5)} fill={GOLD} className="aidv-spark aidv-spark-3" />
        <path d={star(16, 74, 4)} fill={GOLD} className="aidv-spark aidv-spark-2" />
      </g>
    );
  }

  if (state === "speaking") {
    return (
      <g fill="none" stroke={GOLD} strokeLinecap="round" strokeWidth="3">
        <path d="M100 46 A11 11 0 0 1 100 64" className="aidv-wave aidv-wave-1" />
        <path d="M104 39 A18 18 0 0 1 104 71" className="aidv-wave aidv-wave-2" opacity="0.6" />
      </g>
    );
  }

  return null;
}

/** four-point sparkle centred at (x, y) */
function star(x: number, y: number, r: number) {
  const i = r * 0.3;
  return `M${x} ${y - r} Q${x + i} ${y - i} ${x + r} ${y} Q${x + i} ${y + i} ${x} ${y + r} Q${x - i} ${y + i} ${x - r} ${y} Q${x - i} ${y - i} ${x} ${y - r} Z`;
}

/* ── keyframes ────────────────────────────────────────────────────────── */

const CSS = `
.aidv-root, .aidv-body, .aidv-tuft, .aidv-eye, .aidv-arm,
.aidv-dot, .aidv-spark, .aidv-wave, .aidv-bang, .aidv-shadow,
.aidv-mouth-o, .aidv-mouth-talk, .aidv-face-alert {
  transform-box: view-box;
}
.aidv-body { transform-origin: 60px 102px; animation: aidv-breathe 3.6s ease-in-out infinite; }
.aidv-tuft { transform-origin: 60px 38px; animation: aidv-sway 3.2s ease-in-out infinite; }
.aidv-shadow { transform-origin: 60px 111px; animation: aidv-shadow 3.6s ease-in-out infinite; }
.aidv-arm-l { animation: aidv-arm-l 3.6s ease-in-out infinite; transform-origin: 25px 68px; }
.aidv-arm-r { animation: aidv-arm-r 3.6s ease-in-out infinite; transform-origin: 95px 68px; }
.aidv-blink { animation: aidv-blink 4.4s ease-in-out infinite; }

.aidv-idle     { animation: aidv-bob 3.6s ease-in-out infinite; }
.aidv-speaking { animation: aidv-bob 1.5s ease-in-out infinite; }
.aidv-thinking { animation: aidv-tilt 4s ease-in-out infinite; transform-origin: 60px 100px; }
.aidv-alert    { animation: aidv-shake 0.55s ease-in-out infinite; }
.aidv-happy    { animation: aidv-hop 0.78s cubic-bezier(.3,.7,.3,1) infinite; }
.aidv-happy .aidv-body { animation: aidv-squash 0.78s cubic-bezier(.3,.7,.3,1) infinite; }
.aidv-alert .aidv-body { animation: none; }

.aidv-mouth-talk { transform-origin: 60px 82px; animation: aidv-talk 0.42s ease-in-out infinite; }
.aidv-mouth-o    { transform-origin: 60px 83px; animation: aidv-gasp 1.1s ease-in-out infinite; }

.aidv-dot { transform-origin: center; animation: aidv-pop 1.5s ease-in-out infinite; }
.aidv-dot-1 { animation-delay: 0s; }
.aidv-dot-2 { animation-delay: .18s; }
.aidv-dot-3 { animation-delay: .36s; }

.aidv-spark { animation: aidv-twinkle 1.1s ease-in-out infinite; }
.aidv-spark-1 { transform-origin: 100px 30px; }
.aidv-spark-2 { transform-origin: 20px 36px; animation-delay: .3s; }
.aidv-spark-3 { transform-origin: 104px 74px; animation-delay: .55s; }

.aidv-bang { transform-origin: 96px 32px; animation: aidv-bang 0.55s ease-in-out infinite; }

.aidv-wave { transform-origin: 99px 55px; animation: aidv-wave 1s ease-out infinite; }
.aidv-wave-2 { animation-delay: .28s; }

@keyframes aidv-breathe { 0%,100% { transform: scale(1,1) } 50% { transform: scale(1.035,.965) } }
@keyframes aidv-bob     { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
@keyframes aidv-sway    { 0%,100% { transform: rotate(-7deg) } 50% { transform: rotate(7deg) } }
@keyframes aidv-shadow  { 0%,100% { transform: scaleX(1); opacity:.4 } 50% { transform: scaleX(.88); opacity:.28 } }
@keyframes aidv-arm-l   { 0%,100% { transform: rotate(0deg) } 50% { transform: rotate(-9deg) } }
@keyframes aidv-arm-r   { 0%,100% { transform: rotate(0deg) } 50% { transform: rotate(9deg) } }
@keyframes aidv-blink   { 0%,90%,100% { transform: scaleY(1) } 93% { transform: scaleY(.08) } 96% { transform: scaleY(1) } }
@keyframes aidv-tilt    { 0%,100% { transform: rotate(-4deg) translateY(0) } 50% { transform: rotate(3deg) translateY(-2px) } }
@keyframes aidv-shake   { 0%,100% { transform: translate(0,0) } 25% { transform: translate(-2.5px,-1px) rotate(-2deg) } 75% { transform: translate(2.5px,-1px) rotate(2deg) } }
@keyframes aidv-hop     { 0%,100% { transform: translateY(0) } 30% { transform: translateY(-11px) } 60% { transform: translateY(0) } }
@keyframes aidv-squash  { 0% { transform: scale(1.06,.94) } 30% { transform: scale(.95,1.06) } 60% { transform: scale(1.08,.92) } 100% { transform: scale(1,1) } }
@keyframes aidv-talk    { 0%,100% { transform: scale(1,.35) } 50% { transform: scale(.9,1.05) } }
@keyframes aidv-gasp    { 0%,100% { transform: scale(1,1) } 50% { transform: scale(1.1,1.25) } }
@keyframes aidv-pop     { 0%,100% { transform: translateY(0) scale(.85); opacity:.45 } 45% { transform: translateY(-4px) scale(1.1); opacity:1 } }
@keyframes aidv-twinkle { 0%,100% { transform: scale(.4) rotate(0deg); opacity:.35 } 50% { transform: scale(1.15) rotate(45deg); opacity:1 } }
@keyframes aidv-bang    { 0%,100% { transform: translateY(0) scale(1) } 50% { transform: translateY(-3px) scale(1.12) } }
@keyframes aidv-wave    { 0% { transform: scale(.7); opacity:0 } 35% { opacity:.9 } 100% { transform: scale(1.15); opacity:0 } }

@media (prefers-reduced-motion: reduce) {
  .aidv-root, .aidv-root *, .aidv-shadow { animation: none !important; }
}
`;
