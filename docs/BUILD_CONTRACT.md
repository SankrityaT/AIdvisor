# Compass — build contract (read before writing any code)

Hackathon build, ASU AIR Spark Challenge. Ships tonight. **Working, plain, and
integrated beats clever and polished.** Do not gold-plate.

## Product in one line
An AI academic advisor ("**AIVISOR**", a cute mascot character) that builds a
student a personalized route to graduation and reroutes it live when classes
fall through.

## Stack (already scaffolded — do not re-scaffold)
- Next.js **16.3.4** App Router, React **19**, TypeScript
- **Tailwind v4** — theme is in `app/globals.css` via `@theme`. There is **NO
  `tailwind.config.js`**. Do not create one. Do not use `@apply` in new files.
- No database, no auth, no extra npm packages unless your brief says so.

## THE COLLISION FIREWALL — this is the important part
Multiple agents are building in parallel right now.

**You may ONLY create/edit files inside the directories your brief assigns you.**

These are **SHARED, OWNED BY THE LEAD, READ-ONLY TO YOU**:
- `lib/types.ts`, `lib/asuair.ts`, `lib/agents.ts`, `lib/prereq.ts`
- `app/globals.css`, `app/layout.tsx`, `app/page.tsx`
- `package.json`, `next.config.ts`, `tsconfig.json`
- `data/**` (unless you are the data agent)

If you think a shared file needs a change: **do not edit it.** Finish your work
against the current contract and say so in your final report. The lead will
reconcile. Editing a shared file will be reverted and waste everyone's time.

## ABSOLUTELY NO GIT. NO COMMITS.
Do **not** run `git` in any form — no `commit`, `add`, `stage`, `branch`,
`checkout`, `stash`, `push`, or `reset`. The lead handles all version control.
Also never run `npm install`, `npm run dev`, or start a server.
Type-check with `npx tsc --noEmit` only.

## Shared contracts you import (read `lib/types.ts` first)
`MajorMap`, `Course`, `CourseSentiment`, `QuizAnswers`, `FlowchartOutput`,
`PlanSemester`, `DisruptionEvent`, `RerouteResult`, `RerouteProposal`,
`AgentEvent`, `ConfidenceSnapshot`, `CourseRelevance`, `AdvisorHandoff`,
`AdvisorEmail`.

- `lib/asuair.ts` → `chat`, `chatJSON`, `speak`, `transcribe`, `MODELS`.
  **SERVER ONLY.** Never import it from a `"use client"` file.
- `lib/agents.ts` → `AgentRun`, `streamPipeline`, `consumePipeline`, `AGENTS`.
- `lib/prereq.ts` → `buildCourseIndex`, `validatePlan`, `validateMove`, `creditLoad`.

## Visual direction — ASU maroon + gold, route-map metaphor
Judges look at this. It must read as a **transit route map**, not a dashboard.

Tokens already defined (use as Tailwind classes):
`maroon` `#8C1D40` · `gold` `#FFC627` · `teal` `#2EC4B6` (rerouted path) ·
`alert` `#FF6B4A` · surfaces `ink-950/900/850/800/700/600` · `mist` muted text.
e.g. `bg-ink-900`, `text-gold`, `border-maroon`, `text-mist`, `bg-teal/10`.

- Dark charcoal base. Maroon and gold carry the brand.
- **Gold** = the planned route line. **Teal** = the rerouted path. **Alert
  coral** = something broke. Never use raw red — it muddies against maroon.
- Semesters are **stations** on a line; courses are **stops**.
- Animations: `animate-rise`, `animate-pulse-slow`, `animate-dash` exist.
- Rounded-lg to -2xl, 1px borders like `border-ink-700`, generous spacing.
- Accessible contrast on text. No emoji as UI icons — inline SVG only.

## Rules that keep integration cheap
1. Every component folder exports a **default** React component from
   `index.tsx`, plus named subcomponents if useful.
2. Components are **presentational + self-contained**: they take data via
   **props** and report back via **callback props**. Do **not** reach for global
   state, context providers, or routing. The lead wires everything in `page.tsx`.
3. Client components need `"use client"` at the top.
4. Anything that talks to ASU AIR goes in **your assigned API route**, never in
   a client component.
5. Handle `loading` / `error` / empty states — the demo must never show a blank
   panel or an unhandled crash.
6. **No placeholder `TODO` logic in the demo path.** If you stub something,
   it must still render something sensible on screen.
7. Keep it typed. `npx tsc --noEmit` should be clean for your files.

## Demo path that MUST work end to end (90 seconds, on stage)
1. Onboarding quiz → answered in ~10s
2. Route map renders, semesters as stations
3. "Simulate Registration" → CSE355 full, CSE240 not offered → visible alert
4. Reroute appears: old plan struck through, new plan in teal, **graduation date
   unchanged**
5. Ask AIVISOR a question by voice → spoken answer
6. Graduation Confidence score drops on the break, climbs back on the reroute

## Report back
End with: files you created, the exact props/exports the lead must wire, any
assumption you made, and anything you could not finish. Be honest — a known gap
is fine, a silently broken demo is not.
