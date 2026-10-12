import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
// @ts-expect-error Loopback-only JavaScript fixture is shared with native PostgreSQL tests.
import * as fixture from "../helpers/doodle-fixture.mjs";
const { createDoodleFixture, fixtureDrawing } = fixture;

let f: Awaited<ReturnType<typeof createDoodleFixture>>;
beforeAll(async () => {
  f = await createDoodleFixture();
}, 60000);
afterAll(async () => {
  await f?.db.close();
});
const submit = (i: number) =>
  f.rpc(i, "submit_doodle", [randomUUID(), fixtureDrawing(i)]);

describe("Doodle authoritative security and lifecycle", () => {
  it("enforces seven-day private review and preserves Hall payloads beyond cleanup", async () => {
    const isolated = await createDoodleFixture();
    try {
      const candidate = await isolated.rpc(1, "submit_doodle", [
        randomUUID(),
        fixtureDrawing(1),
      ]);
      const ordinary = await isolated.rpc(2, "submit_doodle", [
        randomUUID(),
        fixtureDrawing(2),
      ]);
      const hall = await isolated.rpc(3, "submit_doodle", [
        randomUUID(),
        fixtureDrawing(3),
      ]);
      for (const voter of [4, 5, 6, 7, 8]) {
        await isolated.rpc(voter, "appreciate_doodle", [candidate]);
        await isolated.rpc(voter, "appreciate_doodle", [hall]);
      }
      await isolated.advance(60);
      await isolated.exec("select private.cleanup_doodles()");
      expect(
        (
          await isolated.exec("select id from private.doodles where id=$1", [
            ordinary,
          ])
        ).rows,
      ).toHaveLength(0);
      await isolated.moderate(hall, "PROMOTE");
      await isolated.advance(24 * 60 + 1);
      await isolated.rpc(0, "doodle_admin_replay", [candidate]);
      await expect(
        isolated.rpc(2, "doodle_replay", [candidate]),
      ).rejects.toThrow();
      await isolated.advance(6 * 24 * 60 - 2);
      await isolated.rpc(0, "doodle_admin_replay", [candidate]);
      await isolated.advance(1);
      await expect(
        isolated.rpc(0, "doodle_admin_replay", [candidate]),
      ).rejects.toThrow();
      await isolated.exec("select private.cleanup_doodles()");
      expect(
        (
          await isolated.exec("select id from private.doodles where id=$1", [
            candidate,
          ])
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await isolated.exec("select id from private.doodles where id=$1", [
            hall,
          ])
        ).rows,
      ).toHaveLength(1);
      await isolated.advance(30 * 24 * 60);
      expect(await isolated.rpc(0, "doodle_admin_history")).toEqual([]);
      await isolated.exec("select private.cleanup_doodles()");
      expect(
        (await isolated.exec("select id from private.doodle_moderation")).rows,
      ).toHaveLength(0);
      expect(
        (
          await isolated.exec("select id from private.doodles where id=$1", [
            hall,
          ])
        ).rows,
      ).toHaveLength(1);
    } finally {
      await isolated.db.close();
    }
  }, 60000);
  it("keeps every private table and sequence inaccessible and every function explicitly owned", async () => {
    const tables = await f.exec(
      "select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname like 'doodle%' and c.relkind='r' and c.relname<>'doodle_test_clock'",
    );
    expect(tables.rows).toHaveLength(9);
    for (const table of tables.rows) {
      expect(table.relrowsecurity).toBe(true);
      for (const role of [
        "anon",
        "authenticated",
        "service_role",
        "atomic_bond_growth",
      ]) {
        const result = await f.exec(
          "select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE') permitted",
          [role, `private.${table.relname}`],
        );
        expect(result.rows[0].permitted).toBe(false);
      }
    }
    expect(
      (
        await f.exec(
          "select has_sequence_privilege('authenticated','private.doodle_moderation_id_seq','USAGE,SELECT,UPDATE') permitted",
        )
      ).rows[0].permitted,
    ).toBe(false);
    expect(
      (
        await f.exec(
          "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.proname like '%doodle%' and pg_get_userbyid(p.proowner)<>'postgres'",
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("paginates equal-time publications without missing or duplicate drawings", async () => {
    const paging = await createDoodleFixture();
    try {
      for (let i = 1; i <= 25; i++) {
        await paging.rpc(i, "submit_doodle", [randomUUID(), fixtureDrawing(i)]);
      }
      const first = await paging.rpc(0, "read_doodles");
      expect(first.items).toHaveLength(20);
      const tail = first.items[19];
      const second = await paging.rpc(0, "read_doodles", [
        tail.publishedAt,
        tail.id,
      ]);
      expect(second.items).toHaveLength(5);
      expect(
        new Set(
          [...first.items, ...second.items].map((d: { id: string }) => d.id),
        ).size,
      ).toBe(25);
    } finally {
      await paging.db.close();
    }
  }, 60000);
  it("denies anonymous reads/writes, non-admin moderation, direct table and private helper access", async () => {
    for (const [name, args] of [
      ["read_doodles", []],
      ["submit_doodle", [randomUUID(), fixtureDrawing()]],
      ["doodle_admin_queue", []],
    ] as const)
      await expect(f.rpc(-1, name, args)).rejects.toThrow();
    await expect(f.rpc(1, "doodle_admin_queue")).rejects.toThrow();
    await expect(f.rpc(1, "doodle_admin_settings", [6])).rejects.toThrow();
    const r = await f.exec(
      "select has_table_privilege('authenticated','private.doodles','SELECT') as readable,has_function_privilege('authenticated','private.cleanup_doodles(integer)','EXECUTE') as cleanup",
    );
    expect(r.rows[0]).toEqual({ readable: false, cleanup: false });
  });
  it("bounds payloads, validates all replay operations and enforces submission idempotency/cooldown", async () => {
    const key = randomUUID(),
      drawing = fixtureDrawing(1);
    const id = await f.rpc(1, "submit_doodle", [key, drawing]);
    expect(await f.rpc(1, "submit_doodle", [key, drawing])).toBe(id);
    await expect(
      f.rpc(1, "submit_doodle", [key, fixtureDrawing(2)]),
    ).rejects.toThrow();
    await expect(submit(1)).rejects.toThrow();
    const bad = { ...drawing, strokes: [{ draw: true, points: [4096] }] };
    await expect(
      f.rpc(2, "submit_doodle", [randomUUID(), bad]),
    ).rejects.toThrow();
    await expect(
      f.rpc(2, "submit_doodle", [randomUUID(), { ...drawing, strokes: [] }]),
    ).rejects.toThrow();
    expect((await f.rpc(2, "read_doodles")).items).toHaveLength(1);
    expect(await f.rpc(2, "doodle_replay", [id])).toEqual(drawing);
    await f.moderate(id, "REMOVE");
    await expect(submit(1)).rejects.toThrow();
    await f.exec("select private.cleanup_doodles()");
    expect(await f.rpc(1, "submit_doodle", [key, drawing])).toBe(id);
  });
  it("rejects obsolete approvals, self votes and non-active voters; deduplicates retries", async () => {
    const id = await submit(2);
    await expect(
      f.rpc(0, "moderate_doodle", [id, "APPROVE", "wrong"]),
    ).rejects.toThrow();
    await expect(f.rpc(2, "appreciate_doodle", [id])).rejects.toThrow();
    expect(await f.rpc(3, "appreciate_doodle", [id])).toBe(true);
    expect(await f.rpc(3, "appreciate_doodle", [id])).toBe(false);
    await f.rpc(4, "deactivate_my_account");
    await expect(f.rpc(4, "appreciate_doodle", [id])).rejects.toThrow();
    const item = (await f.rpc(3, "read_doodles")).items[0];
    expect(item.score).toBe(1);
    expect(item.appreciated).toBe(true);
    expect(Object.keys(item).sort()).toEqual(
      [
        "id",
        "atomNumber",
        "bitmap",
        "publishedAt",
        "expiresAt",
        "score",
        "appreciated",
        "own",
      ].sort(),
    );
    const replay = await f.rpc(3, "doodle_replay", [id]);
    expect(replay).toEqual(fixtureDrawing(2));
    await f.advance(60);
    expect((await f.rpc(3, "read_doodles")).items).toEqual([]);
    await expect(f.rpc(3, "appreciate_doodle", [id])).rejects.toThrow();
    await f.rpc(0, "doodle_admin_queue");
    expect(
      (
        await f.exec("select final_score from private.doodles where id=$1", [
          id,
        ])
      ).rows[0].final_score,
    ).toBe(1);
  });
  it("requires explicit Hall review, caps at ten, preserves incumbent ties and atomically replaces lower scores", async () => {
    const ids = [];
    for (let owner = 5; owner < 17; owner++) {
      const id = await submit(owner);

      for (let voter = 18; voter < 23 + (owner === 16 ? 1 : 0); voter++)
        await f.rpc(voter, "appreciate_doodle", [id]);
      ids.push(id);
    }
    await f.advance(60);
    expect((await f.rpc(1, "read_doodles")).hall).toHaveLength(0);
    await f.exec("select private.cleanup_doodles()");
    for (const id of ids.slice(0, 10))
      expect(await f.moderate(id, "PROMOTE")).toBe("HALL");
    expect(await f.moderate(ids[10], "PROMOTE")).toBe(
      "NOT_HIGHER_THAN_INCUMBENT",
    );
    expect(await f.moderate(ids[11], "PROMOTE")).toBe("HALL");
    const hall = (await f.rpc(1, "read_doodles")).hall;
    expect(hall).toHaveLength(10);
    expect(hall[0].score).toBe(6);
    await expect(f.rpc(1, "appreciate_doodle", [hall[0].id])).rejects.toThrow();
    await expect(
      f.exec("update private.doodles set final_score=999 where id=$1", [
        hall[0].id,
      ]),
    ).rejects.toThrow();
    await f.advance(7 * 24 * 60 + 1);
    await f.exec("select private.cleanup_doodles()");
    expect((await f.rpc(1, "read_doodles")).hall).toHaveLength(10);
  });
  it("reporting is private, unique, bounded, and never automatically removes content", async () => {
    const id = await submit(17);

    expect(await f.rpc(18, "report_doodle", [id, "ABUSE"])).toBe(true);
    expect(await f.rpc(18, "report_doodle", [id, "ABUSE"])).toBe(false);
    await expect(
      f.rpc(19, "report_doodle", [id, "arbitrary"]),
    ).rejects.toThrow();
    expect((await f.rpc(18, "read_doodles")).items).toHaveLength(1);
    await f.moderate(id, "REMOVE");
    await expect(f.rpc(18, "doodle_replay", [id])).rejects.toThrow();
    await expect(f.rpc(18, "appreciate_doodle", [id])).rejects.toThrow();
  });
  it("removes author Hall content on deactivation, preserves unrelated content and terminal deletion", async () => {
    const before = (await f.rpc(1, "read_doodles")).hall;
    await f.rpc(16, "deactivate_my_account");
    const after = (await f.rpc(1, "read_doodles")).hall;
    expect(after).toHaveLength(before.length - 1);
    expect(
      after.every(
        (d: { atomNumber: string }) => d.atomNumber !== f.people[16].number,
      ),
    ).toBe(true);
    expect(
      (
        await f.exec(
          "select count(*)::int n from private.doodles where atom_id=$1",
          [f.people[16].atom],
        )
      ).rows[0].n,
    ).toBe(0);
    const id = await submit(24);

    await f.rpc(24, "delete_my_account", ["DELETE"]);
    await expect(f.rpc(1, "doodle_replay", [id])).rejects.toThrow();
    expect(
      (
        await f.exec(
          "select count(*)::int n from private.doodle_accounts where atom_id=$1",
          [f.people[24].atom],
        )
      ).rows[0].n,
    ).toBe(0);
  });
  it("publication expires at one hour; threshold changes apply prospectively", async () => {
    const id = await submit(25);
    await f.advance(60);
    await expect(f.moderate(id, "APPROVE")).rejects.toThrow();
    await f.rpc(0, "doodle_admin_settings", [8]);
    await expect(f.rpc(0, "doodle_admin_settings", [0])).rejects.toThrow();
    await expect(f.rpc(0, "doodle_admin_settings", [4])).rejects.toThrow();
    const fresh = await submit(25);

    expect(
      (
        await f.exec("select threshold from private.doodles where id=$1", [
          fresh,
        ])
      ).rows[0].threshold,
    ).toBe(8);
    await f.rpc(0, "doodle_admin_settings", [5]);
    expect(
      (
        await f.exec("select threshold from private.doodles where id=$1", [
          fresh,
        ])
      ).rows[0].threshold,
    ).toBe(8);
  });
  it("bounds replay storage, cleanup batches and report frequency; removes administrator privilege on deactivation", async () => {
    const points = Array.from({ length: 4096 }, (_, i) => i);
    const drawing = {
      version: 1,
      bitmap: Buffer.alloc(512, 255).toString("base64"),
      strokes: Array.from({ length: 256 }, (_, i) => ({
        draw: true,
        points: points.slice((i % 128) * 32, ((i % 128) + 1) * 32),
      })),
    };
    const packed = await f.exec(
      "select octet_length(private.doodle_pack($1::jsonb))::int n",
      [JSON.stringify(drawing)],
    );
    expect(packed.rows[0].n).toBe(16896);
    await expect(
      f.exec("select private.doodle_pack($1::jsonb)", [
        JSON.stringify({
          ...drawing,
          strokes: [...drawing.strokes, drawing.strokes[0]],
        }),
      ]),
    ).rejects.toThrow();
    await expect(
      f.exec("select private.cleanup_doodles(null)"),
    ).rejects.toThrow();
    await expect(
      f.exec("select private.cleanup_doodles(1001)"),
    ).rejects.toThrow();
    const hall = (await f.rpc(18, "read_doodles")).hall;
    await f.exec(
      "insert into private.doodle_accounts(atom_id,report_window,reports_in_window) values($1,private.doodle_now(),10) on conflict(atom_id) do update set report_window=excluded.report_window,reports_in_window=10",
      [f.people[18].atom],
    );
    await expect(
      f.rpc(18, "report_doodle", [hall[0].id, "ABUSE"]),
    ).rejects.toThrow();
    await f.exec(
      "insert into private.signal_administrators(auth_user_id) values($1)",
      [f.people[20].user],
    );
    await f.rpc(20, "doodle_admin_queue");
    await f.rpc(20, "deactivate_my_account");
    await expect(f.rpc(20, "doodle_admin_queue")).rejects.toThrow();
  });
});
