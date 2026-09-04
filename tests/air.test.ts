import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestAirText } from "../src/air.js";

describe("AIR adapter", () => {
  beforeEach(() => {
    process.env.AIR_API_KEY = "test-secret";
    process.env.AIR_BASE_URL = "https://air.example/v1/";
    process.env.AIR_TEXT_MODEL = "test-text-model";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.AIR_API_KEY;
    delete process.env.AIR_BASE_URL;
    delete process.env.AIR_TEXT_MODEL;
  });

  it("uses the configured OpenAI-compatible chat endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ choices: [{ message: { content: "Validated explanation" } }] })
    );

    const result = await requestAirText({ role: "text", system: "system", user: "user" });

    expect(result).toEqual({ text: "Validated explanation", model: "test-text-model" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://air.example/v1/chat/completions",
      expect.objectContaining({ method: "POST" })
    );
    const init = fetchMock.mock.calls[0]![1]!;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-secret");
  });

  it("rejects a malformed successful response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ choices: [] }));

    await expect(
      requestAirText({ role: "text", system: "system", user: "user" })
    ).rejects.toMatchObject({ code: "AIR_INVALID_RESPONSE", status: 503 });
  });

  it("normalizes upstream HTTP failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("down", { status: 502 }));

    await expect(
      requestAirText({ role: "text", system: "system", user: "user" })
    ).rejects.toMatchObject({ code: "AIR_UNAVAILABLE", status: 503 });
  });
});
