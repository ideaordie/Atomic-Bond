import { describe, expect, it, vi } from "vitest";
import { createNetworkReconciler } from "../../src/services/pulses/network-reconciliation";
import { blendEmotionPaints } from "../../src/living-atom/animation/emotion-transition";

describe("authorized network reconciliation scheduling", () => {
  it("separates Pulse and topology refreshes and suspends background/offline requests", async () => {
    let time = 0,
      visible = true,
      invitation = false;
    const refresh = vi.fn(async () => {});
    const r = createNetworkReconciler({
      clock: () => time,
      visible: () => visible,
      invitationPending: () => invitation,
      refresh,
    });
    time = 29999;
    await r.tick();
    expect(refresh).not.toHaveBeenCalled();
    time = 30000;
    await r.tick();
    expect(refresh).toHaveBeenLastCalledWith(false);
    time = 60000;
    await r.tick();
    expect(refresh).toHaveBeenLastCalledWith(true);
    visible = false;
    time = 120000;
    await r.tick();
    expect(refresh).toHaveBeenCalledTimes(2);
    visible = true;
    await r.tick(true);
    expect(refresh).toHaveBeenLastCalledWith(true);
    await r.tick(true);
    expect(refresh).toHaveBeenCalledTimes(3);
    invitation = true;
    time += 10000;
    await r.tick();
    expect(refresh).toHaveBeenLastCalledWith(true);
    r.dispose();
    time += 60000;
    await r.tick(true);
    expect(refresh).toHaveBeenCalledTimes(4);
  });
  it("coalesces overlapping events and bounds failed-request retries", async () => {
    let time = 0,
      finish: () => void = () => {};
    const refresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const r = createNetworkReconciler({
      clock: () => time,
      visible: () => true,
      invitationPending: () => false,
      refresh,
    });
    const pending = r.tick(true);
    time = 60000;
    await r.tick(true);
    expect(refresh).toHaveBeenCalledTimes(1);
    finish();
    await pending;
    refresh.mockImplementationOnce(async () => {
      throw Error("unavailable");
    });
    await expect(r.tick()).rejects.toThrow("unavailable");
    time += 1000;
    await r.tick();
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
it("crossfades material without changing labels/counts and settles to the exact target", () => {
  const old = new Map([["atom", { colors: ["#000000"], activeCount: 0 }]]);
  const next = new Map([
    ["atom", { colors: ["#ffffff"], activeCount: 1, label: "Joy" }],
  ]);
  expect(blendEmotionPaints(old, next, 0.5).get("atom")).toEqual({
    colors: ["#808080"],
    activeCount: 1,
    label: "Joy",
  });
  expect(blendEmotionPaints(old, next, 1)).toBe(next);
});

it("retains a resume request suppressed by the burst guard", async () => {
  let now = 0;
  const refresh = vi.fn(async () => {});
  const r = createNetworkReconciler({
    clock: () => now,
    visible: () => true,
    invitationPending: () => false,
    refresh,
  });
  await r.tick(true);
  now = 1000;
  await r.tick(true);
  expect(refresh).toHaveBeenCalledTimes(1);
  now = 5000;
  await r.tick();
  expect(refresh).toHaveBeenCalledTimes(2);
  expect(refresh).toHaveBeenLastCalledWith(true);
});
