"use server";
import { headers } from "next/headers";
import { authClient } from "../../../../services/auth/server";
import { appOrigin } from "../../../../services/auth/policy";
import { probePuzzleStorage } from "../../../../services/puzzle/storage-probe";
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
  if (
    process.env.PARTICI_PUZZLE_CONTROLLED_ACCESS !== "true" ||
    (await headers()).get("origin") !== appOrigin(process.env)
  )
    return { result: "UNAVAILABLE", bytes: 0 };
  return probePuzzleStorage(await authClient(), bucket, name);
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
