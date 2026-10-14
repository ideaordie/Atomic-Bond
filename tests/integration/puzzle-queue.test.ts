import { beforeEach, afterEach, it, expect } from "vitest";
// @ts-expect-error isolated database fixture
import { createQueueFixture } from "../helpers/puzzle-queue-fixture.mjs";
let f: Awaited<ReturnType<typeof createQueueFixture>>;
beforeEach(async () => {
  f = await createQueueFixture();
}, 60000);
afterEach(async () => {
  await f?.db.close();
});
const rows = async (sql: string, args: unknown[] = []) =>
  (await f.exec(sql, args)).rows;
const finish = async () => {
  await f.exec(
    "update private.puzzle_pieces set position=solution,locked=true where puzzle_id=$1",
    [f.puzzle],
  );
  await f.exec(
    "update private.puzzles set completed_at=private.puzzle_now() where id=$1",
    [f.puzzle],
  );
};
it("is inert until explicitly adopted and preserves existing board/cooldowns", async () => {
  expect((await f.rpc(1, "puzzle_request", ["read"])).puzzle.id).toBe(f.puzzle);
  const before = await rows("select * from private.puzzle_pieces order by id");
  await expect(f.manage("add", { batch: await f.batch() })).rejects.toThrow();
  await f.adopt();
  expect(await rows("select * from private.puzzle_pieces order by id")).toEqual(
    before,
  );
  expect((await f.read()).status).toBe("ACTIVE");
  await f.exec("update private.doodle_test_clock set t=t+interval '8 days'");
  expect((await f.read()).status).toBe("ACTIVE");
});
it("orders multiple private puzzles, prevents duplicates and stale reorder, and preserves waiting artwork", async () => {
  await f.adopt();
  const b = await f.batch(),
    c = await f.batch();
  const x = (await f.manage("add", { batch: b })).puzzle,
    y = (await f.manage("add", { batch: c })).puzzle;
  await expect(f.manage("add", { batch: b })).rejects.toThrow();
  await f.manage("reorder", { order: [y, x] });
  await expect(
    f.manage("reorder", { order: [x, y], revision: 0 }),
  ).rejects.toThrow();
  expect(
    (
      await rows(
        "select id from private.puzzles where queue_state='QUEUED' order by queue_order",
      )
    ).map((r: { id: string }) => r.id),
  ).toEqual([y, x]);
  expect((await f.rpc(1, "puzzle_media_get", [x])).error).toBe("TILE_DENIED");
  expect((await f.call(1, "read", { puzzle: x })).error).toBe(
    "PUZZLE_UNAVAILABLE",
  );
  await f.exec("update private.doodle_test_clock set t=t+interval '40 days'");
  await f.exec("select private.puzzle_run_cleanup()");
  expect(
    (await rows("select count(*)::int n from private.puzzle_media")).at(0).n,
  ).toBe(81);
});
it("celebrates for exactly an hour, advances once, preserves allowances, and handles an empty queue", async () => {
  await f.adopt();
  await f.read(1);
  await f.manage("resume");
  const next = (await f.manage("add", { batch: await f.batch() })).puzzle;
  await f.exec(
    "update private.puzzle_allowances set place_after=private.puzzle_now()+interval '2 hours',move_after=private.puzzle_now()+interval '3 hours'",
  );
  const allowances = await rows(
    "select atom_id,place_after,move_after from private.puzzle_allowances order by atom_id",
  );
  await finish();
  expect((await f.read()).status).toBe("CELEBRATING");
  await f.exec(
    "update private.doodle_test_clock set t=t+interval '59 minutes 59 seconds'",
  );
  await f.advance();
  expect((await f.rpc(1, "puzzle_request", ["read"])).puzzle.id).toBe(f.puzzle);
  await f.exec("update private.doodle_test_clock set t=t+interval '1 second'");
  await f.advance();
  await f.advance();
  expect((await f.rpc(1, "puzzle_request", ["read"])).puzzle.id).toBe(next);
  expect(
    await rows(
      "select atom_id,place_after,move_after from private.puzzle_allowances order by atom_id",
    ),
  ).toEqual(allowances);
  expect(
    (
      await rows(
        "select count(*)::int n from private.puzzle_queue_events where puzzle_id=$1 and action='ACTIVE'",
        [next],
      )
    )[0].n,
  ).toBe(1);
  await f.manage("retire", {
    puzzle: next,
    reason: "Disposable stalled puzzle test",
  });
  expect((await f.rpc(1, "puzzle_request", ["read"])).status).toBe("WAITING");
  const last = (await f.manage("add", { batch: await f.batch() })).puzzle;
  expect((await f.rpc(1, "puzzle_request", ["read"])).puzzle.id).toBe(last);
});
it("pause blocks advancement, not active play or celebration expiry, and resume is explicit", async () => {
  await f.adopt();
  const next = (await f.manage("add", { batch: await f.batch() })).puzzle;
  await finish();
  await f.exec("update private.doodle_test_clock set t=t+interval '1 hour'");
  await f.advance();
  expect((await f.rpc(1, "puzzle_request", ["read"])).status).toBe("WAITING");
  expect(
    (
      await rows("select queue_state from private.puzzles where id=$1", [next])
    )[0].queue_state,
  ).toBe("QUEUED");
  await f.manage("resume");
  expect((await f.rpc(1, "puzzle_request", ["read"])).puzzle.id).toBe(next);
});
it("retains completed media through celebration plus thirty days and cleans idempotently", async () => {
  await f.adopt();
  await finish();
  await f.exec(
    "update private.doodle_test_clock set t=t+interval '30 days 59 minutes 59 seconds'",
  );
  await f.exec("delete from storage.objects");
  await f.exec("select private.puzzle_run_cleanup()");
  expect(
    (await rows("select count(*)::int n from private.puzzle_media"))[0].n,
  ).toBe(27);
  await f.exec("update private.doodle_test_clock set t=t+interval '1 second'");
  await f.exec("select private.puzzle_run_cleanup()");
  await f.exec("select private.puzzle_run_cleanup()");
  expect(
    (await rows("select count(*)::int n from private.puzzle_media"))[0].n,
  ).toBe(0);
  expect((await rows("select count(*)::int n from private.puzzles"))[0].n).toBe(
    1,
  );
});
it("rejects ordinary management, direct tables, invalid removal, and incomplete media", async () => {
  await f.adopt();
  const b = await f.batch();
  await expect(f.manage("add", { batch: b, actor: 1 })).rejects.toThrow();
  await expect(f.rpc(1, "puzzle_queue_studio", [0])).rejects.toThrow();
  await expect(
    f.manage("remove", {
      puzzle: f.puzzle,
      reason: "Do not remove active progress",
    }),
  ).rejects.toThrow();
  await expect(
    f.manage("retire", { puzzle: f.puzzle, reason: "no" }),
  ).rejects.toThrow();
  await f.exec(
    "delete from private.puzzle_media where asset_id in(select id from private.puzzle_assets where batch_id=$1 and kind='source')",
    [b],
  );
  await expect(f.manage("add", { batch: b })).rejects.toThrow();
  expect(
    (
      await rows(
        "select has_table_privilege('authenticated','private.puzzle_queue_settings','SELECT') allowed",
      )
    )[0].allowed,
  ).toBe(false);
});
it("preserves owner/session/media boundaries through cancellation and expiry without cleanup", async () => {
  await f.adopt();
  const reveal = await f.call(1, "reveal", { revision: 0 });
  const piece = reveal.puzzle.reservation.piece;
  expect((await f.rpc(1, "puzzle_media_get", [f.puzzle, piece])).bytes).toBe(
    12,
  );
  expect((await f.rpc(2, "puzzle_media_get", [f.puzzle, piece])).error).toBe(
    "TILE_DENIED",
  );
  expect((await f.rpc(1, "puzzle_media_get", [f.puzzle])).error).toBe(
    "TILE_DENIED",
  );
  await f.exec("update private.doodle_test_clock set t=t+interval '5 minutes'");
  expect(
    (await rows("select count(*)::int n from private.puzzle_reservations"))[0]
      .n,
  ).toBe(1);
  expect((await f.rpc(1, "puzzle_media_get", [f.puzzle, piece])).error).toBe(
    "TILE_DENIED",
  );
  await f.exec("update private.doodle_test_clock set t=t+interval '5 minutes'");
  const second = await f.call(1, "reveal", {
    revision: (await f.read(1)).revision,
  });
  await f.call(1, "cancel", { revision: second.puzzle.revision });
  expect(
    (
      await f.rpc(1, "puzzle_media_get", [
        f.puzzle,
        second.puzzle.reservation.piece,
      ])
    ).error,
  ).toBe("TILE_DENIED");
  await f.exec("update public.atoms set status='DEACTIVATED' where id=$1", [
    f.people[1].atom,
  ]);
  await expect(f.rpc(1, "puzzle_request", ["read"])).rejects.toThrow();
  expect(
    (
      await rows(
        "select has_function_privilege('anon','public.puzzle_request(text,uuid,uuid,bigint,uuid,integer)','EXECUTE') allowed",
      )
    )[0].allowed,
  ).toBe(false);
  expect(
    (
      await rows(
        "select has_function_privilege('authenticated','private.puzzle_queue_adopt(uuid,uuid[])','EXECUTE') allowed",
      )
    )[0].allowed,
  ).toBe(false);
});
it("requires explicit adoption of all future windows without changing their IDs or positions", async () => {
  const batch = await f.batch();
  const future = await f.rpc(0, "puzzle_schedule", [
    batch,
    new Date(Date.parse(await f.now()) + 8 * 86400000).toISOString(),
  ]);
  await expect(f.adopt()).rejects.toThrow("Unapproved future window");
  const before = await rows(
    "select id,position,locked from private.puzzle_pieces where puzzle_id=$1 order by id",
    [future],
  );
  await f.exec("select private.puzzle_queue_adopt($1,$2::uuid[])", [
    f.puzzle,
    [future],
  ]);
  expect(
    await rows(
      "select id,position,locked from private.puzzle_pieces where puzzle_id=$1 order by id",
      [future],
    ),
  ).toEqual(before);
  expect(
    (
      await rows("select queue_state from private.puzzles where id=$1", [
        future,
      ])
    )[0].queue_state,
  ).toBe("QUEUED");
  await expect(
    f.rpc(0, "puzzle_schedule", [await f.batch(), await f.now()]),
  ).rejects.toThrow("Use the puzzle queue");
});
