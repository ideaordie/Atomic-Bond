import { it, expect, vi } from "vitest";
import { studioHttp } from "../../src/services/puzzle/studio";
import type { PuzzleOwnerClient } from "../../src/services/puzzle/owner-media";
const id = "11111111-1111-4111-8111-111111111111";
function client(admin = true) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: { email_confirmed_at: "yes" } },
        error: null,
      }),
    },
    rpc: vi.fn(async () =>
      admin
        ? { data: { content: "iVBORw0KGgo=", bytes: 8 }, error: null }
        : { data: null, error: "denied" },
    ),
  } as unknown as PuzzleOwnerClient;
}
it("returns only authorized preview with private no-store headers", async () => {
  const r = await studioHttp(
    new Request(`https://example.com/api/puzzle/studio?batch=${id}`),
    client(),
    "https://example.com",
  );
  expect(r.status).toBe(200);
  expect(r.headers.get("Vercel-CDN-Cache-Control")).toBe("no-store");
});
it("denies ordinary owners, arbitrary preview parameters and cross-origin uploads", async () => {
  expect(
    (
      await studioHttp(
        new Request(`https://example.com/api/puzzle/studio?batch=${id}`),
        client(false),
        "https://example.com",
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await studioHttp(
        new Request(`https://example.com/api/puzzle/studio?batch=${id}&crop=1`),
        client(),
        "https://example.com",
      )
    ).status,
  ).toBe(403);
  const c = client();
  expect(
    (
      await studioHttp(
        new Request("https://example.com/api/puzzle/studio", {
          method: "POST",
          headers: {
            origin: "https://evil.example",
            "Content-Type": "application/octet-stream",
          },
          body: "no",
        }),
        c,
        "https://example.com",
      )
    ).status,
  ).toBe(403);
  expect(c.rpc).not.toHaveBeenCalled();
});
