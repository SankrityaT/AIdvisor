"use client";

import { useRef, type MouseEvent } from "react";
import HeroChatCard from "./HeroChatCard";

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
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
              <rect x="24" y="34" width="72" height="58" rx="20" fill="#8C1515" />
              <rect x="24" y="34" width="72" height="58" rx="20" fill="url(#faceShade)" />
              <circle cx="45" cy="60" r="6.5" fill="#FFF6F0" />
              <circle cx="75" cy="60" r="6.5" fill="#FFF6F0" />
              <path
                d="M47 75c5.5 5.5 20.5 5.5 26 0"
                stroke="#FFF6F0"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
              <line x1="60" y1="34" x2="60" y2="22" stroke="#8C1515" strokeWidth="4" strokeLinecap="round" />
              <circle cx="60" cy="17" r="6" fill="#D9A13B" />
              <circle cx="60" cy="17" r="10" fill="#D9A13B" opacity=".25" />
              <defs>
                <linearGradient
                  id="faceShade"
                  x1="24"
                  y1="34"
                  x2="96"
                  y2="92"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#fff" stopOpacity=".14" />
                  <stop offset=".5" stopColor="#fff" stopOpacity="0" />
                  <stop offset="1" stopColor="#000" stopOpacity=".14" />
                </linearGradient>
              </defs>
            </svg>
            <span className="avatar-name">AIDvisor</span>
            <span className="avatar-tag">avatar · placeholder</span>
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
