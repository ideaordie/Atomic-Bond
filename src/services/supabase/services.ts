import type { RpcTransport } from "./transport";
import {
  publicAtom,
  publicGraph,
  publicNumber,
  record,
  string,
} from "../../data/supabase/projections";
import { normalizeXHandle } from "../../utils/x-profile";
import {
  EMOTIONS,
  PULSE_LIFETIME_MS,
  type Emotion,
  type EmotionalPulse,
} from "../../types/emotional-pulse";
import type { AtomStatus, NotificationPreferences } from "../../types/atom";
import type { Location, NotificationService } from "../participation/contracts";

export interface PendingAtom {
  status: AtomStatus;
  publicId: string | null;
}
function lifecycle(value: unknown): PendingAtom {
  const row = record(value),
    status = string(row.status) as AtomStatus;
  if (
    !["PENDING", "ACTIVE", "DORMANT", "DEACTIVATED", "DELETED"].includes(status)
  )
    throw new Error("Invalid lifecycle response");
  return {
    status,
    publicId: row.publicId === null ? null : publicNumber(row.publicId),
  };
}
export class SupabaseAtomService {
  constructor(private readonly rpc: RpcTransport) {}
  async create(details: {
    locationId: string;
    alias?: string;
    xHandle?: string;
  }) {
    return lifecycle(
      await this.rpc.call("begin_atom", {
        p_location_id: details.locationId,
        p_display_name: details.alias?.trim() || null,
        p_x_handle: normalizeXHandle(details.xHandle) ?? null,
      }),
    );
  }
  async activate() {
    return lifecycle(await this.rpc.call("activate_atom"));
  }
  async get(publicId: string) {
    const data = record(
      await this.rpc.call("public_graph", {
        p_public_id: publicNumber(publicId),
      }),
    );
    if (!Array.isArray(data.nodes)) throw new Error("Invalid public response");
    const selected = data.nodes.find((n) => record(n).publicId === publicId);
    if (!selected) throw new Error("Atom unavailable");
    return publicAtom(selected);
  }
  async update(details: {
    locationId: string;
    alias?: string;
    xHandle?: string;
  }) {
    await this.rpc.call("update_my_atom", {
      p_location_id: details.locationId,
      p_display_name: details.alias?.trim() || null,
      p_x_handle: normalizeXHandle(details.xHandle) ?? null,
    });
  }
}
export function invitationToken(token: string): string {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new Error("Invalid invitation token");
  return token;
}
/** A QR code will encode this path. No token is an Atom ID or a sequential secret. */
export function invitationPath(token: string) {
  return `/bond/${invitationToken(token)}`;
}
export class SupabaseBondService {
  constructor(private readonly rpc: RpcTransport) {}
  async createInvitation() {
    const row = record(await this.rpc.call("create_bond_invitation"));
    return {
      id: string(row.id),
      token: invitationToken(string(row.token)),
      expiresAt: string(row.expiresAt),
      status: "ACTIVE" as const,
    };
  }
  async read(token: string) {
    const row = record(
      await this.rpc.call("resolve_bond_invitation", {
        p_token: invitationToken(token),
      }),
    );
    return {
      creatorPublicId: publicNumber(row.creatorPublicId),
      expiresAt: string(row.expiresAt),
    };
  }
  async confirm(token: string) {
    await this.rpc.call("accept_bond_invitation", {
      p_token: invitationToken(token),
    });
  }
  async cancel(id: string) {
    await this.rpc.call("cancel_bond_invitation", { p_id: id });
  }
  async graph(publicId?: string) {
    return publicGraph(
      await this.rpc.call("public_graph", {
        p_public_id: publicId ? publicNumber(publicId) : null,
      }),
    );
  }
}
function pulse(value: unknown): EmotionalPulse {
  const row = record(value),
    emotion = string(row.emotion) as Emotion;
  if (
    !EMOTIONS.includes(emotion) ||
    !Number.isFinite(row.createdAt) ||
    !Number.isFinite(row.expiresAt) ||
    Number(row.expiresAt) - Number(row.createdAt) !== PULSE_LIFETIME_MS
  )
    throw new Error("Invalid Pulse response");
  return {
    id: string(row.id),
    atomId: publicNumber(row.atomId),
    emotion,
    createdAt: Number(row.createdAt),
    expiresAt: Number(row.expiresAt),
  };
}
export class SupabasePulseService {
  constructor(private readonly rpc: RpcTransport) {}
  async send(emotion: Emotion) {
    if (!EMOTIONS.includes(emotion))
      throw new Error("Select an approved emotion");
    return pulse(
      await this.rpc.call("send_emotional_pulse", {
        p_emotion: emotion.toUpperCase(),
      }),
    );
  }
  async visible() {
    const rows = await this.rpc.call("connected_emotional_pulses");
    if (!Array.isArray(rows)) throw new Error("Invalid Pulse response");
    return rows.map(pulse);
  }
}
export class SupabaseLocationService {
  constructor(private readonly rpc: RpcTransport) {}
  async resolve(id: string): Promise<Location | undefined> {
    const value = await this.rpc.call("canonical_location", { p_id: id });
    if (value === null) return undefined;
    const r = record(value);
    return {
      id: string(r.id),
      city: string(r.city),
      region: string(r.region),
      country: string(r.country),
      countryCode: string(r.country_code),
      displayName: string(r.display_name),
    };
  }
  async search(query: string): Promise<readonly Location[]> {
    const rows = await this.rpc.call("canonical_locations", { p_query: query });
    if (!Array.isArray(rows)) throw new Error("Invalid location response");
    return rows.map((value) => {
      const r = record(value);
      return {
        id: string(r.id),
        city: string(r.city),
        region: string(r.region),
        country: string(r.country),
        countryCode: string(r.country_code),
        displayName: string(r.display_name),
      };
    });
  }
}
export class SupabasePreferenceService {
  constructor(private readonly rpc: RpcTransport) {}
  async get(): Promise<NotificationPreferences> {
    const row = record(await this.rpc.call("my_notification_preferences"));
    if (
      row.transactionalAccess !== true ||
      typeof row.pulseNotifications !== "boolean" ||
      !["weekly", "monthly", "disabled"].includes(String(row.growthDigest))
    )
      throw new Error("Invalid preferences response");
    return {
      transactionalAccess: true,
      growthDigest: row.growthDigest as NotificationPreferences["growthDigest"],
      pulseNotifications: row.pulseNotifications,
    };
  }
  async update(
    growthDigest: NotificationPreferences["growthDigest"],
    pulseNotifications: boolean,
  ) {
    await this.rpc.call("update_notification_preferences", {
      p_growth_digest: growthDigest,
      p_pulse_notifications: pulseNotifications,
    });
  }
}
/** Intentionally fails clearly: real delivery and access links are Task #7. */
export class DeferredNotificationService implements NotificationService {
  sendVerificationEmail(): never {
    throw new Error("Email delivery is not enabled; Task #7 is required.");
  }
  sendMagicAccessLink(): never {
    throw new Error("Passwordless access is not enabled; Task #7 is required.");
  }
  sendBondNotification(): never {
    throw new Error("Notification delivery is not enabled.");
  }
  sendGrowthDigest(): never {
    throw new Error("Notification delivery is not enabled.");
  }
}
export function createSupabaseServices(rpc: RpcTransport) {
  return {
    atoms: new SupabaseAtomService(rpc),
    bonds: new SupabaseBondService(rpc),
    pulses: new SupabasePulseService(rpc),
    locations: new SupabaseLocationService(rpc),
    preferences: new SupabasePreferenceService(rpc),
    notifications: new DeferredNotificationService(),
  };
}
