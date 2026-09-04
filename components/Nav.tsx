"use client";

import { useEffect, useState } from "react";
import AIDvisor from "@/app/components/mascot";
import Link from "next/link";

const links = [
  { href: "#handles", label: "What AIDvisor handles" },
  { href: "#how", label: "How it works" },
  { href: "#trust", label: "Why trust AIDvisor" },
  { href: "#stories", label: "Student stories" },
];


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
        <Link className="logo" href="#top" aria-label="AIDvisor home">
          <span className="logo-mark is-mascot">
              <AIDvisor state="idle" size={30} />
            </span>
          <span>
            AIDvisor
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
            Ask AIDvisor <span className="arrow">→</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
