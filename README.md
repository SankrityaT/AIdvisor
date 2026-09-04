# Compass Backend

Stateless Vercel backend for the Compass ASU AIR Spark Challenge demo. It provides a validated Computer Science core pathway, a deterministic registration disruption/reroute, grounded chat, and ASU AIR voice proxies.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

AIR credentials are optional for planning, rerouting, and chat because those routes have deterministic fallbacks. ASR requires AIR. TTS returns a text fallback when AIR is unavailable.

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

Import this repository into Vercel and configure the variables from `.env.example`. Set `FRONTEND_ORIGIN` to the exact deployed frontend origin. The app uses standard TypeScript functions under `api/` and requires no framework.

## Validation

```bash
npm run typecheck
npm test
npx vercel build
```

The bundled curriculum is a simplified demo core pathway, not a DARS-certified degree audit. Course sentiment is mocked demo data.
