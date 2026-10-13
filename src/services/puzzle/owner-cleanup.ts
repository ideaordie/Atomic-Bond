/** Legacy Storage retirement only; new media is removed transactionally by Cron. */
export type PuzzleCleanupClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { email_confirmed_at?: string } | null };
      error: unknown;
    }>;
  };
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  storage: {
    from: (bucket: string) => {
      remove: (names: string[]) => PromiseLike<{ error: unknown }>;
    };
  };
};
export async function cleanupLegacyPuzzleBatch(client: PuzzleCleanupClient) {
  const owner = await client.auth.getUser();
  if (owner.error || !owner.data.user?.email_confirmed_at)
    throw Error("Verified administrator required");
  // RPC independently checks ACTIVE administrator membership and retention.
  const plan = await client.rpc("puzzle_cleanup_batch");
  const data = plan.data as {
    batch?: string;
    assets?: { bucket: string; name: string }[];
  } | null;
  if (plan.error || !Array.isArray(data?.assets) || data.assets.length > 27)
    throw Error("Cleanup unavailable");
  if (data.assets.length === 0) return { removed: 0 };
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    !data.batch ||
    !uuid.test(data.batch) ||
    data.assets.some(
      (a) =>
        !["puzzle-originals", "puzzle-tiles"].includes(a.bucket) ||
        !a.name.endsWith(".png") ||
        !uuid.test(a.name.slice(0, -4)),
    )
  )
    throw Error("Invalid cleanup manifest");
  for (const bucket of ["puzzle-originals", "puzzle-tiles"]) {
    const names = data.assets
      .filter((a) => a.bucket === bucket)
      .map((a) => a.name);
    if (names.length && (await client.storage.from(bucket).remove(names)).error)
      throw Error("Cleanup incomplete; retry safely");
  }
  const ack = await client.rpc("puzzle_cleanup_batch", { p_ack: data.batch });
  if (ack.error || !(ack.data as { removed?: boolean })?.removed)
    throw Error("Cleanup acknowledgment incomplete");
  return { removed: data.assets.length };
}
