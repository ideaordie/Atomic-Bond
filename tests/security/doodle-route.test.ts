import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@vercel/firewall", () => ({ checkRateLimit: vi.fn() }));
vi.mock("../../src/services/doodle/server", () => ({ executeDoodle: vi.fn() }));
import { checkRateLimit } from "@vercel/firewall";
import { executeDoodle } from "../../src/services/doodle/server";
import { POST } from "../../src/app/api/doodle/route";
const origin = "https://atomicbond.ideaordie.com";
const request = () =>
  new Request(origin + "/api/doodle", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      host: "untrusted.invalid",
      "x-real-ip": "192.0.2.1",
      cookie: "private-session=synthetic",
    },
    body: JSON.stringify({ action: "read", args: [] }),
  });
beforeEach(() => {
  vi.stubEnv("GLOBAL_DOODLE_ENABLED", "true");
  vi.stubEnv("APP_ORIGIN", origin);
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("NODE_ENV", "production");
  vi.mocked(checkRateLimit).mockResolvedValue({ rateLimited: false });
  vi.mocked(executeDoodle).mockResolvedValue({ data: [] });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("passes only configured host and platform IP to the official protection check", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(checkRateLimit).toHaveBeenCalledExactlyOnceWith("atomic-bond-doodle", {
    headers: { host: "atomicbond.ideaordie.com", "x-real-ip": "192.0.2.1" },
    timeout: 1500,
  });
  expect(executeDoodle).toHaveBeenCalledOnce();
});
it("never lets the SDK development no-op bypass the Vercel guard", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("AUTH_ALLOW_LOCALHOST", "true");
  expect((await POST(request())).status).toBe(503);
  expect(checkRateLimit).not.toHaveBeenCalled();
  expect(executeDoodle).not.toHaveBeenCalled();
});
it("does not run the SDK or owner adapter while rollout is disabled", async () => {
  vi.stubEnv("GLOBAL_DOODLE_ENABLED", "false");
  expect((await POST(request())).status).toBe(404);
  expect(checkRateLimit).not.toHaveBeenCalled();
  expect(executeDoodle).not.toHaveBeenCalled();
});
