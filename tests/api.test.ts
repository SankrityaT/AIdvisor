import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as chat } from "../api/chat.js";
import { GET as health } from "../api/health.js";
import { POST as plan } from "../api/plan.js";
import { POST as reroute } from "../api/reroute.js";
import { POST as speak } from "../api/voice/speak.js";
import { POST as transcribe } from "../api/voice/transcribe.js";
import { buildBaselinePlan } from "../src/planner.js";
import type { QuizAnswers } from "../src/types.js";

const quiz: QuizAnswers = {
  major: "Computer Science, BS",
  goal: "software engineering career",
  riskTolerance: "balanced",
  priority: "protect_gpa"
};

function jsonRequest(url: string, body: unknown, origin?: string): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { Origin: origin } : {})
    },
    body: JSON.stringify(body)
  });
}

describe("API contracts", () => {
  beforeEach(() => {
    delete process.env.AIR_API_KEY;
    delete process.env.FRONTEND_ORIGIN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports health without exposing configuration values", async () => {
    const response = health(new Request("https://compass.test/api/health"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.capabilities.airTextConfigured).toBe(false);
    expect(JSON.stringify(body)).not.toContain("openai.rc.asu.edu");
  });

  it("generates a validated fallback plan without AIR", async () => {
    const response = await plan(jsonRequest("https://compass.test/api/plan", quiz));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.meta.source).toBe("fallback");
    expect(body.data.plan.semesters).toHaveLength(8);
  });

  it("returns a stable validation error envelope", async () => {
    const response = await plan(
      jsonRequest("https://compass.test/api/plan", { ...quiz, major: "History, BA" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      error: { code: "INVALID_REQUEST", message: "Request validation failed" }
    });
  });

  it("reroutes the submitted plan statelessly", async () => {
    const response = await reroute(
      jsonRequest("https://compass.test/api/reroute", {
        currentPlan: buildBaselinePlan(quiz),
        scenarioId: "semester-3-registration"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.source).toBe("fallback");
    expect(body.data.changes).toHaveLength(4);
    expect(body.data.newPlan.graduationTarget).toBe(body.data.originalPlan.graduationTarget);
  });

  it("answers grounded demo questions without AIR", async () => {
    const activePlan = buildBaselinePlan(quiz);
    const response = await chat(
      jsonRequest("https://compass.test/api/chat", {
        message: "Am I still graduating on time?",
        quizAnswers: quiz,
        activePlan,
        history: []
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.meta.source).toBe("fallback");
    expect(body.data.answer).toContain(activePlan.graduationTarget);
  });

  it("rejects an unapproved production origin", async () => {
    process.env.NODE_ENV = "production";
    process.env.FRONTEND_ORIGIN = "https://frontend.example";
    const response = await plan(
      jsonRequest("https://compass.test/api/plan", quiz, "https://attacker.example")
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("ORIGIN_NOT_ALLOWED");
    process.env.NODE_ENV = "test";
  });

  it("returns text fallback metadata when TTS is unavailable", async () => {
    const response = await speak(
      jsonRequest("https://compass.test/api/voice/speak", { text: "You are on track." })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ text: "You are on track.", audioAvailable: false });
    expect(body.meta.source).toBe("fallback");
  });

  it("validates transcription audio types before contacting AIR", async () => {
    const form = new FormData();
    form.append("file", new File(["not audio"], "note.txt", { type: "text/plain" }));
    const response = await transcribe(
      new Request("https://compass.test/api/voice/transcribe", { method: "POST", body: form })
    );
    const body = await response.json();

    expect(response.status).toBe(415);
    expect(body.error.code).toBe("UNSUPPORTED_AUDIO");
  });
});
