import Reveal from "./Reveal";

const stats = [
  { n: "24/7", label: "always on, all semester" },
  { n: "5", label: "campuses, one advisor" },
  { n: "10k+", label: "policies & pages read" },
  { n: "0", label: "judgment, ever" },
];

export default function Stats() {
  return (
    <section className="stats">
      <div className="wrap stats-grid">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 80}>
            <div className="stat">
              <b>{s.n}</b>
              <span>{s.label}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
