import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { dataConfiguration } from "../../data/supabase/config";
import { createSupabaseServices } from "../supabase/services";

export async function authClient() {
  const config = dataConfiguration(process.env);
  if (config.mode !== "supabase")
    throw new Error("Real authentication requires Supabase mode");
  const jar = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        try {
          for (const { name, value, options } of values)
            jar.set(name, value, options);
        } catch {
          /* Server components use refreshed Proxy cookies. */
        }
      },
    },
  });
}
export async function ownerContext() {
  const client = await authClient();
  const jar = await cookies();
  const hasSession = jar
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  const user = hasSession ? (await client.auth.getUser()).data.user : null;
  const services = createSupabaseServices({
    async call(name, args = {}) {
      const { data, error } = await client.rpc(name, args);
      if (error)
        throw new Error(
          "Operation unavailable. Please sign in again or retry.",
        );
      return data as unknown;
    },
  });
  const { data: atom, error } = user
    ? await client.rpc("my_atom")
    : { data: null, error: null };
  if (error) throw new Error("Owner configuration unavailable");
  return {
    client,
    user,
    atom: atom as null | {
      publicId: string | null;
      status: string;
      locationId: string;
      alias: string | null;
      xHandle: string | null;
    },
    services,
  };
}
export function ownedPublicId(
  context: Awaited<ReturnType<typeof ownerContext>>,
) {
  return context.user?.email_confirmed_at &&
    context.atom?.publicId &&
    ["ACTIVE", "DORMANT"].includes(context.atom.status)
    ? context.atom.publicId
    : null;
}
export async function requireOwner() {
  const context = await ownerContext();
  if (
    !context.user?.email_confirmed_at ||
    !context.atom?.publicId ||
    !["ACTIVE", "DORMANT"].includes(context.atom.status)
  )
    throw new Error("Verified Atom ownership required");
  return context;
}
