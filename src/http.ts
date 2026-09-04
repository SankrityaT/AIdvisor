import { ZodError, type ZodType } from "zod";
import { AppError } from "./errors.js";
import type { ApiFailure, ApiSuccess, ResponseMeta } from "./types.js";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const configuredOrigin = process.env.FRONTEND_ORIGIN;
  const isLocal = origin ? /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) : false;
  const allowedOrigin =
    origin && (origin === configuredOrigin || (process.env.NODE_ENV !== "production" && isLocal))
      ? origin
      : configuredOrigin;

  return {
    "Access-Control-Allow-Origin": allowedOrigin ?? "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    Vary: "Origin"
  };
}

export function isOriginAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  const configuredOrigin = process.env.FRONTEND_ORIGIN;
  if (!origin || !configuredOrigin) return true;
  if (origin === configuredOrigin) return true;
  return process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function jsonSuccess<T>(
  request: Request,
  data: T,
  meta: ResponseMeta,
  status = 200
): Response {
  const body: ApiSuccess<T> = { ok: true, data, meta };
  return Response.json(body, {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(request) }
  });
}

export function jsonError(request: Request, error: unknown): Response {
  const appError =
    error instanceof AppError
      ? error
      : error instanceof ZodError
        ? new AppError(400, "INVALID_REQUEST", "Request validation failed", error.flatten())
        : new AppError(500, "INTERNAL_ERROR", "An unexpected error occurred");

  const body: ApiFailure = {
    ok: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details === undefined ? {} : { details: appError.details })
    }
  };
  return Response.json(body, {
    status: appError.status,
    headers: { ...JSON_HEADERS, ...corsHeaders(request) }
  });
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 1_000_000) {
    throw new AppError(413, "PAYLOAD_TOO_LARGE", "JSON request exceeds 1 MB");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new AppError(400, "INVALID_JSON", "Request body must be valid JSON");
  }
  return schema.parse(payload);
}

export async function handleJson<T>(request: Request, action: () => Promise<Response>): Promise<Response> {
  if (!isOriginAllowed(request)) {
    return jsonError(request, new AppError(403, "ORIGIN_NOT_ALLOWED", "Origin is not allowed"));
  }
  try {
    return await action();
  } catch (error) {
    return jsonError(request, error);
  }
}
