import { beforeEach, afterEach, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
// @ts-expect-error shared isolated database fixture
import { createPuzzleFixture } from "../helpers/puzzle-fixture.mjs";
let f: Awaited<ReturnType<typeof createPuzzleFixture>>;
beforeEach(async () => {
  f = await createPuzzleFixture(undefined, true);
  for (const file of [
    "supabase/candidates/202610140004_puzzle_controlled_access.sql",
    "supabase/migrations/202610150001_puzzle_database_media.sql",
    "supabase/migrations/202610170001_puzzle_launch_boundary.sql",
  ])
    await f.db.exec(await readFile(file, "utf8"));
  await f.exec(
    "insert into private.puzzle_media(asset_id,content) select id,decode('89504e470d0a1a0a00000000','hex') from private.puzzle_assets",
  );
  await f.exec("update private.puzzle_access_settings set public_enabled=true");
}, 60000);
afterEach(async () => {
  await f?.db.close();
});
it("fails closed without an anchor and does not expose historical media", async () => {
  expect((await f.rpc(1, "puzzle_request", ["read"])).status).toBe("WAITING");
  expect((await f.call(1, "reveal")).error).toBe("PUZZLE_UNAVAILABLE");
  expect((await f.rpc(1, "puzzle_media_get", [f.puzzle])).error).toBe(
    "TILE_DENIED",
  );
});
it("waits on database time, rejects all early actions and opens automatically at the exact start", async () => {
  await f.exec("update private.puzzle_launch_settings set first_puzzle=$1", [
    f.puzzle,
  ]);
  await f.exec("update private.doodle_test_clock set t=t-interval '1 second'");
  const waiting = await f.rpc(1, "puzzle_request", ["read"]);
  expect(Object.keys(waiting).sort()).toEqual([
    "firstCommunity",
    "nextStart",
    "serverTime",
    "status",
  ]);
  expect(waiting.firstCommunity).toBe(true);
  for (const op of ["read", "reveal", "place", "move", "cancel"])
    expect((await f.call(1, op)).error).toBe("PUZZLE_UNAVAILABLE");
  expect((await f.rpc(1, "puzzle_media_get", [f.puzzle])).error).toBe(
    "TILE_DENIED",
  );
  await f.exec("update private.doodle_test_clock set t=t+interval '1 second'");
  expect((await f.rpc(1, "puzzle_request", ["read"])).puzzle.id).toBe(f.puzzle);
  const result = await f.call(1, "reveal", { revision: 0 });
  expect(result.error).toBeUndefined();
  const reservation = (await f.read(1)).reservation;
  expect(
    (await f.rpc(1, "puzzle_media_get", [f.puzzle, reservation.piece])).bytes,
  ).toBe(12);
  expect(
    (await f.rpc(2, "puzzle_media_get", [f.puzzle, reservation.piece])).error,
  ).toBe("TILE_DENIED");
  expect(
    (await f.call(1, "cancel", { revision: (await f.read(1)).revision })).error,
  ).toBeUndefined();
  expect(
    (await f.rpc(1, "puzzle_media_get", [f.puzzle, reservation.piece])).error,
  ).toBe("TILE_DENIED");
});
it("excludes an earlier live test window without deleting it or changing cooldowns", async () => {
  await f.exec(
    "insert into private.puzzles(source_key,starts_at,ends_at) values(gen_random_uuid(),private.puzzle_now()+interval '7 days',private.puzzle_now()+interval '14 days')",
  );
  await f.exec(
    "update private.puzzle_launch_settings set first_puzzle=(select id from private.puzzles order by starts_at desc limit 1)",
  );
  expect((await f.rpc(1, "puzzle_request", ["read"])).status).toBe("WAITING");
  expect((await f.call(1, "read")).error).toBe("PUZZLE_UNAVAILABLE");
  expect(
    (
      await f.exec(
        "select count(*)::int n from private.puzzle_pieces where puzzle_id=$1",
        [f.puzzle],
      )
    ).rows[0].n,
  ).toBe(25);
  await expect(f.rpc(-1, "puzzle_request", ["read"])).rejects.toThrow();
  await f.rpc(1, "deactivate_my_account");
  await expect(f.rpc(1, "puzzle_request", ["read"])).rejects.toThrow();
});
