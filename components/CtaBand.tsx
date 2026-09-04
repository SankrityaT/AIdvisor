import Link from "next/link";
import Reveal from "./Reveal";

export default function CtaBand() {
  return (
    <section className="cta-band" id="cta">
      <div className="wrap">
        <Reveal>
          <div className="cta-card">
            <div className="cmark">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="5" fill="#fff" />
                <g stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" />
                </g>
              </svg>
            </div>
            <h2>
              Your best ASU questions deserve better than a web search.
            </h2>
            <p>
              Join the beta and be one of the first Sun Devils to have an
              advisor that&apos;s always awake.
            </p>
            <Link className="btn btn-white" href="/advisor">
              Meet AIVISOR — it&apos;s free <span className="arrow">→</span>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
