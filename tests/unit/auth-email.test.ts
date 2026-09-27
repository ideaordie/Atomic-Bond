import { describe, it, expect, vi } from "vitest";
import { Webhook } from "standardwebhooks";
import {
  accessRequest,
  appOrigin,
  emailLink,
  hookOrigin,
  nextPath,
  registration,
  isAuthTokenHash,
} from "../../src/services/auth/policy";
import { deliverAuthEmail } from "../../src/services/auth/email-hook";
import { ResendNotificationService } from "../../src/services/notifications/resend-notification-service";
const origin = "https://atomic-bond.vercel.app";
const token = "a".repeat(64),
  invite = "b".repeat(64),
  loc = "00000000-0000-0000-0000-000000000001";
describe("passwordless email boundaries", () => {
  it("normalizes email without collapsing provider aliases and validates optional public details", () => {
    expect(
      accessRequest({
        email: " A.B+tag@Example.COM ",
        mode: "access",
        next: "//evil.com",
      }),
    ).toMatchObject({
      email: "a.b+tag@example.com",
      next: "/explore",
      details: null,
    });
    expect(
      registration({ locationId: loc, alias: " Alex ", xHandle: "@alex" }),
    ).toEqual({ locationId: loc, alias: "Alex", xHandle: "alex" });
    expect(registration({ locationId: loc })).not.toHaveProperty("xHandle");
    expect(() =>
      registration({ locationId: loc, xHandle: "https://x.com/alex" }),
    ).toThrow();
    expect(() => registration({ locationId: "arbitrary" })).toThrow();
  });
  it.each([
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/auth/confirm?next=//evil.test",
    "/bond/short",
    "/explore?token=secret",
  ])("rejects unsafe next destination %s", (value) =>
    expect(nextPath(value)).toBe("/explore"),
  );
  it("preserves only valid invitation continuation and puts auth hash in fragment", () => {
    const url = new URL(
      emailLink(
        origin,
        token,
        `${origin}/auth/confirm?next=${encodeURIComponent(`/bond/${invite}`)}`,
      ),
    );
    expect(url.search).toBe("");
    expect(url.hash).toContain(token);
    expect(url.hash).toContain(invite);
    expect(() =>
      emailLink(origin, token, "https://evil.test/auth/confirm"),
    ).toThrow();
  });
  it("requires explicit exact callback origins and local opt-in for production test servers", () => {
    expect(appOrigin({ APP_ORIGIN: origin, NODE_ENV: "production" })).toBe(
      origin,
    );
    expect(() =>
      appOrigin({
        APP_ORIGIN: "http://localhost:3000",
        NODE_ENV: "production",
      }),
    ).toThrow();
    expect(
      hookOrigin(
        {
          APP_ORIGIN: origin,
          AUTH_ALLOWED_ORIGINS: "https://approved-preview.vercel.app",
        },
        "https://approved-preview.vercel.app/auth/confirm",
      ),
    ).toBe("https://approved-preview.vercel.app");
    expect(() =>
      hookOrigin(
        { APP_ORIGIN: origin },
        "https://attacker.vercel.app/auth/confirm",
      ),
    ).toThrow();
  });
  it.each(["", "pkce_"])(
    "only delivers valid signed Auth hashes with prefix %s",
    async (prefix) => {
      const secret = Buffer.from(
        "test-only-signing-key-32-bytes-long",
      ).toString("base64");
      const webhook = new Webhook(secret),
        send = vi.fn(async () => {});
      const service = new ResendNotificationService(
        { send },
        "Atomic Bond <connect@atomicbond.ideaordie.com>",
      );
      const payload = JSON.stringify({
        user: { email: "test@example.invalid" },
        email_data: {
          token_hash: prefix + token,
          email_action_type: "magiclink",
          redirect_to: `${origin}/auth/confirm`,
        },
      });
      const now = new Date(),
        id = "test-hook-id";
      const headers = {
        "webhook-id": id,
        "webhook-timestamp": String(Math.floor(now.getTime() / 1000)),
        "webhook-signature": webhook.sign(id, now, payload),
      };
      await deliverAuthEmail(payload, headers, secret, origin, service);
      expect(send).toHaveBeenCalledOnce();
      expect(send.mock.calls[0]).toHaveLength(2);
      await expect(
        deliverAuthEmail(payload + " ", headers, secret, origin, service),
      ).rejects.toThrow();
      const old = new Date(now.getTime() - 600000);
      await expect(
        deliverAuthEmail(
          payload,
          {
            ...headers,
            "webhook-timestamp": String(Math.floor(old.getTime() / 1000)),
            "webhook-signature": webhook.sign(id, old, payload),
          },
          secret,
          origin,
          service,
        ),
      ).rejects.toThrow();
      expect(send).toHaveBeenCalledOnce();
    },
  );
  it("preserves supported Auth hash prefixes and rejects malformed tokens", () => {
    for (const value of [token, `pkce_${token}`]) {
      expect(isAuthTokenHash(value)).toBe(true);
      const link = new URL(emailLink(origin, value, `${origin}/auth/confirm`));
      expect(new URLSearchParams(link.hash.slice(1)).get("token_hash")).toBe(
        value,
      );
    }
    for (const value of [
      "pkce_",
      "pkce_short",
      `other_${token}`,
      `pkce_pkce_${token}`,
      `${token}\n`,
      `pkce_${token}?next=evil`,
    ]) {
      expect(isAuthTokenHash(value)).toBe(false);
      expect(() =>
        emailLink(origin, value, `${origin}/auth/confirm`),
      ).toThrow();
    }
  });
  it("requires Auth-generated links and respects disabled growth delivery", async () => {
    const send = vi.fn(async () => {}),
      service = new ResendNotificationService({ send }, "sender");
    await expect(
      service.sendMagicAccessLink({
        email: "test@example.invalid",
        verificationStatus: "verified",
        notificationPreferences: {
          transactionalAccess: true,
          growthDigest: "disabled",
        },
      }),
    ).rejects.toThrow();
    await service.sendSummary(
      {
        email: "test@example.invalid",
        enabled: false,
        people: 1,
        cities: 1,
        countries: 1,
        link: origin,
      },
      "summary-test",
    );
    expect(send).not.toHaveBeenCalled();
  });
});
