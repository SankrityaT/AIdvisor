import Reveal from "./Reveal";

const steps = [
  {
    title: "Ask in plain language",
    body: (
      <>
        Type it like you&apos;d say it. &quot;Can I still make it to grad
        school if I drop this class?&quot; — AIDvisor gets it.
      </>
    ),
  },
  {
    title: "AIDvisor checks the source",
    body: (
      <>
        It reads official ASU policies, your degree check, and your campus
        rules — then cites where the answer came from.
      </>
    ),
  },
  {
    title: "Get a clear answer",
    body: (
      <>
        Short, direct, with next steps. And when it matters, AIDvisor hands you to
        a human — advisor, counseling, or financial aid.
      </>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section className="section how" id="how">
      <div className="wrap">
        <Reveal>
          <div className="sec-head">
            <span className="mono">How it works</span>
            <h2>Three steps. No appointment needed.</h2>
            <p>
              AIDvisor is built to replace the &quot;should I email my
              advisor?&quot; loop. You ask, it checks, you know.
            </p>
          </div>
        </Reveal>
        <div className="steps">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 100}>
              <div className="step" style={{ height: "100%" }}>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
                {i < steps.length - 1 && (
                  <span className="line" aria-hidden="true" />
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
