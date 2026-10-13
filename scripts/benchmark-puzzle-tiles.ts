// Local synthetic pixels, no network or stored source asset.
import { PNG } from "pngjs";
import { randomUUID } from "node:crypto";
// @ts-expect-error Node's local type-stripping runner requires the source extension.
import { deliverPuzzleTile } from "../src/services/puzzle/tile-core.ts";
const image = new PNG({ width: 500, height: 500 });
for (let y = 0; y < 500; y++)
  for (let x = 0; x < 500; x++) {
    const i = (y * 500 + x) * 4;
    image.data[i] = x % 256;
    image.data[i + 1] = y % 256;
    image.data[i + 2] = (x + y) % 256;
    image.data[i + 3] = 255;
  }
const source = PNG.sync.write(image);
const durations: number[] = [];
let bytes = 0;
for (let i = 0; i < 25; i++) {
  const t = performance.now();
  const response = await deliverPuzzleTile(
    {
      authorize: async () => randomUUID(),
      resolve: async () => ({ object: randomUUID() + ".png", region: i }),
      readSource: async () => source,
    },
    randomUUID(),
    randomUUID(),
  );
  if (response.status !== 200) throw new Error("Benchmark delivery failed");
  bytes += (await response.arrayBuffer()).byteLength;
  durations.push(performance.now() - t);
}
durations.sort((a, b) => a - b);
console.log(
  JSON.stringify({
    samples: 25,
    sourceBytes: source.length,
    totalTileBytes: bytes,
    medianMs: +durations[12]!.toFixed(2),
    p95Ms: +durations[23]!.toFixed(2),
    networkIncluded: false,
  }),
);
