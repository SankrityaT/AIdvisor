"use client";

const ROUTE_PATH = "M10 46 H68 L102 18 H186 L220 46 H310";
const STATIONS: Array<[number, number]> = [
  [10, 46],
  [102, 18],
  [186, 18],
  [220, 46],
  [310, 46],
];

export interface RouteLoaderProps {
  /** Student's name — "Plotting Maya's route…" */
  name: string;
  /** Short chips echoing what they answered. */
  chips: string[];
}

/**
 * Pending state while the lead's pipeline builds the plan. Deliberately
 * quiet — the real agent telemetry panel lives elsewhere on the page.
 */
export function RouteLoader({ name, chips }: RouteLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-rise rounded-2xl border border-ink-700 bg-ink-900/60 px-6 py-8 text-center"
    >
      <svg
        viewBox="0 0 320 64"
        aria-hidden="true"
        className="mx-auto h-16 w-full max-w-sm"
      >
        <path
          d={ROUTE_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-ink-700"
        />
        <path
          d={ROUTE_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="10 14"
          className="animate-dash text-gold"
        />
        {STATIONS.map(([cx, cy], i) => (
          <circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r="4.5"
            fill="currentColor"
            className="animate-pulse-slow text-gold"
            style={{ animationDelay: `${i * 180}ms` }}
          />
        ))}
      </svg>

      <p className="mt-5 text-lg font-medium tracking-tight text-white/95">
        Plotting {name}&rsquo;s route&hellip;
      </p>
      <p className="mt-1.5 text-sm text-mist">
        Reading the major map, ordering prerequisites, checking the load.
      </p>

      {chips.length > 0 ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-ink-700 bg-ink-850 px-3 py-1 text-[12px] text-mist"
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default RouteLoader;
