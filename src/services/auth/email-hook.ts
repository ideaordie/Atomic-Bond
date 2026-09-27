import { Webhook } from "standardwebhooks";
import { emailLink } from "./policy";
import type { ResendNotificationService } from "../notifications/resend-notification-service";

export async function deliverAuthEmail(
  body: string,
  headers: Record<string, string>,
  secret: string,
  origin: string,
  service: ResendNotificationService,
) {
  if (body.length > 65536) throw new Error("Invalid hook");
  // Supabase displays v1,whsec_...; Standard Webhooks consumes whsec_... .
  const verified = new Webhook(secret.replace(/^v1,/, "")).verify(
    body,
    headers,
  ) as {
    user?: { email?: string };
    email_data?: {
      token_hash?: string;
      redirect_to?: string;
      email_action_type?: string;
    };
  };
  const email = verified.user?.email,
    data = verified.email_data;
  if (
    !email ||
    !data?.token_hash ||
    !data.redirect_to ||
    !["signup", "magiclink"].includes(data.email_action_type || "")
  )
    throw new Error("Unsupported auth operation");
  const identity = {
    email,
    verificationStatus: "pending" as const,
    notificationPreferences: {
      transactionalAccess: true as const,
      growthDigest: "disabled" as const,
    },
  };
  const link = emailLink(origin, data.token_hash, data.redirect_to);
  const id = headers["webhook-id"];
  if (!id || !/^[\w-]{1,200}$/.test(id)) throw new Error("Invalid hook id");
  if (data.email_action_type === "signup")
    await service.sendVerificationEmail(identity, link, id);
  else await service.sendMagicAccessLink(identity, link, id);
}
