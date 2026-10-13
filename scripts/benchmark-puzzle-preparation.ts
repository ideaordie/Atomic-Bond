import sharp from "sharp";
// @ts-expect-error Node type-stripping runner requires the extension.
import { preparePuzzle } from "../src/services/puzzle/prepare.ts";
const pixels = Buffer.alloc(700 * 600 * 3);
for (let y = 0; y < 600; y++)
  for (let x = 0; x < 700; x++) {
    const i = (y * 700 + x) * 3;
    pixels[i] = x % 256;
    pixels[i + 1] = y % 256;
    pixels[i + 2] = (x + y) % 256;
  }
const input = await sharp(pixels, {
  raw: { width: 700, height: 600, channels: 3 },
})
  .jpeg()
  .withMetadata({ orientation: 6 })
  .toBuffer();
const durations: number[] = [];
let prepared: Awaited<ReturnType<typeof preparePuzzle>> | undefined;
for (let n = 0; n < 10; n++) {
  const start = performance.now();
  prepared = await preparePuzzle(input);
  durations.push(performance.now() - start);
}
durations.sort((a, b) => a - b);
const sizes = prepared!.tiles.map((t) => t.length).sort((a, b) => a - b);
console.log(
  JSON.stringify({
    samples: 10,
    preparationMedianMs: durations[5],
    preparationMaxMs: durations[9],
    tileTotalBytes: sizes.reduce((a, b) => a + b, 0),
    medianRevealBytes: sizes[12],
    normalizedImageBytes: prepared!.source.length,
    totalStorageBytes:
      prepared!.source.length +
      prepared!.full.length +
      sizes.reduce((a, b) => a + b, 0),
    hostedLatencyMeasured: false,
  }),
);
