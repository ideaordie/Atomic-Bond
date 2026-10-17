import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readReceipt,
  requestReceipt,
  verificationReceipt,
  sessionReceipt,
} from "../../src/services/auth/registration-receipt";
import { deliverAuthEmail } from "../../src/services/auth/email-hook";
import { ResendNotificationService } from "../../src/services/notifications/resend-notification-service";
import { Webhook } from "standardwebhooks";
const email = "new@example.invalid",
  user = "synthetic-new-user",
  token = "a".repeat(64),
  invitation = "b".repeat(64);
beforeEach(() => vi.stubEnv("AUTH_CONTINUATION_KEY", "16".repeat(32)));
afterEach(() => vi.unstubAllEnvs());
function flow(now = Date.now()) {
  const request = requestReceipt(email, invitation, now + 86400000, now)!;
  const verification = verificationReceipt(request, email, user, token, now)!;
  return { request, verification, now };
}
describe("isolated new-registration receipt", () => {
  it("separates purposes, preserves absolute deadline and binds actual verified user, OTP and session", () => {
    const { request, verification, now } = flow();
    expect(readReceipt(request, "verification", now)).toBeNull();
    expect(readReceipt(verification, "request", now)).toBeNull();
    const session = sessionReceipt(
      verification,
      email,
      user,
      token,
      "session-one",
      now,
    )!;
    expect(readReceipt(session, "session", now)).toMatchObject({
      user,
      session: "session-one",
      invitation,
      deadline: now + 86400000,
      expires: now + 86400000,
    });
    expect(readReceipt(session, "session", now + 86400000)).toBeNull();
    expect(readReceipt(session, "session", now)).not.toHaveProperty("attempt");
    expect(request).not.toContain(email);
    expect(verification).not.toContain(invitation);
  });
  it.each(["email", "user", "token"])("rejects substituted %s", (field) => {
    const { verification } = flow();
    expect(
      sessionReceipt(
        verification,
        field === "email" ? "other@example.invalid" : email,
        field === "user" ? "other" : user,
        field === "token" ? "c".repeat(64) : token,
        "session",
      ),
    ).toBeNull();
  });
  it("rejects modified ciphertext and expired verification attempts", () => {
    const { verification, now } = flow();
    const altered =
      (verification[0] === "a" ? "b" : "a") + verification.slice(1);
    expect(
      sessionReceipt(altered, email, user, token, "session", now),
    ).toBeNull();
    expect(
      sessionReceipt(
        verification,
        email,
        user,
        token,
        "session",
        now + 3600000,
      ),
    ).toBeNull();
    expect(
      verificationReceipt(flow().request, "other@example.invalid", user, token),
    ).toBeNull();
  });
  it("fails optional context closed when key is missing or rotated without startup failure", () => {
    const { verification } = flow();
    vi.stubEnv("AUTH_CONTINUATION_KEY", "");
    expect(requestReceipt(email, invitation, Date.now() + 10000)).toBeNull();
    expect(readReceipt(verification, "verification")).toBeNull();
    vi.stubEnv("AUTH_CONTINUATION_KEY", "17".repeat(32));
    expect(readReceipt(verification, "verification")).toBeNull();
  });
  it.each([
    ["signup", true],
    ["magiclink", true],
    ["signup", false],
  ] as const)(
    "real signed %s email (marked=%s) preserves normal credential; only marked signup carries receipt",
    async (kind, marked) => {
      const request = flow().request;
      const secret = Buffer.from("synthetic-hook-only").toString("base64");
      const hook = new Webhook(secret),
        now = new Date(),
        id = "receipt-hook";
      const payload = JSON.stringify({
        user: {
          id: user,
          email,
          user_metadata: { atomic_bond_registration_receipt: request },
        },
        email_data: {
          token_hash: token,
          email_action_type: kind,
          redirect_to: `https://example.invalid/auth/confirm?next=%2Fexplore${marked ? "&registration_invitation=1" : ""}`,
        },
      });
      const send = vi.fn();
      await deliverAuthEmail(
        payload,
        {
          "webhook-id": id,
          "webhook-timestamp": String(Math.floor(+now / 1000)),
          "webhook-signature": hook.sign(id, now, payload),
        },
        secret,
        "https://example.invalid",
        new ResendNotificationService({ send }, "test@example.invalid"),
      );
      const url = new URL(
        send.mock.calls[0]![0].text.split("\n").find((line: string) =>
          line.startsWith("https:"),
        ),
      );
      expect(url.search).toBe("");
      const fragment = new URLSearchParams(url.hash.slice(1));
      expect(fragment.get("token_hash")).toBe(token);
      expect(url.pathname).toBe(
        kind === "signup" && marked
          ? "/auth/register/confirm"
          : "/auth/confirm",
      );
      expect(fragment.has("receipt")).toBe(kind === "signup" && marked);
      expect(url.href).not.toContain(invitation);
      const message = send.mock.calls[0]![0];
      const htmlDestination = message.html
        .match(/href="([^"]*)"/)[1]
        .replace(/&amp;/g, "&");
      expect(htmlDestination).toBe(url.href);
      expect(message.html).toContain(
        kind === "signup" && marked
          ? "YOUR CONNECTION IS WAITING"
          : "VERIFY YOUR ATOM",
      );
    },
  );
});
