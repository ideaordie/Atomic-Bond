// Disposable loopback PostgreSQL only. No environment database URL or credentials.
import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createServer } from "node:net";
import assert from "node:assert/strict";
import { createEvolveFixture } from "../tests/helpers/evolve-fixture.mjs";
const root = resolve("artifacts/database-tests");
await mkdir(root, { recursive: true });
const directory = await mkdtemp(`${root}${sep}evolve-`);
const listener = createServer();
await new Promise((done) => listener.listen(0, "127.0.0.1", done));
const port = listener.address().port;
await new Promise((done) => listener.close(done));
const postgres = new EmbeddedPostgres({
  databaseDir: directory,
  port,
  user: "postgres",
  password: randomBytes(32).toString("hex"),
  persistent: true,
  createPostgresUser: false,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
let started = false,
  admin;
try {
  await postgres.initialise();
  await postgres.start();
  started = true;
  admin = postgres.getPgClient();
  await admin.connect();
  const wrap = (client) => ({
    query: (sql, args) => client.query(sql, args),
    exec: (sql) => client.query(sql),
  });
  const db = {
    ...wrap(admin),
    transaction: async (work) => {
      const client = postgres.getPgClient();
      await client.connect();
      try {
        await client.query("begin");
        const result = await work(wrap(client));
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        await client.end();
      }
    },
  };
  const f = await createEvolveFixture(db);
  await f.enable();
  const submissions = await Promise.all(
    Array.from({ length: 8 }, (_, n) =>
      f.call(1, "submit", { body: `Concurrent idea ${n}`, revision: 0 }),
    ),
  );
  assert.equal(submissions.filter((r) => r.data).length, 1);
  assert.equal(
    submissions.filter((r) => r.error === "STALE_REVISION").length,
    7,
  );
  const idea = submissions.find((r) => r.data).data;
  await f.moderate(idea);
  const votes = await Promise.all(
    Array.from({ length: 8 }, () =>
      f.call(2, "support", { id: idea.id, supported: true, revision: 0 }),
    ),
  );
  assert.equal(votes.filter((r) => r.data).length, 1);
  assert.equal(
    (
      await f.exec(
        "select count(*)::int n from private.evolve_support where idea_id=$1",
        [idea.id],
      )
    ).rows[0].n,
    1,
  );
  await Promise.all(
    [3, 4, 5].map((actor) =>
      f.call(actor, "support", { id: idea.id, supported: true, revision: 0 }),
    ),
  );
  assert.equal(
    (
      await f.exec(
        "select count(*)::int n from private.evolve_support where idea_id=$1",
        [idea.id],
      )
    ).rows[0].n,
    4,
  );
  const race = await Promise.all([
    f.call(2, "support", { id: idea.id, supported: false, revision: 1 }),
    f.call(2, "support", { id: idea.id, supported: true, revision: 1 }),
  ]);
  assert.equal(race.filter((r) => r.data).length, 1);
  assert.equal(race.filter((r) => r.error === "STALE_REVISION").length, 1);
  const lifecycle = await Promise.allSettled([
    f.call(6, "support", { id: idea.id, supported: true, revision: 0 }),
    f.rpc(6, "deactivate_my_account"),
  ]);
  assert.equal(lifecycle[1].status, "fulfilled");
  assert.equal(
    (
      await f.exec(
        "select count(*)::int n from private.evolve_support where atom_id=$1",
        [f.people[6].atom],
      )
    ).rows[0].n,
    0,
  );
  const authorRace = await Promise.allSettled([
    f.submit(7, "Lifecycle race"),
    f.rpc(7, "deactivate_my_account"),
  ]);
  assert.equal(authorRace[1].status, "fulfilled");
  assert.equal(
    (
      await f.exec(
        "select count(*)::int n from private.evolve_ideas where owner_id=$1 and moderation='VISIBLE'",
        [f.people[7].atom],
      )
    ).rows[0].n,
    0,
  );
  const current = (await f.call(0, "admin_list")).data.find(
    (i) => i.id === idea.id,
  );
  const moderation = await Promise.all([
    f.moderate(current, "HIDDEN"),
    f.moderate(current, "VISIBLE", "PLANNED"),
  ]);
  assert.equal(moderation.filter((r) => r.data).length, 1);
  assert.equal(
    moderation.filter((r) => r.error === "STALE_REVISION").length,
    1,
  );
  await Promise.all([
    f.exec("select private.evolve_cleanup(100)"),
    f.call(8, "list"),
  ]);
  assert.equal(
    (
      await f.exec(
        "select count(*)::int n from private.evolve_ideas where id=$1",
        [idea.id],
      )
    ).rows[0].n,
    1,
  );
  const withdrawalIdea = (await f.submit(9, "Concurrent author withdrawal"))
    .data;
  await f.moderate(withdrawalIdea);
  const withdrawalRace = await Promise.all([
    f.call(9, "withdraw", { id: withdrawalIdea.id, revision: 1 }),
    ...[10, 11, 12, 13].map((actor) =>
      f.call(actor, "support", {
        id: withdrawalIdea.id,
        supported: true,
        revision: 0,
      }),
    ),
  ]);
  assert.ok(withdrawalRace[0].data);
  assert.ok(
    withdrawalRace.slice(1).every((r) => r.data || r.error === "NOT_AVAILABLE"),
  );
  assert.equal(
    (
      await f.exec(
        "select count(*)::int n from private.evolve_support where idea_id=$1",
        [withdrawalIdea.id],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await f.exec("select moderation from private.evolve_ideas where id=$1", [
        withdrawalIdea.id,
      ])
    ).rows[0].moderation,
    "HIDDEN",
  );
  assert.equal(
    (await f.call(14, "list")).data.some((i) => i.id === withdrawalIdea.id),
    false,
  );
  const removedIdea = (await f.submit(15, "Concurrent deletion")).data;
  await f.moderate(removedIdea);
  await Promise.allSettled([
    f.call(15, "withdraw", { id: removedIdea.id, revision: 1 }),
    f.rpc(15, "delete_my_account", ["DELETE"]),
    f.exec("select private.evolve_cleanup(100)"),
  ]);
  const removed = (
    await f.exec(
      "select body,owner_id,moderation from private.evolve_ideas where id=$1",
      [removedIdea.id],
    )
  ).rows[0];
  assert.deepEqual(removed, {
    body: null,
    owner_id: null,
    moderation: "REMOVED",
  });
  console.log(
    "PASS: 8-way submissions/votes, equal influence, competing support withdrawal, author withdrawal versus four supporters, deletion/withdrawal/cleanup, lifecycle races and stale moderation on isolated PostgreSQL.",
  );
} finally {
  await admin?.end();
  if (started) await postgres.stop();
  const target = resolve(directory);
  if (!target.startsWith(root + sep) || target === root)
    throw new Error("Unsafe cleanup path");
  await rm(target, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
