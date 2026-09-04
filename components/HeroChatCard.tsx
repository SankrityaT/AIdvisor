"use client";

import { useEffect, useState } from "react";

const pairs = [
  {
    q: "Will BIO 181 count for my major?",
    a: "Yes — BIO 181 satisfies the life science core for Biology. I've added it to your degree check.",
    s: "source · asu.edu/registrar",
  },
  {
    q: "What's my FAFSA priority deadline?",
    a: "March 2 for priority consideration. Your projected aid is about $18,400 — want the full breakdown?",
    s: "source · asu.edu/financial-aid",
  },
  {
    q: "Is the Tempe shuttle running 24/7?",
    a: "Yes — routes 450 and 451 run all night. The next one stops by you in 6 minutes on Military Rd.",
    s: "source · asu.edu/shuttle",
  },
];

type Phase = "q" | "typing" | "a";

export default function HeroChatCard() {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("q");

  useEffect(() => {
    if (
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setPhase("a");
      return;
    }
    const t1 = setTimeout(() => setPhase("typing"), 900);
    const t2 = setTimeout(() => setPhase("a"), 2600);
    const t3 = setTimeout(
      () => setIdx((i) => (i + 1) % pairs.length),
      6800
    );
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [idx]);

  const p = pairs[idx];

  return (
    <div className="chat-card" role="img" aria-label="Example AIDvisor conversation">
      <div className="chat-head">
        <span className="cmark">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="4.5" fill="#fff" />
            <g stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
            </g>
          </svg>
        </span>
        <span>
          <b>AIDvisor</b>
          <small>just now · reads all 5 campuses</small>
        </span>
      </div>
      <div className="chat-body">
        <div className="bubble user" key={`q-${idx}`}>
          {p.q}
        </div>
        <div
          className={`typing ${phase === "typing" ? "on" : ""}`.trim()}
          aria-hidden="true"
        >
          <i />
          <i />
          <i />
        </div>
        {phase === "a" && (
          <div className="bubble bot" key={`a-${idx}`}>
            {p.a}
            <span className="src">{p.s}</span>
          </div>
        )}
      </div>
    </div>
  );
}
