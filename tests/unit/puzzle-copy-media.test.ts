import { expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { copyPuzzleMedia } from "../../src/services/puzzle/copy-media";
import type { PuzzleOwnerClient } from "../../src/services/puzzle/owner-media";
function fixture(mismatch = false) {
  const bytes = Buffer.from("89504e470d0a1a0a", "hex");
  const rpc = vi.fn(async (name: string) =>
    name === "puzzle_media_copy_inventory"
      ? {
          data: Array.from({ length: 52 }, () => ({
            id: "00000000-0000-4000-8000-000000000001",
            sha256: null,
          })),
          error: null,
        }
      : {
          data: {
            bytes: bytes.length,
            sha256: mismatch
              ? "wrong"
              : createHash("sha256").update(bytes).digest("hex"),
          },
          error: null,
        },
  );
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: { email_confirmed_at: "verified" } },
        error: null,
      }),
    },
    rpc,
    storage: {
      from: () => ({
        download: async () => ({ data: new Blob([bytes]), error: null }),
        upload: async () => ({ error: true }),
      }),
    },
  } satisfies PuzzleOwnerClient;
  return { client, rpc };
}
it("bounds copy to 26 and verifies source bytes against database digest", async () => {
  const { client, rpc } = fixture();
  expect(await copyPuzzleMedia(client)).toEqual({
    copied: 26,
    verified: 26,
    bytes: 208,
    total: 52,
  });
  expect(rpc).toHaveBeenCalledTimes(27);
});
it("stops immediately on a mismatching destination digest", async () => {
  const { client, rpc } = fixture(true);
  await expect(copyPuzzleMedia(client)).rejects.toThrow();
  expect(rpc).toHaveBeenCalledTimes(2);
});
