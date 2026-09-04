import Reveal from "./Reveal";

const quotes = [
  {
    text: (
      <>
        &quot;I asked AIDvisor at 2am whether my transfer credits would count. It
        answered in a minute with the <em>exact registrar page</em>. I would
        have panicked for a week.&quot;
      </>
    ),
    initial: "M",
    color: "var(--red-600)",
    name: "Mariana G.",
    meta: "First-year · Tempe",
  },
  {
    text: (
      <>
        &quot;The degree check feature caught that I was{" "}
        <em>two semesters off from graduating</em> because of a prerequisite
        swap. My human advisor confirmed it. That&apos;s it, that&apos;s the
        review.&quot;
      </>
    ),
    initial: "J",
    color: "#B4541E",
    name: "Jerome T.",
    meta: "W. P. Carey · Downtown",
  },
  {
    text: (
      <>
        &quot;I was scared to ask about withdrawing. AIDvisor didn&apos;t make me
        feel dumb — it laid out the deadlines, the refund dates, and{" "}
        <em>routed me to a counselor</em>. Zero shame.&quot;
      </>
    ),
    initial: "A",
    color: "#7A4A8C",
    name: "Aisha K.",
    meta: "Senior · West",
  },
];

export default function Testimonials() {
  return (
    <section className="section" id="stories">
      <div className="wrap">
        <Reveal>
          <div className="sec-head">
            <span className="mono">Student stories</span>
            <h2>Sun Devils, unfiltered.</h2>
            <p>Early beta feedback from students across campus.</p>
          </div>
        </Reveal>
        <div className="quotes">
          {quotes.map((q, i) => (
            <Reveal key={q.name} delay={i * 100}>
              <article className="quote" style={{ height: "100%" }}>
                <span className="stars">★★★★★</span>
                <p>{q.text}</p>
                <div className="q-who">
                  <i style={{ background: q.color }}>{q.initial}</i>
                  <div>
                    <b>{q.name}</b>
                    <small>{q.meta}</small>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
