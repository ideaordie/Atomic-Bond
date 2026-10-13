import { expect, it, vi } from "vitest";
import { probePuzzleStorage } from "../../src/services/puzzle/storage-probe";
const name = "11111111-1111-4111-8111-111111111111.png";
function fixture() {
  const download = vi
    .fn()
    .mockResolvedValue({ data: new Blob(["tile"]), error: null });
  const rpc = vi.fn().mockResolvedValue({ data: { puzzle: {} }, error: null });
  const getUser = vi
    .fn()
    .mockResolvedValue({
      data: { user: { email_confirmed_at: "verified" } },
      error: null,
    });
  return {
    download,
    rpc,
    getUser,
    client: {
      auth: { getUser },
      rpc,
      storage: { from: vi.fn().mockReturnValue({ download, upload: vi.fn() }) },
    },
  };
}
it("probes Storage independently with an authorized session and returns no content", async () => {
  const f = fixture();
  expect(await probePuzzleStorage(f.client, "puzzle-tiles", name)).toEqual({
    result: "ALLOWED",
    bytes: 4,
  });
  expect(f.rpc).toHaveBeenCalledExactlyOnceWith("puzzle_request", {
    p_operation: "read",
  });
  expect(f.download).toHaveBeenCalledWith(
    name,
    {},
    expect.objectContaining({ cache: "no-store" }),
  );
});
it("does not reach Storage when owner or controlled gate rejects access", async () => {
  const f = fixture();
  f.rpc.mockResolvedValue({ data: null, error: {} });
  expect(
    (await probePuzzleStorage(f.client, "puzzle-tiles", name)).result,
  ).toBe("UNAVAILABLE");
  expect(f.download).not.toHaveBeenCalled();
  f.rpc.mockResolvedValue({ data: { error: "RATE_LIMITED" }, error: null });
  await probePuzzleStorage(f.client, "puzzle-tiles", name);
  expect(f.download).not.toHaveBeenCalled();
  f.getUser.mockResolvedValue({ data: { user: null }, error: null });
  await probePuzzleStorage(f.client, "puzzle-tiles", name);
  expect(f.download).not.toHaveBeenCalled();
});
it("bounds buckets and names and never returns provider error details", async () => {
  const f = fixture();
  await probePuzzleStorage(f.client, "unrelated", name);
  await probePuzzleStorage(f.client, "puzzle-tiles", "../secret");
  expect(f.download).not.toHaveBeenCalled();
  f.download.mockResolvedValue({
    data: null,
    error: { message: "private-provider-detail" },
  });
  expect(await probePuzzleStorage(f.client, "puzzle-originals", name)).toEqual({
    result: "DENIED",
    bytes: 0,
  });
});
