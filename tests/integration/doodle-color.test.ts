import { beforeEach, afterEach, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
// @ts-expect-error isolated shared fixture
import * as fixture from "../helpers/doodle-fixture.mjs";
const { createDoodleFixture, fixtureDrawing, doodleColorMigrationSql } =
  fixture;
import { DoodleEditor, encode } from "../../src/prototypes/doodle/model";
let f: Awaited<ReturnType<typeof createDoodleFixture>>;
const drawing = () => {
  const e = new DoodleEditor(2);
  e.begin(0, true, 8);
  e.move(7);
  e.finish();
  e.begin(1, false);
  e.finish();
  return e.export();
};
beforeEach(async () => {
  f = await createDoodleFixture(undefined, true, true);
  await f.db.exec(await doodleColorMigrationSql());
}, 60000);
afterEach(async () => {
  await f?.db.close();
});
const enable = () =>
  f.exec("update private.doodle_settings set color_submissions=true");
const submit = (owner = 1, d: unknown = drawing(), key = randomUUID()) =>
  f.rpc(owner, "submit_doodle", [key, d]);
it("defaults OFF, preserves v1 fingerprints and deadlines, and retries v2 after disabling writes", async () => {
  await expect(submit()).rejects.toThrow();
  const key = randomUUID(),
    legacy = fixtureDrawing();
  const id = await submit(1, legacy, key);
  const before = (
    await f.exec(
      "select bitmap,replay,expires_at from private.doodles where id=$1",
      [id],
    )
  ).rows[0];
  expect(await submit(1, legacy, key)).toBe(id);
  const hashes = (
    await f.exec(
      "select private.doodle_fingerprint(encoding_version,bitmap,replay) actual,encode(sha256(bitmap||coalesce(replay,''::bytea)),'hex') legacy from private.doodles where id=$1",
      [id],
    )
  ).rows[0];
  expect(hashes.actual).toBe(hashes.legacy);
  await enable();
  const colorKey = randomUUID(),
    d = drawing();
  const colored = await submit(2, d, colorKey);
  expect(await f.rpc(0, "doodle_admin_replay", [colored])).toEqual(d);
  await f.exec("update private.doodle_settings set color_submissions=false");
  expect(await submit(2, d, colorKey)).toBe(colored);
  expect(
    (
      await f.exec(
        "select bitmap,replay,expires_at from private.doodles where id=$1",
        [id],
      )
    ).rows[0],
  ).toEqual(before);
  const row = (
    await f.exec(
      "select octet_length(bitmap) bytes,extract(epoch from expires_at-published_at) lifetime from private.doodles where id=$1",
      [colored],
    )
  ).rows[0];
  expect(row.bytes).toBe(2048);
  expect(Number(row.lifetime)).toBe(604800);
});
it("rejects invalid nibbles, malformed replay, mismatches and version substitution", async () => {
  await enable();
  for (let index = 9; index < 16; index++) {
    const bits = Buffer.alloc(2048);
    bits[0] = index;
    await expect(
      submit(1, { version: 2, bitmap: bits.toString("base64"), strokes: null }),
    ).rejects.toThrow();
    bits[0] = index << 4;
    await expect(
      submit(1, { version: 2, bitmap: bits.toString("base64"), strokes: null }),
    ).rejects.toThrow();
  }
  const d = drawing();
  for (const bad of [
    { ...d, version: 3 },
    { ...d, bitmap: fixtureDrawing().bitmap },
    { ...d, strokes: [] },
    { ...d, strokes: [{ draw: true, color: 0, points: [0] }] },
    { ...d, strokes: [{ draw: true, color: 9, points: [0] }] },
    { ...d, strokes: [{ draw: true, color: 8, points: [4096] }] },
    { ...d, bitmap: encode(new Uint8Array(2048)) },
  ])
    await expect(submit(1, bad)).rejects.toThrow();
});
it("renders mixed WORLD/network/Hall metadata and requires exact version-aware moderation fingerprint", async () => {
  await enable();
  const color = await submit(),
    old = await submit(2, fixtureDrawing());
  const feed = await f.rpc(3, "read_doodles");
  expect(feed.items.map((x: { version: number }) => x.version).sort()).toEqual([
    1, 2,
  ]);
  const network = await f.rpc(1, "read_network_doodles");
  expect(
    network.items.find((x: { id: string }) => x.id === color).version,
  ).toBe(2);
  expect((await f.rpc(2, "doodle_replay", [color])).strokes).toBeNull();
  for (let i = 3; i < 8; i++) await f.rpc(i, "appreciate_doodle", [color]);
  await f.advance(10080);
  await expect(f.rpc(8, "appreciate_doodle", [color])).rejects.toThrow();
  const q = await f.rpc(0, "doodle_admin_queue");
  const item = q.items.find((x: { id: string }) => x.id === color);
  await expect(
    f.rpc(0, "moderate_doodle", [color, "PROMOTE", "bad"]),
  ).rejects.toThrow();
  await f.rpc(0, "moderate_doodle", [color, "PROMOTE", item.fingerprint]);
  expect((await f.rpc(3, "read_doodles")).hall[0].version).toBe(2);
  await f.exec("select private.cleanup_doodles(500)");
  expect(
    (await f.exec("select id from private.doodles where id=$1", [old])).rows,
  ).toHaveLength(0);
  expect((await f.rpc(3, "read_doodles")).hall[0].id).toBe(color);
});
it("preserves ACTIVE ownership, moderation authorization, immutable content, cooldowns and private tables", async () => {
  await enable();
  await expect(submit(99)).rejects.toThrow();
  const id = await submit();
  await expect(submit()).rejects.toThrow();
  await expect(f.rpc(2, "doodle_admin_replay", [id])).rejects.toThrow();
  await expect(
    f.exec("update private.doodles set encoding_version=1 where id=$1", [id]),
  ).rejects.toThrow();
  await expect(
    f.exec(
      "update private.doodles set bitmap=decode(repeat('99',2048),'hex') where id=$1",
      [id],
    ),
  ).rejects.toThrow();
  await expect(
    f.db.transaction(async (tx: { exec: (s: string) => Promise<unknown> }) => {
      await tx.exec("set local role authenticated");
      await tx.exec("select * from private.doodles");
    }),
  ).rejects.toThrow();
  await f.rpc(1, "deactivate_my_account");
  await expect(submit()).rejects.toThrow();
  expect((await f.rpc(2, "read_doodles")).items).toHaveLength(0);
});
it("validates maximum replay without raising ingress limits", async () => {
  await enable();
  const bits = new Uint8Array(2048);
  bits[2047] = 0x88;
  const strokes = Array.from({ length: 256 }, () => ({
    draw: true,
    color: 8,
    points: Array(32).fill(4095),
  }));
  bits[2047] = 0x80;
  const d = { version: 2, bitmap: encode(bits), strokes };
  const bytes = await f.exec(
    "select octet_length($1::jsonb::text) body,octet_length(private.doodle_pack($1::jsonb)) replay",
    [JSON.stringify(d)],
  );
  expect(bytes.rows[0].body).toBeLessThan(65536);
  expect(bytes.rows[0].replay).toBe(17152);
  await submit(1, d);
  await expect(
    submit(2, { ...d, strokes: [...strokes, strokes[0]] }),
  ).rejects.toThrow();
});

it("applies additively to existing content without changing ACLs or legacy moderation hashes", async () => {
  const previous = await createDoodleFixture(undefined, true, true);
  try {
    const id = await previous.rpc(1, "submit_doodle", [
      randomUUID(),
      fixtureDrawing(),
    ]);
    const snapshot = async () =>
      (
        await previous.exec(
          "select bitmap,replay,published_at,expires_at,purge_at,state from private.doodles where id=$1",
          [id],
        )
      ).rows;
    const acl = async () =>
      (
        await previous.exec(
          "select oid::regprocedure::text name,proacl::text,proowner,prosecdef,proconfig from pg_proc where pronamespace='public'::regnamespace and proname like '%doodle%' order by name",
        )
      ).rows;
    const before = await snapshot(),
      privileges = await acl();
    const queue = await previous.rpc(0, "doodle_admin_queue");
    await previous.db.exec(await doodleColorMigrationSql());
    expect(await snapshot()).toEqual(before);
    expect(await acl()).toEqual(privileges);
    expect(
      (await previous.rpc(0, "doodle_admin_queue")).items[0].fingerprint,
    ).toBe(queue.items[0].fingerprint);
  } finally {
    await previous.db.close();
  }
}, 60000);
