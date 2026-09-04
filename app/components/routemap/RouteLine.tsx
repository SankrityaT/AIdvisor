"use client";

import { useId } from "react";
import { LAYOUT, segmentIsRerouted, type StationModel } from "./geometry";

export interface RouteLineProps {
  stations: StationModel[];
  terminusX: number;
  width: number;
  height: number;
}

/**
 * The whole route drawn as one SVG: casing, coloured segments, station
 * nodes, drop spines and the branch tick for every stop. Everything sits on
 * the LAYOUT pixel grid so the HTML chips line up exactly.
 */
export function RouteLine({ stations, terminusX, width, height }: RouteLineProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gridId = `cmp-grid-${uid}`;
  const glowId = `cmp-glow-${uid}`;
  const y = LAYOUT.LINE_Y;
  const originX = LAYOUT.PAD_X - 34;

  const segments: { key: string; x1: number; x2: number; teal: boolean }[] = [];
  for (let i = 0; i < stations.length - 1; i += 1) {
    segments.push({
      key: `seg-${i}`,
      x1: stations[i].x,
      x2: stations[i + 1].x,
      teal: segmentIsRerouted(stations, i),
    });
  }
  const last = stations[stations.length - 1];
  if (last) {
    segments.push({
      key: "seg-terminus",
      x1: last.x,
      x2: terminusX,
      teal: last.changed,
    });
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute left-0 top-0"
      aria-hidden
    >
      <defs>
        <pattern id={gridId} width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" className="fill-ink-800" />
        </pattern>
        <radialGradient id={glowId}>
          <stop offset="0%" stopColor="var(--color-gold, #ffc627)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--color-gold, #ffc627)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={width} height={height} fill={`url(#${gridId})`} opacity={0.7} />

      {/* Casing: the dark sheath that makes the line read as transit ink. */}
      <line
        x1={originX}
        y1={y}
        x2={terminusX}
        y2={y}
        className="stroke-ink-800"
        strokeWidth={15}
        strokeLinecap="round"
      />

      {/* Origin cap. */}
      <rect
        x={originX - 5}
        y={y - 9}
        width={11}
        height={18}
        rx={3}
        className="fill-gold-600"
      />
      <line
        x1={originX}
        y1={y}
        x2={stations[0]?.x ?? terminusX}
        y2={y}
        className="stroke-gold/50"
        strokeWidth={5}
        strokeLinecap="round"
      />

      {segments.map((seg) => (
        <g key={seg.key}>
          <line
            x1={seg.x1}
            y1={y}
            x2={seg.x2}
            y2={y}
            className={seg.teal ? "stroke-teal" : "stroke-gold"}
            strokeWidth={5}
            strokeLinecap="round"
          />
          {seg.teal ? (
            <line
              x1={seg.x1}
              y1={y}
              x2={seg.x2}
              y2={y}
              className="animate-dash stroke-ink-950/70"
              strokeWidth={5}
              strokeDasharray="4 20"
              strokeLinecap="round"
            />
          ) : null}
        </g>
      ))}

      {/* Drop spines + branch ticks. */}
      {stations.map((station) => {
        const stops = station.stops;
        if (stops.length === 0) return null;
        const lastStop = stops[stops.length - 1];
        const spineEnd = lastStop.y + LAYOUT.CHIP_H / 2;
        return (
          <g key={`branch-${station.semester}`}>
            <line
              x1={station.x}
              y1={y + LAYOUT.NODE_R}
              x2={station.x}
              y2={spineEnd}
              className={station.changed ? "stroke-teal/55" : "stroke-gold/35"}
              strokeWidth={2}
              strokeLinecap="round"
            />
            {stops.map((stop) => {
              const cy = stop.y + LAYOUT.CHIP_H / 2;
              // Literal class strings on both branches — Tailwind only emits
              // classes it can see in the source.
              const tone = stop.broken
                ? { line: "stroke-alert/80", dot: "fill-alert/80" }
                : stop.kind === "added"
                  ? { line: "stroke-teal", dot: "fill-teal" }
                  : stop.kind === "removed"
                    ? { line: "stroke-ink-600", dot: "fill-ink-600" }
                    : { line: "stroke-gold/55", dot: "fill-gold/55" };
              return (
                <g key={`${station.semester}-${stop.code}-${stop.row}`}>
                  <line
                    x1={station.x}
                    y1={cy}
                    x2={station.x + LAYOUT.CHIP_OFFSET_X}
                    y2={cy}
                    className={tone.line}
                    strokeWidth={2}
                  />
                  <circle cx={station.x} cy={cy} r={2.75} className={tone.dot} />
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Station nodes, drawn last so the line passes behind them. */}
      {stations.map((station) => (
        <StationNode key={`node-${station.semester}`} station={station} y={y} />
      ))}

      {/* Terminus: always gold. The destination does not move. */}
      <circle cx={terminusX} cy={y} r={46} fill={`url(#${glowId})`} />
      <circle cx={terminusX} cy={y} r={22} className="fill-ink-950 stroke-gold/35" strokeWidth={1.5} />
      <circle cx={terminusX} cy={y} r={15} className="fill-ink-950 stroke-gold" strokeWidth={4} />
      <circle cx={terminusX} cy={y} r={6} className="fill-gold" />

      {/* Stub tying the terminus node to its graduation-target placard. */}
      <line
        x1={terminusX}
        y1={y + 22}
        x2={terminusX}
        y2={LAYOUT.CHIPS_TOP + 34}
        className="stroke-gold/50"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <line
        x1={terminusX}
        y1={LAYOUT.CHIPS_TOP + 34}
        x2={terminusX + 26}
        y2={LAYOUT.CHIPS_TOP + 34}
        className="stroke-gold/50"
        strokeWidth={2}
      />
    </svg>
  );
}

export interface StationNodeProps {
  station: StationModel;
  y: number;
}

/** The circular station marker: filled = done, pulsing ring = current, hollow = future. */
export function StationNode({ station, y }: StationNodeProps) {
  const r = LAYOUT.NODE_R;
  const accent = station.changed ? "stroke-teal" : "stroke-gold";
  const accentFill = station.changed ? "fill-teal" : "fill-gold";

  return (
    <g>
      {/* Halo so the route line appears to pass behind the node. */}
      <circle cx={station.x} cy={y} r={r + 5} className="fill-ink-950" />

      {station.status === "current" ? (
        <circle
          cx={station.x}
          cy={y}
          r={r + 7}
          className={`animate-pulse-slow ${accent}`}
          strokeWidth={2}
          fill="none"
          opacity={0.55}
        />
      ) : null}

      {station.status === "done" ? (
        <>
          <circle cx={station.x} cy={y} r={r} className={accentFill} opacity={0.5} />
          <path
            d={`M ${station.x - 5} ${y} l 3.5 3.8 L ${station.x + 5.5} ${y - 4.5}`}
            className="stroke-ink-950"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      ) : (
        <>
          <circle
            cx={station.x}
            cy={y}
            r={r}
            className={`fill-ink-950 ${
              station.status === "current" || station.changed ? accent : "stroke-ink-600"
            }`}
            strokeWidth={3}
          />
          {station.status === "current" ? (
            <circle cx={station.x} cy={y} r={5} className={accentFill} />
          ) : null}
        </>
      )}

      {station.hasBreak ? (
        <circle
          cx={station.x + r + 6}
          cy={y - r - 4}
          r={4}
          className="fill-alert stroke-ink-950"
          strokeWidth={1.5}
        />
      ) : null}
    </g>
  );
}

export default RouteLine;
