import {
  ownerPuzzleTile,
  verifiedPuzzleClient,
  puzzlePrivateHeaders,
  type PuzzleOwnerClient,
} from "./owner-media";
import { uploadPuzzle } from "./owner-upload";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function bounded(request: Request, max: number) {
  const reader = request.body?.getReader();
  if (!reader) throw Error();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.length;
      if (size > max) throw Error();
      chunks.push(r.value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks);
}
export async function puzzleHttp(
  request: Request,
  config: {
    enabled: boolean;
    origin: string;
    client: () => Promise<PuzzleOwnerClient>;
  },
) {
  if (!config.enabled) return new Response(null, { status: 404 });
  try {
    const url = new URL(request.url);
    if (request.method === "GET") {
      if (
        [...url.searchParams.keys()].some(
          (k) => !["puzzle", "piece"].includes(k),
        )
      )
        throw Error();
      const puzzle = url.searchParams.get("puzzle"),
        piece = url.searchParams.get("piece");
      if (
        !puzzle ||
        !uuid.test(puzzle) ||
        (piece !== null && !uuid.test(piece))
      )
        throw Error();
      return ownerPuzzleTile(await config.client(), puzzle, piece);
    }
    if (
      request.method !== "POST" ||
      request.headers.get("origin") !== config.origin
    )
      throw Error();
    const client = await verifiedPuzzleClient(await config.client());
    if (request.headers.get("content-type") === "application/octet-stream") {
      const result = await uploadPuzzle(
        client,
        await bounded(request, 3_000_000),
      );
      return Response.json(result, { headers: puzzlePrivateHeaders });
    }
    const body = JSON.parse(
      (await bounded(request, 2048)).toString(),
    ) as Record<string, unknown>;
    if (
      Object.keys(body).some(
        (k) =>
          ![
            "operation",
            "puzzle",
            "request",
            "revision",
            "piece",
            "to",
          ].includes(k),
      )
    )
      throw Error();
    if (
      !["read", "reveal", "cancel", "place", "move"].includes(
        String(body.operation),
      )
    )
      throw Error();
    for (const key of ["puzzle", "request", "piece"])
      if (
        body[key] != null &&
        (typeof body[key] !== "string" || !uuid.test(body[key]))
      )
        throw Error();
    if (
      body.revision != null &&
      (!Number.isSafeInteger(body.revision) || Number(body.revision) < 0)
    )
      throw Error();
    if (
      body.to != null &&
      (!Number.isInteger(body.to) ||
        Number(body.to) < 0 ||
        Number(body.to) > 24)
    )
      throw Error();
    const result = await client.rpc("puzzle_request", {
      p_operation: body.operation,
      p_puzzle: body.puzzle ?? null,
      p_request: body.request ?? null,
      p_revision: body.revision ?? null,
      p_piece: body.piece ?? null,
      p_to: body.to ?? null,
    });
    if (result.error) throw Error();
    return Response.json(result.data, { headers: puzzlePrivateHeaders });
  } catch {
    return Response.json(
      { error: "Puzzle unavailable" },
      { status: 403, headers: puzzlePrivateHeaders },
    );
  }
}
