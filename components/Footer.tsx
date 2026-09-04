import Link from "next/link";
import AIDvisor from "@/app/components/mascot";

const cols = [
  {
    title: "Product",
    links: [
      { label: "What AIDvisor handles", href: "#handles" },
      { label: "How it works", href: "#how" },
      { label: "Why trust AIDvisor", href: "#trust" },
      { label: "Student stories", href: "#stories" },
    ],
  },
  {
    title: "Campuses",
    links: [
      { label: "Tempe", href: "#" },
      { label: "West", href: "#" },
      { label: "Polytechnic", href: "#" },
      { label: "Downtown Phoenix", href: "#" },
      { label: "ASU Online", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Academic calendar", href: "#" },
      { label: "Financial aid", href: "#" },
      { label: "Career services", href: "#" },
      { label: "Counseling center", href: "#" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Link className="logo" href="#top">
              <span className="logo-mark is-mascot">
              <AIDvisor state="idle" size={28} />
            </span>
              <span>
                AIDvisor
                <small>ASU AI ADVISOR</small>
              </span>
            </Link>
            <p>
              The AI advisor for every Sun Devil. One place for every question
              about ASU.
            </p>
          </div>
          {cols.map((c) => (
            <div className="foot-col" key={c.title}>
              <h4>{c.title}</h4>
              <ul>
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="foot-bottom">
          <span>
            © 2026 AIDvisor · a concept project, not affiliated with Arizona State
            University.
          </span>
          <span className="disc">
            AIDvisor is an AI assistant. For urgent matters, medical needs, or
            binding academic decisions, always confirm with an official ASU
            service.
          </span>
        </div>
      </div>
    </footer>
  );
}
