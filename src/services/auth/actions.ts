"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authClient, ownerContext, requireOwner } from "./server";
import {
  accessRequest,
  appOrigin,
  nextPath,
  registration,
  isAuthTokenHash,
} from "./policy";
import { EMOTIONS, type Emotion } from "../../types/emotional-pulse";
import { invitationPresentation } from "../bonds/qr-invitation";
import { bondRelationship } from "../bonds/relationship";
import { isCanonicalRegionId } from "../locations/canonical-regions";

async function sameOrigin() {
  const h = await headers();
  if (h.get("origin") !== appOrigin(process.env))
    throw new Error("Invalid request origin");
}
export async function requestAccess(form: FormData) {
  try {
    await sameOrigin();
    const input = accessRequest(Object.fromEntries(form));
    const { client, services } = await ownerContext();
    if (input.details) {
      if (!isCanonicalRegionId(input.details.locationId))
        return {
          error: "Select a country and an applicable region from the lists.",
        };
      const place = await services.locations.resolve(input.details.locationId);
      if (!place || place.displayName === "Verification only")
        return { error: "Select a home region from the available locations." };
    }
    const { error } = await client.auth.signInWithOtp({
      email: input.email,
      options: {
        shouldCreateUser: Boolean(input.details),
        emailRedirectTo: `${appOrigin(process.env)}/auth/confirm?next=${encodeURIComponent(input.next)}`,
        ...(input.details ? { data: { atomic_bond: input.details } } : {}),
      },
    });
    // Identical response for unknown/existing identities and provider throttling.
    void error;
    return {
      message:
        "If this address can receive an access email, a secure link is on its way. Check your inbox, or wait a minute before retrying.",
    };
  } catch {
    return {
      error: "Unable to request access. Check your details and try again.",
    };
  }
}
export async function completeAccess(tokenHash: string, next: string) {
  try {
    await sameOrigin();
    if (!isAuthTokenHash(tokenHash)) throw new Error();
    const client = await authClient();
    const { error } = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type: "email",
    });
    if (error)
      return {
        error:
          "This link is invalid, expired, or already used. Request a new access email.",
      };
    const context = await ownerContext();
    if (!context.user?.email_confirmed_at) throw new Error();
    const returning = Boolean(context.atom?.publicId);
    if (!context.atom) {
      const details = registration(
        context.user.user_metadata.atomic_bond ?? {},
      );
      const place = await context.services.locations.resolve(
        details.locationId,
      );
      if (!place || place.displayName === "Verification only")
        throw new Error();
      await context.services.atoms.create(details);
    }
    const atom = await context.services.atoms.activate();
    return { next: nextPath(next), publicId: atom.publicId, returning };
  } catch {
    return {
      error:
        "Access could not be completed. Request a new link, or complete your Atom details.",
    };
  }
}
export async function finishRegistration(form: FormData) {
  try {
    await sameOrigin();
    const context = await ownerContext();
    if (!context.user?.email_confirmed_at) throw new Error();
    const details = registration(Object.fromEntries(form));
    if (!isCanonicalRegionId(details.locationId)) throw new Error();
    const place = await context.services.locations.resolve(details.locationId);
    if (!place || place.displayName === "Verification only") throw new Error();
    await context.services.atoms.create(details);
    await context.services.atoms.activate();
    return { next: nextPath(form.get("next")) };
  } catch {
    return {
      error: "Unable to complete registration. Choose a valid home region.",
    };
  }
}
export async function signOut() {
  await sameOrigin();
  const client = await authClient();
  await client.auth.signOut({ scope: "local" });
  redirect("/");
}
export async function createOwnerInvitation() {
  await sameOrigin();
  const { services } = await requireOwner();
  const invite = await services.bonds.createInvitation();
  return {
    id: invite.id,
    expiresAt: invite.expiresAt,
    ...(await invitationPresentation(invite.token, process.env)),
  };
}
export async function cancelOwnerInvitation(id: string) {
  await sameOrigin();
  const { services } = await requireOwner();
  await services.bonds.cancel(id);
}
export async function refreshOwnerNetwork() {
  const { services, atom } = await requireOwner();
  return {
    graph: await services.bonds.graph(atom!.publicId!),
    pulses: await services.pulses.visible(),
  };
}
export async function confirmOwnerBond(token: string) {
  await sameOrigin();
  try {
    const { services, atom } = await requireOwner();
    const invite = await services.bonds.read(token);
    const graph = await services.bonds.graph(atom!.publicId!);
    const relationship = bondRelationship(
      graph,
      atom!.publicId,
      invite.creatorPublicId,
    );
    if (relationship === "self")
      return {
        error: "This is your invitation. Share it with another person.",
      };
    if (relationship === "bonded") return { error: "YOU ARE ALREADY BONDED" };
    await services.bonds.confirm(token);
    return {
      next: "/explore",
      publicId: atom!.publicId!,
      arrivalId: invite.creatorPublicId,
      graph: await services.bonds.graph(atom!.publicId!),
      pulses: await services.pulses.visible(),
    };
  } catch {
    return {
      error:
        "This Bond could not be confirmed. The invitation may be expired, used, or already connected.",
    };
  }
}
export async function sendOwnerPulse(emotion: Emotion) {
  await sameOrigin();
  if (!EMOTIONS.includes(emotion)) throw new Error("Select an emotion");
  const { services } = await requireOwner();
  return services.pulses.send(emotion);
}
export async function visibleOwnerPulses() {
  const { services } = await requireOwner();
  return services.pulses.visible();
}
export async function updateOwner(form: FormData) {
  try {
    await sameOrigin();
    const { services, atom } = await requireOwner();
    const digest = form.get("digest");
    if (
      form.get("digestChanged") === "true" &&
      !["weekly", "monthly", "disabled"].includes(String(digest))
    )
      throw new Error();
    await services.atoms.update(
      registration({
        alias: form.get("alias"),
        xHandle: form.get("xHandle"),
        locationId: atom!.locationId,
      }),
    );
    // Unrelated profile saves must not replay stale consent after unsubscribe.
    if (form.get("digestChanged") === "true")
      await services.preferences.update(
        digest as "weekly" | "monthly" | "disabled",
        (await services.preferences.get()).pulseNotifications,
      );
    return { message: "Your profile and preferences are saved." };
  } catch {
    return {
      error: "Unable to save. Check your profile details and try again.",
    };
  }
}

export async function updateWeeklyGrowth(enabled: boolean) {
  try {
    await sameOrigin();
    if (typeof enabled !== "boolean") throw new Error();
    const { services } = await requireOwner();
    await services.preferences.update(
      enabled ? "weekly" : "disabled",
      (await services.preferences.get()).pulseNotifications,
    );
    return { saved: true };
  } catch {
    return { saved: false };
  }
}
