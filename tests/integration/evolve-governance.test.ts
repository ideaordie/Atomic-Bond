import { afterEach, beforeEach, expect, test } from "vitest";
// @ts-expect-error Isolated shared JavaScript fixture.
import { createEvolveFixture } from "../helpers/evolve-fixture.mjs";
let f: Awaited<ReturnType<typeof createEvolveFixture>>;
beforeEach(async () => {
  f = await createEvolveFixture();
  await f.enable();
}, 60000);
afterEach(async () => {
  await f?.db.close();
});
const row = async (id: string) =>
  (await f.exec("select * from private.evolve_ideas where id=$1", [id]))
    .rows[0];
const withdraw = async (actor: number, id: string) => {
  const state = await f.call(actor, "list");
  return f.call(actor, "withdraw", { id, revision: state.revision });
};
test("withdrawal from pending and every development stage hides content and invalidates support", async () => {
  for (const [index, status] of [
    null,
    "PROPOSED",
    "UNDER REVIEW",
    "PLANNED",
    "LIVE",
    "DEFERRED",
    "DECLINED",
  ].entries()) {
    const actor = index + 1;
    const idea = (await f.submit(actor, `Stage ${status}`)).data;
    expect(idea.acknowledgment).toContain("awaiting administrator review");
    expect(
      (
        await f.exec(
          "select count(*)::int n from private.evolve_support where idea_id=$1",
          [idea.id],
        )
      ).rows[0].n,
    ).toBe(0);
    if (status) {
      await f.moderate(idea, "VISIBLE", status);
      await f.call(actor, "support", {
        id: idea.id,
        supported: true,
        revision: 1,
      });
    }
    expect((await withdraw(actor, idea.id)).data.withdrawnAt).not.toBeNull();
    const r = await row(idea.id);
    expect(r.moderation).toBe("HIDDEN");
    expect(r.attribution).toBe(false);
    expect(
      (
        await f.exec(
          "select count(*)::int n from private.evolve_support where idea_id=$1",
          [idea.id],
        )
      ).rows[0].n,
    ).toBe(0);
    expect(
      (await f.call(20, "list")).data.some(
        (x: { id: string }) => x.id === idea.id,
      ),
    ).toBe(false);
    expect(
      (
        await f.call(20, "support", {
          id: idea.id,
          supported: true,
          revision: 0,
        })
      ).error,
    ).toBe("NOT_AVAILABLE");
    expect((await f.moderate(r, "VISIBLE", "LIVE")).error).toBe(
      "NOT_AVAILABLE",
    );
  }
});
test("withdrawal cannot impersonate an author; repeat withdrawal never extends the 90-day deadline", async () => {
  const idea = (await f.submit(1)).data;
  expect(
    (await f.call(2, "withdraw", { id: idea.id, revision: 0 })).error,
  ).toBe("NOT_AVAILABLE");
  await withdraw(1, idea.id);
  const initial = await row(idea.id);
  await f.advance(89 * 1440);
  await withdraw(1, idea.id);
  expect((await row(idea.id)).purge_at).toEqual(initial.purge_at);
  expect((await f.call(1, "list")).data).toHaveLength(1);
  await f.advance(1440);
  expect((await f.call(1, "list")).data).toEqual([]);
  expect((await f.call(0, "admin_list")).data).toEqual([]);
  await f.exec("select private.evolve_cleanup(100)");
  expect((await row(idea.id)).body).toBeNull();
  expect((await row(idea.id)).owner_id).toBeNull();
  expect(
    (
      await f.exec(
        "select count(*)::int n from private.evolve_history where idea_id=$1",
        [idea.id],
      )
    ).rows[0].n,
  ).toBe(0);
  expect((await f.exec("select private.evolve_cleanup(100) n")).rows[0].n).toBe(
    0,
  );
});
test("previously public decline expires at 90 days without cleanup or repeated-review extension", async () => {
  const idea = (await f.submit(1)).data;
  await f.moderate(idea);
  await f.moderate(await row(idea.id), "VISIBLE", "DECLINED");
  const first = await row(idea.id);
  await f.advance(89 * 1440);
  await f.moderate(first, "VISIBLE", "DECLINED");
  expect((await row(idea.id)).purge_at).toEqual(first.purge_at);
  expect((await f.call(2, "list")).data).toHaveLength(1);
  await f.advance(1440);
  expect((await f.call(2, "list")).data).toEqual([]);
  expect(
    (await f.call(2, "support", { id: idea.id, supported: true, revision: 0 }))
      .error,
  ).toBe("NOT_AVAILABLE");
  expect(
    (await f.moderate(await row(idea.id), "VISIBLE", "PLANNED")).error,
  ).toBe("NOT_AVAILABLE");
});
test("deactivation shortens withdrawal retention and reactivation cannot restore content or support", async () => {
  const idea = (await f.submit(1)).data;
  await f.moderate(idea);
  await withdraw(1, idea.id);
  await f.rpc(1, "deactivate_my_account");
  const inactive = await row(idea.id);
  expect(
    new Date(inactive.purge_at).getTime() -
      new Date(inactive.updated_at).getTime(),
  ).toBe(30 * 86400000);
  await f.exec(
    "update auth.sessions set created_at=clock_timestamp() where id=$1",
    [f.people[1].session],
  );
  await f.rpc(1, "reactivate_my_account");
  await withdraw(1, idea.id);
  expect((await row(idea.id)).purge_at).toEqual(inactive.purge_at);
  expect((await f.moderate(await row(idea.id))).error).toBe("NOT_AVAILABLE");
  await f.advance(30 * 1440);
  await f.exec("select private.evolve_cleanup(100)");
  expect((await row(idea.id)).body).toBeNull();
  expect((await f.call(1, "list")).data).toEqual([]);
});
test("alias opt-in is current public text only; deletion and moderation remove identities and content", async () => {
  await f.exec(
    "update public.atoms set display_name='Synthetic alias' where id=$1",
    [f.people[1].atom],
  );
  const idea = (
    await f.call(1, "submit", {
      body: "Synthetic private suggestion",
      attribution: true,
      revision: 0,
    })
  ).data;
  expect(idea.authorAlias).toBe("Synthetic alias");
  expect(idea).not.toHaveProperty("authorPublicId");
  await f.moderate(idea);
  await f.exec("update public.atoms set display_name=null where id=$1", [
    f.people[1].atom,
  ]);
  expect((await f.call(2, "list")).data[0].authorAlias).toBeNull();
  await f.rpc(1, "delete_my_account", ["DELETE"]);
  expect((await row(idea.id)).body).toBeNull();
  expect((await row(idea.id)).owner_id).toBeNull();
  const audit = (await f.call(0, "history", { id: idea.id })).data;
  expect(audit).toEqual([]);
  expect(
    (
      await f.exec(
        "select count(*)::int n from private.evolve_history where idea_id=$1",
        [idea.id],
      )
    ).rows[0].n,
  ).toBe(0);
  expect(JSON.stringify(audit)).not.toContain("Synthetic private suggestion");
  expect(JSON.stringify(audit)).not.toContain(f.people[1].atom);
  const second = (await f.submit(3)).data;
  await f.moderate(second);
  await withdraw(3, second.id);
  await f.moderate(await row(second.id), "REMOVED", "DECLINED");
  expect((await row(second.id)).body).toBeNull();
  expect((await row(second.id)).owner_id).toBeNull();
});
test("independent sanitized release history has no identity/idea link and private audit expires at 30 days", async () => {
  const idea = (await f.submit(1, "Never copy this suggestion")).data;
  await f.moderate(idea, "VISIBLE", "LIVE");
  const payload = {
    improvement: "A released accessibility improvement",
    completedOn: "2026-01-01",
    explanation: "Keyboard navigation is improved.",
    sanitized: true,
  };
  expect((await f.call(1, "publish_history", payload)).error).toBe("FORBIDDEN");
  expect(
    (await f.call(0, "publish_history", { ...payload, sanitized: false }))
      .error,
  ).toBe("INVALID_REQUEST");
  expect(
    (await f.call(0, "publish_history", { ...payload, ideaId: idea.id })).error,
  ).toBe("INVALID_REQUEST");
  const entry = await f.call(0, "publish_history", payload);
  expect(entry.data.id).toBeDefined();
  await withdraw(1, idea.id);
  await f.rpc(1, "delete_my_account", ["DELETE"]);
  const history = (await f.call(2, "development_history")).data;
  expect(history).toHaveLength(1);
  expect(JSON.stringify(history)).not.toContain(idea.id);
  expect(JSON.stringify(history)).not.toContain("Never copy");
  for (const person of f.people) {
    expect(JSON.stringify(history)).not.toContain(person.atom);
    expect(JSON.stringify(history)).not.toContain(person.user);
  }
  expect((await f.call(2, "history", { id: idea.id })).error).toBe("FORBIDDEN");
  expect((await f.call(0, "history")).data.length).toBeGreaterThan(0);
  await f.advance(30 * 1440);
  expect((await f.call(0, "history")).data).toEqual([]);
  expect((await f.call(0, "history", { id: idea.id })).data).toEqual([]);
  await f.exec("select private.evolve_cleanup(100)");
  expect(
    (await f.exec("select count(*)::int n from private.evolve_history")).rows[0]
      .n,
  ).toBe(0);
  expect((await f.call(2, "development_history")).data).toHaveLength(1);
  const access = (
    await f.exec(
      "select relrowsecurity rls from pg_class where oid='private.evolve_development_history'::regclass",
    )
  ).rows[0];
  expect(access.rls).toBe(true);
  expect(
    (
      await f.exec(
        "select has_table_privilege('authenticated','private.evolve_development_history','SELECT') allowed",
      )
    ).rows[0].allowed,
  ).toBe(false);
  expect((await f.call(2, "remove_history", { id: entry.data.id })).error).toBe(
    "FORBIDDEN",
  );
  await f.call(0, "remove_history", { id: entry.data.id });
  expect((await f.call(2, "development_history")).data).toEqual([]);
});

