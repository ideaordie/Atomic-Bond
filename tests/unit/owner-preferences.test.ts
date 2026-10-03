import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  profile: vi.fn(),
  get: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ origin: "https://atomicbond.ideaordie.com" }),
}));
vi.mock("../../src/services/auth/server", () => ({
  requireOwner: async () => ({
    atom: { locationId: "00000000-0000-0000-0000-000000000001" },
    services: {
      atoms: { update: mocks.profile },
      preferences: { get: mocks.get, update: mocks.update },
    },
  }),
}));
import {
  updateOwner,
  updateWeeklyGrowth,
} from "../../src/services/auth/actions";
beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "https://atomicbond.ideaordie.com");
  mocks.get.mockResolvedValue({
    growthDigest: "disabled",
    pulseNotifications: false,
  });
});
it("does not overwrite an unsubscribe with a stale profile form", async () => {
  const form = new FormData();
  form.set("digest", "weekly");
  form.set("alias", "Alex");
  expect(await updateOwner(form)).toHaveProperty("message");
  expect(mocks.profile).toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});
it("allows an intentional owner preference change to re-enable weekly", async () => {
  const form = new FormData();
  form.set("digest", "weekly");
  form.set("digestChanged", "true");
  expect(await updateOwner(form)).toHaveProperty("message");
  expect(mocks.update).toHaveBeenCalledWith("weekly", false);
});
it("immediately updates weekly independently of profile fields", async () => {
  expect(await updateWeeklyGrowth(false)).toEqual({ saved: true });
  expect(mocks.update).toHaveBeenCalledWith("disabled", false);
  expect(mocks.profile).not.toHaveBeenCalled();
});
