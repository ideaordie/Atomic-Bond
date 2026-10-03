import { describe, it, expect, vi } from "vitest";
import { growthEmail, growthDelta } from "../../src/services/growth/email";
import {
  runGrowth,
  schedulerAuthorized,
  type GrowthRunOptions,
} from "../../src/services/growth/scheduler";
import type {
  GrowthDelivery,
  GrowthStore,
} from "../../src/services/growth/contracts";
import {
  ResendNotificationService,
  EmailDeliveryError,
} from "../../src/services/notifications/resend-notification-service";
const origin = "https://atomicbond.ideaordie.com";
const delivery: GrowthDelivery = {
  id: "fixture-job",
  attemptId: "fixture-claim",
  email: "private@example.com",
  publicId: "3",
  previous: { connectedAtoms: 1, directBonds: 1, regions: 1, countries: 1 },
  current: { connectedAtoms: 3, directBonds: 2, regions: 2, countries: 1 },
  unsubscribeToken: "a".repeat(64),
};
function fixture() {
  const store: GrowthStore = {
    scan: vi
      .fn()
      .mockResolvedValue([{ public_id: "3", eligibility: "eligible" }]),
    evaluate: vi.fn().mockResolvedValue({ outcome: "would_send" }),
    reserve: vi.fn().mockResolvedValue(delivery.id),
    claim: vi.fn().mockResolvedValue(delivery),
    authorize: vi.fn().mockResolvedValue(true),
    finish: vi.fn().mockResolvedValue(true),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
  const transport = { send: vi.fn().mockResolvedValue(undefined) };
  return {
    store,
    transport,
    sender: new ResendNotificationService(
      transport,
      "Atomic Bond <connect@atomicbond.ideaordie.com>",
    ),
  };
}
const options: GrowthRunOptions = {
  origin,
  dryRun: false,
  enabled: true,
  batchSize: 5,
  maxBatches: 3,
  sendCap: 2,
  intervalMs: 1000,
  maxDurationMs: 10000,
};
describe("weekly growth service", () => {
  it("stops a run after provider rate limiting without repeatedly retrying", async () => {
    const { store, transport, sender } = fixture();
    vi.mocked(store.scan).mockResolvedValue([
      { public_id: "3", eligibility: "eligible" },
      { public_id: "4", eligibility: "eligible" },
    ]);
    transport.send.mockRejectedValue(new EmailDeliveryError(429));
    const result = await runGrowth(store, sender, options, async () => {});
    expect(result.rateLimited).toBe(true);
    expect(transport.send).toHaveBeenCalledTimes(1);
    expect(result.nextCursor).toBe("0");
  });
  it("renders truthful nonzero aggregate growth and keeps email out of content", () => {
    const message = growthEmail(delivery, origin);
    expect(message.text).toContain("+2 connected Atoms");
    expect(message.text).not.toContain("+0");
    expect(message.text).not.toContain(delivery.email);
    expect(message.html).not.toContain(delivery.email);
    expect(message.text).toContain(`${origin}/return`);
    expect(message.html).toContain(`${origin}/unsubscribe#`);
    expect(message.html).not.toContain("vercel.app");
    expect(message.html).not.toContain("Email preferences");
    expect(message.text).not.toContain("Email preferences");
    expect(message.html).not.toContain(`${origin}/owner`);
    expect(message.text).toContain(`${origin}/unsubscribe#`);
    expect(message.text).not.toContain("cities");
    expect(() =>
      growthEmail({ ...delivery, current: delivery.previous }, origin),
    ).toThrow("No meaningful growth");
    expect(() =>
      growthDelta(delivery.previous, { ...delivery.current, regions: -1 }),
    ).toThrow();
    expect(() =>
      growthEmail({ ...delivery, publicId: "<script>" }, origin),
    ).toThrow();
  });
  it("authenticates scheduler requests without prefix or missing-secret bypass", () => {
    expect(schedulerAuthorized(null, "a".repeat(32))).toBe(false);
    expect(schedulerAuthorized("Bearer bad", "a".repeat(32))).toBe(false);
    expect(schedulerAuthorized("Bearer ", undefined)).toBe(false);
    expect(
      schedulerAuthorized(`Bearer ${"a".repeat(32)}`, "a".repeat(32)),
    ).toBe(true);
  });
  it.each([
    { dryRun: true, enabled: true },
    { dryRun: false, enabled: false },
  ])(
    "never sends in dry mode or with kill switch disabled %j",
    async (config) => {
      const { store, transport, sender } = fixture();
      const r = await runGrowth(
        store,
        sender,
        { ...options, ...config },
        async () => {},
      );
      expect(r.wouldSend).toBe(1);
      expect(store.evaluate).toHaveBeenCalledWith("3", false);
      expect(store.reserve).not.toHaveBeenCalled();
      expect(transport.send).not.toHaveBeenCalled();
    },
  );
  it.each([
    "baseline",
    "no_growth",
    "disabled",
    "ineligible",
    "already_sent",
    "blocked",
  ])("does not send for %s", async (outcome) => {
    const { store, transport, sender } = fixture();
    vi.mocked(store.evaluate).mockResolvedValue({
      outcome: outcome as Awaited<
        ReturnType<GrowthStore["evaluate"]>
      >["outcome"],
    });
    await runGrowth(store, sender, options, async () => {});
    expect(transport.send).not.toHaveBeenCalled();
  });
  it("binds payload before sending and records acceptance afterward", async () => {
    const { store, transport, sender } = fixture();
    const r = await runGrowth(store, sender, options, async () => {});
    expect(r.accepted).toBe(1);
    expect(store.authorize).toHaveBeenCalledWith(
      delivery.id,
      delivery.attemptId,
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: delivery.email, html: expect.any(String) }),
      `growth/${delivery.id}`,
    );
    expect(store.finish).toHaveBeenCalledWith(
      delivery.id,
      delivery.attemptId,
      true,
    );
    expect(vi.mocked(store.authorize).mock.invocationCallOrder[0]).toBeLessThan(
      transport.send.mock.invocationCallOrder[0]!,
    );
    expect(transport.send.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(store.finish).mock.invocationCallOrder[0]!,
    );
  });
  it("records failures without marking sent, continues safely, and limits deliveries", async () => {
    const { store, transport, sender } = fixture();
    vi.mocked(store.scan).mockResolvedValue([
      { public_id: "3", eligibility: "eligible" },
      { public_id: "4", eligibility: "eligible" },
      { public_id: "5", eligibility: "eligible" },
    ]);
    transport.send.mockRejectedValueOnce(
      new Error("private provider body must not escape"),
    );
    const r = await runGrowth(store, sender, options, async () => {});
    expect(r.failed).toBe(1);
    expect(r.accepted).toBe(1);
    expect(r.safetyCap).toBe(true);
    expect(r.nextCursor).toBe("4");
    expect(store.finish).toHaveBeenCalledWith(
      delivery.id,
      delivery.attemptId,
      false,
    );
    expect(JSON.stringify(r)).not.toContain("private");
    expect(JSON.stringify(r)).not.toContain(delivery.email);
  });
  it("paginates stably with bounded pages and no skips", async () => {
    const { store, sender } = fixture();
    vi.mocked(store.scan)
      .mockResolvedValueOnce([
        { public_id: "1", eligibility: "eligible" },
        { public_id: "2", eligibility: "eligible" },
      ])
      .mockResolvedValueOnce([{ public_id: "3", eligibility: "eligible" }]);
    const r = await runGrowth(
      store,
      sender,
      { ...options, dryRun: true, batchSize: 2 },
      async () => {},
    );
    expect(r.evaluated).toBe(3);
    expect(store.scan).toHaveBeenNthCalledWith(2, "2", 2);
    expect(r.more).toBe(false);
  });
});