test("cleanup failure rolls back, retry clears expired content, and repeated cleanup is idempotent", async () => {
  const idea = (await f.submit(1, "Disposable cleanup failure fixture")).data;
  await withdraw(1, idea.id);
  await f.advance(90 * 1440);
  await f.db
    .exec(`create function private.evolve_fail_cleanup() returns trigger language plpgsql as $$begin raise exception 'Synthetic cleanup failure';end$$;
    create trigger evolve_test_failure before update on private.evolve_ideas for each row execute function private.evolve_fail_cleanup()`);
  await expect(f.exec("select private.evolve_cleanup(100)")).rejects.toThrow(
    "Synthetic cleanup failure",
  );
  expect((await row(idea.id)).body).toBe("Disposable cleanup failure fixture");
  expect((await f.call(2, "list")).data).toEqual([]);
  await f.db.exec(
    "drop trigger evolve_test_failure on private.evolve_ideas; drop function private.evolve_fail_cleanup()",
  );
  await f.exec("select private.evolve_cleanup(100)");
  expect((await row(idea.id)).body).toBeNull();
  expect((await row(idea.id)).owner_id).toBeNull();
  expect((await f.exec("select private.evolve_cleanup(100) n")).rows[0].n).toBe(
    0,
  );
});

test("production cleanup runner records failure and recovery; health is administrator-only", async () => {
  for (const role of ["anon", "service_role", "atomic_bond_growth"]) {
    const privileges = (
      await f.exec(
        "select has_function_privilege($1,'public.evolve_request(text,jsonb)','EXECUTE') request, has_function_privilege($1,'public.evolve_cleanup_status()','EXECUTE') health",
        [role],
      )
    ).rows[0];
    expect(privileges).toEqual({ request: false, health: false });
  }
  const idea = (await f.submit(1, "Operational cleanup fixture")).data;
  await withdraw(1, idea.id);
  await f.advance(90 * 1440);
  await f.db.exec(
    `create function private.evolve_fail_run() returns trigger language plpgsql as $$begin raise exception 'Synthetic failure';end$$;create trigger evolve_test_failure before update on private.evolve_ideas for each row execute function private.evolve_fail_run()`,
  );
  const failed = (await f.exec("select private.evolve_run_cleanup() result"))
    .rows[0].result;
  expect(failed.ok).toBe(false);
  await expect(f.rpc(1, "evolve_cleanup_status")).rejects.toThrow();
  expect((await f.rpc(0, "evolve_cleanup_status")).last_ok).toBe(false);
  await f.db.exec(
    "drop trigger evolve_test_failure on private.evolve_ideas;drop function private.evolve_fail_run()",
  );
  expect(
    (await f.exec("select private.evolve_run_cleanup() result")).rows[0].result
      .ok,
  ).toBe(true);
  expect((await f.rpc(0, "evolve_cleanup_status")).last_ok).toBe(true);
  expect((await row(idea.id)).body).toBeNull();
});
