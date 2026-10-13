import "server-only";
import type { TileAuthority } from "./tile-core";
type OwnerClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: { email_confirmed_at?: string } | null };
      error: unknown;
    }>;
  };
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
};
/** Restricted-role token supplied by server composition only. No environment fallback. */
export function puzzleMediaAuthority(
  owner: OwnerClient,
  config: { origin: string; publishableKey: string; mediaToken: string },
  request: typeof fetch = fetch,
): TileAuthority {
  const origin = new URL(config.origin);
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error("Invalid media configuration");
  // Defense against accidentally configuring a broad service token. Supabase still
  // verifies the JWT signature/expiry; decoding here is NOT authentication.
  let claims: { role?: string; exp?: number };
  try {
    claims = JSON.parse(
      Buffer.from(
        config.mediaToken.split(".")[1] ?? "",
        "base64url",
      ).toString(),
    );
  } catch {
    throw new Error("Restricted media token required");
  }
  if (
    claims.role !== "atomic_bond_puzzle_media" ||
    !claims.exp ||
    claims.exp <= Date.now() / 1000 ||
    claims.exp > Date.now() / 1000 + 3600
  )
    throw new Error("Restricted media token required");
  const headers = {
    apikey: config.publishableKey,
    Authorization: `Bearer ${config.mediaToken}`,
  };
  return {
    authorize: async (puzzle, piece) => {
      const user = await owner.auth.getUser();
      if (user.error || !user.data.user?.email_confirmed_at)
        throw new Error("Owner required");
      const result = await owner.rpc("puzzle_request", {
        p_operation: piece === null ? "image" : "tile",
        p_puzzle: puzzle,
        p_piece: piece,
      });
      const data = result.data as { ticket?: unknown } | null;
      if (result.error || typeof data?.ticket !== "string")
        throw new Error("Tile denied");
      return data.ticket;
    },
    resolve: async (ticket) => {
      const response = await request(
        `${origin.origin}/rest/v1/rpc/puzzle_media_resolve`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ p_ticket: ticket }),
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(3000),
        },
      );
      if (!response.ok) throw new Error("Tile denied");
      return await response.json();
    },
    readSource: async (object) => {
      if (!/^[0-9a-f-]{36}\.png$/i.test(object))
        throw new Error("Invalid object");
      const response = await request(
        `${origin.origin}/storage/v1/object/authenticated/puzzle-sources/${object}`,
        {
          headers,
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(3000),
        },
      );
      if (!response.ok || !response.body) throw new Error("Source unavailable");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.length;
          if (size > 2_000_000) throw new Error("Source too large");
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel();
      }
      return Buffer.concat(chunks);
    },
  };
}
