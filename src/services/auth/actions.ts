"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authClient, ownerContext, requireOwner } from "./server";
import {
  accessRequest,
  appOrigin,
  nextPath,
  registration,
  isAuthTokenHash,
} from "./policy";
import {
  invitationIntent,
  sealAccess,
  readAccess,
  readInvitation,
  continuationId,
  matchesContinuation,
  type BoundIntent,
} from "./invitation-continuation";
import { isSelectablePulse, type Emotion } from "../../types/emotional-pulse";
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
    const destination = input.next.startsWith("/bond/")
      ? "c1." +
        invitationIntent(
          input.email,
          input.next,
          (await services.bonds.read(input.next.slice(6))).expiresAt,
        )
      : input.next;
    const { error } = await client.auth.signInWithOtp({
      email: input.email,
      options: {
        shouldCreateUser: Boolean(input.details),
        emailRedirectTo: `${appOrigin(process.env)}/auth/confirm?next=${encodeURIComponent(destination)}`,
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
  // Previously issued links can authenticate, but unsigned invitation context
  // cannot claim a binding to that authentication attempt.
  const destination = nextPath(next);
  const result = await finishAccess(
    tokenHash,
    destination.startsWith("/bond/") ? "/explore" : destination,
  );
  return destination.startsWith("/bond/") && !("error" in result)
    ? { ...result, invitationRecovery: true }
    : result;
}
async function finishAccess(
  tokenHash: string,
  next: string,
  bound?: BoundIntent,
  invitationRecovery = false,
) {
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
    if (
      bound &&
      (!matchesContinuation(bound, context.user) || bound.token !== tokenHash)
    ) {
      next = "/explore";
      invitationRecovery = true;
    }
    const deletion = await context.client.rpc("account_deletion_status");
    if (!deletion.error && deletion.data?.pending)
      return { next: "/account/delete", publicId: null, returning: true };
    const returning = Boolean(context.atom?.publicId);
    if (context.atom?.status === "DEACTIVATED")
      return {
        next:
          nextPath(next) === "/account/delete"
            ? "/account/delete"
            : `/account/reactivate?next=${encodeURIComponent(nextPath(next))}`,
        publicId: context.atom.publicId,
        returning: true,
      };
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
    return {
      next: nextPath(next),
      publicId: atom.publicId,
      returning,
      invitationRecovery,
    };
  } catch {
    return {
      error:
        "Access could not be completed. Request a new link, or complete your Atom details.",
    };
  }
}

const continuationCookie = (id: string) => `ab-bond-auth-${id}`;
export async function stageInvitationAccess(
  value: string,
  tokenHash?: string,
  next = "/explore",
  access?: string,
) {
  try {
    await sameOrigin();
    if (access) tokenHash = readAccess(access).token;
    // New invitation links carry an independently encrypted access credential.
    // Old sealed-only links remain supported during the deployment transition.
    if (tokenHash) value = sealAccess(tokenHash, next, value);
    const data = tokenHash ? readAccess(value) : readInvitation(value);
    const id = continuationId(tokenHash || value);
    const jar = await cookies();
    const active = jar
      .getAll()
      .filter((c) => c.name.startsWith("ab-bond-auth-"));
    if (!jar.has(continuationCookie(id)) && active.length >= 4)
      return {
        error:
          "Too many open access links. Finish or dismiss an existing link first.",
      };
    jar.set(continuationCookie(id), value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/auth/confirm",
      maxAge: Math.max(1, Math.floor((data.exp - Date.now()) / 1000)),
    });
    return { flow: id };
  } catch {
    return {
      error:
        "This invitation access link is unavailable. Reopen the original invitation and request a new access email.",
    };
  }
}
export async function completeInvitationAccess(
  id: string,
  skipInvitation = false,
) {
  try {
    await sameOrigin();
    if (!/^[a-f0-9]{32}$/.test(id)) throw new Error();
    const jar = await cookies();
    const value = jar.get(continuationCookie(id))?.value;
    if (!value) throw new Error();
    let token: string,
      next = "/explore",
      bound: BoundIntent | undefined;
    let invitationRecovery = false;
    try {
      const access = readAccess(value);
      if (continuationId(access.token) !== id) throw new Error();
      token = access.token;
      next = access.next;
      if (access.continuation && !skipInvitation) {
        try {
          bound = readInvitation(access.continuation);
          if (bound.token !== token) throw new Error();
          next = bound.next;
        } catch {
          bound = undefined;
          invitationRecovery = true;
        }
      }
    } catch {
      if (continuationId(value) !== id) throw new Error();
      bound = readInvitation(value);
      token = bound.token;
      next = skipInvitation ? "/explore" : bound.next;
    }
    const result = await finishAccess(token, next, bound, invitationRecovery);
    jar.set(continuationCookie(id), "", { path: "/auth/confirm", maxAge: 0 });
    return result;
  } catch {
    return {
      error:
        "This invitation access link is unavailable. Reopen the original invitation and request a new access email.",
    };
  }
}
export async function dismissInvitationAccess(id: string) {
  await sameOrigin();
  if (/^[a-f0-9]{32}$/.test(id))
    (await cookies()).set(continuationCookie(id), "", {
      path: "/auth/confirm",
      maxAge: 0,
    });
}

