import { it, expect } from "vitest";
import { cleanupLegacyPuzzleBatch } from "../../src/services/puzzle/owner-cleanup";
const id = "a414ec11-e0a9-4dce-8541-d54c5166fe80";
it("acknowledges only after successful bounded Storage deletion and supports retry", async () => {
  const calls: string[] = [];
  let fail = true;
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: { email_confirmed_at: "test" } },
        error: null,
      }),
    },
    rpc: async (_name: string, args?: Record<string, unknown>) => {
      calls.push(args ? "ack" : "plan");
      return {
        data: args
          ? { removed: true }
          : {
              batch: id,
              assets: [{ bucket: "puzzle-originals", name: id + ".png" }],
            },
        error: null,
      };
    },
    storage: {
      from: () => ({
        remove: async () => {
          calls.push("remove");
          return { error: fail ? true : null };
        },
      }),
    },
  };
  await expect(cleanupLegacyPuzzleBatch(client)).rejects.toThrow("retry");
  expect(calls).toEqual(["plan", "remove"]);
  fail = false;
  expect(await cleanupLegacyPuzzleBatch(client)).toEqual({ removed: 1 });
  expect(calls.slice(-3)).toEqual(["plan", "remove", "ack"]);
});
it("rejects invalid manifests before any Storage operation", async () => {
  let removed = false;
  await expect(
    cleanupLegacyPuzzleBatch({
      auth: {
        getUser: async () => ({
          data: { user: { email_confirmed_at: "test" } },
          error: null,
        }),
      },
      rpc: async () => ({
        data: { batch: id, assets: [{ bucket: "other", name: id + ".png" }] },
        error: null,
      }),
      storage: {
        from: () => ({
          remove: async () => {
            removed = true;
            return { error: null };
          },
        }),
      },
    }),
  ).rejects.toThrow("manifest");
  expect(removed).toBe(false);
});
