"use client";

const ITEMS = [
  { label: "Planned", swatch: "bg-gold", note: "on the original line" },
  { label: "Rerouted", swatch: "bg-teal", note: "new segment" },
  { label: "Unavailable", swatch: "bg-alert", note: "class fell through" },
] as const;

export interface LegendProps {
  /** Dims the teal entry until a reroute has actually happened. */
  rerouted?: boolean;
  hasBreak?: boolean;
}

export function Legend({ rerouted, hasBreak }: LegendProps) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {ITEMS.map((item) => {
        const dim =
          (item.label === "Rerouted" && rerouted === false) ||
          (item.label === "Unavailable" && hasBreak === false);
        return (
          <li
            key={item.label}
            className={`flex items-center gap-1.5 transition-opacity ${dim ? "opacity-35" : ""}`}
            title={item.note}
          >
            <span className={`h-[3px] w-5 rounded-full ${item.swatch}`} aria-hidden />
            <span className="font-mono text-[9.5px] tracking-[0.12em] text-mist">
              {item.label.toUpperCase()}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default Legend;
