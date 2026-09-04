"use client";

import { useRef, type MouseEvent } from "react";
import HeroChatCard from "./HeroChatCard";
import AIDvisor from "@/app/components/mascot";

export default function AvatarStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = stageRef.current;
    const tilt = tiltRef.current;
    if (!el || !tilt) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!matchMedia("(pointer:fine)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    tilt.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
  };

  const onLeave = () => {
    if (tiltRef.current) tiltRef.current.style.transform = "";
  };

  return (
    <div
      className="avatar-stage"
      ref={stageRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div className="stage-glow" aria-hidden="true" />
      <div className="avatar-tilt" ref={tiltRef}>
        <div className="ring" aria-hidden="true" />
        <div className="avatar-core">
          <div className="avatar-dashed" aria-hidden="true" />
          <div className="avatar-face">
            <AIDvisor state="idle" size={150} />
            <span className="avatar-name">AIDvisor</span>
          </div>
          <span className="avatar-status">
            <i /> Online — answers in seconds
          </span>
        </div>
      </div>

      <div className="chip chip-1">
        <span className="ic">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <span>
          <b>CSC 320 registered</b>
          <small>degree check updated</small>
        </span>
      </div>
      <div className="chip chip-2">
        <span className="ic">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10L12 5 2 10l10 5 10-5z" />
            <path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
          </svg>
        </span>
        <span>
          <b>GPA 3.7 · on track</b>
          <small>grad spring 2027</small>
        </span>
      </div>
      <div className="chip chip-3">
        <span className="ic">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
          </svg>
        </span>
        <span>
          <b>12,481 answers</b>
          <small>this week, all campuses</small>
        </span>
      </div>

      <HeroChatCard />
    </div>
  );
}
