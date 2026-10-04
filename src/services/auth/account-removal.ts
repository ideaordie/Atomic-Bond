import "server-only";
import { createClient } from "@supabase/supabase-js";
import { dataConfiguration } from "../../data/supabase/config";

/** Separate privileged boundary. Never use this client for ordinary owner operations. */
export function accountRemovalAdapter() {
  const config = dataConfiguration(process.env);
  const key = process.env.SUPABASE_ACCOUNT_DELETION_SECRET_KEY;
  if (
    config.mode !== "supabase" ||
    !key?.startsWith("sb_secret_") ||
    /\s/.test(key) ||
    key === process.env.SUPABASE_GROWTH_SECRET_KEY
  )
    throw new Error("Account deletion configuration unavailable");
  const admin = createClient(config.url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return {
    async ready(ownerAuthId: string) {
      try {
        const result = await admin.rpc("account_cleanup_pending", {
          p_user: ownerAuthId,
        });
        return !result.error && typeof result.data === "boolean";
      } catch {
        return false;
      }
    },
    async finish(ownerAuthId: string) {
      try {
        const pending = await admin.rpc("account_cleanup_pending", {
          p_user: ownerAuthId,
        });
        if (pending.error || pending.data !== true) return false;
        const removed = await admin.auth.admin.deleteUser(ownerAuthId);
        // A retry after Auth deletion can finish the durable cleanup marker.
        if (removed.error && removed.error.code !== "user_not_found")
          return false;
        const completed = await admin.rpc("account_cleanup_finish", {
          p_user: ownerAuthId,
        });
        return !completed.error && completed.data === true;
      } catch {
        // Never emit provider diagnostics or lose the durable pending marker.
        return false;
      }
    },
  };
}
