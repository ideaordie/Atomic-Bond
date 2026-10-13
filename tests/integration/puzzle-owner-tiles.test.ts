import { beforeEach, afterEach, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { puzzleHttp } from "../../src/services/puzzle/http";
import { uploadPuzzle } from "../../src/services/puzzle/owner-upload";
import type { PuzzleOwnerClient } from "../../src/services/puzzle/owner-media";
// @ts-expect-error shared isolated fixture
import { createPuzzleFixture } from "../helpers/puzzle-fixture.mjs";
let f: Awaited<ReturnType<typeof createPuzzleFixture>>;
beforeEach(async () => {
  f = await createPuzzleFixture(undefined, true);
  await f.db.exec(
    await readFile(
      "supabase/migrations/202610140002_puzzle_storage_download_info.sql",
      "utf8",
    ),
  );
}, 60000);
afterEach(async () => {
  await f?.db.close();
});
async function asOwner(
  actor: number,
  operation: string,
  sql: string,
  args: unknown[] = [],
) {
  return f.db.transaction(
    async (tx: {
      exec: (sql: string) => Promise<unknown>;
      query: (
        sql: string,
        args: unknown[],
      ) => Promise<{ rows: Record<string, unknown>[] }>;
    }) => {
      const p = f.people[actor];
      await tx.exec("set local role " + (p ? "authenticated" : "anon"));
      await tx.query(
        "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true),set_config('storage.operation',$3,true)",
        [
          p?.user ?? "",
          JSON.stringify(p ? { session_id: p.session } : {}),
          operation,
        ],
      );
      return (await tx.query(sql, args)).rows;
    },
  );
}
const read = (
  actor: number,
  name: string,
  bucket = "puzzle-tiles",
  op = "object.get_authenticated",
) =>
  asOwner(
    actor,
    op,
    "select name from storage.objects where name=$1 and bucket_id=$2",
    [name, bucket],
  );
const asset = async (kind: string) =>
  (
    await f.exec(
      "select id::text||'.png' name from private.puzzle_assets where kind=$1 limit 1",
      [kind],
    )
  ).rows[0].name;
it("enforces direct Storage downloads and prerequisite info: own/board yes, foreign/unrevealed/source/list/sign no", async () => {
  const id = (await f.call(1, "reveal", { revision: 0 })).puzzle.reservation
    .piece;
  const name = (await f.rpc(1, "puzzle_asset", [f.puzzle, id])).name;
  expect(await read(1, name)).toHaveLength(1);
  expect(await read(2, name)).toHaveLength(0);
  expect(
    await read(1, name, "puzzle-tiles", "object.get_authenticated_info"),
  ).toHaveLength(1);
  expect(
    await read(2, name, "puzzle-tiles", "object.get_authenticated_info"),
  ).toHaveLength(0);
  await expect(read(-1, name)).rejects.toThrow();
  expect(await read(1, randomUUID() + ".png")).toHaveLength(0);
  const hidden = (
    await f.exec(
      "select a.id::text||'.png' name from private.puzzle_assets a join private.puzzle_pieces p on p.solution=a.solution where p.id<>$1 limit 1",
      [id],
    )
  ).rows[0].name;
  expect(await read(1, hidden)).toHaveLength(0);
  expect(
    await read(1, hidden, "puzzle-tiles", "object.get_authenticated_info"),
  ).toHaveLength(0);
  expect(
    await read(
      1,
      await asset("source"),
      "puzzle-originals",
      "object.get_authenticated_info",
    ),
  ).toHaveLength(0);
  await f.db.exec(
    "create policy unrelated_permissive_fixture on storage.objects for select to authenticated using(true)",
  );
  expect(await read(1, hidden)).toHaveLength(0);
  expect(await read(1, name)).toHaveLength(1);
  await f.db.exec(
    "drop policy unrelated_permissive_fixture on storage.objects",
  );
  for (const op of ["object.list", "object.sign", "object.transform"])
    expect(await read(1, name, "puzzle-tiles", op)).toHaveLength(0);
  expect(await read(0, await asset("source"), "puzzle-originals")).toHaveLength(
    0,
  );
  await expect(
    asOwner(
      1,
      "object.get_authenticated",
      "select * from private.puzzle_assets",
    ),
  ).rejects.toThrow();
  await expect(
    asOwner(
      1,
      "object.get_authenticated",
      "select * from private.atom_identities",
    ),
  ).rejects.toThrow();
  expect(await read(1, name, "other")).toHaveLength(0);
  for (let i = 0; i < 5; i++) expect(await read(1, name)).toHaveLength(1);
  await f.call(1, "place", {
    revision: (await f.read()).revision,
    piece: id,
    to: await f.solution(id),
  });
  expect(await read(2, name)).toHaveLength(1);
  expect(
    await read(2, name, "puzzle-tiles", "object.get_authenticated_info"),
  ).toHaveLength(1);
});
it("rejects expired/revoked sessions and reservations, future content and lifecycle changes", async () => {
  const id = (await f.call(1, "reveal", { revision: 0 })).puzzle.reservation
    .piece;
  const name = (await f.rpc(1, "puzzle_asset", [f.puzzle, id])).name;
  await f.advance(5);
  expect(await read(1, name)).toHaveLength(0);
  expect(
    await read(1, name, "puzzle-tiles", "object.get_authenticated_info"),
  ).toHaveLength(0);
  await f.advance(5);
  const next = (
    await f.call(1, "reveal", { revision: (await f.read()).revision })
  ).puzzle.reservation.piece;
  const nextName = (await f.rpc(1, "puzzle_asset", [f.puzzle, next])).name;
  await f.rpc(1, "deactivate_my_account");
  expect(await read(1, nextName)).toHaveLength(0);
  expect(
    await read(1, nextName, "puzzle-tiles", "object.get_authenticated_info"),
  ).toHaveLength(0);
  await f.exec(
    "update public.atoms set status='DELETED',display_name=null,x_handle=null where id=$1",
    [f.people[2].atom],
  );
  expect(await read(2, nextName)).toHaveLength(0);
  expect(
    await read(2, nextName, "puzzle-tiles", "object.get_authenticated_info"),
  ).toHaveLength(0);
  const full = await asset("full");
  expect(await read(3, full)).toHaveLength(0);
  expect(
    await read(3, full, "puzzle-tiles", "object.get_authenticated_info"),
  ).toHaveLength(0);
  await f.exec(
    "update private.puzzles set starts_at=starts_at+interval '8 days',ends_at=ends_at+interval '8 days',completed_at=private.puzzle_now() where id=$1",
    [f.puzzle],
  );
  expect(await read(3, full)).toHaveLength(0);
  await f.exec(
    "update private.puzzles set starts_at=starts_at-interval '8 days',ends_at=ends_at-interval '8 days' where id=$1",
    [f.puzzle],
  );
  expect(await read(3, full)).toHaveLength(1);
  await f.exec("delete from auth.sessions where id=$1", [f.people[3].session]);
  expect(await read(3, full)).toHaveLength(0);
});
it("releases full artwork after scheduled expiry, closes access at retention deadline", async () => {
  const full = await asset("full");
  await f.advance(10080);
  expect(await read(1, full)).toHaveLength(1);
  expect((await f.rpc(1, "puzzle_asset", [f.puzzle, null])).name).toBe(full);
  await f.advance(30 * 1440);
  expect(await read(1, full)).toHaveLength(0);
});

it("bounds cleanup to one expired batch and protects active objects and ordinary owners", async () => {
  expect((await f.rpc(0, "puzzle_cleanup_batch", [null])).assets).toEqual([]);
  const name = await asset("full");
  expect(
    await asOwner(
      0,
      "object.delete_many",
      "delete from storage.objects where name=$1 returning name",
      [name],
    ),
  ).toHaveLength(0);
  await f.advance(10080 + 30 * 1440);
  await expect(f.rpc(1, "puzzle_cleanup_batch", [null])).rejects.toThrow();
  const plan = await f.rpc(0, "puzzle_cleanup_batch", [null]);
  expect(plan.assets).toHaveLength(27);
  await expect(f.rpc(0, "puzzle_cleanup_batch", [plan.batch])).rejects.toThrow(
    "incomplete",
  );
  expect(
    await asOwner(
      1,
      "object.delete_many",
      "delete from storage.objects where name=$1 returning name",
      [name],
    ),
  ).toHaveLength(0);
  for (const a of plan.assets)
    await asOwner(
      0,
      "object.delete_many",
      "delete from storage.objects where name=$1 and bucket_id=$2",
      [a.name, a.bucket],
    );
  expect((await f.rpc(0, "puzzle_cleanup_batch", [plan.batch])).removed).toBe(
    true,
  );
  expect(
    (await f.exec("select count(*)::int n from private.puzzles")).rows[0].n,
  ).toBe(1);
});
it("integrates admin preparation, immutable owner-session uploads, readiness and scheduling", async () => {
  await expect(f.rpc(1, "puzzle_prepare", [null])).rejects.toThrow();
  const batch = await f.rpc(0, "puzzle_prepare", [null]);
  expect(batch.assets).toHaveLength(27);
  await expect(f.rpc(0, "puzzle_prepare", [batch.batch])).rejects.toThrow(
    "Incomplete",
  );
  const a = batch.assets[0];
  await expect(
    asOwner(
      1,
      "object.upload",
      "insert into storage.objects(bucket_id,name) values('puzzle-tiles',$1)",
      [a.name],
    ),
  ).rejects.toThrow();
  for (const x of batch.assets)
    await asOwner(
      0,
      "object.upload",
      'insert into storage.objects(bucket_id,name,metadata) values($1,$2,\'{"size":100,"mimetype":"image/png"}\'::jsonb)',
      [x.kind === "source" ? "puzzle-originals" : "puzzle-tiles", x.name],
    );
  await f.rpc(0, "puzzle_prepare", [batch.batch]);
  await expect(
    asOwner(
      0,
      "object.upload",
      "insert into storage.objects(bucket_id,name) values('puzzle-tiles',$1)",
      [a.name],
    ),
  ).rejects.toThrow();
  await expect(
    asOwner(
      0,
      "object.update",
      "update storage.objects set name='changed' where name=$1",
      [a.name],
    ),
  ).rejects.toThrow();
  const start = (
    await f.exec("select ends_at from private.puzzles where id=$1", [f.puzzle])
  ).rows[0].ends_at;
  await f.rpc(0, "puzzle_schedule", [batch.batch, start]);
  expect(await read(0, a.name)).toHaveLength(0);
});
it("serves stored tile bytes through the integrated HTTP handler; unknown parameters and cross-origin writes fail", async () => {
  await f.db.exec(
    await readFile(
      "supabase/candidates/202610140004_puzzle_controlled_access.sql",
      "utf8",
    ),
  );
  await f.exec("update private.puzzle_access_settings set public_enabled=true");
  await f.db.exec(
    await readFile(
      "supabase/migrations/202610150001_puzzle_database_media.sql",
      "utf8",
    ),
  );
  const bytes = await sharp({
    create: { width: 100, height: 100, channels: 4, background: "red" },
  })
    .png()
    .toBuffer();
  await f.exec(
    "insert into private.puzzle_media(asset_id,content) select id,$1 from private.puzzle_assets where kind<>'source'",
    [bytes],
  );
  const client: PuzzleOwnerClient = {
    auth: {
      getUser: async () => ({
        data: { user: { email_confirmed_at: "fixture" } },
        error: null,
      }),
    },
    rpc: async (name, args) => {
      try {
        return {
          data: await f.rpc(
            1,
            name,
            name === "puzzle_request"
              ? [
                  args!.p_operation,
                  args!.p_puzzle,
                  args!.p_request,
                  args!.p_revision,
                  args!.p_piece,
                  args!.p_to,
                ]
              : [args!.p_puzzle, args!.p_piece],
          ),
          error: null,
        };
      } catch {
        return { data: null, error: true };
      }
    },
    storage: {
      from: (bucket) => ({
        download: async (name) => ({
          data: (await read(1, name, bucket)).length
            ? new Blob([new Uint8Array(bytes)])
            : null,
          error: null,
        }),
        upload: async () => ({ error: true }),
      }),
    },
  };
  const config = {
    enabled: true,
    origin: "http://localhost",
    client: async () => client,
  };
  const revealed = await puzzleHttp(
    new Request("http://localhost/api/puzzle", {
      method: "POST",
      headers: { origin: "http://localhost" },
      body: JSON.stringify({
        operation: "reveal",
        puzzle: f.puzzle,
        request: randomUUID(),
        revision: 0,
      }),
    }),
    config,
  );
  const piece = (await revealed.json()).puzzle.reservation.piece;
  const response = await puzzleHttp(
    new Request(
      `http://localhost/api/puzzle?puzzle=${f.puzzle}&piece=${piece}`,
    ),
    config,
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  expect(
    (
      await puzzleHttp(
        new Request(`http://localhost/api/puzzle?puzzle=${f.puzzle}&x=0`),
        config,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await puzzleHttp(
        new Request("http://localhost/api/puzzle", {
          method: "POST",
          headers: { origin: "https://bad.invalid" },
          body: "{}",
        }),
        config,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await puzzleHttp(new Request("http://localhost/api/puzzle"), {
        ...config,
        enabled: false,
      })
    ).status,
  ).toBe(404);
});

it("integrates preparation with 26 database assets and a private source before READY", async () => {
  await f.db.exec(
    await readFile(
      "supabase/candidates/202610140004_puzzle_controlled_access.sql",
      "utf8",
    ),
  );
  await f.exec("update private.puzzle_access_settings set public_enabled=true");
  await f.db.exec(
    await readFile(
      "supabase/migrations/202610150001_puzzle_database_media.sql",
      "utf8",
    ),
  );
  let uploads = 0;
  const client: PuzzleOwnerClient = {
    auth: {
      getUser: async () => ({
        data: { user: { email_confirmed_at: "fixture" } },
        error: null,
      }),
    },
    rpc: async (name, args) => ({
      data: await f.rpc(
        0,
        name,
        name === "puzzle_media_put"
          ? [args!.p_asset, args!.p_content]
          : [args!.p_batch],
      ),
      error: null,
    }),
    storage: {
      from: (bucket) => ({
        download: async () => ({ data: null, error: true }),
        upload: async (name, bytes, options) => {
          expect(options.upsert).toBe(false);
          expect(options.cacheControl).toBe("0");
          const meta = await sharp(bytes).metadata();
          expect(meta.format).toBe("png");
          expect(meta.exif).toBeUndefined();
          await asOwner(
            0,
            "object.upload",
            "insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)",
            [
              bucket,
              name,
              JSON.stringify({
                size: bytes.length,
                mimetype: options.contentType,
              }),
            ],
          );
          uploads++;
          return { error: null };
        },
      }),
    },
  };
  const input = await sharp({
    create: { width: 600, height: 700, channels: 3, background: "green" },
  })
    .jpeg()
    .toBuffer();
  const result = await uploadPuzzle(client, input);
  expect(result.ready).toBe(true);
  expect(uploads).toBe(1);
  expect(
    (await f.exec("select count(*)::int n from private.puzzle_media")).rows[0]
      .n,
  ).toBe(26);
  expect(
    (
      await f.exec("select ready from private.puzzle_batches where id=$1", [
        result.batch,
      ])
    ).rows[0].ready,
  ).toBe(true);
});
