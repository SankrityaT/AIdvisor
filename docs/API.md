# Compass API contract

All routes are rooted at the deployed Vercel origin. JSON successes use:

```ts
type ApiSuccess<T> = {
  ok: true;
  data: T;
  meta: {
    source: "air" | "fallback" | "deterministic";
    model?: string;
    fallbackReason?: string;
  };
};
```

JSON errors use:

```ts
type ApiFailure = {
  ok: false;
  error: { code: string; message: string; details?: unknown };
};
```

Canonical TypeScript domain interfaces live in [`src/types.ts`](../src/types.ts).

## Plan

`POST /api/plan`

```json
{
  "major": "Computer Science, BS",
  "goal": "software engineering career",
  "riskTolerance": "balanced",
  "priority": "protect_gpa"
}
```

`riskTolerance` accepts `conservative`, `balanced`, or `ambitious`. `priority`
accepts `learn_deeply` or `protect_gpa`.

The success data is:

```ts
{
  plan: DegreePlan;
  explanation: string;
}
```

## Reroute

`POST /api/reroute`

```ts
const generated = await fetch(`${apiOrigin}/api/plan`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(quizAnswers)
}).then((response) => response.json());

const rerouted = await fetch(`${apiOrigin}/api/reroute`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    currentPlan: generated.data.plan,
    scenarioId: "semester-3-registration"
  })
}).then((response) => response.json());
```

The success data contains `originalPlan`, `newPlan`, `disruptions`, `changes`, and
`explanation`. Render `changes` to create the old-to-new visual diff, then retain
`newPlan` as the active client-side plan.

## Chat

`POST /api/chat`

```ts
{
  message: string;
  quizAnswers: QuizAnswers;
  activePlan: DegreePlan;
  disruption?: {
    disruptions: Disruption[];
    explanation: string;
  };
  history: Array<{
    role: "user" | "assistant";
    content: string;
  }>; // at most 8 entries
}
```

The success data is `{ answer: string }`. After rerouting, send `newPlan` as
`activePlan` and the reroute's disruptions and explanation as `disruption`.

## Voice

`POST /api/voice/transcribe` accepts `multipart/form-data` with one `file` field.
Use WebM, WAV, or MP3 and keep the file at or below 4 MB. Success data is
`{ transcript: string }`. This route returns HTTP 503 when AIR ASR is unavailable.

`POST /api/voice/speak` accepts:

```ts
{ text: string; voice?: string }
```

On success it returns an audio response; inspect `Content-Type` and
`X-Compass-Source: air`. If AIR is unavailable, it returns the normal JSON envelope
with `{ text, audioAvailable: false }`, allowing the browser to fall back to
`speechSynthesis`.

## Catalog and health

- `GET /api/catalog` returns the static core pathway and enriched course catalog.
- `GET /api/health` returns capability flags. It does not make a live AIR request.

## CORS

Set `FRONTEND_ORIGIN` in Vercel to the exact frontend origin, including scheme.
Production mutation requests from any other browser origin receive HTTP 403.
