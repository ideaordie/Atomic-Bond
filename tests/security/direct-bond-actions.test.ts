import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  owner: vi.fn(),
  headers: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("../../src/services/auth/server", () => ({
  ownerContext: mocks.owner,
}));
vi.mock("@vercel/firewall", () => ({ checkRateLimit: mocks.limit }));
import { directRequest } from "../../src/services/direct-bonds/actions";
beforeEach(() => {
  vi.stubEnv("DIRECT_BOND_REQUESTS_ENABLED", "true");
  vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3100");
  vi.stubEnv("AUTH_ALLOW_LOCALHOST", "true");
  vi.stubEnv("VERCEL", "");
  mocks.headers.mockResolvedValue(
    new Headers({ origin: "http://127.0.0.1:3100" }),
  );
  mocks.owner.mockResolvedValue({
    user: { email_confirmed_at: "verified" },
    atom: { status: "ACTIVE" },
    client: { rpc: mocks.rpc },
  });
  mocks.rpc.mockResolvedValue({ data: { state: "PENDING" }, error: null });
  mocks.limit.mockResolvedValue({ rateLimited: false });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("fails closed when disabled, cross-origin or an inactive owner", async () => {
  vi.stubEnv("DIRECT_BOND_REQUESTS_ENABLED", "false");
  await expect(directRequest("list")).rejects.toThrow();
  expect(mocks.owner).not.toHaveBeenCalled();
  vi.stubEnv("DIRECT_BOND_REQUESTS_ENABLED", "true");
  mocks.headers.mockResolvedValue(
    new Headers({ origin: "https://untrusted.example" }),
  );
  await expect(directRequest("list")).rejects.toThrow();
  mocks.headers.mockResolvedValue(
    new Headers({ origin: "http://127.0.0.1:3100" }),
  );
  mocks.owner.mockResolvedValue({
    user: { email_confirmed_at: "verified" },
    atom: { status: "DEACTIVATED" },
  });
  await expect(directRequest("accept", { id: "synthetic" })).rejects.toThrow();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("uses the existing authenticated RPC without forwarding a caller identity", async () => {
  await directRequest("create", { target: "3" });
  expect(mocks.rpc).toHaveBeenCalledWith("direct_bond_request", {
    p_operation: "create",
    p_payload: { target: "3" },
  });
});
it("does not expose private database diagnostics and fails closed on ingress failure", async () => {
  mocks.rpc.mockResolvedValue({
    error: { message: "private identity detail" },
  });
  await expect(directRequest("list")).rejects.toThrow("no longer available");
  vi.stubEnv("VERCEL", "1");
  mocks.limit.mockRejectedValue(new Error("unavailable"));
  await expect(directRequest("list")).rejects.toThrow(
    "temporarily unavailable",
  );
});
