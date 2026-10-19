import { afterAll, beforeAll, expect, test } from "vitest";
// @ts-expect-error Isolated JavaScript database fixture.
import { createEvolveFixture } from "../helpers/evolve-fixture.mjs";
let f: Awaited<ReturnType<typeof createEvolveFixture>>;
beforeAll(async () => {
  f = await createEvolveFixture();
}, 60000);
afterAll(async () => {
  await f?.db.close();
});
test("default-off, live owner authorization, RLS and private helper restrictions", async () => {
  await expect(f.call(1, "list")).rejects.toThrow("disabled");
  await f.enable();
  await expect(f.call(-1, "list")).rejects.toThrow();
  await f.db.transaction(async (tx: typeof f.db) => {
    await tx.exec("set local role authenticated");
    await expect(
      tx.query("select * from private.evolve_ideas"),
    ).rejects.toThrow();
  });
  expect(
    (
      await f.exec(
        "select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('evolve_accounts','evolve_ideas','evolve_support','evolve_history','evolve_settings') and c.relrowsecurity",
      )
    ).rows[0].n,
  ).toBe(5);
  expect(
    (
      await f.exec(
        "select has_function_privilege('authenticated','private.evolve_cleanup(integer)','EXECUTE') allowed",
      )
    ).rows[0].allowed,
  ).toBe(false);
});
test("pending author visibility, exact rolling cooldown, validation and stale replay", async () => {
  const r = await f.submit(1);
  expect(r.data.moderation).toBe("PENDING");
  expect((await f.call(2, "list")).data).toEqual([]);
  expect((await f.call(1, "list")).data).toHaveLength(1);
  expect(
    (await f.call(1, "submit", { body: "replay", revision: 0 })).error,
  ).toBe("STALE_REVISION");
  expect((await f.submit(1, "second")).error).toBe("SUBMISSION_COOLDOWN");
  await f.advance(1439.999);
  expect((await f.submit(1, "second")).error).toBe("SUBMISSION_COOLDOWN");
  await f.advance(0.001);
  expect((await f.submit(1, "second")).data.body).toBe("second");
  await f.advance(1440);
  expect((await f.submit(1, " SECOND ")).error).toBe("DUPLICATE_IDEA");
  expect((await f.submit(2, "x".repeat(251))).error).toBe("INVALID_REQUEST");
  expect((await f.submit(2, " ")).error).toBe("INVALID_REQUEST");
  expect(
    (
      await f.call(2, "submit", {
        body: "test",
        revision: 0,
        owner_id: f.people[1].atom,
      })
    ).error,
  ).toBe("INVALID_REQUEST");
});
test("admin decisions, equal support, withdrawal, privacy and private recognition", async () => {
  const idea = (await f.submit(3)).data;
  expect(
    (
      await f.call(0, "moderate", {
        id: idea.id,
        revision: idea.revision,
        status: "PROPOSED",
        moderation: "VISIBLE",
        explanation: " ",
      })
    ).error,
  ).toBe("INVALID_REQUEST");
  expect((await f.call(3, "moderate", { id: idea.id })).error).toBe(
    "FORBIDDEN",
  );
  expect((await f.call(3, "history", { id: idea.id })).error).toBe("FORBIDDEN");
  expect((await f.moderate(idea)).data.id).toBe(idea.id);
  for (const actor of [0, 3, 4]) {
    const state = await f.call(actor, "list");
    const payload = { id: idea.id, supported: true, revision: state.revision };
    expect((await f.call(actor, "support", payload)).data.supported).toBe(true);
    expect((await f.call(actor, "support", payload)).error).toBe(
      "STALE_REVISION",
    );
  }
  let admin = (await f.call(0, "admin_list")).data.find(
    (x: { id: string }) => x.id === idea.id,
  );
  expect(admin.supportCount).toBe(3);
  const state = await f.call(4, "list");
  expect(
    (
      await f.call(4, "support", {
        id: idea.id,
        supported: false,
        revision: state.revision,
      })
    ).data.supported,
  ).toBe(false);
  await f.moderate(admin, "VISIBLE", "LIVE");
  const output = await f.call(3, "list");
  expect(
    output.data.find((x: { id: string }) => x.id === idea.id)
      .acknowledgmentEligible,
  ).toBe(true);
  for (const p of f.people) {
    expect(JSON.stringify(output)).not.toContain(p.user);
    expect(JSON.stringify(output)).not.toContain(p.atom);
  }
  expect(
    output.data.find((x: { id: string }) => x.id === idea.id).supportCount,
  ).toBe(2);
  expect((await f.call(0, "history", { id: idea.id })).data).toHaveLength(2);
  admin = (await f.call(0, "admin_list")).data.find(
    (x: { id: string }) => x.id === idea.id,
  );
  await f.moderate(admin, "REMOVED", "DECLINED");
  expect(
    (await f.call(3, "list")).data.some(
      (x: { id: string }) => x.id === idea.id,
    ),
  ).toBe(false);
  const tombstone = (
    await f.exec("select * from private.evolve_ideas where id=$1", [idea.id])
  ).rows[0];
  expect(tombstone.body).toBeNull();
  expect(tombstone.owner_id).toBeNull();
});
test("inactive lifecycle hides content, deletes support, preserves cooldown; deletion redacts", async () => {
  const idea = (await f.submit(5)).data;
  await f.moderate(idea);
  await f.call(6, "support", { id: idea.id, supported: true, revision: 0 });
  await f.rpc(5, "deactivate_my_account");
  await expect(f.call(5, "list")).rejects.toThrow();
  expect(
    (await f.call(6, "list")).data.some(
      (x: { id: string }) => x.id === idea.id,
    ),
  ).toBe(false);
  expect(
    (
      await f.exec(
        "select count(*)::int n from private.evolve_support where idea_id=$1",
        [idea.id],
      )
    ).rows[0].n,
  ).toBe(0);
  // Synthetic successful reauthentication after the lifecycle epoch.
  await f.exec(
    "update auth.sessions set created_at=clock_timestamp() where id=$1",
    [f.people[5].session],
  );
  await f.rpc(5, "reactivate_my_account");
  expect((await f.submit(5, "bypass")).error).toBe("SUBMISSION_COOLDOWN");
  expect((await f.call(5, "list")).data[0].moderation).toBe("HIDDEN");
  await f.rpc(5, "delete_my_account", ["DELETE"]);
  expect(
    (
      await f.exec(
        "select body,owner_id from private.evolve_ideas where id=$1",
        [idea.id],
      )
    ).rows[0],
  ).toEqual({ body: null, owner_id: null });
  await expect(f.call(5, "list")).rejects.toThrow();
  await f.exec("update public.atoms set status='DORMANT' where id=$1", [
    f.people[7].atom,
  ]);
  await expect(
    f.call(7, "submit", { body: "no", revision: 0 }),
  ).rejects.toThrow();
});
test("throttle persists for rejected requests; bounded cleanup preserves published ideas", async () => {
  for (let n = 0; n < 30; n++)
    expect((await f.call(8, "invalid")).error).toBe("INVALID_REQUEST");
  expect((await f.call(8, "list")).error).toBe("RATE_LIMIT");
  await f.advance(1);
  expect((await f.call(8, "list")).data).toBeDefined();
  const idea = (await f.submit(9)).data;
  await f.moderate(idea);
  await f.advance(31 * 1440);
  expect((await f.exec("select private.evolve_cleanup(1) n")).rows[0].n).toBe(
    1,
  );
  await f.exec("select private.evolve_cleanup(100)");
  expect(
    (
      await f.exec("select moderation from private.evolve_ideas where id=$1", [
        idea.id,
      ])
    ).rows[0].moderation,
  ).toBe("VISIBLE");
  await f.advance(31 * 1440);
  await f.exec("select private.evolve_cleanup(100)");
  expect((await f.exec("select private.evolve_cleanup(100) n")).rows[0].n).toBe(
    0,
  );
});

