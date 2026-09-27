import "server-only";
import type { MailTransport } from "./resend-notification-service";
export function resendTransport(): MailTransport {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Configure server-only Resend delivery");
  return {
    async send(message, idempotencyKey) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("Email delivery failed");
    },
  };
}
