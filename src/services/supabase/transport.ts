import { createClient } from "@supabase/supabase-js";
import type { DataConfiguration } from "../../data/supabase/config";
export interface RpcTransport {
  call(name: string, args?: Record<string, unknown>): Promise<unknown>;
}
/** No service-role client exists. Future Task #7 supplies an Auth access token. */
export function supabaseTransport(
  config: Extract<DataConfiguration, { mode: "supabase" }>,
  accessToken?: string,
): RpcTransport {
  const client = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    ...(accessToken
      ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
      : {}),
  });
  return {
    async call(name, args = {}) {
      const { data, error } = await client.rpc(name, args);
      // Do not expose SQL details (which can include private constraint values).
      if (error)
        throw new Error(
          `Atomic Bond operation ${name} failed (${error.code || "network"}).`,
        );
      return data as unknown;
    },
  };
}
