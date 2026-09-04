import Link from "next/link";
import AvatarStage from "./AvatarStage";
import Reveal from "./Reveal";

export default function Hero() {
  return (
    <section className="hero">
      <div className="wrap hero-inner">
        <div className="hero-copy">
          <Reveal>
            <span className="eyebrow">
              <span className="pulse" /> AIDVisor · your AI advisor for every Sun Devil
            </span>
          </Reveal>
          <Reveal delay={70}>
            <h1>
              The one place to ask{" "}
              <span className="mark">
                anything
                <svg viewBox="0 0 200 24" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M4 18 C 50 6, 150 6, 196 14" />
                </svg>
              </span>{" "}
              about ASU.
            </h1>
          </Reveal>
          <Reveal delay={140}>
            <p className="hero-sub">
              Meet <b>AIDVisor</b>. From degree checks and financial aid to housing,
              health, and career — get clear, honest answers in seconds.{" "}
              <b>Any campus. Any hour. Zero judgment.</b>
            </p>
          </Reveal>
          <Reveal delay={210}>
            <div className="hero-ctas">
              <Link className="btn btn-primary" href="/advisor">
                Ask AIDVisor a question <span className="arrow">→</span>
              </Link>
              <Link className="btn btn-ghost" href="#how">
                See how AIDVisor works
              </Link>
            </div>
          </Reveal>
          <Reveal delay={280}>
            <div className="trust-row">
              <div className="avatar-stack" aria-hidden="true">
                <span className="as1">M</span>
                <span className="as2">J</span>
                <span className="as3">A</span>
                <span className="as4">K</span>
              </div>
              <div className="trust-txt">
                <b>Trusted by 20,000+ students</b>
                <span className="stars" aria-label="4.9 out of 5 stars">
                  ★★★★★
                </span>{" "}
                4.9 average from first-years to grads
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <AvatarStage />
        </Reveal>
      </div>
    </section>
  );
}
