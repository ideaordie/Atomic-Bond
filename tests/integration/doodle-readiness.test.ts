import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
// @ts-expect-error Shared isolated JavaScript fixture.
import * as fixture from "../helpers/doodle-fixture.mjs";
const { createDoodleFixture, fixtureDrawing } = fixture;
let f: Awaited<ReturnType<typeof createDoodleFixture>>;
beforeAll(async () => {
  f = await createDoodleFixture();
}, 60000);
afterAll(async () => {
  await f?.db.close();
});

describe("Doodle production readiness", () => {
  it("preserves unfinalized qualifiers beyond a cleanup batch", async () => {
    const backlog = await createDoodleFixture();
    try {
      await backlog.exec(
        `insert into private.doodles(atom_id,request_id,bitmap,state,submitted_at,published_at,expires_at,purge_at,threshold)
        select $1,gen_random_uuid(),decode($2,'base64'),'PUBLISHED',private.doodle_now()-interval '1 hour',private.doodle_now()-interval '1 hour',private.doodle_now(),private.doodle_now(),5 from generate_series(1,1001)`,
        [backlog.people[1].atom, fixtureDrawing().bitmap],
      );
      for (const voter of [2, 3, 4, 5, 6])
        await backlog.exec(
          "insert into private.doodle_appreciations select id,$1,private.doodle_now()-interval '1 minute' from private.doodles",
          [backlog.people[voter].atom],
        );
      await backlog.exec("select private.cleanup_doodles(500)");
      expect(
        (await backlog.exec("select count(*)::int n from private.doodles"))
          .rows[0].n,
      ).toBe(1001);
      expect(
        (
          await backlog.exec(
            "select count(*)::int n from private.doodles where state='PUBLISHED'",
          )
        ).rows[0].n,
      ).toBe(1);
      await backlog.exec("select private.cleanup_doodles(500)");
      expect(
        (
          await backlog.exec(
            "select count(*)::int n from private.doodles where state='CANDIDATE' and final_score=5",
          )
        ).rows[0].n,
      ).toBe(1001);
      expect((await backlog.rpc(2, "read_doodles")).items).toEqual([]);
    } finally {
      await backlog.db.close();
    }
  }, 60000);
  it("makes more than 100 equal-time review records accessible through stable bounded pages", async () => {
    // Isolated equal-time cursor stress fixture, never hosted data.
    await f.exec(
      `insert into private.doodles(atom_id,request_id,bitmap,state,submitted_at,published_at,expires_at,purge_at,threshold)
      select $1,gen_random_uuid(),decode($2,'base64'),'PUBLISHED',private.doodle_now(),private.doodle_now(),private.doodle_now()+interval '1 hour',private.doodle_now()+interval '1 hour',5
      from generate_series(1,126)`,
      [f.people[1].atom, fixtureDrawing().bitmap],
    );
    const seen = new Set<string>();
    let args: string[] = [];
    let pages = 0;
    for (;;) {
      const q = await f.rpc(0, "doodle_admin_queue", args);
      expect(q.items.length).toBeLessThanOrEqual(25);
      for (const item of q.items) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
      }
      pages++;
      if (q.items.length < 25) break;
      const last = q.items.at(-1);
      args = [last.submittedAt, last.id];
    }
    expect(pages).toBe(6);
    expect(seen.size).toBe(126);
    expect((await f.rpc(2, "read_doodles")).items).toHaveLength(20);
    await f.rpc(2, "submit_doodle", [randomUUID(), fixtureDrawing()]);
    await f.exec("delete from private.doodles");
  });

  it("commits failed request accounting, enforces write/read limits and denies bypass RPCs", async () => {
    for (let i = 0; i < 30; i++)
      await expect(
        f.rpc(3, "submit_doodle", [randomUUID(), { version: 1 }]),
      ).rejects.toThrow("OPERATION_REJECTED");
    await expect(
      f.rpc(3, "submit_doodle", [randomUUID(), fixtureDrawing()]),
    ).rejects.toThrow("RATE_LIMITED");
    const r = (
      await f.exec(
        "select requests,writes from private.doodle_requests where atom_id=$1",
        [f.people[3].atom],
      )
    ).rows[0];
    expect(r).toEqual({ requests: 30, writes: 30 });
    for (let i = 0; i < 120; i++) await f.rpc(4, "read_doodles");
    await expect(f.rpc(4, "read_doodles")).rejects.toThrow("RATE_LIMITED");
    await f.advance(1);
    await f.rpc(4, "read_doodles");
    await f.rpc(3, "submit_doodle", [randomUUID(), fixtureDrawing()]);
    const grants =
      await f.exec(`select proname,has_function_privilege('authenticated',p.oid,'EXECUTE') allowed
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in
      ('submit_doodle','read_doodles','doodle_replay','appreciate_doodle','report_doodle','doodle_admin_queue','doodle_admin_replay','moderate_doodle','doodle_admin_settings','restrict_doodle_author','doodle_request','doodle_admin_pause','doodle_admin_history','doodle_admin_restrict_atom')`);
    expect(grants.rows).toHaveLength(14);
    for (const row of grants.rows)
      expect(row.allowed).toBe(row.proname === "doodle_request");
    await expect(f.rpc(-1, "read_doodles")).rejects.toThrow();
    await expect(
      f.rpc(2, "moderate_doodle", [randomUUID(), "REMOVE", "fake"]),
    ).rejects.toThrow();
  });

  it("accepts over 100 submissions in a day without a global quota, while retaining per-Atom cooldown", async () => {
    const many = await createDoodleFixture();
    try {
      let accepted = 0;
      for (let round = 0; round < 5; round++) {
        for (let owner = 0; owner < 26; owner++) {
          await many.rpc(owner, "submit_doodle", [
            randomUUID(),
            fixtureDrawing(),
          ]);
          accepted++;
        }
        await expect(
          many.rpc(1, "submit_doodle", [randomUUID(), fixtureDrawing()]),
        ).rejects.toThrow();
        await many.advance(60);
      }
      expect(accepted).toBe(130);
      expect(
        (await many.exec("select count(*)::int n from private.doodles")).rows[0]
          .n,
      ).toBe(130);
      expect(
        (
          await many.exec(
            "select to_regclass('private.doodle_admission') absent",
          )
        ).rows[0].absent,
      ).toBeNull();
    } finally {
      await many.db.close();
    }
  }, 60000);

  it("pauses only new submissions, preserves live voting, resumes, and records decisions privately", async () => {
    const id = await f.rpc(8, "submit_doodle", [
      randomUUID(),
      fixtureDrawing(),
    ]);
    await expect(f.rpc(7, "doodle_admin_pause", [true])).rejects.toThrow();
    await expect(f.rpc(-1, "doodle_admin_pause", [true])).rejects.toThrow();
    await f.rpc(0, "doodle_admin_pause", [true]);
    await f.rpc(0, "doodle_admin_pause", [true]);
    expect((await f.rpc(7, "read_doodles")).submissionsPaused).toBe(true);
    await expect(
      f.rpc(9, "submit_doodle", [randomUUID(), fixtureDrawing()]),
    ).rejects.toThrow("SUBMISSIONS_PAUSED");
    expect(await f.rpc(7, "appreciate_doodle", [id])).toBe(true);
    await f.rpc(0, "doodle_admin_pause", [false]);
    await f.rpc(9, "submit_doodle", [randomUUID(), fixtureDrawing()]);
    const history = await f.rpc(0, "doodle_admin_history");
    expect(
      history.filter((h: { action: string }) => h.action === "PAUSED"),
    ).toHaveLength(1);
    expect(history.map((h: { action: string }) => h.action)).toContain(
      "RESUMED",
    );
    expect(Object.keys(history[0]).sort()).toEqual(
      ["id", "drawingId", "atomNumber", "action", "createdAt"].sort(),
    );
    await expect(f.rpc(7, "doodle_admin_history")).rejects.toThrow();
    await expect(f.rpc(-1, "doodle_admin_history")).rejects.toThrow();
  });

  it("prioritizes reports in a dedicated view, removes immediately, and supports restriction reversal after cleanup", async () => {
    const id = await f.rpc(10, "submit_doodle", [
      randomUUID(),
      fixtureDrawing(),
    ]);
    await f.rpc(11, "report_doodle", [id, "ABUSE"]);
    await f.rpc(12, "report_doodle", [id, "ABUSE"]);
    expect(await f.rpc(11, "report_doodle", [id, "ABUSE"])).toBe(false);
    const reported = await f.rpc(0, "doodle_admin_queue", [
      null,
      null,
      "REPORTED",
    ]);
    expect(reported.items.map((d: { id: string }) => d.id)).toEqual([id]);
    expect(reported.items[0].reportCount).toBe(2);
    expect(reported.items[0].reportCategories).toEqual(["ABUSE"]);
    expect(
      (await f.rpc(11, "read_doodles")).items.some(
        (d: { id: string }) => d.id === id,
      ),
    ).toBe(true);
    await f.rpc(0, "restrict_doodle_author", [id, true]);
    await f.moderate(id, "REMOVE");
    expect(
      (await f.rpc(11, "read_doodles")).items.some(
        (d: { id: string }) => d.id === id,
      ),
    ).toBe(false);
    await expect(f.rpc(11, "doodle_replay", [id])).rejects.toThrow();
    await f.exec("select private.cleanup_doodles()");
    const history = await f.rpc(0, "doodle_admin_history");
    expect(
      history.some(
        (h: { action: string; drawingId: string | null }) =>
          h.action === "REMOVED" && h.drawingId === null,
      ),
    ).toBe(true);
    await f.advance(60);
    await expect(
      f.rpc(10, "submit_doodle", [randomUUID(), fixtureDrawing()]),
    ).rejects.toThrow();
    await expect(
      f.rpc(11, "doodle_admin_restrict_atom", [f.people[10].number, false]),
    ).rejects.toThrow();
    await f.rpc(0, "doodle_admin_restrict_atom", [f.people[10].number, false]);
    await f.rpc(10, "submit_doodle", [randomUUID(), fixtureDrawing()]);
  });

  it("validates every erased frame, publishes complete replay, and makes removed content unavailable", async () => {
    const bits = Buffer.alloc(512);
    bits[0] = 2;
    const drawing = {
      version: 1,
      bitmap: bits.toString("base64"),
      strokes: [
        { draw: true, points: [0, 1] },
        { draw: false, points: [0] },
      ],
    };
    const id = await f.rpc(6, "submit_doodle", [randomUUID(), drawing]);
    const review = await f.rpc(0, "doodle_admin_replay", [id]);
    expect(review).toEqual(drawing);
    expect(await f.rpc(7, "doodle_replay", [id])).toEqual(drawing);
    await expect(f.moderate(id, "APPROVE")).rejects.toThrow();
    await f.moderate(id, "REMOVE");
    await expect(f.rpc(0, "doodle_admin_replay", [id])).rejects.toThrow();
    await expect(f.rpc(7, "doodle_replay", [id])).rejects.toThrow();
    expect(
      (await f.rpc(7, "read_doodles")).items.some(
        (d: { id: string }) => d.id === id,
      ),
    ).toBe(false);
  });
  it("bounds and expires private moderation history", async () => {
    await f.advance(1);
    for (let i = 0; i < 26; i++)
      await f.rpc(0, "doodle_admin_pause", [i % 2 === 0]);
    const first = await f.rpc(0, "doodle_admin_history");
    const next = await f.rpc(0, "doodle_admin_history", [first.at(-1).id]);
    expect(first).toHaveLength(25);
    expect(next.length).toBeGreaterThan(0);
    expect(
      new Set([...first, ...next].map((h: { id: string }) => h.id)).size,
    ).toBe(first.length + next.length);
    await f.advance(31 * 1440);
    await f.exec("select private.cleanup_doodles()");
    expect(await f.rpc(0, "doodle_admin_history")).toEqual([]);
  });
});
