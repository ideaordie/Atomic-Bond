"use server";
import { checkRateLimit } from "@vercel/firewall";
import { headers } from "next/headers";
import { ownerContext } from "../auth/server";
import { appOrigin } from "../auth/policy";
import type { DirectOperation, DirectResult } from "./types";
export async function directRequest(
  operation: DirectOperation,
  payload: Record<string, unknown> = {},
): Promise<DirectResult> {
  if (
    process.env.DIRECT_BOND_REQUESTS_ENABLED !== "true" ||
    (await headers()).get("origin") !== appOrigin(process.env)
  )
    throw new Error("Requests unavailable.");
  if (process.env.VERCEL) {
    const h = await headers();
    const limit = await checkRateLimit("atomic-bond-direct-requests", {
      headers: {
        host: new URL(appOrigin(process.env)).host,
        "x-real-ip": h.get("x-real-ip") ?? "",
      },
      timeout: 1500,
    }).catch(() => ({ error: "unavailable", rateLimited: false }));
    if (limit.error || limit.rateLimited)
      throw new Error("Requests temporarily unavailable. Please try later.");
  }
  const context = await ownerContext();
  if (!context.user?.email_confirmed_at || context.atom?.status !== "ACTIVE")
    throw new Error("An active verified owner session is required.");
  const { data, error } = await context.client.rpc("direct_bond_request", {
    p_operation: operation,
    p_payload: payload,
  });
  if (error) {
    if (error.message === "Daily request limit reached")
      throw new Error(
        "You can send five requests per rolling 24 hours. Please try later.",
      );
    if (error.message === "Outstanding request limit reached")
      throw new Error("You already have ten pending outgoing requests.");
    throw new Error(
      "This request is no longer available. Refresh your requests and try again.",
    );
  }
  return data as DirectResult;
}
