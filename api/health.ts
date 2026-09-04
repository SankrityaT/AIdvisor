import { getAirConfig } from "../src/air.js";
import { jsonSuccess, preflight } from "../src/http.js";

export function OPTIONS(request: Request): Response {
  return preflight(request);
}

export function GET(request: Request): Response {
  const config = getAirConfig();
  const configured = Boolean(config.apiKey);
  return jsonSuccess(
    request,
    {
      service: "compass-backend",
      status: "ok",
      catalogVersion: "2026-demo-1",
      capabilities: {
        planning: true,
        rerouting: true,
        chat: true,
        airTextConfigured: configured,
        asrConfigured: configured,
        ttsConfigured: configured
      }
    },
    { source: "deterministic" }
  );
}
