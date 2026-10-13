// Native PostgreSQL, isolated loopback fixture; never uses a hosted connection.
import EmbeddedPostgres from "embedded-postgres";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createServer } from "node:net";
import assert from "node:assert/strict";
import {
  createDoodleFixture,
  fixtureDrawing,
} from "../tests/helpers/doodle-fixture.mjs";
const root = resolve("artifacts/database-tests");
await mkdir(root, { recursive: true });
const directory = await mkdtemp(root + sep + "doodle-");
const listener = createServer();
await new Promise((r) => listener.listen(0, "127.0.0.1", r));
const port = listener.address().port;
await new Promise((r) => listener.close(r));
const postgres = new EmbeddedPostgres({
  databaseDir: directory,
  port,
  user: "postgres",
  password: randomBytes(32).toString("hex"),
  persistent: true,
  createPostgresUser: false,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: (message) => {
    if (message.includes("FATAL:") || message.includes("PANIC:"))
      console.error("Isolated PostgreSQL:", message);
  },
  onError: () => {},
});
let started = false,
  admin;
let stage = "initialize";
try {
  await postgres.initialise();
  stage = "start";
  await postgres.start();
  stage = "database tests";
  started = true;
  admin = postgres.getPgClient();
  await admin.connect();
  const adapter = {
    exec: (sql) => admin.query(sql),
    query: (sql, args) => admin.query(sql, args),
    transaction: async (callback) => {
      const c = postgres.getPgClient();
      await c.connect();
      try {
        await c.query("begin");
        const result = await callback({
          exec: (sql) => c.query(sql),
          query: (sql, args) => c.query(sql, args),
        });
        await c.query("commit");
        return result;
      } catch (e) {
        await c.query("rollback");
        throw e;
      } finally {
        await c.end();
      }
    },
  };
  const f = await createDoodleFixture(
      adapter,
      process.env.DOODLE_REVIEW_NEXT === "true",
      process.env.DOODLE_SEVEN_DAY_REVIEW === "true",
    ),
    drawing = fixtureDrawing(),
    key = randomUUID();
  const submissions = await Promise.all(
    Array.from({ length: 12 }, () => f.rpc(1, "submit_doodle", [key, drawing])),
  );
  assert.equal(new Set(submissions).size, 1);
  const independent = await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      f.rpc(2, "submit_doodle", [randomUUID(), drawing]),
    ),
  );
  assert.equal(independent.filter((x) => x.status === "fulfilled").length, 1);
  const id = submissions[0];

  const votes = await Promise.all(
    Array.from({ length: 16 }, () => f.rpc(3, "appreciate_doodle", [id])),
  );
  assert.equal(votes.filter(Boolean).length, 1);
  const hallIds = [];
  for (let owner = 4; owner <= 15; owner++) {
    const candidate = await f.rpc(owner, "submit_doodle", [
      randomUUID(),
      drawing,
    ]);

    for (let voter = 17; voter < 22 + (owner % 2); voter++)
      await f.rpc(voter, "appreciate_doodle", [candidate]);
    hallIds.push(candidate);
  }
  await f.advance(
    process.env.DOODLE_SEVEN_DAY_REVIEW === "true"
      ? 10080
      : process.env.DOODLE_REVIEW_NEXT === "true"
        ? 1440
        : 60,
  );
  const q = await f.rpc(0, "doodle_admin_queue");
  await Promise.all(
    hallIds.map((id) =>
      f.rpc(0, "moderate_doodle", [
        id,
        "PROMOTE",
        q.items.find((d) => d.id === id).fingerprint,
      ]),
    ),
  );
  assert.equal(
    (await f.exec("select count(*)::int n from private.doodle_hall")).rows[0].n,
    10,
  );
  assert.equal((await f.rpc(1, "read_doodles")).hall[0].score, 6);
  // Cleanup and promotion serialize; Hall payloads survive.
  await Promise.all([
    f.exec("select private.cleanup_doodles()"),
    f.rpc(0, "doodle_admin_queue"),
  ]);
  assert.equal((await f.rpc(1, "read_doodles")).hall.length, 10);
  // Immediate publication vs deactivation serializes; no content survives inactivity.
  await Promise.allSettled([
    f.rpc(16, "submit_doodle", [randomUUID(), drawing]),
    f.rpc(16, "deactivate_my_account"),
  ]);
  assert.equal(
    (
      await f.exec(
        "select count(*)::int n from private.doodles where atom_id=$1",
        [f.people[16].atom],
      )
    ).rows[0].n,
    0,
  );
  // Expired vote checks clock under the lock even if a vote started waiting earlier.
  const live = await f.rpc(17, "submit_doodle", [randomUUID(), drawing]);

  const lock = postgres.getPgClient();
  await lock.connect();
  await lock.query("begin");
  await lock.query("select private.doodle_lock()");
  const waiting = f.rpc(18, "appreciate_doodle", [live]).then(
    () => false,
    () => true,
  );
  await f.advance(
    process.env.DOODLE_SEVEN_DAY_REVIEW === "true"
      ? 10080
      : process.env.DOODLE_REVIEW_NEXT === "true"
        ? 1440
        : 60,
  );
  await lock.query("commit");
  await lock.end();
  assert.equal(await waiting, true);
  // Emergency pause and submissions share the lifecycle lock. Once pause completes,
  // all later submissions fail; publication accepted before the pause may remain.
  await Promise.allSettled([
    f.rpc(0, "doodle_admin_pause", [true]),
    ...[22, 23, 24, 25].map((owner) =>
      f.rpc(owner, "submit_doodle", [randomUUID(), drawing]),
    ),
  ]);
  assert.equal((await f.rpc(1, "read_doodles")).submissionsPaused, true);
  const blocked = await Promise.allSettled(
    [22, 23, 24, 25].map((owner) =>
      f.rpc(owner, "submit_doodle", [randomUUID(), drawing]),
    ),
  );
  assert.equal(blocked.filter((r) => r.status === "fulfilled").length, 0);
  await f.rpc(0, "doodle_admin_pause", [false]);
  // Exactly one remaining request allowance cannot be spent by concurrent callers twice.
  await f.rpc(21, "read_doodles");
  await f.exec(
    "update private.doodle_requests set requests=119 where atom_id=$1",
    [f.people[21].atom],
  );
  const reads = await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      f.rpc(
        21,
        process.env.DOODLE_NETWORK_REVIEW === "true"
          ? "read_network_doodles"
          : "read_doodles",
      ),
    ),
  );
  assert.equal(reads.filter((r) => r.status === "fulfilled").length, 1);
  if (process.env.DOODLE_NETWORK_REVIEW === "true")
    assert.equal((await f.rpc(1, "read_network_doodles")).hall.length, 10);
  await admin.end();
  admin = null;
  stage = "restart";
  await postgres.stop();
  started = false;
  // embedded-postgres uses taskkill on Windows and resolves on the parent exit;
  // allow its child processes to release shared-memory handles before restart.
  if (process.platform === "win32")
    await new Promise((resolve) => setTimeout(resolve, 1000));
  await postgres.start();
  started = true;
  admin = postgres.getPgClient();
  await admin.connect();
  assert.equal(
    (await f.exec("select count(*)::int n from private.doodle_hall")).rows[0].n,
    10,
  );
  assert.equal(await f.rpc(1, "submit_doodle", [key, drawing]), id);
  console.log(
    "PASS: native concurrent submissions, duplicate voting, Top 10 replacement, cleanup, deactivation/publication race, expiration under lock, restart-persistent idempotency.",
  );
} catch (error) {
  console.error(
    "Doodle native fixture failed during",
    stage,
    error instanceof Error ? error.message : "native process failure",
  );
  throw error;
} finally {
  await admin?.end();
  if (started) await postgres.stop();
  const target = resolve(directory);
  if (!target.startsWith(root + sep) || target === root)
    throw new Error("Unsafe fixture cleanup path");
  await rm(target, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
