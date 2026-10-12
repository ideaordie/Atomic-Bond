import "server-only";
import { authClient } from "../auth/server";
import { doodleRequest } from "./contracts";
export async function doodlePageAccess() {
  if (
    process.env.GLOBAL_DOODLE_ENABLED !== "true" &&
    process.env.GLOBAL_DOODLE_CONTROLLED_ACCESS !== "true"
  )
    return false;
  try {
    const result = await executeDoodle({ action: "read", args: [] });
    return !result.error && result.data !== undefined;
  } catch {
    return false;
  }
}
export async function executeDoodle(body: unknown) {
  const { operation, args } = doodleRequest(body);
  const client = await authClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user?.email_confirmed_at)
    throw new Error("Verified access required");
  const { data, error } = await client.rpc("doodle_request", {
    p_operation: operation,
    p_args: args,
  });
  if (error || !data || typeof data !== "object")
    throw new Error("Doodle unavailable");
  return data as { data?: unknown; error?: string; retryAfterSeconds?: number };
}
