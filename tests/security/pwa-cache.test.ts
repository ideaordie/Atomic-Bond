import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

it("service worker stores only fixed public assets and never caches private requests or responses", async () => {
  const handlers: Record<string, (e: unknown) => void> = {};
  const stored = new Map<string, Response>();
  const deleted: string[] = [];
  const offline = new Response("You're offline.");
  const fetcher = vi.fn(async () => new Response("public asset"));
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: {
      location: { origin: "https://example.test" },
      addEventListener: (name: string, fn: (e: unknown) => void) =>
        (handlers[name] = fn),
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches: {
      open: async () => ({
        put: async (key: string, value: Response) => stored.set(key, value),
      }),
      keys: async () => ["atomic-bond-public-old", "unrelated"],
      delete: async (key: string) => deleted.push(key),
      match: async () => offline.clone(),
    },
    fetch: fetcher,
    URL,
    Response,
  });
  let work: Promise<unknown> = Promise.resolve();
  handlers.install!({ waitUntil: (p: Promise<unknown>) => (work = p) });
  await work;
  expect([...stored.keys()]).toEqual([
    "/offline.html",
    "/icons/atom-192.png",
    "/icons/atom-512.png",
    "/icons/atom-maskable-512.png",
    "/icons/apple-touch-icon.png",
  ]);
  expect(
    fetcher.mock.calls.every(
      (args) =>
        (args as unknown[])[1] &&
        ((args as unknown[])[1] as RequestInit).credentials === "omit",
    ),
  ).toBe(true);
  handlers.activate!({ waitUntil: (p: Promise<unknown>) => (work = p) });
  await work;
  expect(deleted).toEqual(["atomic-bond-public-old"]);
  fetcher.mockClear();
  for (const [path, method, mode] of [
    ["/api/private", "GET", "cors"],
    ["/auth/confirm", "POST", "navigate"],
    ["/bond/secret?_rsc=x", "GET", "cors"],
    ["/icons/atom-192.png?token=secret", "GET", "cors"],
    ["https://other.test/x", "GET", "navigate"],
  ]) {
    const respondWith = vi.fn();
    handlers.fetch!({
      request: {
        url: new URL(path!, "https://example.test").href,
        method,
        mode,
      },
      respondWith,
    });
    expect(respondWith).not.toHaveBeenCalled();
  }
  for (const path of ["/owner", "/auth/confirm", "/bond/secret", "/explore"]) {
    fetcher.mockRejectedValueOnce(new Error("offline"));
    handlers.fetch!({
      request: {
        url: `https://example.test${path}`,
        method: "GET",
        mode: "navigate",
      },
      respondWith: (p: Promise<Response>) => (work = p),
    });
    expect(await ((await work) as Response).text()).toBe("You're offline.");
  }
  expect(stored.size).toBe(5);
});
