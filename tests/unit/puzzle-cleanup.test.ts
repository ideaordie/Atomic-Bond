import { it, expect } from "vitest";
import { cleanupPuzzleSources } from "../../src/services/puzzle/cleanup-core";
import { randomUUID } from "node:crypto";
it("keeps failures queued and acknowledges only successful Storage removal", async () => {
  const first = randomUUID() + ".png",
    second = randomUUID() + ".png";
  const acknowledged: string[] = [];
  const result = await cleanupPuzzleSources(
    {
      plan: async () => [{ object: first }, { object: second }],
      remove: async (key) => {
        if (key === second) throw new Error("provider unavailable");
      },
      acknowledge: async (key) => {
        acknowledged.push(key);
      },
    },
    2,
  );
  expect(result).toEqual({ evaluated: 2, deleted: 1, failed: 1 });
  expect(acknowledged).toEqual([first]);
});
it("rejects excessive batches and arbitrary object paths before removal", async () => {
  let removed = 0;
  const authority = {
    plan: async () => [{ object: "../other/image.png" }],
    remove: async () => {
      removed++;
    },
    acknowledge: async () => {},
  };
  await expect(cleanupPuzzleSources(authority)).rejects.toThrow();
  expect(removed).toBe(0);
  await expect(cleanupPuzzleSources(authority, 101)).rejects.toThrow();
});
