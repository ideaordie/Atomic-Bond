import { expect, it } from "vitest";
import manifest from "../../src/app/manifest";
import {
  appOrigin,
  emailLink,
  hookOrigin,
} from "../../src/services/auth/policy";
import { invitationPresentation } from "../../src/services/bonds/qr-invitation";

it("uses the configured permanent origin for PWA, email and Bond destinations", async () => {
  const origin = "https://atomicbond.ideaordie.com";
  const env = { APP_ORIGIN: origin, NODE_ENV: "production" };
  const secret = "a".repeat(64);
  const callback = `${appOrigin(env)}/auth/confirm?next=${encodeURIComponent(`/bond/${secret}`)}`;
  const link = new URL(
    emailLink(hookOrigin(env, callback), "b".repeat(64), callback),
  );
  expect(link.origin).toBe(origin);
  expect(link.pathname).toBe("/auth/confirm");
  expect(new URLSearchParams(link.hash.slice(1)).get("next")).toBe(
    `/bond/${secret}`,
  );
  expect((await invitationPresentation(secret, env)).url).toBe(
    `${origin}/bond/${secret}`,
  );
  for (const path of [manifest().id, manifest().start_url, manifest().scope]) {
    expect(path).toBe("/");
    expect(new URL(path!, origin).origin).toBe(origin);
  }
  expect(() =>
    hookOrigin(env, "https://unapproved.example/auth/confirm"),
  ).toThrow();
});
