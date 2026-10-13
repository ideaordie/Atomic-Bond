import { it, expect } from "vitest";
import { PNG } from "pngjs";
import { randomUUID } from "node:crypto";
import {
  deliverPuzzleTile,
  normalizePuzzleImage,
  type TileAuthority,
} from "../../src/services/puzzle/tile-core";
const image = () => {
  const p = new PNG({ width: 500, height: 500 });
  for (let y = 0; y < 500; y++)
    for (let x = 0; x < 500; x++) {
      const i = (y * 500 + x) * 4;
      p.data[i] = Math.floor(x / 100) * 45;
      p.data[i + 1] = Math.floor(y / 100) * 45;
      p.data[i + 2] = 125;
      p.data[i + 3] = 255;
    }
  return PNG.sync.write(p);
};
it("returns exactly the authorized crop with no source bytes/metadata in response", async () => {
  const data = image();
  const authority: TileAuthority = {
    authorize: async () => randomUUID(),
    resolve: async () => ({ object: randomUUID() + ".png", region: 7 }),
    readSource: async () => data,
  };
  const response = await deliverPuzzleTile(
    authority,
    randomUUID(),
    randomUUID(),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  const tile = PNG.sync.read(Buffer.from(await response.arrayBuffer()));
  expect([tile.width, tile.height]).toEqual([100, 100]);
  expect([...tile.data.subarray(0, 4)]).toEqual([90, 45, 125, 255]);
});
it("fails closed on authorization, arbitrary region and path injection", async () => {
  let reads = 0;
  const base: TileAuthority = {
    authorize: async () => {
      throw new Error("private-token-do-not-log");
    },
    resolve: async () => ({ object: "../source.png", region: 0 }),
    readSource: async () => {
      reads++;
      return image();
    },
  };
  const failure = await deliverPuzzleTile(base, randomUUID(), randomUUID());
  expect(failure.status).toBe(403);
  expect(await failure.text()).not.toContain("private-token");
  expect(reads).toBe(0);
  expect(
    (
      await deliverPuzzleTile(
        { ...base, authorize: async () => randomUUID() },
        randomUUID(),
        randomUUID(),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await deliverPuzzleTile(
        {
          ...base,
          authorize: async () => randomUUID(),
          resolve: async () => ({ object: randomUUID() + ".png", region: 25 }),
        },
        randomUUID(),
        randomUUID(),
      )
    ).status,
  ).toBe(403);
  expect(reads).toBe(0);
});
it("rejects active content, invalid dimensions, oversized input and full-image grant substitution", async () => {
  expect(() => normalizePuzzleImage(Buffer.from("<svg></svg>"))).toThrow();
  expect(() => normalizePuzzleImage(Buffer.alloc(2_000_001))).toThrow();
  const bad = image();
  bad.writeUInt32BE(2000000, 16);
  expect(() => normalizePuzzleImage(bad)).toThrow();
  const source = image();
  const authority: TileAuthority = {
    authorize: async () => randomUUID(),
    resolve: async () => ({ object: randomUUID() + ".png", region: null }),
    readSource: async () => source,
  };
  expect(
    (await deliverPuzzleTile(authority, randomUUID(), randomUUID())).status,
  ).toBe(403);
  expect((await deliverPuzzleTile(authority, randomUUID(), null)).status).toBe(
    200,
  );
});
