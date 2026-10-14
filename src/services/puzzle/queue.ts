import { verifiedPuzzleClient, type PuzzleOwnerClient } from "./owner-media";
export type QueueCommand = {
  action: "add" | "reorder" | "remove" | "retire" | "pause" | "resume";
  revision: number;
  batch?: string;
  puzzle?: string;
  order?: string[];
  reason?: string;
};
export type QueueInventory = {
  now: string;
  settings: { enabled: boolean; paused: boolean; revision: number };
  gates: { public: boolean; controlled: boolean };
  cleanup: {
    lastSuccess: string | null;
    lastFailure: string | null;
    ok: boolean | null;
    counts: Record<string, number>;
  };
  current: null | {
    id: string;
    batch: string;
    state: string;
    completedAt: string | null;
    celebrationEndsAt: string | null;
    placed: number;
    locked: number;
  };
  queue: { id: string; batch: string; ready: boolean; order: number }[];
  total: number;
  batches: { id: string; ready: boolean; expiresAt: string }[];
  history: {
    puzzle: string | null;
    action: string;
    reason: string | null;
    at: string;
  }[];
};
export async function queueInventory(
  client: PuzzleOwnerClient,
  offset = 0,
): Promise<QueueInventory> {
  await verifiedPuzzleClient(client);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000)
    throw Error("Invalid page");
  const r = await client.rpc("puzzle_queue_studio", { p_offset: offset });
  if (r.error || !r.data) throw Error("Administrator access required");
  return r.data as QueueInventory;
}
export async function manageQueue(
  client: PuzzleOwnerClient,
  command: QueueCommand,
) {
  await verifiedPuzzleClient(client);
  if (
    !["add", "reorder", "remove", "retire", "pause", "resume"].includes(
      command.action,
    ) ||
    !Number.isSafeInteger(command.revision)
  )
    throw Error("Invalid command");
  const r = await client.rpc("puzzle_queue_manage", {
    p_action: command.action,
    p_revision: command.revision,
    p_batch: command.batch ?? null,
    p_puzzle: command.puzzle ?? null,
    p_order: command.order ?? null,
    p_reason: command.reason ?? null,
  });
  if (r.error || !r.data) throw Error("Queue changed or operation unavailable");
  return r.data;
}
