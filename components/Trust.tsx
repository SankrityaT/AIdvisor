import Reveal from "./Reveal";

const items = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13z" />
        <path d="M9 9h6M9 13h4" />
      </svg>
    ),
    title: "Grounded in official policy",
    body: (
      <>
        Every answer cites the ASU page or policy it came from, so you can
        verify in one click.
      </>
    ),
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s-7-4.6-9.5-9A5.5 5.5 0 0 1 12 6.6 5.5 5.5 0 0 1 21.5 12c-2.5 4.4-9.5 9-9.5 9z" />
      </svg>
    ),
    title: "Knows your campus, your major",
    body: (
      <>
        West Campus parking isn&apos;t Tempe parking. Sol answers for{" "}
        <em>your</em> context, not a generic one.
      </>
    ),
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9.5" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M15.5 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: "Hands you to a human when it counts",
    body: (
      <>
        Withdrawals, health, holds, appeals — Sol knows when a person needs to
        be in the room and routes you there.
      </>
    ),
  },
];

export default function Trust() {
  return (
    <section className="section" id="trust">
      <div className="wrap trust-grid">
        <Reveal>
          <div>
            <span className="mono">Why trust Sol</span>
            <h2
              style={{
                fontSize: "clamp(2rem,3.6vw,2.9rem)",
                fontWeight: 800,
                margin: ".9rem 0 1rem",
              }}
            >
              Real answers. Real sources. No wild guessing.
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "1.05rem" }}>
              A wrong answer about registration deadlines is worse than no
              answer. So Sol is built around honesty by default.
            </p>
            <div className="trust-list">
              {items.map((it) => (
                <div className="t-item" key={it.title}>
                  <span className="tic">{it.icon}</span>
                  <div>
                    <b>{it.title}</b>
                    <p>{it.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div
            className="chat-panel"
            role="img"
            aria-label="Example Sol answer with source citation"
          >
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
                <b>Sol</b>
                <small>West Campus · Biology &apos;27</small>
              </span>
            </div>
            <div className="chat-body">
              <div className="bubble user">
                I got put on academic probation. What actually happens now?
              </div>
              <div className="bubble bot">
                First — breathe. Probation means your GPA dipped below 2.0,
                and it gets lifted automatically when your cumulative GPA
                reaches 2.0. You&apos;ll be placed on a <b>probation
                contract</b> with your advisor.
                <br />
                <br />
                Next steps: ① book your probation advising slot, ② review
                your schedule with me — I can drop a load that&apos;s dragging
                your GPA, ③ check the tutoring center on West.
                <span className="src">source · asu.edu/academic-probation</span>
              </div>
              <div className="bubble user">Do I lose my financial aid?</div>
              <div className="bubble bot">
                Maybe — it depends on your <b>satisfactory progress</b>{" "}
                status, which is separate from probation. Let me check your
                SAP record… I&apos;ll flag the exact deadline your aid office
                set.
                <span className="src">source · asu.edu/financial-aid/sap</span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
