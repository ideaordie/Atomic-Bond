import { afterEach, beforeEach, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
// @ts-expect-error isolated fixture
import * as fixture from "../helpers/doodle-fixture.mjs";
const { createDoodleFixture, fixtureDrawing } = fixture;
let f: Awaited<ReturnType<typeof createDoodleFixture>>;
const id = "f7b8cb40-17b3-4d23-8773-2d440901ce2c";
const sql = await readFile(
  "supabase/migrations/202610170003_doodle_legacy_deadline.sql",
  "utf8",
);
beforeEach(async () => {
  f = await createDoodleFixture(undefined, true, true);
  await f.exec(
    "update private.doodle_test_clock set t='2026-10-12 23:47:12.649486Z'",
  );
  const p = await f.rpc(1, "publish_doodle", [randomUUID(), fixtureDrawing()]);
  await f.exec(
    "update private.doodles set id=$1,expires_at=published_at+interval '24 hours',purge_at=published_at+interval '24 hours' where id=$2",
    [id, p.id],
  );
  await f.rpc(2, "appreciate_doodle", [id]);
}, 60000);
afterEach(async () => {
  await f?.db.close();
});
it("extends only approved deadlines while preserving artwork and appreciations", async () => {
  await f.db.exec(sql);
  await f.advance(4320);
  await f.exec("select private.cleanup_doodles(500)");
  expect((await f.rpc(2, "read_doodles")).items[0].id).toBe(id);
  expect(
    (
      await f.exec(
        "select count(*)::int n from private.doodle_appreciations where doodle_id=$1",
        [id],
      )
    ).rows[0].n,
  ).toBe(1);
  await expect(f.db.exec(sql)).rejects.toThrow("no longer eligible");
  await f.db.exec("rollback");
});
it("does not reopen removed content", async () => {
  await f.moderate(id, "REMOVE");
  await expect(f.db.exec(sql)).rejects.toThrow("no longer eligible");
  await f.db.exec("rollback");
  expect((await f.rpc(2, "read_doodles")).items).toEqual([]);
});
it("does not reopen a finalized score", async () => {
  await f.advance(1440);
  await f.exec("select private.doodle_finalize()");
  await expect(f.db.exec(sql)).rejects.toThrow("no longer eligible");
  await f.db.exec("rollback");
  expect(
    (await f.exec("select final_score from private.doodles where id=$1", [id]))
      .rows[0].final_score,
  ).toBe(1);
});
