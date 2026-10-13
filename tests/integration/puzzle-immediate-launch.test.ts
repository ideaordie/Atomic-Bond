import { beforeEach, afterEach, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
// @ts-expect-error isolated fixture
import { createPuzzleFixture } from "../helpers/puzzle-fixture.mjs";
let f: Awaited<ReturnType<typeof createPuzzleFixture>>;
const official = "f2870bd6-d907-4282-9008-20d02f95f3b0";
const batch = "7c36c311-2a91-465e-8923-10e7efccc903";
const migration = await readFile(
  "supabase/migrations/202610170002_puzzle_immediate_launch.sql",
  "utf8",
);
beforeEach(async () => {
  f = await createPuzzleFixture(undefined, true);
  for (const file of [
    "supabase/candidates/202610140004_puzzle_controlled_access.sql",
    "supabase/migrations/202610150001_puzzle_database_media.sql",
    "supabase/migrations/202610150003_puzzle_scheduled_cleanup.sql",
    "supabase/migrations/202610170001_puzzle_launch_boundary.sql",
  ])
    await f.db.exec(await readFile(file, "utf8"));
  await f.exec("delete from private.puzzle_pieces");
  await f.exec(
    "update private.puzzles set id=$1,source_key=$2,starts_at='2026-10-27 04:00Z',ends_at='2026-11-03 04:00Z'",
    [official, batch],
  );
  await f.exec("insert into private.puzzle_batches(id,ready) values($1,true)", [
    batch,
  ]);
  await f.exec(
    "insert into private.puzzle_assets(batch_id,kind,solution) select $1,'tile',n from generate_series(0,24)n",
    [batch],
  );
  await f.exec(
    "insert into private.puzzle_assets(batch_id,kind) values($1,'source'),($1,'full')",
    [batch],
  );
  await f.exec(
    "insert into private.puzzle_media(asset_id,content) select id,decode('89504e470d0a1a0a00000000','hex') from private.puzzle_assets",
  );
  await f.exec(
    "insert into private.puzzle_pieces(puzzle_id,solution) select $1,n from generate_series(0,24)n",
    [official],
  );
  await f.exec(
    "insert into private.puzzles(id,source_key,starts_at,ends_at,revision) values('1129c11d-cea4-4b90-bd0b-1ea0516fd0f3','3ef7302f-81f9-4637-9b6c-1d9717c85fe5','2026-10-13 02:43:22.981Z','2026-10-20 02:43:22.981Z',16),('cd79a42e-28e3-4ce0-b55b-3b50bfbfd611','10444948-fd34-4d37-af55-b5ffcae5b381','2026-10-20 04:00Z','2026-10-27 04:00Z',0)",
  );
  await f.exec("update private.puzzle_launch_settings set first_puzzle=$1", [
    official,
  ]);
  await f.exec(
    "update private.puzzle_cleanup_health set last_ok=true,last_success=clock_timestamp()",
  );
}, 60000);
afterEach(async () => {
  await f?.db.close();
});
it("reschedules exactly once, preserves media and opens an exact 168-hour official window", async () => {
  await f.db.exec(migration);
  const result = (
    await f.exec(
      "select starts_at<=clock_timestamp() active,extract(epoch from ends_at-starts_at)/3600 hours from private.puzzles where id=$1",
      [official],
    )
  ).rows[0];
  expect(result.active).toBe(true);
  expect(Number(result.hours)).toBe(168);
  expect(
    (
      await f.exec(
        "select count(*)::int n from private.puzzle_pieces where puzzle_id=$1",
        [official],
      )
    ).rows[0].n,
  ).toBe(25);
  await expect(f.db.exec(migration)).rejects.toThrow(
    "Official puzzle changed or started",
  );
  await f.db.exec("rollback");
});
it("aborts without changing windows if the official board has been touched", async () => {
  await f.exec(
    "update private.puzzle_pieces set position=solution where puzzle_id=$1 and solution=0",
    [official],
  );
  await expect(f.db.exec(migration)).rejects.toThrow("Official board touched");
  await f.db.exec("rollback");
  expect(
    new Date(
      (
        await f.exec("select starts_at from private.puzzles where id=$1", [
          official,
        ])
      ).rows[0].starts_at,
    ).toISOString(),
  ).toBe("2026-10-27T04:00:00.000Z");
});
