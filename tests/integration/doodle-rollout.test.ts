import { afterAll, beforeAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
// @ts-expect-error Shared isolated JavaScript database fixture.
import * as fixture from "../helpers/doodle-fixture.mjs";
const { createDoodleFixture, fixtureDrawing } = fixture;
let f: Awaited<ReturnType<typeof createDoodleFixture>>;
beforeAll(async () => {
  f = await createDoodleFixture();
  await f.exec(
    "update private.doodle_settings set public_access=false, submissions_paused=true",
  );
}, 60000);
afterAll(async () => {
  await f?.db.close();
});

it("requires operator membership even for an administrator; denies direct enrollment", async () => {
  await expect(f.rpc(0, "doodle_admin_queue")).rejects.toThrow();
  await expect(f.rpc(1, "read_doodles")).rejects.toThrow();
  expect(
    (
      await f.exec(
        "select has_table_privilege('authenticated','private.doodle_rollout_members','INSERT') allowed",
      )
    ).rows[0].allowed,
  ).toBe(false);
  expect(
    (
      await f.exec(
        "select has_table_privilege('authenticated','private.doodle_rollout_members','SELECT') allowed",
      )
    ).rows[0].allowed,
  ).toBe(false);
  for (const i of [0, 1])
    await f.exec(
      "insert into private.doodle_rollout_members values($1,private.doodle_now()+interval '2 hours')",
      [f.people[i].atom],
    );
  expect((await f.rpc(1, "read_doodles")).items).toEqual([]);
  await expect(f.rpc(1, "doodle_admin_queue")).rejects.toThrow();
});

it("keeps emergency pause authoritative and resume limited to admitted owners", async () => {
  await expect(
    f.rpc(1, "submit_doodle", [randomUUID(), fixtureDrawing()]),
  ).rejects.toThrow("SUBMISSIONS_PAUSED");
  await f.rpc(0, "doodle_admin_pause", [false]);
  await f.rpc(1, "submit_doodle", [randomUUID(), fixtureDrawing()]);
  await expect(f.rpc(2, "read_doodles")).rejects.toThrow();
  await expect(
    f.rpc(2, "submit_doodle", [randomUUID(), fixtureDrawing()]),
  ).rejects.toThrow();
  await expect(
    f.rpc(1, "submit_doodle", [randomUUID(), fixtureDrawing()]),
  ).rejects.toThrow();
});

it("expires controlled access using database time, including administrator access", async () => {
  await f.advance(120);
  await expect(f.rpc(1, "read_doodles")).rejects.toThrow();
  await expect(f.rpc(0, "doodle_admin_queue")).rejects.toThrow();
  // Cleanup is independent of participant admission and pause.
  await f.exec("select private.cleanup_doodles(500)");
  expect(
    (await f.exec("select count(*)::int n from private.doodles")).rows[0].n,
  ).toBe(0);
});
