# Compass Backend

Stateless Vercel backend for the Compass ASU AIR Spark Challenge demo. It provides a validated Computer Science core pathway, a deterministic registration disruption/reroute, grounded chat, and ASU AIR voice proxies.

## Run locally

```bash
npm install
cp .env.example .env.local
npx vercel dev
```

Set `AIR_API_KEY` in `.env.local` to enable the ASU AIR integration. The local
file is ignored by git and must never be committed. This project uses
`glm-5-3-flash` for chat and plan explanations and
`qwen3-235b-a22b-thinking-2507` for reroute reasoning by default. Both models
are served through the OpenAI-compatible endpoint configured by `AIR_BASE_URL`.

AIR credentials are optional for planning, rerouting, and chat because those
routes have deterministic fallbacks. ASR requires AIR. TTS returns a text
fallback when AIR is unavailable. The voice model variables in `.env.example`
are optional overrides and are independent of the text-model selection.

## API

- `GET /api/health`
- `GET /api/catalog`
- `POST /api/plan`
- `POST /api/reroute`
- `POST /api/chat`
- `POST /api/voice/transcribe`
- `POST /api/voice/speak`

### Generate a plan

```json
{
  "major": "Computer Science, BS",
  "goal": "software engineering career",
  "riskTolerance": "balanced",
  "priority": "protect_gpa"
}
```

Send the complete returned `data.plan` to `/api/reroute` as `currentPlan`, along with
`"scenarioId": "semester-3-registration"`. See [docs/API.md](docs/API.md) for the
complete frontend contract and examples.

The frontend must retain the active plan and chat context; Vercel Functions do not use server-side session state.

## Deploy

Create or import the project in Vercel, then configure `AIR_API_KEY`,
`AIR_BASE_URL`, `AIR_TEXT_MODEL`, and `AIR_REASONER_MODEL` for Preview and
Production. Configure the same variables for Development when using
`vercel dev`, which injects that remote environment into the local server.
Store the secret through the Vercel dashboard or CLI; do not upload `.env.local`
or the OpenCode configuration. Set `FRONTEND_ORIGIN` to the exact deployed
frontend origin when a browser frontend is ready. The app uses standard
TypeScript functions under `api/` and requires no framework.

## Validation

```bash
npm run typecheck
npm test
npx vercel build
```

The bundled curriculum is a simplified demo core pathway, not a DARS-certified degree audit. Course sentiment is mocked demo data.
