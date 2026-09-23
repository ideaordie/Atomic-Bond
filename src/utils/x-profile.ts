export const X_HANDLE_ERROR =
  "Enter an X handle with 1–15 letters, numbers, or underscores, with an optional leading @. URLs are not accepted.";

/** Profile references accept short existing handles, not just new-account registrations. */
export function normalizeXHandle(input?: string): string | undefined {
  const value = input?.trim();
  if (!value) return undefined;
  const handle = value.startsWith("@") ? value.slice(1) : value;
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) throw new Error(X_HANDLE_ERROR);
  return handle;
}

/** Fixed origin/path construction; malformed public projections fail closed. */
export function xProfileUrl(handle?: string): string | undefined {
  try {
    const normalized = normalizeXHandle(handle);
    return normalized ? `https://x.com/${normalized}` : undefined;
  } catch {
    return undefined;
  }
}
