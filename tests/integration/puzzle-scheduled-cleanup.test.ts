import { beforeEach, afterEach, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
// @ts-expect-error shared isolated fixture
import { createPuzzleFixture } from "../helpers/puzzle-fixture.mjs";
let f: Awaited<ReturnType<typeof createPuzzleFixture>>;
beforeEach(async () => {
  f = await createPuzzleFixture(undefined, true);
  for (const file of [
    "supabase/candidates/202610140004_puzzle_controlled_access.sql",
    "supabase/migrations/202610150001_puzzle_database_media.sql",
    "supabase/migrations/202610150003_puzzle_scheduled_cleanup.sql",
  ])
    await f.db.exec(await readFile(file, "utf8"));
  await f.exec("update private.puzzle_access_settings set public_enabled=true");
}, 60000);
afterEach(async () => {
  await f?.db.close();
});
const run = async () =>
  (await f.exec("select private.puzzle_run_cleanup() r")).rows[0].r;
async function batch(age: string, storage = false) {
  const id = randomUUID(),
    asset = randomUUID();
  await f.exec(
    "insert into private.puzzle_batches(id,created_at) values($1,private.puzzle_now()-$2::interval)",
    [id, age],
  );
  await f.exec(
    "insert into private.puzzle_assets(id,batch_id,kind) values($1,$2,'source')",
    [asset, id],
  );
  await f.exec(
    "insert into private.puzzle_media(asset_id,content) values($1,decode('89504e470d0a1a0a00000000','hex'))",
    [asset],
  );
  if (storage)
    await f.exec(
      "insert into storage.objects(bucket_id,name) values('puzzle-originals',$1)",
      [asset + ".png"],
    );
  return id;
}
it("removes abandoned bytes only at 24 hours, preserves fresh/active/future content, and is idempotent", async () => {
  const old = await batch("24 hours"),
    fresh = await batch("23 hours"),
    future = await batch("48 hours");
  await f.exec(
    "insert into private.puzzles(source_key,starts_at,ends_at) values($1,private.puzzle_now()+interval '14 days',private.puzzle_now()+interval '21 days')",
    [future],
  );
  const before = JSON.stringify(
    (await f.exec("select * from private.puzzle_pieces order by id")).rows,
  );
  expect((await run()).removed.batches).toBe(1);
  expect(
    (await f.exec("select id from private.puzzle_batches where id=$1", [old]))
      .rows,
  ).toHaveLength(0);
  expect(
    (
      await f.exec(
        "select id from private.puzzle_batches where id in ($1,$2)",
        [fresh, future],
      )
    ).rows,
  ).toHaveLength(2);
  expect(
    JSON.stringify(
      (await f.exec("select * from private.puzzle_pieces order by id")).rows,
    ),
  ).toBe(before);
  expect((await run()).removed.media).toBe(0);
});
it("retains manifest for Storage API deletion and cannot orphan physical objects", async () => {
  const old = await batch("2 days", true);
  expect((await run()).removed.legacyStorageBatchesQueued).toBe(1);
  expect(
    (
      await f.exec("select retiring from private.puzzle_batches where id=$1", [
        old,
      ])
    ).rows[0].retiring,
  ).toBe(true);
  expect(
    (await f.exec("select count(*)::int n from private.puzzle_media")).rows[0]
      .n,
  ).toBe(0);
  expect((await run()).removed.legacyStorageBatchesQueued).toBe(0);
  await expect(f.rpc(0, "puzzle_cleanup_batch", [old])).rejects.toThrow();
});
it("expires reservations with the existing reveal penalty, preserves place/move, and removes only expired receipts", async () => {
  const q = (await f.call(1, "reveal", { revision: 0 })).puzzle;
  await f.exec(
    "insert into private.puzzle_receipts(atom_id,request_id,fingerprint,result,expires_at) select atom_id,$1,'test','{}',private.puzzle_now()+interval '1 day' from private.puzzle_reservations where piece_id=$2",
    [randomUUID(), q.reservation.piece],
  );
  const before = (
    await f.exec("select place_after,move_after from private.puzzle_allowances")
  ).rows;
  expect((await run()).removed.reservations).toBe(0);
  await f.advance(5);
  const r = await run();
  expect(r.ok).toBe(true);
  expect(r.removed.reservations).toBe(1);
  expect(
    (
      await f.exec(
        "select place_after,move_after from private.puzzle_allowances",
      )
    ).rows,
  ).toEqual(before);
  expect(
    (await f.exec("select count(*)::int n from private.puzzle_receipts"))
      .rows[0].n,
  ).toBeGreaterThan(0);
  expect((await f.call(1, "reveal", { revision: q.revision })).error).toBe(
    "COOLDOWN",
  );
});
it("rolls back partial failure, records only SQLSTATE, retries safely, and denies participant execution", async () => {
  const old = await batch("2 days");
  await f.db.exec(
    "create function private.cleanup_test_failure() returns trigger language plpgsql as $$begin raise exception 'private diagnostic';end$$;create trigger cleanup_test_failure before delete on private.puzzle_media for each row execute function private.cleanup_test_failure();",
  );
  expect(await run()).toEqual({ ok: false, code: "P0001" });
  expect(
    (
      await f.exec("select retiring from private.puzzle_batches where id=$1", [
        old,
      ])
    ).rows[0].retiring,
  ).toBe(false);
  await f.db.exec("drop trigger cleanup_test_failure on private.puzzle_media");
  expect((await run()).ok).toBe(true);
  const h = (await f.exec("select * from private.puzzle_cleanup_health"))
    .rows[0];
  expect(h.failed_runs).toBe(1);
  expect(h.successful_runs).toBe(1);
  expect(h.last_error_code).toBe("P0001");
  await expect(
    f.db.transaction(
      async (tx: { exec: (sql: string) => Promise<unknown> }) => {
        await tx.exec("set local role authenticated");
        await tx.exec("select private.puzzle_run_cleanup()");
      },
    ),
  ).rejects.toThrow();
});
it("bounds batches and removes closed media only after the complete 30 day retention", async () => {
  for (let i = 0; i < 27; i++) await batch("2 days");
  const r = await run();
  expect(r.removed.batches).toBe(25);
  expect((await run()).removed.batches).toBe(2);
  const id = await batch("40 days");
  await f.exec(
    "insert into private.puzzles(source_key,starts_at,ends_at) values($1,private.puzzle_now()-interval '37 days'+interval '1 second',private.puzzle_now()-interval '30 days'+interval '1 second')",
    [id],
  );
  expect((await run()).removed.batches).toBe(0);
  await f.advance(1);
  expect((await run()).removed.batches).toBe(1);
});
