import {
  verifiedPuzzleClient,
  puzzlePrivateHeaders,
  type PuzzleOwnerClient,
} from "./owner-media";
import { uploadPuzzle } from "./owner-upload";
export type StudioBatch = {
  id: string;
  createdAt: string;
  ready: boolean;
  expiresAt: string | null;
  mediaCount: number;
  puzzle: null | {
    id: string;
    start: string;
    end: string;
    state: string;
    placed: number;
    locked: number;
  };
};
export type StudioInventory = {
  now: string;
  gates: { public: boolean; controlled: boolean };
  total: number;
  batches: StudioBatch[];
  cleanup: {
    lastSuccess: string | null;
    lastFailure: string | null;
    ok: boolean | null;
    counts: Record<string, number>;
  };
};
export async function studioInventory(
  client: PuzzleOwnerClient,
  offset = 0,
): Promise<StudioInventory> {
  await verifiedPuzzleClient(client);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000)
    throw Error("Invalid page");
  const r = await client.rpc("puzzle_studio", { p_offset: offset });
  if (r.error || !r.data) throw Error("Administrator access required");
  return r.data as StudioInventory;
}
export async function studioHttp(
  request: Request,
  client: PuzzleOwnerClient,
  origin: string,
) {
  try {
    await verifiedPuzzleClient(client);
    const url = new URL(request.url);
    if (request.method === "GET") {
      const batch = url.searchParams.get("batch");
      if (
        !batch ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          batch,
        ) ||
        [...url.searchParams.keys()].some((k) => k !== "batch")
      )
        throw Error();
      const r = await client.rpc("puzzle_studio_preview", { p_batch: batch });
      const m = r.data as { content?: string; bytes?: number } | null;
      if (
        r.error ||
        typeof m?.content !== "string" ||
        m.content.length > 2702000 ||
        typeof m.bytes !== "number" ||
        m.bytes > 2000000
      )
        throw Error();
      const bytes = Buffer.from(m.content, "base64");
      if (
        bytes.length !== m.bytes ||
        bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
      )
        throw Error();
      return new Response(bytes, {
        headers: { ...puzzlePrivateHeaders, "Content-Type": "image/png" },
      });
    }
    if (
      request.method !== "POST" ||
      request.headers.get("origin") !== origin ||
      request.headers.get("content-type") !== "application/octet-stream" ||
      url.search
    )
      throw Error();
    // Recheck live admin membership before reading or decoding any uploaded image.
    await studioInventory(client);
    const reader = request.body?.getReader();
    if (!reader) throw Error();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const r = await reader.read();
        if (r.done) break;
        size += r.value.length;
        if (size > 3000000) throw Error();
        chunks.push(r.value);
      }
    } finally {
      await reader.cancel();
    }
    return Response.json(await uploadPuzzle(client, Buffer.concat(chunks)), {
      headers: puzzlePrivateHeaders,
    });
  } catch {
    return Response.json(
      { error: "Puzzle Studio unavailable" },
      { status: 403, headers: puzzlePrivateHeaders },
    );
  }
}
