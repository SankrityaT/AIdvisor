"use client";

import { LAYOUT } from "./geometry";

export interface TerminusProps {
  /** x of the terminus node on the board. */
  x: number;
  graduationTarget: string;
  major?: string;
  /** True once a reroute has happened — the target is shown holding firm. */
  rerouted?: boolean;
}

/**
 * End of the line. Always gold, never teal: the whole point is that the
 * destination survives the reroute.
 */
export function Terminus({ x, graduationTarget, major, rerouted }: TerminusProps) {
  return (
    <>
      <div
        className="absolute select-none text-center"
        style={{ left: x - 90, top: LAYOUT.LINE_Y - 62, width: 180 }}
      >
        <p className="font-mono text-[9px] font-bold tracking-[0.2em] text-gold-600">
          TERMINUS
        </p>
      </div>

      <div
        className="absolute animate-rise"
        // Sits to the right of the node so it never collides with the last
        // station's stops; RouteLine draws the stub that connects it.
        style={{ left: x + 26, top: LAYOUT.CHIPS_TOP - 6, width: LAYOUT.TERMINUS_W - 34 }}
      >
        <div className="rounded-xl border border-gold/35 bg-gradient-to-br from-maroon/35 via-ink-850 to-ink-900 p-4 shadow-[0_0_50px_-16px_rgba(255,198,39,.55)]">
          <p className="font-mono text-[9px] tracking-[0.18em] text-gold-600">
            GRADUATION TARGET
          </p>
          <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight text-gold">
            {graduationTarget || "TBD"}
          </p>
          {major ? (
            <p className="mt-2 text-[11px] leading-snug text-mist">{major}</p>
          ) : null}
          {rerouted ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-teal/45 bg-teal/10 px-2 py-1 font-mono text-[9px] font-bold tracking-[0.1em] text-teal">
              <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden>
                <path
                  d="M2 6.4 4.6 9 10 3.2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              UNCHANGED BY REROUTE
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}

export default Terminus;
