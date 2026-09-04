const items = [
  "Course registration",
  "Major changes",
  "Financial aid",
  "Housing & housing",
  "Career paths",
  "Health services",
  "Clubs & events",
  "Transferring in",
  "Graduation planning",
  "Disability services",
];

export default function Marquee() {
  return (
    <div className="strip" aria-hidden="true">
      <div className="marquee">
        {[...items, ...items].map((t, i) => (
          <span key={i}>
            <i />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
