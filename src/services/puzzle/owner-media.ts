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
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  Vary: "Cookie, Authorization",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
export async function ownerPuzzleTile(
  client: PuzzleOwnerClient,
  puzzle: string,
  piece: string | null,
) {
  try {
    await verifiedPuzzleClient(client);
    const { data, error } = await client.rpc("puzzle_media_get", {
      p_puzzle: puzzle,
      p_piece: piece,
    });
    const media = data as { content?: unknown; bytes?: unknown } | null;
    if (
      error ||
      typeof media?.content !== "string" ||
      media.content.length > 2702000 ||
      typeof media.bytes !== "number" ||
      media.bytes < 8 ||
      media.bytes > 2_000_000
    )
      throw Error();
    const bytes = Buffer.from(media.content, "base64");
    if (
      bytes.length !== media.bytes ||
      bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
    )
      throw Error();
    return new Response(bytes, {
      headers: { ...puzzlePrivateHeaders, "Content-Type": "image/png" },
    });
  } catch {
    return Response.json(
      { error: "Tile unavailable" },
      { status: 403, headers: puzzlePrivateHeaders },
    );
  }
}
