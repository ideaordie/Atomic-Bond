export type DataConfiguration =
  { mode: "mock" } | { mode: "supabase"; url: string; anonKey: string };

/** Server composition chooses the mode. A production omission never loads fixtures. */
export function dataConfiguration(
  env: Record<string, string | undefined>,
): DataConfiguration {
  const mode =
    env.ATOMIC_BOND_DATA_MODE ||
    (env.NODE_ENV === "development" ? "mock" : undefined);
  if (mode === "mock") return { mode };
  if (mode !== "supabase")
    throw new Error(
      "Set ATOMIC_BOND_DATA_MODE explicitly to supabase or mock.",
    );
  const url = env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey)
    throw new Error(
      "Supabase mode requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" &&
    !(
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
    )
  )
    throw new Error("Supabase requires HTTPS outside local development.");
  if (parsed.username || parsed.password || parsed.search || parsed.hash)
    throw new Error("Invalid Supabase project URL.");
  if (anonKey.startsWith("sb_secret_"))
    throw new Error("An administrative key is not browser-safe.");
  if (!anonKey.startsWith("sb_publishable_")) {
    try {
      const payload = JSON.parse(
        atob(anonKey.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")),
      ) as { role?: unknown };
      if (payload.role !== "anon") throw new Error();
    } catch {
      throw new Error(
        "Use a Supabase anonymous or publishable key, never a service-role key.",
      );
    }
  }
  return { mode, url: parsed.origin, anonKey };
}
