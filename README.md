# AIDVisor — Compass

**An AI academic advisor that builds a student a personalized route to graduation, then reroutes it live the moment reality gets in the way.**

Built for the **ASU AIR Spark Challenge**. Every model call runs on ASU's AIR gateway (`openai.rc.asu.edu/v1`).

---

## The problem

A class fills up. A course isn't offered. Today that means a student finds out three
weeks later, in an advisor's inbox. AIDVisor reroutes the degree plan in about
fourteen seconds — and keeps the graduation date.

## Demo path (90 seconds)

1. **Quiz** — major, career goal, risk tolerance, priority. ~10 seconds.
2. **Route map renders** — semesters as stations, courses as stops along a gold line.
3. **Simulate Registration** — `CSE355` comes back FULL, `CSE240` NOT OFFERED.
4. **Graduation Confidence drops** 94 → 49, with specific reasons.
5. **Three reasoners debate concurrently** — fastest graduation vs. lightest workload
   vs. best career fit. A judge picks one and says why in a sentence.
6. **Apply the reroute** — old plan struck through, new plan in teal, confidence back
   to 91, **graduation date unchanged**.
7. **Ask AIDVisor out loud** — speech in, spoken answer out, grounded in *your* plan.

## The multi-agent pipeline is real

The Agent Activity panel is not a loading animation. Every row is one genuine ASU AIR
call, showing the real model id and real elapsed time.

| Stage | Agents | Model |
|---|---|---|
| Plan | Curator → Planner → Critic | `devstral2-123b`, `glm-5-3-flash` |
| Reroute | Analyst → **3 Reasoners in parallel** → Judge | `qwen3-235b-a22b-instruct-2507`, `devstral2-123b` |
| Live | Advisor (why this class), Narrator, Chat | `qwen3-coder-next`, `qwen38-27b` |
| Voice | ASR / TTS | `qwen3-asr-1p7b`, `qwen3-tts-customvoice-1p7b` |

**AI proposes, deterministic code disposes.** Every plan an LLM produces is validated
against a real prerequisite graph (`lib/prereq.ts`) before a student ever sees it, and
`lib/solver.ts` can construct a valid reroute on its own. If the gateway is slow or
degraded mid-demo, the reroute still works.

## Features

- Route-map visualization with live reroute diff
- Graduation Confidence score that moves at the two moments that matter
- Multi-agent reroute debate with a judge
- Grounded chat — answers cite *your* courses and semesters, never generic advice
- Voice in / voice out
- "Why this class" relevance, weighted to the stated career goal
- Drag-to-reschedule what-if validation against the prereq graph
- Time-preference conflict checking
- Advisor handoff document + ready-to-send email for genuine dead ends
- **AIDVisor**, an animated Lottie mascot who reacts to what's happening

## Run it

```bash
npm install
export OPENAI_API_KEY=<your ASU AIR key>
npm run dev
```

Open http://localhost:3000. No database, no auth, no build step beyond Next.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Lottie

```
app/          UI + API routes
app/api/      plan, reroute, chat, relevance, narrative, handoff, voice
lib/          types, ASU AIR client, agent orchestration, prereq graph, solver
data/         ASU CS major map, prerequisites, course sentiment
```

## Honest notes

- One major (Computer Science, BS) and one demo persona, per the challenge scope.
- Course sentiment blurbs are realistic but synthetic, not scraped.
- `MAT243`'s prerequisite deviates slightly from the live catalog so the scripted
  disruption has a valid solution — flagged in `data/notes.md`.
- The disruption is deterministic, not random. That is deliberate: it is a demo.
