import { expect, test, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("../../src/services/auth/server", () => ({
  authClient: async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
  }),
}));
import { executeEvolve } from "../../src/services/evolve/production";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({
    data: { user: { email_confirmed_at: "2026-01-01" } },
    error: null,
  });
  mocks.rpc.mockResolvedValue({
    data: { data: [], revision: 7, serverTime: "2026-01-01" },
    error: null,
  });
});
test("production adapter uses verified session and preserves authoritative envelope", async () => {
  const result = await executeEvolve({ operation: "list", payload: {} });
  expect(result.revision).toBe(7);
  expect(mocks.rpc).toHaveBeenCalledWith("evolve_request", {
    p_operation: "list",
    p_payload: {},
  });
});
test("unverified or revoked sessions never reach the RPC", async () => {
  mocks.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: "invalid" },
  });
  await expect(executeEvolve({ operation: "list" })).rejects.toThrow(
    "Verified access",
  );
  expect(mocks.rpc).not.toHaveBeenCalled();
});
test("fixture authority and unknown operations are rejected before authentication", async () => {
  for (const operation of ["fixture_session", "reset", "__proto__"]) {
    await expect(
      executeEvolve({ operation, payload: { fixture: "administrator" } }),
    ).rejects.toThrow("Invalid request");
  }
  expect(mocks.getUser).not.toHaveBeenCalled();
});
test("hosted RPC denials cannot become successful UI state", async () => {
  mocks.rpc.mockResolvedValue({
    data: null,
    error: { message: "private details" },
  });
  await expect(executeEvolve({ operation: "list" })).rejects.toThrow(
    "EVOLVE unavailable",
  );
});
