import { getCatalogResponse } from "../src/catalog.js";
import { jsonSuccess, preflight } from "../src/http.js";

export function OPTIONS(request: Request): Response {
  return preflight(request);
}

export function GET(request: Request): Response {
  return jsonSuccess(request, getCatalogResponse(), { source: "deterministic" });
}