test("bounded keyset pagination keeps every pending idea reviewable", async () => {
  await f.advance(1);
  await f.exec(
    `insert into private.evolve_ideas(owner_id,body,created_at,updated_at,purge_at)
    select $1,'Synthetic page '||n,private.evolve_now()+n*interval '1 second',private.evolve_now(),private.evolve_now()+interval '30 days' from generate_series(1,30) n`,
    [f.people[10].atom],
  );
  const first = (await f.call(0, "admin_list")).data;
  expect(first).toHaveLength(25);
  const cursor = first.at(-1);
  const second = (
    await f.call(0, "admin_list", {
      before: cursor.createdAt,
      beforeId: cursor.id,
    })
  ).data;
  const ids = [...first, ...second].map((item: { id: string }) => item.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(
    [...first, ...second].filter((item: { body: string | null }) =>
      item.body?.startsWith("Synthetic page"),
    ),
  ).toHaveLength(30);
  expect(
    (await f.call(11, "list")).data.some((item: { body: string | null }) =>
      item.body?.startsWith("Synthetic page"),
    ),
  ).toBe(false);
});

test("malformed actions, direct privileges, revoked sessions and unverified users fail safely", async () => {
  expect(
    (
      await f.call(12, "support", {
        id: "not-a-uuid",
        supported: true,
        revision: 0,
      })
    ).error,
  ).toBe("INVALID_REQUEST");
  expect((await f.call(12, "submit", { body: "missing revision" })).error).toBe(
    "STALE_REVISION",
  );
  await f.exec("delete from auth.sessions where id=$1", [f.people[13].session]);
  await expect(f.call(13, "list")).rejects.toThrow("Live owner session");
  await f.exec("update auth.users set email_confirmed_at=null where id=$1", [
    f.people[14].user,
  ]);
  await expect(
    f.call(14, "submit", { body: "unverified", revision: 0 }),
  ).rejects.toThrow();
  const access =
    await f.exec(`select has_table_privilege('authenticated','private.evolve_support','INSERT') as support,
    has_table_privilege('authenticated','private.evolve_history','SELECT') as history,
    has_function_privilege('anon','public.evolve_request(text,jsonb)','EXECUTE') as anonymous`);
  expect(access.rows[0]).toEqual({
    support: false,
    history: false,
    anonymous: false,
  });
});
