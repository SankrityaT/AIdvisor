import Reveal from "./Reveal";

export default function Bento() {
  return (
    <section className="section" id="handles">
      <div className="wrap">
        <Reveal>
          <div className="sec-head">
            <span className="mono">What AIDvisor handles</span>
            <h2>Everything ASU. One conversation.</h2>
            <p>
              Stop tab-hopping between six department websites. AIDvisor reads the
              fine print so you don&apos;t have to — and tells you straight
              when it doesn&apos;t know.
            </p>
          </div>
        </Reveal>

        <div className="bento">
          <Reveal className="b-1" delay={0}>
            <article className="bcard">
              <span className="bicon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13z" />
                  <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
                  <path d="M9 9h6M9 13h4" />
                </svg>
              </span>
              <span className="btag">
                <i /> Academics
              </span>
              <h3>Course &amp; degree planning</h3>
              <p>
                Check if a class counts, find open sections, spot missing
                prerequisites — AIDvisor walks your degree check line by line and
                flags anything that would delay graduation.
              </p>
              <div className="mini-ui" aria-hidden="true">
                <div className="mini-ui-bar">
                  <i />
                  <i />
                  <i />
                  <span>degree-check · biology B.S.</span>
                </div>
                <div className="mini-row">
                  <span className="tick ok">✓</span>
                  Biology core — BIO 181 · 182 <small>2 / 2 done</small>
                </div>
                <div className="mini-row">
                  <span className="tick ok">✓</span>
                  Math sequence — MTH 141 <small>in progress</small>
                </div>
                <div className="mini-row">
                  <span className="tick warn">!</span>
                  Chemistry — missing CHM 113 <small>open seat · sec 4</small>
                </div>
                <div className="mini-row">
                  <span className="tick ok">✓</span>
                  Elective slots <small>1 remaining</small>
                </div>
              </div>
            </article>
          </Reveal>

          <Reveal className="b-2" delay={70}>
            <article className="bcard">
              <span className="bicon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
              </span>
              <span className="btag">
                <i /> Career
              </span>
              <h3>Majors &amp; career paths</h3>
              <p>
                Compare majors, salaries, and where Sun Devils actually end up.
                &quot;What does a W. P. Carey grad do?&quot; — answered.
              </p>
            </article>
          </Reveal>

          <Reveal className="b-3" delay={140}>
            <article className="bcard">
              <span className="bicon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v10M14.8 9.2c-.5-1-1.6-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2.1 0 2.9 5.6 1.5 5.6 4.2 0 1.4-1.3 2.2-2.9 2.2-1.3 0-2.4-.5-2.9-1.5" />
                </svg>
              </span>
              <span className="btag">
                <i /> Money
              </span>
              <h3>Money, made less scary</h3>
              <p>
                FAFSA deadlines, scholarship fit, fee breakdowns, and
                &quot;is this actually free money?&quot; — explained in plain
                English.
              </p>
              <div className="mini-bars" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </article>
          </Reveal>

          <Reveal className="b-4" delay={0}>
            <article className="bcard">
              <span className="bicon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
                </svg>
              </span>
              <span className="btag">
                <i /> Campus life
              </span>
              <h3>Housing, health &amp; the daily stuff</h3>
              <p>
                Move-in dates, dining hall hours, clinic referrals, lost &amp;
                found, ASUcard issues. The stuff nobody&apos;s website answers
                fast enough.
              </p>
            </article>
          </Reveal>

          <Reveal className="b-5" delay={70}>
            <article className="bcard">
              <span className="bicon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="14" rx="2" />
                  <path d="M8 21h8M12 18v3" />
                </svg>
              </span>
              <span className="btag">
                <i /> Always on
              </span>
              <h3>24/7, wherever you are</h3>
              <p>
                One advisor who knows every campus — not five different help
                desks with five different hours.
              </p>
              <div className="campus-row" aria-hidden="true">
                <span>Tempe</span>
                <span>West</span>
                <span>Poly</span>
                <span>Downtown</span>
                <span>Online</span>
              </div>
            </article>
          </Reveal>

          <Reveal className="b-6" delay={140}>
            <article className="bcard">
              <span className="bicon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l8 3v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </span>
              <span className="btag">
                <i /> Judgment-free
              </span>
              <h3>Ask the awkward questions</h3>
              <p>
                Academic probation, withdrawing, failing a class, switching
                everything. AIDvisor doesn&apos;t blink — and knows exactly what to
                do next.
              </p>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
