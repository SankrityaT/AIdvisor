/**
 * Lottie animation data for AIDVisor, one file per state.
 *
 * Kept as a barrel so `index.tsx` can `await import("./animations")` behind a
 * try/catch — if anything here is missing or malformed the component silently
 * falls back to the hand-drawn SVG mascot.
 *
 * Identical copies live in `public/lottie/` for anyone who wants to fetch them
 * over HTTP instead.
 */

import idle from "./lottie/idle.json";
import thinking from "./lottie/thinking.json";
import alert from "./lottie/alert.json";
import happy from "./lottie/happy.json";
import speaking from "./lottie/speaking.json";

export type MascotState = "idle" | "thinking" | "alert" | "happy" | "speaking";

const animations: Record<MascotState, object> = {
  idle,
  thinking,
  alert,
  happy,
  speaking,
};

export default animations;
