import { describe, expect, it } from "vitest";
import { authEmail } from "../../src/services/notifications/auth-email";
import {
  ResendNotificationService,
  type MailTransport,
} from "../../src/services/notifications/resend-notification-service";

const decode = (value: string) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

describe("verification email presentation", () => {
  it.each(["signup", "access", "invitation", "resend"])(
    "delivers both formats without changing recipient or idempotency for %s",
    async (kind) => {
      const messages: Parameters<MailTransport["send"]>[] = [];
      const service = new ResendNotificationService(
        {
          send: async (...args) => {
            messages.push(args);
          },
        },
        "sender@example.invalid",
      );
      const identity = {
        email: "recipient@example.invalid",
        verificationStatus: "pending" as const,
        notificationPreferences: {
          transactionalAccess: true as const,
          growthDigest: "disabled" as const,
        },
      };
      const link = `https://example.invalid/auth/${kind === "invitation" ? "register/" : ""}confirm#token_hash=pkce_synthetic&receipt=synthetic%2Bvalue`;
      if (kind === "access")
        await service.sendMagicAccessLink(identity, link, "synthetic-hook-id");
      else
        await service.sendVerificationEmail(
          identity,
          link,
          "synthetic-hook-id",
        );
      expect(messages).toHaveLength(1);
      const [message, id] = messages[0]!;
      expect(id).toBe("synthetic-hook-id");
      expect(message.to).toBe(identity.email);
      expect(message.subject).toBe(
        kind === "access"
          ? "Your Atomic Bond access link"
          : "Verify your Atomic Bond email",
      );
      expect(message.text).toContain(`\n${link}\n`);
      expect(decode(message.html!.match(/href="([^"]*)"/)![1]!)).toBe(link);
    },
  );
  it.each([
    ["/auth/confirm#token_hash=pkce_test&next=%2Fexplore", false],
    [
      "/auth/register/confirm#token_hash=pkce_test&receipt=opaque%2Bdata%3D",
      true,
    ],
    ["/auth/confirm#token_hash=resend&next=%2Fbond%2Fsynthetic", false],
  ])("preserves the complete generated destination %s", (path, invitation) => {
    const link = `https://example.invalid${path}`;
    const { html, text } = authEmail(link);
    const href = html.match(/href="([^"]*)"/)![1]!;
    expect(decode(href)).toBe(link);
    expect(
      text.split("\n").filter((line) => line.startsWith("https:")),
    ).toEqual([link]);
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html.replace(/<[^>]*>/g, "")).not.toContain(link);
    expect(text).toContain(invitation ? "VERIFY & CONTINUE" : "VERIFY MY ATOM");
    expect(html).toContain(
      invitation ? "YOUR CONNECTION IS WAITING" : "VERIFY YOUR ATOM",
    );
    expect(html).not.toMatch(/<script|<img|onclick|src=|javascript:/i);
    expect(html).toContain('name="viewport"');
  });
  it("escapes attribute metacharacters without rewriting the destination", () => {
    const link = `https://example.invalid/auth/confirm#token_hash=test&opaque="'><img src=x>&amp;`;
    const { html, text } = authEmail(link);
    expect(decode(html.match(/href="([^"]*)"/)![1]!)).toBe(link);
    expect(html).not.toContain("<img");
    expect(text).toContain(link);
  });
});
