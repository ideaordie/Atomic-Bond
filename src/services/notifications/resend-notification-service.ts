import type {
  NotificationService,
  PrivateIdentity,
} from "../participation/contracts";
import { growthEmail } from "../growth/email";
import type { GrowthDelivery } from "../growth/contracts";
import { authEmail } from "./auth-email";

export class EmailDeliveryError extends Error {
  constructor(public readonly status: number) {
    super("Email delivery failed");
  }
}

export interface MailTransport {
  send(
    message: {
      from: string;
      to: string;
      subject: string;
      text: string;
      html?: string;
    },
    idempotencyKey?: string,
  ): Promise<void>;
}
/** Server composition supplies the transport. No credentials or private payloads reach UI. */
export class ResendNotificationService implements NotificationService {
  constructor(
    private readonly transport: MailTransport,
    private readonly from: string,
  ) {}
  async sendVerificationEmail(
    identity: PrivateIdentity,
    link?: string,
    idempotencyKey?: string,
  ) {
    if (!link) throw new Error("Supabase Auth verification link required");
    await this.transport.send(
      {
        from: this.from,
        to: identity.email,
        subject: "Verify your Atomic Bond email",
        ...authEmail(link),
      },
      idempotencyKey,
    );
  }
  async sendMagicAccessLink(
    identity: PrivateIdentity,
    link?: string,
    idempotencyKey?: string,
  ) {
    if (!link) throw new Error("Supabase Auth access link required");
    await this.transport.send(
      {
        from: this.from,
        to: identity.email,
        subject: "Your Atomic Bond access link",
        ...authEmail(link),
      },
      idempotencyKey,
    );
  }
  async sendBondNotification(): Promise<void> {
    throw new Error("Bond email delivery is not enabled");
  }
  async sendGrowthDigest(input: GrowthDelivery, origin: string): Promise<void> {
    await this.transport.send(
      this.growthMessage(input, origin),
      `growth/${input.id}`,
    );
  }
  growthMessage(input: GrowthDelivery, origin: string) {
    return { from: this.from, to: input.email, ...growthEmail(input, origin) };
  }
  async sendSummary(
    input: {
      email: string;
      enabled: boolean;
      people: number;
      cities: number;
      countries: number;
      link: string;
    },
    idempotencyKey: string,
  ) {
    if (!input.enabled) return;
    for (const n of [input.people, input.cities, input.countries])
      if (!Number.isSafeInteger(n) || n < 0) throw new Error("Invalid summary");
    await this.transport.send(
      {
        from: this.from,
        to: input.email,
        subject: "Your Atom grew",
        text: `ATOMIC BOND\n\nYOUR ATOM GREW\n+${input.people} connected people\n+${input.cities} cities\n+${input.countries} countries\n\nVIEW MY ATOM\n${input.link}\n\nManage or disable digests in your Atom preferences.`,
      },
      idempotencyKey,
    );
  }
}
