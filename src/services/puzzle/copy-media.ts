import { createHash } from "node:crypto";
import { verifiedPuzzleClient, type PuzzleOwnerClient } from "./owner-media";
/** Controlled migration only. Immutable bytes, bounded work, no payload logging. */
export async function copyPuzzleMedia(client: PuzzleOwnerClient) {
  await verifiedPuzzleClient(client);
  const inventory = await client.rpc("puzzle_media_copy_inventory");
  if (inventory.error || !Array.isArray(inventory.data)) throw Error();
  let copied = 0,
    verified = 0,
    bytes = 0;
  for (const asset of inventory.data.slice(0, 26)) {
    if (!/^[0-9a-f-]{36}$/i.test(asset.id)) throw Error();
    const original = await client.storage
      .from("puzzle-tiles")
      .download(
        asset.id + ".png",
        {},
        { cache: "no-store", signal: AbortSignal.timeout(5000) },
      );
    if (original.error || !original.data || original.data.size > 2_000_000)
      throw Error();
    const payload = Buffer.from(await original.data.arrayBuffer());
    const sha256 = createHash("sha256").update(payload).digest("hex");
    const stored = await client.rpc("puzzle_media_put", {
      p_asset: asset.id,
      p_content: payload.toString("base64"),
    });
    const result = stored.data as { bytes?: number; sha256?: string } | null;
    if (
      stored.error ||
      result?.bytes !== payload.length ||
      result.sha256 !== sha256
    )
      throw Error();
    if (!asset.sha256) copied++;
    verified++;
    bytes += payload.length;
  }
  return { copied, verified, bytes, total: inventory.data.length };
}
