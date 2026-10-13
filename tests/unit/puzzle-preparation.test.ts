import { it, expect } from "vitest";
import sharp from "sharp";
import { preparePuzzle } from "../../src/services/puzzle/prepare";
it("normalizes orientation, dimensions and metadata and generates exactly 25 optimized tiles", async () => {
  const input = await sharp({
    create: { width: 700, height: 600, channels: 3, background: "blue" },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const result = await preparePuzzle(input);
  expect(result.tiles).toHaveLength(25);
  const meta = await sharp(result.source).metadata();
  expect([meta.width, meta.height]).toEqual([500, 500]);
  expect(meta.exif).toBeUndefined();
  expect(meta.orientation).toBeUndefined();
  for (const t of result.tiles) {
    const m = await sharp(t).metadata();
    expect([m.width, m.height]).toEqual([100, 100]);
    expect(m.exif).toBeUndefined();
  }
});
it("rejects active content, oversized and malformed images", async () => {
  await expect(preparePuzzle(Buffer.from("<svg/>"))).rejects.toThrow();
  await expect(preparePuzzle(Buffer.alloc(5_000_001))).rejects.toThrow();
  await expect(
    preparePuzzle(Buffer.from([255, 216, 255, 0])),
  ).rejects.toThrow();
});
