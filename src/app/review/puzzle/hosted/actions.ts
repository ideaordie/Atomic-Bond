"use server";
import { headers } from "next/headers";
import { authClient } from "../../../../services/auth/server";
import { appOrigin } from "../../../../services/auth/policy";
import { probePuzzleStorage } from "../../../../services/puzzle/storage-probe";
import { checkRateLimit } from "@vercel/firewall";
import {
  observeStorageFetch,
  type StorageObservation,
} from "../../../../services/puzzle/storage-observation";
export async function checkControlledCleanup() {
  try {
    if (
      process.env.PARTICI_PUZZLE_CONTROLLED_ACCESS !== "true" ||
      (await headers()).get("origin") !== appOrigin(process.env)
    )
      throw Error();
    const c = await authClient();
    const { data, error } = await c.rpc("puzzle_cleanup_batch");
    if (error || !Array.isArray(data?.assets)) throw Error();
    return { ok: true, eligibleObjects: data.assets.length };
  } catch {
    return { ok: false, eligibleObjects: 0 };
  }
}
export async function checkControlledStorage(bucket: string, name: string) {
  const requestHeaders = await headers();
  if (
    process.env.PARTICI_PUZZLE_CONTROLLED_ACCESS !== "true" ||
    requestHeaders.get("origin") !== appOrigin(process.env)
  )
    return { result: "UNAVAILABLE", bytes: 0 };
  if (process.env.VERCEL) {
    const limit = await checkRateLimit("atomic-bond-puzzle", {
      headers: {
        host: new URL(appOrigin(process.env)).host,
        "x-real-ip": requestHeaders.get("x-real-ip") ?? "",
      },
      timeout: 1500,
    }).catch(() => ({ error: "unavailable", rateLimited: false }));
    if (limit.error || limit.rateLimited)
      return { result: "UNAVAILABLE", bytes: 0 };
  }
  const observations: StorageObservation[] = [];
  const original = await probePuzzleStorage(
    await authClient(observeStorageFetch(observations, false)),
    bucket,
    name,
  );
  const freshObservations: StorageObservation[] = [];
  const fresh = await probePuzzleStorage(
    await authClient(observeStorageFetch(freshObservations, true)),
    bucket,
    name,
  );
  return {
    ...original,
    diagnostics: {
      original: observations,
      fresh: { ...fresh, responses: freshObservations },
    },
  };
}
export async function scheduleControlledPuzzle(batch: string, start: string) {
  try {
    if (
      process.env.PARTICI_PUZZLE_CONTROLLED_ACCESS !== "true" ||
      (await headers()).get("origin") !== appOrigin(process.env)
    )
      throw Error();
    if (!/^[0-9a-f-]{36}$/i.test(batch) || !Number.isFinite(Date.parse(start)))
      throw Error();
    const c = await authClient();
    const { data, error } = await c.rpc("puzzle_schedule", {
      p_source: batch,
      p_start: start,
    });
    if (error) throw Error();
    return { ok: true, id: String(data) };
  } catch {
    return { ok: false };
  }
}

export async function copyControlledMedia() {
  try {
    if (
      process.env.PARTICI_PUZZLE_CONTROLLED_ACCESS !== "true" ||
      (await headers()).get("origin") !== appOrigin(process.env)
    )
      throw Error();
    const { copyPuzzleMedia } =
      await import("../../../../services/puzzle/copy-media");
    return { ok: true, ...(await copyPuzzleMedia(await authClient())) };
  } catch {
    return { ok: false, copied: 0, verified: 0, bytes: 0, total: 0 };
  }
}
