import { preparePuzzle } from "./prepare";
import { verifiedPuzzleClient, type PuzzleOwnerClient } from "./owner-media";
export async function uploadPuzzle(client: PuzzleOwnerClient, input: Buffer) {
  await verifiedPuzzleClient(client);
  // Admin check occurs before expensive decoding. Every upload is independently RLS checked.
  const begun = await client.rpc("puzzle_prepare", { p_batch: null });
  const batch = begun.data as {
    batch: string;
    assets: { name: string; kind: string; solution: number | null }[];
  };
  if (begun.error || !batch?.batch || batch.assets?.length !== 27)
    throw new Error("Preparation unavailable");
  const prepared = await preparePuzzle(input);
  for (const a of batch.assets) {
    const bytes =
      a.kind === "source"
        ? prepared.source
        : a.kind === "full"
          ? prepared.full
          : prepared.tiles[a.solution ?? -1];
    if (!bytes || !/^[0-9a-f-]{36}\.png$/i.test(a.name))
      throw new Error("Invalid manifest");
    const uploaded =
      a.kind === "source"
        ? await client.storage.from("puzzle-originals").upload(a.name, bytes, {
            contentType: "image/png",
            cacheControl: "0",
            upsert: false,
          })
        : await client.rpc("puzzle_media_put", {
            p_asset: a.name.slice(0, -4),
            p_content: bytes.toString("base64"),
          });
    if (uploaded.error)
      throw new Error("Upload incomplete; batch remains unpublished");
  }
  const finished = await client.rpc("puzzle_prepare", { p_batch: batch.batch });
  if (finished.error) throw new Error("Preparation incomplete");
  return { batch: batch.batch, ready: true };
}
