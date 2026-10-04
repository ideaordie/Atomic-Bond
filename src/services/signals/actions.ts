"use server";
import { headers } from "next/headers";
import { authClient } from "../auth/server";
import { appOrigin } from "../auth/policy";
import {
  validateSignal,
  type SignalDraft,
  type NetworkSignal,
  type AdminSignal,
} from "./model";
async function client() {
  const c = await authClient();
  const {
    data: { user },
  } = await c.auth.getUser();
  if (!user?.email_confirmed_at) throw new Error("Verified access required");
  return c;
}
export async function readNetworkSignal(): Promise<{
  signal: NetworkSignal | null;
  available: boolean;
}> {
  try {
    const c = await client();
    const { data, error } = await c.rpc("current_network_signal");
    if (error) throw error;
    return { signal: data, available: true };
  } catch {
    return { signal: null, available: false };
  }
}
export async function signalHistory(): Promise<AdminSignal[]> {
  const c = await client();
  const { data, error } = await c.rpc("signal_admin_history");
  if (error) throw new Error("Signal administration denied");
  return data;
}
export async function manageSignal(
  action: "save" | "publish" | "end",
  id: string | null,
  draft: SignalDraft | null = null,
  replace: string | null = null,
) {
  try {
    if ((await headers()).get("origin") !== appOrigin(process.env))
      throw new Error();
    const c = await client();
    let name: string;
    let args: Record<string, unknown>;
    if (action === "save" && draft) {
      validateSignal(draft);
      name = "save_signal_draft";
      args = {
        p_id: id,
        p_type: draft.type,
        p_title: draft.title,
        p_message: draft.message,
        p_label: draft.linkLabel,
        p_url: draft.linkUrl,
        p_start: draft.startsAt,
        p_end: draft.endsAt,
      };
    } else if (action === "publish" && id) {
      name = "publish_network_signal";
      args = { p_id: id, p_replace: replace };
    } else if (action === "end" && id) {
      name = "end_network_signal";
      args = { p_id: id };
    } else throw new Error();
    const { data, error } = await c.rpc(name, args);
    if (error)
      return {
        error:
          "Operation rejected. Check authorization, dates and overlapping Signals; explicitly end or replace any conflict.",
      };
    return { id: typeof data === "string" ? data : id, error: null };
  } catch {
    return {
      error:
        "Unable to complete Signal operation. Check the fields and your administrator access.",
    };
  }
}
