import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createDoodleFixture } from "./doodle-fixture.mjs";
export async function createPuzzleFixture(db, ownerTiles = false) {
  const f = await createDoodleFixture(db, true, true);
  await f.db.exec(
    await readFile(
      "supabase/candidates/202610140001_partici_puzzle.sql",
      "utf8",
    ),
  );
  await f.db.exec(`create role authenticator;create schema storage;
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create function storage.allow_only_operation(op text) returns boolean language sql stable as $$select current_setting('storage.operation',true)=op$$;
 alter table storage.objects enable row level security;
 create or replace function private.puzzle_now() returns timestamptz language sql volatile set search_path='' as $$select t from private.doodle_test_clock$$;`);
  if (!ownerTiles)
    await f.db.exec(
      await readFile(
        "supabase/candidates/202610140002_puzzle_media.sql",
        "utf8",
      ),
    );
  await f.exec(
    "update private.doodle_test_clock set t=date_trunc('milliseconds',t)",
  );
  const now = async () =>
    (await f.exec("select private.puzzle_now() t")).rows[0].t;
  const start = await now();
  const puzzle = await f.rpc(0, "puzzle_schedule", [randomUUID(), start]);
  if (ownerTiles) {
    await f.db.exec(
      await readFile(
        "supabase/candidates/202610140003_puzzle_owner_tiles.sql",
        "utf8",
      ),
    );
    await f.exec(
      "insert into private.puzzle_batches(id,created_by,ready) select source_key,$2,true from private.puzzles where id=$1",
      [puzzle, f.people[0].user],
    );
    await f.exec(
      "insert into private.puzzle_assets(batch_id,kind,solution) select q.source_key,'tile',p.solution from private.puzzles q join private.puzzle_pieces p on p.puzzle_id=q.id where q.id=$1",
      [puzzle],
    );
    await f.exec(
      "insert into private.puzzle_assets(batch_id,kind) select source_key,k from private.puzzles cross join unnest(array['source','full']) k where id=$1",
      [puzzle],
    );
    await f.exec(
      "insert into storage.objects(bucket_id,name,metadata) select case when kind='source' then 'puzzle-originals' else 'puzzle-tiles' end,id::text||'.png','{\"size\":100,\"mimetype\":\"image/png\"}'::jsonb from private.puzzle_assets",
    );
  }
  const call = (actor, operation, options = {}) =>
    f.rpc(actor, "puzzle_request", [
      operation,
      options.puzzle ?? puzzle,
      options.request ?? randomUUID(),
      options.revision ?? null,
      options.piece ?? null,
      options.to ?? null,
    ]);
  const read = async (actor = 1, id = puzzle) =>
    (await call(actor, "read", { puzzle: id })).puzzle;
  const solution = async (id) =>
    (
      await f.exec("select solution from private.puzzle_pieces where id=$1", [
        id,
      ])
    ).rows[0].solution;
  const media = async (ticket) =>
    f.db.transaction(async (tx) => {
      await tx.exec("set local role atomic_bond_puzzle_media");
      return (
        await tx.query("select public.puzzle_media_resolve($1) result", [
          ticket,
        ])
      ).rows[0].result;
    });
  return { ...f, puzzle, now, call, read, solution, media };
}
