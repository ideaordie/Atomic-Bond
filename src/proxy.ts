import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { dataConfiguration } from "./data/supabase/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "private, no-store");
  if (
    process.env.ATOMIC_BOND_DATA_MODE !== "supabase" ||
    !request.cookies
      .getAll()
      .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"))
  )
    return response;
  const config = dataConfiguration(process.env);
  if (config.mode !== "supabase") return response;
  const client = createServerClient(config.url, config.anonKey, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values)
          response.cookies.set(name, value, options);
        response.headers.set("Referrer-Policy", "no-referrer");
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  await client.auth.getUser();
  return response;
}
export const config = {
  matcher: [
    "/explore",
    "/auth/:path*",
    "/bond/:path*",
    "/owner/:path*",
    "/account/:path*",
    "/return",
  ],
};
