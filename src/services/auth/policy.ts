import { normalizeEmail } from "../../utils/email";
import { normalizeXHandle } from "../../utils/x-profile";

export function appOrigin(env: Record<string, string | undefined>) {
  const url = new URL(env.APP_ORIGIN || "");
  if (
    url.origin !== env.APP_ORIGIN ||
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        (env.NODE_ENV !== "production" ||
          env.AUTH_ALLOW_LOCALHOST === "true") &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new Error("Configure a trusted APP_ORIGIN");
  return url.origin;
}
export function nextPath(value: unknown): string {
  if (value === "/explore" || value === "/account/delete") return value;
  if (typeof value === "string" && /^\/bond\/[a-f0-9]{64}$/.test(value))
    return value;
  return "/explore";
}
export function registration(value: Record<string, unknown>) {
  const alias = typeof value.alias === "string" ? value.alias.trim() : "";
  if (alias.length > 60) throw new Error("Name is too long");
  if (
    typeof value.locationId !== "string" ||
    !/^[a-f0-9-]{36}$/i.test(value.locationId)
  )
    throw new Error("Select a home region");
  const xHandle = normalizeXHandle(
    typeof value.xHandle === "string" ? value.xHandle : undefined,
  );
  return {
    alias,
    locationId: value.locationId,
    ...(xHandle ? { xHandle } : {}),
  };
}
export function hookOrigin(
  env: Record<string, string | undefined>,
  redirectTo: string,
) {
  const candidate = new URL(redirectTo).origin;
  const allowed = [
    appOrigin(env),
    ...(env.AUTH_ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ];
  if (!allowed.includes(candidate))
    throw new Error("Unapproved callback origin");
  return appOrigin({
    ...env,
    APP_ORIGIN: candidate,
    AUTH_ALLOW_LOCALHOST: "true",
  });
}
export function accessRequest(value: Record<string, unknown>) {
  if (typeof value.email !== "string") throw new Error("Enter a valid email");
  const email = normalizeEmail(value.email);
  return {
    email,
    next: nextPath(value.next),
    details: value.mode === "register" ? registration(value) : null,
  };
}
/** Fragment keeps Auth token hashes out of URL request/access logs and referrers. */
export function isAuthTokenHash(value: string) {
  return (
    value === value.trim() && /^(?:pkce_)?[a-fA-F0-9]{32,128}$/.test(value)
  );
}
export function emailLink(
  origin: string,
  tokenHash: string,
  redirectTo: string,
) {
  if (!isAuthTokenHash(tokenHash)) throw new Error("Invalid Auth token");
  const redirect = new URL(redirectTo);
  if (redirect.origin !== origin || redirect.pathname !== "/auth/confirm")
    throw new Error("Invalid callback destination");
  const fragment = new URLSearchParams({
    token_hash: tokenHash,
    next: nextPath(redirect.searchParams.get("next")),
  });
  return `${origin}/auth/confirm#${fragment}`;
}
