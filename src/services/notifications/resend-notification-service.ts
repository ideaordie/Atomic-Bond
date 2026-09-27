import type {
  NotificationService,
  PrivateIdentity,
} from "../participation/contracts";

export interface MailTransport {
  send(
    message: { from: string; to: string; subject: string; text: string },
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
        text: `ATOMIC BOND\n\nVerify your email to create or access your Atom.\n\nVERIFY MY ATOM\n${link}\n\nIf you did not request this email, you can ignore it.`,
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
        text: `ATOMIC BOND\n\nReturn securely to your Atom.\n\nVIEW MY ATOM\n${link}\n\nIf you did not request this email, you can ignore it.`,
      },
      idempotencyKey,
    );
  }
  async sendBondNotification(): Promise<void> {
    throw new Error("Bond email delivery is not enabled");
  }
  async sendGrowthDigest(): Promise<void> {
    throw new Error("Use an authorized, preference-checked summary delivery");
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
