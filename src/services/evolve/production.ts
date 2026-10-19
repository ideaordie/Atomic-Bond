import "server-only";
import { authClient } from "../auth/server";
const operations = new Set([
  "session",
  "list",
  "submit",
  "support",
  "withdraw",
  "admin_list",
  "moderate",
  "history",
  "development_history",
  "publish_history",
  "remove_history",
  "cleanup_status",
]);
export async function executeEvolve(body: unknown): Promise<{
  data?: unknown;
  error?: string;
  revision?: number;
  nextSubmissionAt?: string;
  serverTime?: string;
}> {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("Invalid request");
  const { operation, payload = {} } = body as {
    operation: string;
    payload?: unknown;
  };
  if (!operations.has(operation) || JSON.stringify(body).length > 8192)
    throw new Error("Invalid request");
  const client = await authClient((input, init) =>
    fetch(input, { ...init, cache: "no-store" }),
  );
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user?.email_confirmed_at)
    throw new Error("Verified access required");
  const result =
    operation === "cleanup_status"
      ? await client.rpc("evolve_cleanup_status")
      : await client.rpc("evolve_request", {
          p_operation: operation,
          p_payload: payload,
        });
  if (result.error || !result.data) throw new Error("EVOLVE unavailable");
  if (operation === "cleanup_status") return { data: result.data };
  return result.data as {
    data?: unknown;
    error?: string;
    revision?: number;
    nextSubmissionAt?: string;
    serverTime?: string;
  };
}
