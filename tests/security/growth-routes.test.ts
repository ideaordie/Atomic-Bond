import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  unsubscribe: vi.fn(),
  scan: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../src/data/growth/store", () => ({ growthStore: mocks }));
vi.mock("../../src/services/notifications/resend-transport", () => ({
  resendTransport: () => {
    throw new Error("Unexpected live sender");
  },
}));
import { POST } from "../../src/app/api/growth/unsubscribe/route";
import { GET } from "../../src/app/api/growth/run/route";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("rejects recipient, RPC and Atom overrides even on authorized scheduler calls", async () => {
  vi.stubEnv("CRON_SECRET", "s".repeat(32));
  for (const parameter of ["recipient", "rpc", "atomId", "table", "sql"]) {
    const result = await GET(
      new Request(
        `https://example.com/api/growth/run?${parameter}=unapproved`,
        { headers: { authorization: `Bearer ${"s".repeat(32)}` } },
      ),
    );
    expect(result.status).toBe(400);
    expect(mocks.scan).not.toHaveBeenCalled();
  }
});
it("rejects unauthorized scheduler invocations before database access", async () => {
  vi.stubEnv("CRON_SECRET", "s".repeat(32));
  for (const authorization of ["", "Bearer bad"]) {
    const result = await GET(
      new Request("https://example.com/api/growth/run?dryRun=false", {
        headers: { authorization },
      }),
    );
    expect(result.status).toBe(401);
    expect(mocks.scan).not.toHaveBeenCalled();
  }
});
it("authorized default mode is aggregate-only, non-sending and non-caching", async () => {
  vi.stubEnv("CRON_SECRET", "s".repeat(32));
  vi.stubEnv("APP_ORIGIN", "https://atomicbond.ideaordie.com");
  vi.stubEnv("GROWTH_EMAIL_ENABLED", "false");
  const result = await GET(
    new Request("https://example.com/api/growth/run", {
      headers: { authorization: `Bearer ${"s".repeat(32)}` },
    }),
  );
  expect(result.status).toBe(200);
  expect(await result.json()).toMatchObject({
    dryRun: true,
    attempted: 0,
    accepted: 0,
  });
  expect(result.headers.get("cache-control")).toContain("no-store");
});
it("rejects malformed/oversized unsubscribe and never establishes a session", async () => {
  for (const body of ["3", "private@example.com", "a".repeat(65)]) {
    const result = await POST(
      new Request("https://example.com/api/growth/unsubscribe", {
        method: "POST",
        body,
      }),
    );
    expect(result.ok).toBe(false);
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
  }
  mocks.unsubscribe.mockResolvedValue(true);
  const result = await POST(
    new Request("https://example.com/api/growth/unsubscribe", {
      method: "POST",
      body: "a".repeat(64),
    }),
  );
  expect(await result.json()).toEqual({ success: true });
  expect(result.headers.has("set-cookie")).toBe(false);
  expect(result.headers.get("cache-control")).toContain("no-store");
});
