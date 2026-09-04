"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const links = [
  { href: "#handles", label: "What AIVISOR handles" },
  { href: "#how", label: "How it works" },
  { href: "#trust", label: "Why trust AIVISOR" },
  { href: "#stories", label: "Student stories" },
];

export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="5" fill="#fff" />
      <g stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" />
      </g>
    </svg>
  );
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(scrollY > 8);
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`nav ${scrolled ? "scrolled" : ""}`.trim()}>
      <div className="wrap nav-inner">
        <Link className="logo" href="#top" aria-label="AIVISOR home">
          <span className="logo-mark">
            <LogoMark />
          </span>
          <span>
            AIVISOR
            <small>ASU AI ADVISOR</small>
          </span>
        </Link>
        <nav aria-label="Primary">
          <ul className="nav-links">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="nav-cta">
          <Link className="btn btn-ghost btn-sm" href="#how">
            See it in action
          </Link>
          <Link className="btn btn-primary btn-sm" href="/advisor">
            Ask AIVISOR <span className="arrow">→</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
