import { it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { puzzleMediaAuthority } from "../../src/services/puzzle/media-adapter";
const token = (role: string) =>
  `header.${Buffer.from(JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + 1800 })).toString("base64url")}.fixture-signature`;
const owner = {
  auth: {
    getUser: async () => ({
      data: { user: { email_confirmed_at: "fixture" } },
      error: null,
    }),
  },
  rpc: async () => ({ data: { ticket: "opaque" }, error: null }),
};
it("rejects broadly privileged credentials and non-HTTPS configuration", () => {
  expect(() =>
    puzzleMediaAuthority(owner, {
      origin: "https://example.invalid",
      publishableKey: "public",
      mediaToken: token("service_role"),
    }),
  ).toThrow("Restricted");
  expect(() =>
    puzzleMediaAuthority(owner, {
      origin: "http://example.invalid",
      publishableKey: "public",
      mediaToken: token("atomic_bond_puzzle_media"),
    }),
  ).toThrow();
});
it("keeps restricted token only on fixed Supabase calls and disables caches/redirects", async () => {
  const calls: { url: string; options: RequestInit | undefined }[] = [];
  const request = async (input: RequestInfo | URL, options?: RequestInit) => {
    calls.push({ url: String(input), options });
    return Response.json({ object: "fixture", region: 1 });
  };
  const authority = puzzleMediaAuthority(
    owner,
    {
      origin: "https://example.invalid",
      publishableKey: "public",
      mediaToken: token("atomic_bond_puzzle_media"),
    },
    request,
  );
  expect(await authority.authorize("puzzle", "piece")).toBe("opaque");
  await authority.resolve("opaque");
  expect(calls[0]!.url).toBe(
    "https://example.invalid/rest/v1/rpc/puzzle_media_resolve",
  );
  expect(calls[0]!.options?.cache).toBe("no-store");
  expect(calls[0]!.options?.redirect).toBe("error");
  await expect(authority.readSource("../other")).rejects.toThrow();
  expect(calls).toHaveLength(1);
});
