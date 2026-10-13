import { verifiedPuzzleClient, type PuzzleOwnerClient } from "./owner-media";

// Controlled acceptance only. The Storage request deliberately has no asset-RPC
// precheck: this verifies Storage RLS itself with the existing owner session.
export async function probePuzzleStorage(
  client: PuzzleOwnerClient,
  bucket: string,
  name: string,
) {
  try {
    if (
      !["puzzle-tiles", "puzzle-originals"].includes(bucket) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/i.test(
        name,
      )
    )
      throw Error();
    await verifiedPuzzleClient(client);
    // Do not run gameplay RPCs here: even read expires reservations. Storage
    // independently checks the owner, controlled cohort and reservation deadline.
    const result = await client.storage.from(bucket).download(
      name,
      {},
      {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (result.error || !result.data) return { result: "DENIED", bytes: 0 };
    return { result: "ALLOWED", bytes: result.data.size };
  } catch {
    return { result: "UNAVAILABLE", bytes: 0 };
  }
}
