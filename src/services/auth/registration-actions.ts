"use server";
import { cookies, headers } from "next/headers";
import { authClient, ownerContext } from "./server";
import { accessRequest, appOrigin, isAuthTokenHash } from "./policy";
import { requestAccess, finishRegistration, confirmOwnerBond } from "./actions";
import { isCanonicalRegionId } from "../locations/canonical-regions";
import { requestReceipt, sessionReceipt } from "./registration-receipt";
import { REGISTRATION_COOKIE, registrationIntent } from "./registration-intent";

async function origin() {
  if ((await headers()).get("origin") !== appOrigin(process.env))
    throw new Error("Invalid request");
}
async function clearIntent() {
  (await cookies()).set(REGISTRATION_COOKIE, "", {
    path: "/auth/register",
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
}
export async function requestInvitedRegistration(form: FormData) {
  try {
    await origin();
    const input = accessRequest(Object.fromEntries(form));
    if (!input.details || !input.next.startsWith("/bond/"))
      return requestAccess(form);
    const context = await ownerContext();
    if (context.user) return requestAccess(form);
    if (!isCanonicalRegionId(input.details.locationId)) throw new Error();
    const place = await context.services.locations.resolve(
      input.details.locationId,
    );
    if (!place || place.displayName === "Verification only") throw new Error();
    // The existing read RPC independently validates cancellation and expiration.
    const invitation = input.next.slice(6);
    const invite = await context.services.bonds.read(invitation);
    const receipt = requestReceipt(
      input.email,
      invitation,
      Date.parse(invite.expiresAt),
    );
    await context.client.auth.signInWithOtp({
      email: input.email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${appOrigin(process.env)}/auth/confirm?next=%2Fexplore&registration_invitation=1`,
        data: {
          atomic_bond: input.details,
          ...(receipt ? { atomic_bond_registration_receipt: receipt } : {}),
        },
      },
    });
    return {
      message:
        "If this address can receive an access email, a secure link is on its way. Check your inbox, or wait a minute before retrying.",
    };
  } catch {
    return {
      error:
        "Unable to request registration. Check your details and invitation, then try again.",
    };
  }
}

export async function completeInvitedRegistration(
  token: string,
  receipt: string,
) {
  try {
    await origin();
    if (!isAuthTokenHash(token)) throw new Error();
    const client = await authClient();
    // Only this successful provider verification can establish invitation intent.
    // A pre-existing session is never sufficient to redeem an email receipt.
    const { error } = await client.auth.verifyOtp({
      token_hash: token,
      type: "email",
    });
    if (error && (await ownerContext()).user?.email_confirmed_at)
      return recoverInvitedRegistration();
    if (error)
      return {
        error:
          "This link is invalid, expired, or already used. You can access your Atom or request a new email.",
      };
    const context = await ownerContext();
    if (!context.user?.email_confirmed_at) throw new Error();
    const deletion = await context.client.rpc("account_deletion_status");
    if (!deletion.error && deletion.data?.pending)
      return { next: "/account/delete" };
    if (context.atom && context.atom.status !== "PENDING")
      return {
        next:
          context.atom.status === "DEACTIVATED"
            ? "/account/reactivate"
            : "/explore",
      };
    const jar = await cookies();
    await clearIntent();
    try {
      const { data } = await context.client.auth.getClaims();
      const session = data?.claims.session_id;
      const intent =
        typeof session === "string" && context.user.email
          ? sessionReceipt(
              receipt,
              context.user.email,
              context.user.id,
              token,
              session,
            )
          : null;
      if (intent)
        jar.set(REGISTRATION_COOKIE, intent, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/auth/register",
          maxAge: 86400,
        });
    } catch {
      /* Optional context cannot block verified registration. */
    }
    const form = new FormData();
    for (const [name, value] of Object.entries(
      context.user.user_metadata.atomic_bond ?? {},
    ))
      if (typeof value === "string") form.set(name, value);
    const result = await finishRegistration(form);
    if (result.error) return { next: "/auth/register/details" };
    if (result.next !== "/explore") return result;
    return { next: "/auth/register/invitation", created: true };
  } catch {
    return {
      error:
        "Verification could not be completed. You can access your Atom or request a new email.",
    };
  }
}

export async function finishInvitedRegistration(form: FormData) {
  await origin();
  // The destination is fixed; posted identity/next fields cannot establish intent.
  form.set("next", "/explore");
  const result = await finishRegistration(form);
  if (result.next === "/explore")
    return { ...result, next: "/auth/register/invitation" };
  return result;
}
export async function dismissRegistrationInvitation() {
  await origin();
  await clearIntent();
  return { next: "/explore" };
}
export async function confirmRegistrationInvitation() {
  await origin();
  const context = await ownerContext();
  const intent = await registrationIntent(context);
  if (!intent)
    return {
      error:
        "This invitation is no longer available. You can continue to MY ATOM.",
    };
  const result = await confirmOwnerBond(intent.invitation);
  if (result.next) await clearIntent();
  return result;
}
export async function recoverInvitedRegistration() {
  await origin();
  const context = await ownerContext();
  if (!context.user?.email_confirmed_at) return { next: "/auth" };
  if (context.atom?.status === "DEACTIVATED")
    return { next: "/account/reactivate" };
  if (!context.atom || context.atom.status === "PENDING")
    return { next: "/auth/register/details" };
  return {
    next: (await registrationIntent(context))
      ? "/auth/register/invitation"
      : "/explore",
  };
}
