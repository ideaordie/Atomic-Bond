import { createHash, timingSafeEqual } from "node:crypto";
import { EmailDeliveryError } from "../notifications/resend-notification-service";
import type { GrowthDelivery, GrowthStore } from "./contracts";
export interface GrowthSender {
  growthMessage(delivery: GrowthDelivery, origin: string): unknown;
  sendGrowthDigest(delivery: GrowthDelivery, origin: string): Promise<void>;
}
export function schedulerAuthorized(
  header: string | null,
  secret: string | undefined,
) {
  if (!secret || secret.length < 32 || !header) return false;
  const a = Buffer.from(header),
    b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
export interface GrowthRunOptions {
  dryRun: boolean;
  enabled: boolean;
  origin: string;
  after?: string;
  onlyAtom?: string | undefined;
  batchSize: number;
  maxBatches: number;
  sendCap: number;
  intervalMs: number;
  maxDurationMs: number;
}
/** Sequential and bounded. Private payloads/errors never become operational output. */
export async function runGrowth(
  store: GrowthStore,
  sender: GrowthSender,
  options: GrowthRunOptions,
  wait: (ms: number) => Promise<void> = (ms) =>
    new Promise((r) => setTimeout(r, ms)),
  clock = Date.now,
) {
  if (
    !Number.isInteger(options.batchSize) ||
    options.batchSize < 1 ||
    options.batchSize > 100 ||
    !Number.isInteger(options.maxBatches) ||
    options.maxBatches < 1 ||
    options.maxBatches > 10 ||
    !Number.isInteger(options.sendCap) ||
    options.sendCap < 0 ||
    options.sendCap > 100 ||
    options.intervalMs < 1000 ||
    options.maxDurationMs < 1000 ||
    options.maxDurationMs > 240000 ||
    !/^(0|[1-9][0-9]*)$/.test(options.after || "0") ||
    (options.onlyAtom && !/^[1-9][0-9]*$/.test(options.onlyAtom))
  )
    throw new Error("Invalid growth run configuration");
  const result = {
    evaluated: 0,
    eligible: 0,
    wouldSend: 0,
    noGrowth: 0,
    baseline: 0,
    disabled: 0,
    ineligible: 0,
    alreadySent: 0,
    blocked: 0,
    attempted: 0,
    accepted: 0,
    failed: 0,
    safetyCap: false,
    timeLimit: false,
    nextCursor: options.after || "0",
    more: false,
    dryRun: options.dryRun || !options.enabled,
    rateLimited: false,
  };
  const start = clock();
  const real = !result.dryRun;
  for (let batch = 0; batch < options.maxBatches; batch++) {
    const rows = options.onlyAtom
      ? [{ public_id: options.onlyAtom, eligibility: "unknown" }]
      : await store.scan(result.nextCursor, options.batchSize);
    result.more = rows.length === options.batchSize && !options.onlyAtom;
    for (const row of rows) {
      if (clock() - start >= options.maxDurationMs) {
        result.timeLimit = true;
        result.more = true;
        return result;
      }
      if (real && result.attempted >= options.sendCap) {
        result.safetyCap = true;
        result.more = true;
        return result;
      }
      let delivery: GrowthDelivery | null = null;
      try {
        const { outcome } = await store.evaluate(row.public_id, real);
        result.evaluated++;
        if (outcome === "disabled") result.disabled++;
        else if (outcome === "ineligible") result.ineligible++;
        else {
          result.eligible++;
          if (outcome === "baseline") result.baseline++;
          if (outcome === "no_growth") result.noGrowth++;
          if (outcome === "already_sent") result.alreadySent++;
          if (outcome === "blocked") result.blocked++;
          if (outcome === "would_send") {
            result.wouldSend++;
            if (real) {
              const job = await store.reserve(row.public_id);
              delivery = job ? await store.claim(job) : null;
              if (delivery) {
                const hash = createHash("sha256")
                  .update(
                    JSON.stringify(
                      sender.growthMessage(delivery, options.origin),
                    ),
                  )
                  .digest("hex");
                if (
                  await store.authorize(delivery.id, delivery.attemptId, hash)
                ) {
                  result.attempted++;
                  await sender.sendGrowthDigest(delivery, options.origin);
                  // Provider acceptance is not inbox delivery. If persistence fails,
                  // retry remains bound to the same immutable provider key/payload.
                  if (
                    !(await store.finish(delivery.id, delivery.attemptId, true))
                  )
                    throw new Error("Acceptance recording unavailable");
                  result.accepted++;
                  delivery = null;
                  await wait(options.intervalMs);
                } else result.blocked++;
              }
            }
          }
        }
      } catch (error) {
        result.failed++;
        if (delivery) {
          try {
            await store.finish(delivery.id, delivery.attemptId, false);
          } catch {
            /* Lease expires; payload/key remains durable. */
          }
          await wait(options.intervalMs);
        }
        if (error instanceof EmailDeliveryError && error.status === 429) {
          result.rateLimited = true;
          result.more = true;
          return result;
        }
      }
      result.nextCursor = row.public_id;
    }
    if (!result.more || options.onlyAtom) break;
  }
  return result;
}
