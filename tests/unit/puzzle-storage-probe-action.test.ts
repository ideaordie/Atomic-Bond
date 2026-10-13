import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  limit: vi.fn(),
  probe: vi.fn(),
  client: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@vercel/firewall", () => ({ checkRateLimit: mocks.limit }));
vi.mock("../../src/services/auth/server", () => ({ authClient: mocks.client }));
vi.mock("../../src/services/auth/policy", () => ({
  appOrigin: () => "https://atomicbond.ideaordie.com",
}));
vi.mock("../../src/services/puzzle/storage-probe", () => ({
  probePuzzleStorage: mocks.probe,
}));
import { checkControlledStorage } from "../../src/app/review/puzzle/hosted/actions";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
function setup() {
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("PARTICI_PUZZLE_CONTROLLED_ACCESS", "true");
  mocks.headers.mockResolvedValue(
    new Headers({ origin: "https://atomicbond.ideaordie.com" }),
  );
  mocks.client.mockResolvedValue({});
  mocks.probe.mockResolvedValue({ result: "DENIED", bytes: 0 });
}
it("fails closed on rate limit and firewall failure before Storage", async () => {
  setup();
  for (const outcome of [{ rateLimited: true }, { error: "unavailable" }]) {
    mocks.limit.mockResolvedValue(outcome);
    expect(await checkControlledStorage("puzzle-tiles", "test.png")).toEqual({
      result: "UNAVAILABLE",
      bytes: 0,
    });
  }
  mocks.limit.mockRejectedValue(new Error("network"));
  await checkControlledStorage("puzzle-tiles", "test.png");
  expect(mocks.probe).not.toHaveBeenCalled();
  expect(mocks.client).not.toHaveBeenCalled();
});
it("requires the controlled flag and same-origin request", async () => {
  setup();
  vi.stubEnv("PARTICI_PUZZLE_CONTROLLED_ACCESS", "false");
  await checkControlledStorage("puzzle-tiles", "test.png");
  vi.stubEnv("PARTICI_PUZZLE_CONTROLLED_ACCESS", "true");
  mocks.headers.mockResolvedValue(
    new Headers({ origin: "https://example.com" }),
  );
  await checkControlledStorage("puzzle-tiles", "test.png");
  expect(mocks.probe).not.toHaveBeenCalled();
});
it("uses the existing firewall rule before owner-session Storage", async () => {
  setup();
  mocks.limit.mockResolvedValue({ rateLimited: false });
  await checkControlledStorage("puzzle-tiles", "test.png");
  expect(mocks.limit).toHaveBeenCalledWith(
    "atomic-bond-puzzle",
    expect.objectContaining({ timeout: 1500 }),
  );
  expect(mocks.probe).toHaveBeenCalledWith({}, "puzzle-tiles", "test.png");
});
