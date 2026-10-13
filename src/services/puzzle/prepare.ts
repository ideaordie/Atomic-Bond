import sharp from "sharp";
/** Server upload preparation. No URL input, metadata output or runtime cropping. */
export async function preparePuzzle(input: Buffer) {
  if (!input.length || input.length > 3_000_000)
    throw new Error("Image size limit");
  const png = input
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = input[0] === 255 && input[1] === 216 && input[2] === 255;
  if (!png && !jpeg) throw new Error("JPEG or PNG required");
  const options = { limitInputPixels: 16_000_000, failOn: "warning" as const };
  const metadata = await sharp(input, options).metadata();
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width > 8000 ||
    metadata.height > 8000 ||
    (metadata.pages ?? 1) !== 1
  )
    throw new Error("Image dimensions or animation rejected");
  const source = await sharp(input, options)
    .autoOrient()
    .resize(500, 500, { fit: "cover", position: "centre" })
    .toColourspace("srgb")
    .ensureAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
  const tiles: Buffer[] = [];
  for (let n = 0; n < 25; n++)
    tiles.push(
      await sharp(source)
        .extract({
          left: (n % 5) * 100,
          top: Math.floor(n / 5) * 100,
          width: 100,
          height: 100,
        })
        .png({ compressionLevel: 9 })
        .toBuffer(),
    );
  return { source, full: source, tiles };
}
