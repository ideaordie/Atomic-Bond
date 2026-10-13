// Disposable native PostgreSQL only. No environment files or hosted credentials.
import EmbeddedPostgres from "embedded-postgres";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createServer } from "node:net";
import assert from "node:assert/strict";
import { createPuzzleFixture } from "../tests/helpers/puzzle-fixture.mjs";
const root = resolve("artifacts/database-tests");
await mkdir(root, { recursive: true });
const directory = await mkdtemp(root + sep + "puzzle-");
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
  onLog: () => {},
  onError: () => {},
});
let admin,
  started = false;
try {
  await postgres.initialise();
  await postgres.start();
  started = true;
  admin = postgres.getPgClient();
  await admin.connect();
  const adapter = {
    exec: (sql) => admin.query(sql),
    query: (sql, args) => admin.query(sql, args),
    transaction: async (fn) => {
      const c = postgres.getPgClient();
      await c.connect();
      try {
        await c.query("begin");
        const result = await fn({
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
  const f = await createPuzzleFixture(adapter);
  const reveals = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      f.call(i + 1, "reveal", { revision: 0 }),
    ),
  );
  assert.equal(reveals.filter((r) => r.puzzle).length, 1);
  const winner = reveals.findIndex((r) => r.puzzle) + 1;
  let q = await f.read(winner);
  const id = q.reservation.piece;
  const mediaTicket = (await f.call(winner, "tile", { piece: id })).ticket;
  const mediaAttempts = await Promise.allSettled(
    Array.from({ length: 8 }, () => f.media(mediaTicket)),
  );
  assert.equal(mediaAttempts.filter((r) => r.status === "fulfilled").length, 1);
  console.log(
    "PASS: eight concurrent media-ticket redemptions produce one authorized resolution.",
  );
  const request = randomUUID();
  const args = {
    revision: q.revision,
    piece: id,
    to: await f.solution(id),
    request,
  };
  const placements = await Promise.all(
    Array.from({ length: 8 }, () => f.call(winner, "place", args)),
  );
  assert.ok(
    placements.every(
      (r) => JSON.stringify(r) === JSON.stringify(placements[0]),
    ),
  );
  assert.equal((await f.read(winner)).placements, 1);
  // Deactivation races with a reservation. Either order must end without reservation.
  const actor = winner === 6 ? 5 : 6;
  q = await f.read(actor);
  await Promise.allSettled([
    f.call(actor, "reveal", { revision: q.revision }),
    f.rpc(actor, "deactivate_my_account"),
  ]);
  assert.equal(
    (
      await f.exec(
        "select count(*)::int n from private.puzzle_reservations where atom_id=$1",
        [f.people[actor].atom],
      )
    ).rows[0].n,
    0,
  );
  // Serialize two moves from the same board snapshot. Exactly one revision wins.
  await f.exec(
    "update private.puzzle_pieces set position=case solution when 0 then 1 when 1 then 0 else solution end,locked=(solution>1) where puzzle_id=$1",
    [f.puzzle],
  );
  const piece = (
    await f.exec(
      "select id from private.puzzle_pieces where puzzle_id=$1 and solution=0",
      [f.puzzle],
    )
  ).rows[0].id;
  q = await f.read(winner);
  const actors = [1, 2, 3, 4].filter((a) => a !== actor);
  const moves = await Promise.all(
    actors.map((a) =>
      f.call(a, "move", { revision: q.revision, piece, to: 0 }),
    ),
  );
  assert.equal(moves.filter((r) => r.puzzle).length, 1);
  assert.equal((await f.read(winner)).status, "COMPLETE");
  // Benchmark fresh reads, bounded well below ingress limits.
  const samples = [];
  let snapshot;
  for (let i = 0; i < 40; i++) {
    const t = performance.now();
    snapshot = await f.call(winner, "read");
    samples.push(performance.now() - t);
  }
  samples.sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      readMedianMs: +samples[20].toFixed(2),
      readP95Ms: +samples[38].toFixed(2),
      snapshotBytes: Buffer.byteLength(JSON.stringify(snapshot)),
      samples: 40,
    }),
  );
  await admin.end();
  admin = null;
  await postgres.stop();
  started = false;
  if (process.platform === "win32")
    await new Promise((r) => setTimeout(r, 1000));
  await postgres.start();
  started = true;
  admin = postgres.getPgClient();
  await admin.connect();
  assert.deepEqual(await f.call(winner, "place", args), placements[0]);
  assert.equal((await f.read(winner)).status, "COMPLETE");
  console.log(
    "PASS: native concurrent reveal/placement/moves, lifecycle race, atomic completion and restart-persistent idempotency.",
  );
} finally {
  await admin?.end();
  if (started) await postgres.stop();
  const target = resolve(directory);
  if (!target.startsWith(root + sep) || target === root)
    throw new Error("Unsafe cleanup");
  await rm(target, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
