/** Bounded retryable worker contract. Storage API deletion, never SQL object deletion. */
export type PuzzleCleanupAuthority = {
  plan: (limit: number) => Promise<{ object: string }[]>;
  remove: (object: string) => Promise<void>;
  acknowledge: (object: string) => Promise<void>;
};
export async function cleanupPuzzleSources(
  authority: PuzzleCleanupAuthority,
  limit = 25,
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error("Invalid cleanup batch");
  const batch = await authority.plan(limit);
  if (batch.length > limit) throw new Error("Unbounded cleanup plan");
  let deleted = 0,
    failed = 0;
  for (const entry of batch) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/i.test(
        entry.object,
      )
    )
      throw new Error("Invalid cleanup object");
    try {
      await authority.remove(entry.object);
      await authority.acknowledge(entry.object);
      deleted++;
    } catch {
      failed++;
    }
  }
  return { evaluated: batch.length, deleted, failed };
}