/** Recovery uses only the independently verified current session, never stale invitation input. */
export async function recoverAuthenticatedAccess() {
  try {
    await sameOrigin();
    const context = await ownerContext();
    if (!context.user?.email_confirmed_at) return null;
    const deletion = await context.client.rpc("account_deletion_status");
    if (!deletion.error && deletion.data?.pending)
      return { next: "/account/delete", publicId: null, returning: true };
    if (context.atom?.status === "DEACTIVATED")
      return {
        next: "/account/reactivate",
        publicId: context.atom.publicId,
        returning: true,
      };
    if (!context.atom || !context.atom.publicId)
      return { next: "/auth", publicId: null, returning: false };
    if (!["ACTIVE", "DORMANT"].includes(context.atom.status)) return null;
    return {
      next: "/explore",
      publicId: context.atom.publicId,
      returning: true,
    };
  } catch {
    return null;
  }
}

export async function finishRegistration(form: FormData) {
  try {
    await sameOrigin();
    const context = await ownerContext();
    if (!context.user?.email_confirmed_at) throw new Error();
    if (context.atom?.status === "DEACTIVATED")
      return { next: "/account/reactivate" };
    const details = registration(Object.fromEntries(form));
    if (!isCanonicalRegionId(details.locationId)) throw new Error();
    const place = await context.services.locations.resolve(details.locationId);
    if (!place || place.displayName === "Verification only") throw new Error();
    await context.services.atoms.create(details);
    await context.services.atoms.activate();
    return {
      next: nextPath(form.get("next")),
      created: !context.atom?.publicId,
    };
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
    createdAt: invite.createdAt,
    ...(await invitationPresentation(invite.token, process.env)),
  };
}
export async function cancelOwnerInvitation(id: string) {
  await sameOrigin();
  const { services } = await requireOwner();
  await services.bonds.cancel(id);
}
export async function refreshOwnerNetwork() {
  const { services, atom, user } = await ownerContext();
  if (!user?.email_confirmed_at || !atom?.publicId || atom.status !== "ACTIVE")
    return { graph: { nodes: [], edges: [] }, pulses: [] };
  return {
    graph: await services.bonds.graph(atom!.publicId!),
    pulses: await services.pulses.visible(),
  };
}
/** No caller-selected root: ownership is resolved from the verified server session. */
export async function ownerGeographicNetwork() {
  const { services, atom } = await requireOwner();
  return {
    ownerId: atom!.publicId!,
    graph: await services.bonds.graph(atom!.publicId!),
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
      activeOwner: atom!.status === "ACTIVE",
      firstBond:
        atom!.status === "ACTIVE" &&
        !graph.edges.some(
          (e) => e.source === atom!.publicId || e.target === atom!.publicId,
        ),
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
  if (!isSelectablePulse(emotion)) throw new Error("Select an emotion");
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

export async function updateHomeRegion(form: FormData) {
  try {
    await sameOrigin();
    const { client, atom } = await requireOwner();
    const locationId = form.get("locationId");
    if (
      atom?.status !== "ACTIVE" ||
      typeof locationId !== "string" ||
      !isCanonicalRegionId(locationId)
    )
      throw new Error();
    const { error } = await client.rpc("update_my_home_region", {
      p_location_id: locationId,
    });
    if (error) throw new Error();
    return { saved: true };
  } catch {
    return {
      error:
        "Unable to update Home Region. Select a canonical country and region for your active account.",
    };
  }
}
