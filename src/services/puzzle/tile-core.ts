/** Server pipeline core, dependency-injected for local tests. Never import into UI. */
import { PNG } from "pngjs";
export type TileAuthority = {
  authorize: (puzzle: string, piece: string | null) => Promise<string>;
  resolve: (
    ticket: string,
  ) => Promise<{ object: string; region: number | null }>;
  readSource: (object: string) => Promise<Buffer>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function normalizePuzzleImage(input: Buffer): Buffer {
  if (
    input.length > 2_000_000 ||
    input.length < 33 ||
    !input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw new Error("Invalid image");
  if (
    input.readUInt32BE(8) !== 13 ||
    input.toString("ascii", 12, 16) !== "IHDR" ||
    input[24] !== 8 ||
    input[25] !== 6 ||
    input[26] !== 0 ||
    input[27] !== 0 ||
    input[28] !== 0
  )
    throw new Error("Normalized non-interlaced RGBA PNG required");
  for (let offset = 8; offset + 12 <= input.length;) {
    const length = input.readUInt32BE(offset);
    if (length > input.length - offset - 12) throw new Error("Invalid chunk");
    if (input.toString("ascii", offset + 4, offset + 8) === "acTL")
      throw new Error("Animated images are not accepted");
    offset += length + 12;
  }
  // Bound allocation BEFORE decoding. Initial contract: exactly 500 square pixels.
  if (input.readUInt32BE(16) !== 500 || input.readUInt32BE(20) !== 500)
    throw new Error("Image must be 500 × 500");
  const decoded = PNG.sync.read(input, { checkCRC: true });
  // Re-encoding drops metadata and produces one canonical source, not tile files.
  const normalized = new PNG({ width: 500, height: 500 });
  normalized.data = decoded.data;
  return PNG.sync.write(normalized, { colorType: 6 });
}
export async function deliverPuzzleTile(
  authority: TileAuthority,
  puzzle: string,
  piece: string | null,
): Promise<Response> {
  const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    Vary: "Cookie, Authorization",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
  try {
    if (!uuid.test(puzzle) || (piece !== null && !uuid.test(piece)))
      throw new Error();
    const ticket = await authority.authorize(puzzle, piece);
    const grant = await authority.resolve(ticket);
    if (
      !/^[0-9a-f-]{36}\.png$/i.test(grant.object) ||
      !uuid.test(grant.object.slice(0, -4)) ||
      (grant.region !== null &&
        (!Number.isInteger(grant.region) ||
          grant.region < 0 ||
          grant.region > 24))
    )
      throw new Error();
    if ((piece === null) !== (grant.region === null)) throw new Error();
    const source = normalizePuzzleImage(
      await authority.readSource(grant.object),
    );
    if (grant.region === null)
      return new Response(new Uint8Array(source), {
        headers: { ...headers, "Content-Type": "image/png" },
      });
    const original = PNG.sync.read(source);
    const tile = new PNG({ width: 100, height: 100 });
    const left = (grant.region % 5) * 100,
      top = Math.floor(grant.region / 5) * 100;
    for (let row = 0; row < 100; row++)
      original.data.copy(
        tile.data,
        row * 400,
        ((top + row) * 500 + left) * 4,
        ((top + row) * 500 + left + 100) * 4,
      );
    return new Response(new Uint8Array(PNG.sync.write(tile)), {
      headers: { ...headers, "Content-Type": "image/png" },
    });
  } catch {
    return Response.json(
      { error: "Tile unavailable" },
      { status: 403, headers },
    );
  }
}
