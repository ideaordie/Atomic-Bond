// Disposable loopback PostgreSQL only; never reads production credentials.
import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createServer } from "node:net";
import assert from "node:assert/strict";
import { createQueueFixture } from "../tests/helpers/puzzle-queue-fixture.mjs";
const root = resolve("artifacts/queue-database-tests");
await mkdir(root, { recursive: true });
const directory = await mkdtemp(root + sep + "postgres-");
const listener = createServer();
await new Promise((r) => listener.listen(0, "127.0.0.1", r));
const port = listener.address().port;
await new Promise((r) => listener.close(r));
const pg = new EmbeddedPostgres({
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
let admin,
  started = false;
try {
  await pg.initialise();
  await pg.start();
  started = true;
  admin = pg.getPgClient();
  await admin.connect();
  const db = {
    query: (s, a) => admin.query(s, a),
    exec: (s) => admin.query(s),
    transaction: async (fn) => {
      const c = pg.getPgClient();
      await c.connect();
      try {
        await c.query("begin");
        const result = await fn({
          query: (s, a) => c.query(s, a),
          exec: (s) => c.query(s),
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
  const f = await createQueueFixture(db);
  await f.adopt();
  await f.manage("resume");
  const next = (await f.manage("add", { batch: await f.batch() })).puzzle;
  // Final two placements compete; only one wins the expected revision.
  await f.exec(
    "update private.puzzle_pieces set position=solution,locked=true where puzzle_id=$1 and solution<24",
    [f.puzzle],
  );
  const [one, two] = await Promise.all([
    f.call(1, "reveal", { revision: 0 }),
    f.call(2, "reveal", { revision: 0 }),
  ]);
  assert.equal([one, two].filter((x) => !x.error).length, 1);
  const actor = one.error ? 2 : 1;
  const read = await f.read(actor);
  const command = {
    piece: read.reservation.piece,
    to: 24,
    revision: read.revision,
  };
  const placed = await Promise.all([
    f.call(actor, "place", command),
    f.call(actor, "place", command),
  ]);
  assert.equal(placed.filter((x) => !x.error).length, 1);
  assert.equal((await f.read(actor)).status, "CELEBRATING");
  const deadlines = (
    await f.exec(
      "select atom_id,place_after::text,move_after::text from private.puzzle_allowances order by atom_id",
    )
  ).rows;
  await f.exec("update private.doodle_test_clock set t=t+interval '1 hour'");
  await Promise.all(
    Array.from({ length: 8 }, () =>
      db.transaction((tx) => tx.query("select private.puzzle_queue_advance()")),
    ),
  );
  assert.equal((await f.rpc(1, "puzzle_request", ["read"])).puzzle.id, next);
  assert.equal(
    (
      await f.exec(
        "select count(*)::int n from private.puzzle_queue_events where action='ACTIVE' and puzzle_id=$1",
        [next],
      )
    ).rows[0].n,
    1,
  );
  assert.deepEqual(
    (
      await f.exec(
        "select atom_id,place_after::text,move_after::text from private.puzzle_allowances order by atom_id",
      )
    ).rows,
    deadlines,
  );
  const reservation = (await f.call(1, "reveal", { puzzle: next, revision: 0 }))
    .puzzle.reservation;
  await Promise.all([
    db.transaction((tx) => tx.query("select private.puzzle_run_cleanup()")),
    f.rpc(1, "puzzle_media_get", [next, reservation.piece]),
  ]);
  assert.equal(
    (await f.rpc(1, "puzzle_media_get", [next, reservation.piece])).bytes,
    12,
  );
  await admin.end();
  admin = null;
  await pg.stop();
  started = false;
  await pg.start();
  started = true;
  admin = pg.getPgClient();
  await admin.connect();
  assert.equal((await f.rpc(1, "puzzle_request", ["read"])).puzzle.id, next);
  assert.deepEqual(
    (
      await f.exec(
        "select atom_id,place_after::text,move_after::text from private.puzzle_allowances order by atom_id",
      )
    ).rows,
    deadlines,
  );
  console.log(
    "PASS: concurrent reveal/final placement; single advancement; cleanup/media race; restart and cross-puzzle cooldown preservation.",
  );
} finally {
  await admin?.end();
  if (started) await pg.stop();
  const target = resolve(directory);
  if (!target.startsWith(root + sep) || target === root)
    throw Error("Unsafe cleanup path");
  await rm(target, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
