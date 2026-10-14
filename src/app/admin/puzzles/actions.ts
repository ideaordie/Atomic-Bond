"use server";
import { headers } from "next/headers";
import { authClient } from "../../../services/auth/server";
import { appOrigin } from "../../../services/auth/policy";
import { studioInventory } from "../../../services/puzzle/studio";
import { cleanupLegacyPuzzleBatch } from "../../../services/puzzle/owner-cleanup";
import {
  queueInventory,
  manageQueue,
  type QueueCommand,
} from "../../../services/puzzle/queue";
export async function readQueue(offset = 0) {
  try {
    return await queueInventory(await authClient(), offset);
  } catch {
    return null;
  }
}
export async function changeQueue(command: QueueCommand) {
  try {
    if ((await headers()).get("origin") !== appOrigin(process.env))
      throw Error();
    await manageQueue(await authClient(), command);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
export async function readStudio(offset = 0) {
  try {
    return await studioInventory(await authClient(), offset);
  } catch {
    return null;
  }
}
export async function scheduleStudio(batch: string, start: string) {
  try {
    if (
      (await headers()).get("origin") !== appOrigin(process.env) ||
      !/^[0-9a-f-]{36}$/i.test(batch) ||
      !Number.isFinite(Date.parse(start))
    )
      throw Error();
    const c = await authClient();
    await studioInventory(c);
    const r = await c.rpc("puzzle_schedule", {
      p_source: batch,
      p_start: start,
    });
    if (r.error) throw Error();
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
export async function cleanupStudio() {
  try {
    if ((await headers()).get("origin") !== appOrigin(process.env))
      throw Error();
    const result = await cleanupLegacyPuzzleBatch(await authClient());
    return { ok: true, removed: result.removed };
  } catch {
    return { ok: false, removed: 0 };
  }
}
