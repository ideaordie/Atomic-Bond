import { expect, it, vi } from "vitest";
import {
  observeStorageFetch,
  type StorageObservation,
} from "../../src/services/puzzle/storage-observation";
it("records only bounded response metadata and preserves the existing request authorization", async () => {
  const observations: StorageObservation[] = [];
  const transport = vi.fn().mockResolvedValue(
    new Response("private bytes", {
      status: 200,
      headers: {
        "cf-cache-status": "HIT",
        age: "12",
        "set-cookie": "private",
        "x-secret": "private",
      },
    }),
  );
  const headers = { Authorization: "test-token" };
  await observeStorageFetch(
    observations,
    false,
    transport,
  )("https://example.com/storage/v1/object/puzzle-tiles/test.png", {
    headers,
    cache: "no-store",
  });
  expect(transport).toHaveBeenCalledWith(
    "https://example.com/storage/v1/object/puzzle-tiles/test.png",
    { headers, cache: "no-store" },
  );
  expect(observations).toEqual([
    { status: 200, cache: "HIT", age: "12", cacheControl: null, date: null },
  ]);
  expect(JSON.stringify(observations)).not.toContain("private");
});
it("adds a cache nonce only to Storage diagnostics, never Auth requests", async () => {
  const transport = vi.fn().mockResolvedValue(new Response());
  const wrapper = observeStorageFetch([], true, transport);
  await wrapper("https://example.com/auth/v1/user");
  expect(transport.mock.calls[0]![0]).toBe("https://example.com/auth/v1/user");
  await wrapper("https://example.com/storage/v1/object/puzzle-tiles/test.png", {
    cache: "no-store",
  });
  const url = transport.mock.calls[1]![0] as URL;
  expect(url.pathname).toBe("/storage/v1/object/puzzle-tiles/test.png");
  expect(url.searchParams.has("cacheNonce")).toBe(true);
});
