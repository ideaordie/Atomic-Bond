export type PuzzleOwnerClient = {
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
      download: (
        name: string,
        options?: Record<string, never>,
        parameters?: { cache?: RequestCache; signal?: AbortSignal },
      ) => PromiseLike<{ data: Blob | null; error: unknown }>;
      upload: (
        name: string,
        data: Buffer,
        options: { contentType: string; cacheControl: string; upsert: boolean },
      ) => Promise<{ error: unknown }>;
    };
  };
};
export async function verifiedPuzzleClient(client: PuzzleOwnerClient) {
  const result = await client.auth.getUser();
  if (result.error || !result.data.user?.email_confirmed_at)
    throw new Error("Verified owner required");
  return client;
}
export const puzzlePrivateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie, Authorization",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
export async function ownerPuzzleTile(
  client: PuzzleOwnerClient,
  puzzle: string,
  piece: string | null,
) {
  let stage = "owner";
  try {
    await verifiedPuzzleClient(client);
    stage = "resolver";
    const { data, error } = await client.rpc("puzzle_asset", {
      p_puzzle: puzzle,
      p_piece: piece,
    });
    const name = (data as { name?: unknown } | null)?.name;
    if (
      error ||
      typeof name !== "string" ||
      !/^[0-9a-f-]{36}\.png$/i.test(name)
    )
      throw Error();
    stage = "storage";
    const asset = await client.storage.from("puzzle-tiles").download(
      name,
      {},
      {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (asset.error || !asset.data || asset.data.size > 2_000_000)
      throw Error();
    return new Response(asset.data, {
      headers: { ...puzzlePrivateHeaders, "Content-Type": "image/png" },
    });
  } catch {
    // Fixed stage names only: never log identities, object names, tokens or
    // provider error text. Useful for controlled hosted acceptance failures.
    console.warn("Puzzle tile unavailable", { stage });
    return Response.json(
      { error: "Tile unavailable" },
      { status: 403, headers: puzzlePrivateHeaders },
    );
  }
}
