import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createPuzzleFixture } from "./puzzle-fixture.mjs";
export async function createQueueFixture(db) {
  const f = await createPuzzleFixture(db, true);
  for (const file of [
    "supabase/candidates/202610140004_puzzle_controlled_access.sql",
    "supabase/migrations/202610150001_puzzle_database_media.sql",
    "supabase/migrations/202610150003_puzzle_scheduled_cleanup.sql",
    "supabase/migrations/202610150004_puzzle_cleanup_ack.sql",
    "supabase/migrations/202610170001_puzzle_launch_boundary.sql",
    "supabase/migrations/202610190001_puzzle_queue.sql",
  ])
    await f.db.exec(await readFile(file, "utf8"));
  await f.exec(
    "insert into private.puzzle_media(asset_id,content) select id,decode('89504e470d0a1a0a00000000','hex') from private.puzzle_assets",
  );
  await f.exec("update private.puzzle_access_settings set public_enabled=true");
  await f.exec("update private.puzzle_launch_settings set first_puzzle=$1", [
    f.puzzle,
  ]);
  const revision = async () =>
    (await f.exec("select revision from private.puzzle_queue_settings")).rows[0]
      .revision;
  const manage = async (action, options = {}) =>
    f.rpc(options.actor ?? 0, "puzzle_queue_manage", [
      action,
      options.revision ?? (await revision()),
      options.batch ?? null,
      options.puzzle ?? null,
      options.order ?? null,
      options.reason ?? null,
    ]);
  const batch = async () => {
    const id = randomUUID();
    await f.exec(
      "insert into private.puzzle_batches(id,ready,created_at) values($1,true,private.puzzle_now())",
      [id],
    );
    await f.exec(
      "insert into private.puzzle_assets(batch_id,kind,solution) select $1,'tile',n from generate_series(0,24)n",
      [id],
    );
    await f.exec(
      "insert into private.puzzle_assets(batch_id,kind) values($1,'source'),($1,'full')",
      [id],
    );
    await f.exec(
      "insert into private.puzzle_media(asset_id,content) select id,decode('89504e470d0a1a0a00000000','hex') from private.puzzle_assets where batch_id=$1",
      [id],
    );
    return id;
  };
  const adopt = () =>
    f.exec("select private.puzzle_queue_adopt($1,$2::uuid[])", [f.puzzle, []]);
  const advance = () => f.exec("select private.puzzle_queue_advance()");
  return { ...f, revision, manage, batch, adopt, advance };
}
