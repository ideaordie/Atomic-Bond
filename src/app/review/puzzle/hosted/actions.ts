"use server";
import { headers } from "next/headers";
import { authClient } from "../../../../services/auth/server";
import { appOrigin } from "../../../../services/auth/policy";
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
