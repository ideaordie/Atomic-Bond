import { beforeEach, afterEach, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
// @ts-expect-error isolated shared fixture
import { createPuzzleFixture } from "../helpers/puzzle-fixture.mjs";
let f: Awaited<ReturnType<typeof createPuzzleFixture>>;
beforeEach(async () => {
  f = await createPuzzleFixture();
}, 60000);
afterEach(async () => {
  await f?.db.close();
});
const reveal = async (a = 1) =>
  f.call(a, "reveal", { revision: (await f.read(a)).revision });
const place = async (a = 1, to?: number) => {
  const q = await f.read(a);
  const id = q.reservation.piece;
  return f.call(a, "place", {
    revision: q.revision,
    piece: id,
    to: to ?? (await f.solution(id)),
  });
};
it("reserves uniquely, rejects stale writes, commits placement once and locks correctly", async () => {
  const first = await reveal();
  const second = await reveal(2);
  expect(first.puzzle.reservation.piece).not.toBe(
    second.puzzle.reservation.piece,
  );
  expect(
    (
      await f.call(1, "place", {
        revision: 0,
        piece: first.puzzle.reservation.piece,
        to: 0,
      })
    ).error,
  ).toBe("STALE_BOARD");
  const q = await f.read();
  const options = {
    revision: q.revision,
    piece: q.reservation.piece,
    to: await f.solution(q.reservation.piece),
    request: randomUUID(),
  };
  const placed = await f.call(1, "place", options);
  expect(placed.puzzle.board[0].locked).toBe(true);
  expect(await f.call(1, "place", options)).toEqual(placed);
  expect(
    (await f.call(1, "place", { ...options, to: (options.to + 1) % 25 })).error,
  ).toBe("IDEMPOTENCY_CONFLICT");
  expect((await reveal()).error).toBe("COOLDOWN");
  const account = (
    await f.exec(
      "select place_after,move_after from private.puzzle_allowances where atom_id=$1",
      [f.people[1].atom],
    )
  ).rows[0];
  expect(
    new Date(account.place_after).getTime() - new Date(await f.now()).getTime(),
  ).toBe(3600000);
  expect((await f.call(1, "read")).moveAfter).toBeNull();
});
it("cancel and expiry impose five-minute reveal delay independently of cleanup timing", async () => {
  await reveal();
  let q = await f.read();
  await f.call(1, "cancel", { revision: q.revision });
  expect((await reveal()).error).toBe("COOLDOWN");
  await f.advance(5);
  expect((await reveal()).puzzle.reservation).toBeTruthy();
  await f.advance(5);
  q = await f.read();
  expect(q.reservation).toBeNull();
  expect((await reveal()).error).toBe("COOLDOWN");
  await f.advance(5);
  expect((await reveal()).puzzle.reservation).toBeTruthy();
});
it("moves and swaps both unlocked pieces atomically, without charging failures", async () => {
  const r = await reveal();
  const first = r.puzzle.reservation.piece;
  const pos = await f.solution(first);
  await place(1, (pos + 1) % 25);
  const q = await f.read();
  expect(
    (
      await f.call(1, "move", {
        revision: q.revision,
        piece: first,
        to: (pos + 1) % 25,
      })
    ).error,
  ).toBe("INVALID_MOVE");
  const moved = await f.call(1, "move", {
    revision: q.revision,
    piece: first,
    to: pos,
  });
  expect(moved.puzzle.board[0].locked).toBe(true);
  expect(
    (
      await f.call(2, "move", {
        revision: moved.puzzle.revision,
        piece: first,
        to: (pos + 2) % 25,
      })
    ).error,
  ).toBe("INVALID_MOVE");
  // Isolated arrangement supplies a final two-piece swap; no production data.
  await f.exec(
    "update private.puzzle_pieces set position=case solution when 0 then 1 when 1 then 0 else solution end,locked=(solution>1) where puzzle_id=$1",
    [f.puzzle],
  );
  const x = (
    await f.exec(
      "select id from private.puzzle_pieces where puzzle_id=$1 and solution=0",
      [f.puzzle],
    )
  ).rows[0].id;
  const done = await f.call(2, "move", {
    revision: moved.puzzle.revision,
    piece: x,
    to: 0,
  });
  expect(done.puzzle.status).toBe("COMPLETE");
  expect(
    done.puzzle.board.filter((p: { locked: boolean }) => p.locked),
  ).toHaveLength(25);
  expect((await reveal(3)).error).toBe("PUZZLE_ENDED");
});
it("preserves rolling PLACE/MOVE cooldowns across a scheduled weekly boundary", async () => {
  await f.advance(10070);
  const r = await reveal();
  const id = r.puzzle.reservation.piece;
  const correct = await f.solution(id);
  await place(1, (correct + 1) % 25);
  const q = await f.read();
  await f.call(1, "move", { revision: q.revision, piece: id, to: correct });
  const start = (
    await f.exec("select ends_at from private.puzzles where id=$1", [f.puzzle])
  ).rows[0].ends_at;
  const next = await f.rpc(0, "puzzle_schedule", [randomUUID(), start]);
  await f.advance(10);
  const fresh = await f.read(1, next);
  expect(
    (await f.call(1, "reveal", { puzzle: next, revision: fresh.revision }))
      .error,
  ).toBe("COOLDOWN");
  const read = await f.call(1, "read", { puzzle: next });
  expect(
    new Date(read.placeAfter).getTime() - new Date(read.serverTime).getTime(),
  ).toBe(50 * 60000);
  expect(read.moveAfter).toBe(read.placeAfter);
  await f.advance(50);
  expect(
    (await f.call(1, "reveal", { puzzle: next, revision: 0 })).puzzle
      .reservation,
  ).toBeTruthy();
});
it("rejects ordinary admin, anonymous access, private table reads and overlapping windows", async () => {
  await expect(
    f.rpc(1, "puzzle_schedule", [randomUUID(), await f.now()]),
  ).rejects.toThrow();
  await expect(f.call(-1, "read")).rejects.toThrow();
  await expect(
    f.rpc(0, "puzzle_schedule", [randomUUID(), await f.now()]),
  ).rejects.toThrow("Overlapping");
  await expect(
    f.db.transaction(async (tx: { exec: (s: string) => Promise<unknown> }) => {
      await tx.exec("set local role authenticated");
      await tx.exec("select * from private.puzzle_pieces");
    }),
  ).rejects.toThrow();
  const read = await f.read();
  expect(JSON.stringify(read)).not.toMatch(
    /solution|source_key|auth_user|email|atom_id/,
  );
});
it("enforces private crop tickets, one-use resolution, RLS and full-image withholding", async () => {
  const r = await reveal();
  const id = r.puzzle.reservation.piece;
  expect((await f.call(2, "tile", { piece: id })).error).toBe("TILE_DENIED");
  expect((await f.call(1, "image")).error).toBe("HIDDEN_IMAGE");
  const ticket = (await f.call(1, "tile", { piece: id })).ticket;
  await expect(f.rpc(1, "puzzle_media_resolve", [ticket])).rejects.toThrow();
  const result = await f.media(ticket);
  expect(result.region).toBe(await f.solution(id));
  await expect(f.media(ticket)).rejects.toThrow();
  const other = (await f.call(1, "tile", { piece: id })).ticket;
  await f.advance(1);
  await expect(f.media(other)).rejects.toThrow();
  const source = (
    await f.exec("select source_key from private.puzzles where id=$1", [
      f.puzzle,
    ])
  ).rows[0].source_key;
  await f.exec(
    "insert into storage.objects(bucket_id,name) values('puzzle-sources',$1),('other','private.png')",
    [source + ".png"],
  );
  const rows = await f.db.transaction(
    async (tx: {
      exec: (s: string) => Promise<unknown>;
      query: (s: string) => Promise<{ rows: unknown[] }>;
    }) => {
      await tx.exec("set local role atomic_bond_puzzle_media");
      return (await tx.query("select name from storage.objects")).rows;
    },
  );
  expect(rows).toEqual([{ name: source + ".png" }]);
  await expect(
    f.db.transaction(async (tx: { exec: (s: string) => Promise<unknown> }) => {
      await tx.exec("set local role atomic_bond_puzzle_media");
      await tx.exec("select * from private.atom_identities");
    }),
  ).rejects.toThrow();
});
it("deactivation cancels reservations and tickets, deletion severs private records but preserves board", async () => {
  await reveal();
  await place();
  await reveal(2);
  const q = await f.read(2);
  const ticket = (await f.call(2, "tile", { piece: q.reservation.piece }))
    .ticket;
  await f.rpc(2, "deactivate_my_account");
  await expect(f.call(2, "read")).rejects.toThrow();
  await expect(f.media(ticket)).rejects.toThrow();
  expect((await f.read()).board).toHaveLength(1);
  await f.exec(
    "update public.atoms set status='DELETED',display_name=null,x_handle=null where id=$1",
    [f.people[1].atom],
  );
  expect((await f.read(3)).board).toHaveLength(1);
  expect(
    (
      await f.exec(
        "select count(*)::int n from private.puzzle_allowances where atom_id=$1",
        [f.people[1].atom],
      )
    ).rows[0].n,
  ).toBe(0);
});
it("closes by database time, retains closed images 30 days, and queues bounded deletion without touching active content", async () => {
  await f.advance(10080);
  expect((await f.read()).status).toBe("CLOSED");
  expect((await f.call(1, "image")).error).toBe("HIDDEN_IMAGE");
  await f.advance(30 * 1440 - 1);
  expect((await f.read()).status).toBe("CLOSED");
  await f.exec("select private.puzzle_cleanup(1)");
  expect(
    (await f.exec("select count(*)::int n from private.puzzle_pieces")).rows[0]
      .n,
  ).toBe(25);
  await f.advance(1);
  expect((await f.call(1, "read")).status).toBe("WAITING");
  await f.exec("select private.puzzle_cleanup(1)");
  expect(
    (await f.exec("select count(*)::int n from private.puzzle_pieces")).rows[0]
      .n,
  ).toBe(0);
  expect(
    (await f.exec("select count(*)::int n from private.puzzle_cleanup_queue"))
      .rows[0].n,
  ).toBe(1);
  expect(
    (await f.exec("select count(*)::int n from private.puzzles")).rows[0].n,
  ).toBe(1);
});
