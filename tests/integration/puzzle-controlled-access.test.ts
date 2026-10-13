import { readFile } from "node:fs/promises";
import { afterEach, expect, it } from "vitest";
// @ts-expect-error shared isolated database fixture
import { createPuzzleFixture } from "../helpers/puzzle-fixture.mjs";
// @ts-expect-error shared isolated database fixture
import { createDoodleFixture } from "../helpers/doodle-fixture.mjs";
let f: Awaited<ReturnType<typeof createPuzzleFixture>>;
afterEach(async () => {
  await f?.db.close();
});
it("defaults closed and limits RPC and Storage authority to unexpired approved owners", async () => {
  f = await createPuzzleFixture(undefined, true);
  const revealed = (await f.call(1, "reveal", { revision: 0 })).puzzle
    .reservation.piece;
  const asset = (await f.rpc(1, "puzzle_asset", [f.puzzle, revealed])).name;
  const directRead = async () =>
    f.db.transaction(
      async (tx: {
        exec: (s: string) => Promise<unknown>;
        query: (s: string, a: unknown[]) => Promise<{ rows: unknown[] }>;
      }) => {
        await tx.exec("set local role authenticated");
        await tx.query(
          "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true),set_config('storage.operation','object.get_authenticated',true)",
          [
            f.people[1].user,
            JSON.stringify({ session_id: f.people[1].session }),
          ],
        );
        return (
          await tx.query(
            "select name from storage.objects where bucket_id='puzzle-tiles' and name=$1",
            [asset],
          )
        ).rows;
      },
    );
  await f.db.exec(
    await readFile(
      "supabase/candidates/202610140004_puzzle_controlled_access.sql",
      "utf8",
    ),
  );
  await expect(f.read(1)).rejects.toThrow("Puzzle unavailable");
  await expect(
    f.rpc(1, "puzzle_asset", [f.puzzle, revealed]),
  ).rejects.toThrow();
  expect(await directRead()).toHaveLength(0);
  await f.exec(
    "insert into private.puzzle_test_members values($1,private.puzzle_now()+interval '1 hour')",
    [f.people[1].atom],
  );
  await expect(f.read(1)).rejects.toThrow("Puzzle unavailable");
  await f.exec(
    "update private.puzzle_access_settings set controlled_enabled=true",
  );
  expect(await f.read(1)).toBeTruthy();
  expect(await directRead()).toHaveLength(1);
  await expect(f.read(2)).rejects.toThrow("Puzzle unavailable");
  await f.exec(
    "update private.puzzle_test_members set expires_at=private.puzzle_now()",
  );
  await expect(f.read(1)).rejects.toThrow("Puzzle unavailable");
  expect(await directRead()).toHaveLength(0);
}, 60000);
it("applies the exact hosted migration atomically with public and controlled access OFF", async () => {
  f = await createDoodleFixture(undefined, true, true);
  await f.db.exec(`create schema storage;
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create function storage.allow_only_operation(op text) returns boolean language sql stable as $$select current_setting('storage.operation',true)=op$$;
    alter table storage.objects enable row level security;`);
  await f.db.exec(
    await readFile(
      "supabase/migrations/202610140001_puzzle_controlled_infrastructure.sql",
      "utf8",
    ),
  );
  expect(
    (
      await f.exec(
        "select public_enabled,controlled_enabled from private.puzzle_access_settings",
      )
    ).rows,
  ).toEqual([{ public_enabled: false, controlled_enabled: false }]);
  await expect(f.rpc(1, "puzzle_request", ["read"])).rejects.toThrow(
    "Puzzle unavailable",
  );
  expect(
    (
      await f.exec(
        "select count(*)::int n from storage.buckets where not public",
      )
    ).rows[0].n,
  ).toBe(2);
}, 60000);
