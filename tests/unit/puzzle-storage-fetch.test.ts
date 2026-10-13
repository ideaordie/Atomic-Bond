import { describe, expect, it, vi } from "vitest";
import { authenticatedTileFetch } from "../../src/services/puzzle/storage-fetch";
describe("authenticated tile transport", () => {
  it("preserves owner authorization, no-store and abort signal on the explicit private endpoint", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("tile"));
    const signal = new AbortController().signal;
    const options = {
      headers: { Authorization: "Bearer fixture-only" },
      cache: "no-store" as const,
      signal,
    };
    await authenticatedTileFetch(transport)(
      "https://fixture.invalid/storage/v1/object/puzzle-tiles/opaque.png",
      options,
    );
    expect(String(transport.mock.calls[0]![0])).toBe(
      "https://fixture.invalid/storage/v1/object/authenticated/puzzle-tiles/opaque.png",
    );
    expect(transport.mock.calls[0]![1]).toBe(options);
  });
  it.each([
    "/auth/v1/user",
    "/rest/v1/rpc/puzzle_asset",
    "/storage/v1/object/puzzle-originals/source.png",
    "/storage/v1/object/another-bucket/item.png",
  ])("leaves unrelated requests unchanged: %s", async (path) => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response());
    const url = `https://fixture.invalid${path}`;
    await authenticatedTileFetch(transport)(url);
    expect(transport.mock.calls[0]![0]).toBe(url);
  });
  it("does not rewrite uploads", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response());
    const url =
      "https://fixture.invalid/storage/v1/object/puzzle-tiles/opaque.png";
    await authenticatedTileFetch(transport)(url, { method: "POST" });
    expect(transport.mock.calls[0]![0]).toBe(url);
  });
});
