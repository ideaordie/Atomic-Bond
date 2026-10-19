import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const evolveCookie = "evolve-local-owner";
const origin = "http://127.0.0.1:54339";
export function localEvolveRequest(request: Request) {
  const url = new URL(request.headers.get("origin") ?? request.url);
  return (
    process.env.NODE_ENV === "development" &&
    !process.env.VERCEL &&
    ["localhost", "127.0.0.1"].includes(url.hostname) &&
    request.headers.get("origin") === url.origin &&
    request.headers.get("host") === url.host &&
    url.protocol === "http:"
  );
}
export async function localEvolveSession(fixture: string) {
  const response = await fetch(origin + "/fixture/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fixture }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Local fixture unavailable");
  const { token } = await response.json();
  (await cookies()).set(evolveCookie, token, {
    httpOnly: true,
    sameSite: "strict",
    path: "/review/evolve",
    maxAge: 28_800,
  });
}
export async function localEvolveOperation(
  operation: string,
  payload: Record<string, unknown>,
) {
  const token = (await cookies()).get(evolveCookie)?.value;
  if (!token) throw new Error("Local session required");
  const client = createClient(origin, "local-fixture-publishable-key", {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
  const { data: owner, error } = await client.auth.getUser(token);
  if (error || !owner.user?.email_confirmed_at)
    throw new Error("Verified local session required");
  const result = await client.rpc("evolve_request", {
    p_operation: operation,
    p_payload: payload,
  });
  if (result.error) throw new Error("Authorized local request required");
  return result.data;
}
