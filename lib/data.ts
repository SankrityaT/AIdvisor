// ── Static data loading (SERVER ONLY) ──────────────────────────────────
// SHARED. Read-only to feature agents.

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CourseSentiment, MajorMap } from "./types";

let cache: { map: MajorMap; sentiment: CourseSentiment[] } | null = null;

export async function loadData(): Promise<{ map: MajorMap; sentiment: CourseSentiment[] }> {
  if (cache) return cache;
  // Our data lives in data/aivisor/ so it cannot collide with the
  // compass-backend data files that share this repo.
  const dir = path.join(process.cwd(), "data", "aivisor");
  const [mapRaw, sentRaw] = await Promise.all([
    readFile(path.join(dir, "major-map.json"), "utf8"),
    readFile(path.join(dir, "course-sentiment.json"), "utf8").catch(() => "[]"),
  ]);
  const map = JSON.parse(mapRaw) as MajorMap;
  const sentiment = JSON.parse(sentRaw) as CourseSentiment[];
  cache = { map, sentiment };
  return cache;
}
