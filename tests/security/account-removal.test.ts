import { afterEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  remove: vi.fn(),
  create: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mock.create }));
import { accountRemovalAdapter } from "../../src/services/auth/account-removal";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
function setup() {
  vi.stubEnv("ATOMIC_BOND_DATA_MODE", "supabase");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_test_only");
  vi.stubEnv(
    "SUPABASE_ACCOUNT_DELETION_SECRET_KEY",
    "sb_secret_deletion_fixture_only",
  );
  mock.create.mockReturnValue({
    rpc: mock.rpc,
    auth: { admin: { deleteUser: mock.remove } },
  });
  mock.rpc.mockResolvedValue({ data: true, error: null });
  mock.remove.mockResolvedValue({ error: null });
}
it("requires a distinct server secret and exposes no generic Auth administration", () => {
  setup();
  expect(Object.keys(accountRemovalAdapter())).toEqual(["ready", "finish"]);
  vi.stubEnv("SUPABASE_ACCOUNT_DELETION_SECRET_KEY", "sb_publishable_wrong");
  expect(() => accountRemovalAdapter()).toThrow("configuration unavailable");
  vi.stubEnv("SUPABASE_ACCOUNT_DELETION_SECRET_KEY", "");
  expect(() => accountRemovalAdapter()).toThrow();
});
it("requires durable owner-authorized pending deletion before deleting exactly that Auth user", async () => {
  setup();
  mock.rpc.mockResolvedValueOnce({ data: false, error: null });
  expect(await accountRemovalAdapter().ready("owner")).toBe(true);
  mock.rpc.mockResolvedValueOnce({ data: null, error: { code: "denied" } });
  expect(await accountRemovalAdapter().ready("owner")).toBe(false);
  mock.rpc.mockResolvedValueOnce({ data: false, error: null });
  expect(await accountRemovalAdapter().finish("owner")).toBe(false);
  expect(mock.remove).not.toHaveBeenCalled();
  expect(await accountRemovalAdapter().finish("owner")).toBe(true);
  expect(mock.remove).toHaveBeenCalledExactlyOnceWith("owner");
  expect(mock.rpc).toHaveBeenLastCalledWith("account_cleanup_finish", {
    p_user: "owner",
  });
});
it("does not mark failed Auth cleanup complete and safely retries already removed Auth users", async () => {
  setup();
  mock.remove.mockResolvedValueOnce({ error: { code: "unexpected_failure" } });
  expect(await accountRemovalAdapter().finish("owner")).toBe(false);
  expect(mock.rpc).toHaveBeenCalledTimes(1);
  mock.remove.mockResolvedValueOnce({ error: { code: "user_not_found" } });
  expect(await accountRemovalAdapter().finish("owner")).toBe(true);
  mock.rpc.mockRejectedValueOnce(new Error("private provider diagnostics"));
  expect(await accountRemovalAdapter().finish("owner")).toBe(false);
});
