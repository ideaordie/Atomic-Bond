import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  invitationIntent,
  sealAccess,
  readAccess,
  verifyProductionContinuationConfiguration,
  bindInvitation,
  readInvitation,
  matchesContinuation,
  continuationId,
} from "../../src/services/auth/invitation-continuation";
import { deliverAuthEmail } from "../../src/services/auth/email-hook";
import { ResendNotificationService } from "../../src/services/notifications/resend-notification-service";
import { Webhook } from "standardwebhooks";
const now = Date.now(),
  email = "owner@example.invalid",
  userId = "00000000-0000-4000-8000-000000000001";
const next = `/bond/${"b".repeat(64)}`,
  token = `pkce_${"a".repeat(64)}`;
const intent = () =>
  invitationIntent(email, next, new Date(now + 86400000).toISOString(), now);
beforeEach(() => vi.stubEnv("AUTH_CONTINUATION_KEY", "16".repeat(32)));
afterEach(() => vi.unstubAllEnvs());
describe("sealed invitation authentication", () => {
  it("fails closed for missing or malformed production configuration without revealing its value", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(verifyProductionContinuationConfiguration()).toBe(true);
    vi.stubEnv("AUTH_CONTINUATION_KEY", "");
    expect(() => verifyProductionContinuationConfiguration()).toThrow(
      "Continuation unavailable",
    );
    vi.stubEnv("AUTH_CONTINUATION_KEY", "invalid");
    expect(() => verifyProductionContinuationConfiguration()).toThrow(
      "Continuation unavailable",
    );
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(verifyProductionContinuationConfiguration()).toBe(false);
  });

  it("binds the private destination, identity and exact Auth token without plaintext leakage", () => {
    const request = intent();
    const sealed = bindInvitation(request, email, userId, token, now);
    expect(sealed).not.toContain(email);
    expect(sealed).not.toContain(next);
    expect(sealed).not.toContain(token);
    const data = readInvitation(sealed, now);
    expect(data).toMatchObject({
      email,
      userId,
      token,
      next,
      exp: now + 3600000,
    });
    expect(matchesContinuation(data, { id: userId, email })).toBe(true);
    expect(
      matchesContinuation(data, { id: userId, email: "other@example.invalid" }),
    ).toBe(false);
    expect(matchesContinuation(data, { id: "other", email })).toBe(false);
    expect(continuationId(sealed)).toMatch(/^[a-f0-9]{32}$/);
  });
  it("rejects substitution, a different purpose, and the wrong recipient", () => {
    const request = intent();
    expect(() => readInvitation(request, now)).toThrow();
    expect(() =>
      bindInvitation(request, "other@example.invalid", userId, token, now),
    ).toThrow();
    const sealed = bindInvitation(request, email, userId, token, now);
    const corrupted = (sealed[0] === "A" ? "B" : "A") + sealed.slice(1);
    expect(() => readInvitation(corrupted, now)).toThrow();
    expect(() => bindInvitation(sealed, email, userId, token, now)).toThrow();
  });
  it("expires exclusively at the earlier invitation/auth deadline", () => {
    const request = invitationIntent(
      email,
      next,
      new Date(now + 1000).toISOString(),
      now,
    );
    const sealed = bindInvitation(request, email, userId, token, now);
    expect(readInvitation(sealed, now + 999).next).toBe(next);
    expect(() => readInvitation(sealed, now + 1000)).toThrow();
    expect(() =>
      invitationIntent(email, next, new Date(now).toISOString(), now),
    ).toThrow();
    expect(() =>
      invitationIntent(
        email,
        "https://evil.example",
        new Date(now + 1000).toISOString(),
        now,
      ),
    ).toThrow();
  });
  it("keeps concurrent requests separate and fails closed after key rotation", () => {
    const a = bindInvitation(intent(), email, userId, token, now);
    const b = bindInvitation(intent(), email, userId, token, now);
    expect(continuationId(a)).not.toBe(continuationId(b));
    vi.stubEnv("AUTH_CONTINUATION_KEY", "17".repeat(32));
    expect(() => readInvitation(a, now)).toThrow();
    vi.stubEnv("AUTH_CONTINUATION_KEY", "");
    expect(() => intent()).toThrow();
  });
  it("uses the signed real email hook to bind the continuation and rejects tampering", async () => {
    const origin = "https://atomicbond.ideaordie.com";
    const secret = Buffer.from("synthetic-hook-secret-for-tests-only").toString(
      "base64",
    );
    const hook = new Webhook(secret);
    const body = JSON.stringify({
      user: { id: userId, email },
      email_data: {
        token_hash: token,
        email_action_type: "magiclink",
        redirect_to: `${origin}/auth/confirm?next=c1.${intent()}`,
      },
    });
    const date = new Date(),
      id = "test-continuation-hook";
    const headers = {
      "webhook-id": id,
      "webhook-timestamp": String(Math.floor(date.getTime() / 1000)),
      "webhook-signature": hook.sign(id, date, body),
    };
    const send = vi.fn(async (message: { text: string }) => {
      void message;
    });
    const service = new ResendNotificationService(
      { send },
      "test@example.invalid",
    );
    await deliverAuthEmail(body, headers, secret, origin, service);
    const url = new URL(
      send.mock.calls[0]![0].text.split("\n").find((line) =>
        line.startsWith("https://"),
      )!,
    );
    expect(url.search).toBe("");
    const fragment = new URLSearchParams(url.hash.slice(1));
    expect(fragment.has("token_hash")).toBe(false);
    expect(readAccess(fragment.get("access")!).token).toBe(token);
    expect(readInvitation(fragment.get("continuation")!)).toMatchObject({
      next,
      userId,
      token,
    });
    await expect(
      deliverAuthEmail(body + " ", headers, secret, origin, service),
    ).rejects.toThrow();
    const invalidContext = JSON.parse(body);
    invalidContext.email_data.redirect_to = `${origin}/auth/confirm?next=c1.invalid`;
    const fallbackBody = JSON.stringify(invalidContext);
    await deliverAuthEmail(
      fallbackBody,
      { ...headers, "webhook-signature": hook.sign(id, date, fallbackBody) },
      secret,
      origin,
      service,
    );
    const fallback = new URL(
      send.mock.calls[1]![0].text.split("\n").find((line) =>
        line.startsWith("https://"),
      )!,
    );
    const fallbackFragment = new URLSearchParams(fallback.hash.slice(1));
    expect(readAccess(fallbackFragment.get("access")!).token).toBe(token);
    expect(fallbackFragment.has("continuation")).toBe(false);
    expect(readAccess(fallbackFragment.get("access")!).next).toBe("/explore");
  });
});

it("stages authentication independently of damaged optional context with bounded encrypted storage", () => {
  const value = sealAccess(token, "https://invalid.example", "damaged", now);
  expect(value).not.toContain(token);
  expect(readAccess(value, now)).toMatchObject({
    token,
    next: "/explore",
    continuation: "damaged",
  });
  expect(() => readAccess(value, now + 3600000)).toThrow();
  expect(() => readInvitation(value, now)).toThrow();
  expect(() =>
    readAccess(bindInvitation(intent(), email, userId, token, now), now),
  ).toThrow();
  expect(() =>
    readAccess((value[0] === "A" ? "B" : "A") + value.slice(1), now),
  ).toThrow();
});
