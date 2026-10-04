"use server";
import { cookies, headers } from "next/headers";
import { authClient, ownerContext } from "./server";
import { appOrigin } from "./policy";
import { accountRemovalAdapter } from "./account-removal";

async function guardOrigin() {
  if ((await headers()).get("origin") !== appOrigin(process.env))
    throw new Error("Invalid origin");
}
export async function requestDeletionAccess() {
  try {
    await guardOrigin();
    const { client, user, atom } = await ownerContext();
    if (
      !user?.email_confirmed_at ||
      !atom?.publicId ||
      !["ACTIVE", "DORMANT", "DEACTIVATED"].includes(atom.status)
    )
      throw new Error();
    const { error } = await client.auth.signInWithOtp({
      email: user!.email!,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${appOrigin(process.env)}/auth/confirm?next=%2Faccount%2Fdelete`,
      },
    });
    return error
      ? { error: "Unable to send now. Wait before trying again." }
      : {
          message:
            "Check your email to verify recent access, then return to account deletion.",
        };
  } catch {
    return { error: "Unable to verify access. Please sign in again." };
  }
}
export async function deleteAccount(confirmation: string) {
  let anonymized = false;
  try {
    await guardOrigin();
    const client = await authClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user)
      return { state: "error", message: "Sign in to your account first." };
    // Configuration must exist before starting irreversible anonymization.
    const cleanup = accountRemovalAdapter();
    if (!(await cleanup.ready(user.id))) throw new Error("Cleanup unavailable");
    const { data, error } = await client.rpc("delete_my_account", {
      p_confirmation: confirmation,
    });
    if (error)
      return {
        state: "error",
        message:
          "We couldn't confirm completion. Check your confirmation and retry safely.",
      };
    if (data?.state === "reauthenticate")
      return {
        state: "reauthenticate",
        message: "Verify your access by email before deleting your account.",
      };
    if (data?.state === "delivery_in_progress")
      return {
        state: "error",
        message:
          "An email is currently being processed. Nothing has been deleted. Please try again in a few minutes.",
      };
    if (data?.state !== "auth_cleanup_pending") throw new Error();
    anonymized = true;
    if (!(await cleanup.finish(user.id)))
      return {
        state: "pending",
        message:
          "Your Atom has been anonymized and owner access removed. Secure sign-in cleanup is still pending. Retry to finish; your account will not be restored.",
      };
    await client.auth.signOut({ scope: "global" });
    const jar = await cookies();
    for (const cookie of jar.getAll())
      if (cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"))
        jar.delete(cookie.name);
    return { state: "deleted", message: "Account deleted." };
  } catch {
    return {
      state: anonymized ? "pending" : "error",
      message: anonymized
        ? "Your Atom is anonymized. Secure cleanup is pending; retry to finish."
        : "Account deletion is unavailable. Please try again later.",
    };
  }
}
