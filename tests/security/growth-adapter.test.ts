import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), createClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
import { growthStore } from "../../src/data/growth/store";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
function configure() {
  vi.stubEnv("ATOMIC_BOND_DATA_MODE", "supabase");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_GROWTH_SECRET_KEY", "sb_secret_test_fixture_only");
  mocks.createClient.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
}
it("exposes only seven fixed operations through a sessionless server client", async () => {
  configure();
  await growthStore.scan("0", 10);
  await growthStore.evaluate("3", false);
  await growthStore.reserve("3");
  await growthStore.claim("job");
  await growthStore.authorize("job", "attempt", "hash");
  await growthStore.finish("job", "attempt", true);
  await growthStore.unsubscribe("token");
  expect(Object.keys(growthStore).sort()).toEqual([
    "authorize",
    "claim",
    "evaluate",
    "finish",
    "reserve",
    "scan",
    "unsubscribe",
  ]);
  expect(mocks.rpc.mock.calls.map((c) => c[0])).toEqual([
    "growth_scan",
    "growth_evaluate",
    "growth_reserve",
    "growth_claim",
    "growth_authorize_send",
    "growth_finish",
    "growth_unsubscribe",
  ]);
  expect(mocks.createClient).toHaveBeenCalledWith(
    "https://example.supabase.co",
    "sb_secret_test_fixture_only",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  expect(readFileSync("src/data/growth/store.ts", "utf8")).toMatch(
    /^import "server-only"/,
  );
});
it("rejects public credentials and suppresses sensitive provider errors", async () => {
  configure();
  vi.stubEnv("SUPABASE_GROWTH_SECRET_KEY", "sb_publishable_wrong");
  await expect(growthStore.scan("0", 10)).rejects.toThrow(
    "Growth database operation unavailable",
  );
  expect(mocks.createClient).not.toHaveBeenCalled();
  configure();
  mocks.rpc.mockRejectedValue(new Error("sensitive provider diagnostics"));
  await expect(growthStore.scan("0", 10)).rejects.toThrow(
    /^Growth database operation unavailable$/,
  );
});
