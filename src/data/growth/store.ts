import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { GrowthStore } from "../../services/growth/contracts";

// Never export a generic privileged client or query method.
function client() {
  const secret = process.env.SUPABASE_GROWTH_SECRET_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (process.env.ATOMIC_BOND_DATA_MODE !== "supabase" || !secret || !url)
    throw new Error("Configure the server-only growth Supabase connection");
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  )
    throw new Error("Invalid growth Supabase configuration");
  // Supabase validates authenticity; this only rejects wrong credential types.
  if (!secret.startsWith("sb_secret_")) {
    try {
      if (
        JSON.parse(
          Buffer.from(secret.split(".")[1] || "", "base64url").toString(),
        ).role !== "service_role"
      )
        throw new Error();
    } catch {
      throw new Error("Growth requires a server secret credential");
    }
  }
  return createClient(parsed.origin, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
type Operation =
  | "growth_scan"
  | "growth_evaluate"
  | "growth_reserve"
  | "growth_claim"
  | "growth_authorize_send"
  | "growth_finish"
  | "growth_unsubscribe";
async function call<T>(
  name: Operation,
  args: Record<string, unknown>,
): Promise<T> {
  try {
    const { data, error } = await client().rpc(name, args);
    if (error) throw new Error();
    return data as T;
  } catch {
    throw new Error("Growth database operation unavailable");
  }
}
export const growthStore: GrowthStore = {
  scan: (after, limit) =>
    call("growth_scan", { p_after: after, p_limit: limit }),
  evaluate: (id, persist) =>
    call("growth_evaluate", { p_number: id, p_persist: persist }),
  reserve: (id) => call("growth_reserve", { p_number: id }),
  claim: (id) => call("growth_claim", { p_job: id }),
  authorize: (id, attempt, hash) =>
    call("growth_authorize_send", {
      p_job: id,
      p_attempt: attempt,
      p_hash: hash,
    }),
  finish: (id, attempt, accepted) =>
    call("growth_finish", {
      p_job: id,
      p_attempt: attempt,
      p_accepted: accepted,
    }),
  unsubscribe: (token) => call("growth_unsubscribe", { p_token: token }),
};
