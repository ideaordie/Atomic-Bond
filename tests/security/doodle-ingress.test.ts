import { describe, it, expect, vi } from "vitest";
import { handleDoodle } from "../../src/services/doodle/ingress";
import { doodleRequest } from "../../src/services/doodle/contracts";
const origin = "https://atomicbond.ideaordie.com";
const request = (
  body = JSON.stringify({ action: "read", args: [] }),
  headers: Record<string, string> = {},
) =>
  new Request(origin + "/api/doodle", {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...headers },
    body,
  });
const dependencies = () => ({
  enabled: true,
  origin,
  ingress: vi.fn(async () => ({ rateLimited: false })),
  execute: vi.fn(async (body: unknown) => {
    doodleRequest(body);
    return { data: [] };
  }),
});
describe("Doodle ingress boundary", () => {
  it("times out a stalled body without invoking authentication or the database", async () => {
    vi.useFakeTimers();
    try {
      const d = dependencies();
      const stalled = new Request(origin + "/api/doodle", {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: new ReadableStream(),
        duplex: "half",
      } as RequestInit);
      const response = handleDoodle(stalled, d);
      await vi.advanceTimersByTimeAsync(5001);
      expect((await response).status).toBe(408);
      expect(d.execute).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
  it("accepts only named operations and never synthetic identity or clock authority", () => {
    expect(doodleRequest({ action: "vote", args: ["id"] }).operation).toBe(
      "appreciate_doodle",
    );
    for (const body of [
      { action: "reset", args: [] },
      { action: "submit", args: [], actor: 0 },
      { action: "read", args: [], atomId: "other" },
      { action: "__proto__", args: [] },
    ])
      expect(() => doodleRequest(body)).toThrow();
  });
  it("feature gate performs no external work", async () => {
    const d = dependencies();
    d.enabled = false;
    expect((await handleDoodle(request(), d)).status).toBe(404);
    expect(d.ingress).not.toHaveBeenCalled();
    expect(d.execute).not.toHaveBeenCalled();
  });
  it("rejects invalid origin, type, encoding, declared and streamed oversize before database", async () => {
    for (const [body, headers, status] of [
      ["{}", { origin: "https://evil.invalid" }, 403],
      ["{}", { "content-type": "text/plain" }, 415],
      ["{}", { "content-encoding": "gzip" }, 415],
      ["{}", { "content-length": "70001" }, 413],
      ["x".repeat(70001), {}, 413],
      ["not json", {}, 400],
    ] as const) {
      const d = dependencies();
      expect((await handleDoodle(request(body, headers), d)).status).toBe(
        status,
      );
      expect(d.execute).not.toHaveBeenCalled();
    }
  });
  it("fails closed when ingress is missing or fails, and limits before authentication", async () => {
    for (const value of [
      { rateLimited: true },
      { rateLimited: false, error: "not-found" },
    ]) {
      const d = dependencies();
      const response = await handleDoodle(request(), {
        ...d,
        ingress: async () => value,
      });
      expect(response.status).toBe(value.rateLimited ? 429 : 503);
      expect(d.execute).not.toHaveBeenCalled();
    }
    expect(
      (
        await handleDoodle(request(), {
          ...dependencies(),
          ingress: async () => {
            throw new Error("private configuration");
          },
        })
      ).status,
    ).toBe(503);
  });
  it("returns no-store results and sanitized errors and preserves database throttling", async () => {
    const r = await handleDoodle(request(), dependencies());
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(await r.json()).toEqual({ data: [] });
    const denied = await handleDoodle(request(), {
      ...dependencies(),
      execute: async () => {
        throw new Error("private identity");
      },
    });
    expect(await denied.text()).not.toContain("private identity");
    const rate = await handleDoodle(request(), {
      ...dependencies(),
      execute: async () => ({ error: "RATE_LIMITED", retryAfterSeconds: 42 }),
    });
    expect(rate.status).toBe(429);
    expect(rate.headers.get("retry-after")).toBe("42");
  });
  it("requires a dual-format reader before returning a color drawing", async () => {
    const data = { items: [{ version: 2, bitmap: "color" }] };
    const deps = { ...dependencies(), execute: async () => ({ data }) };
    const old = await handleDoodle(request(), deps);
    expect(old.status).toBe(409);
    expect(await old.text()).not.toContain('"bitmap"');
    const current = await handleDoodle(
      request(undefined, { "X-Doodle-Formats": "1,2" }),
      deps,
    );
    expect(current.status).toBe(200);
    expect(await current.json()).toEqual({ data });
    expect(current.headers.get("cache-control")).toBe("private, no-store");
  });
});
