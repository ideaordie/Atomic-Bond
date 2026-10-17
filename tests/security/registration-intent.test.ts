import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: state.cookie }) }),
}));
vi.mock("../../src/services/auth/server", () => ({}));
import { registrationIntent } from "../../src/services/auth/registration-intent";
import {
  requestReceipt,
  verificationReceipt,
  sessionReceipt,
} from "../../src/services/auth/registration-receipt";
afterEach(() => vi.unstubAllEnvs());
it("requires the verified owner and exact authenticated session, not cookie possession alone", async () => {
  vi.stubEnv("AUTH_CONTINUATION_KEY", "16".repeat(32));
  const request = requestReceipt(
    "new@example.invalid",
    "a".repeat(64),
    Date.now() + 60000,
  )!;
  const verified = verificationReceipt(
    request,
    "new@example.invalid",
    "owner",
    "otp",
  )!;
  state.cookie = sessionReceipt(
    verified,
    "new@example.invalid",
    "owner",
    "otp",
    "session",
  )!;
  const getClaims = vi.fn().mockResolvedValue({
    data: { claims: { sub: "owner", session_id: "session" } },
    error: null,
  });
  const context = {
    user: { id: "owner", email_confirmed_at: "verified" },
    client: { auth: { getClaims } },
  } as unknown as Parameters<typeof registrationIntent>[0];
  expect(await registrationIntent(context)).not.toBeNull();
  getClaims.mockResolvedValue({
    data: { claims: { sub: "owner", session_id: "other-session" } },
    error: null,
  });
  expect(await registrationIntent(context)).toBeNull();
  getClaims.mockResolvedValue({
    data: { claims: { sub: "other-owner", session_id: "session" } },
    error: null,
  });
  expect(await registrationIntent(context)).toBeNull();
  expect(await registrationIntent({ ...context, user: null })).toBeNull();
  getClaims.mockResolvedValue({
    data: null,
    error: new Error("invalid session"),
  });
  expect(await registrationIntent(context)).toBeNull();
});
