import "server-only";
import { cookies } from "next/headers";
import { ownerContext } from "./server";
import { readReceipt } from "./registration-receipt";

export const REGISTRATION_COOKIE = "ab-registration-invitation";
export async function registrationIntent(
  context: Awaited<ReturnType<typeof ownerContext>>,
) {
  try {
    if (!context.user?.email_confirmed_at) return null;
    const receipt = readReceipt(
      (await cookies()).get(REGISTRATION_COOKIE)?.value,
      "session",
    );
    if (!receipt || receipt.user !== context.user.id) return null;
    const { data, error } = await context.client.auth.getClaims();
    if (
      error ||
      data?.claims.sub !== context.user.id ||
      data?.claims.session_id !== receipt.session
    )
      return null;
    return receipt;
  } catch {
    return null;
  }
}
