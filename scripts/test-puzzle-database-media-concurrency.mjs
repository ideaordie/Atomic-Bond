// Disposable native PostgreSQL only. No environment files or hosted credentials.
import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, rm, readFile } from "node:fs/promises";
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
  const f = await createPuzzleFixture(adapter, true);
  await f.db.exec(
    await readFile(
      "supabase/candidates/202610140004_puzzle_controlled_access.sql",
      "utf8",
    ),
  );
  await f.db.exec(
    await readFile(
      "supabase/migrations/202610150001_puzzle_database_media.sql",
      "utf8",
    ),
  );
  await f.exec("update private.puzzle_access_settings set public_enabled=true");
  await f.exec(
    "insert into private.puzzle_media(asset_id,content) select id,decode('89504e470d0a1a0a00000000','hex') from private.puzzle_assets where kind<>'source'",
  );
  const direct = async (actor, piece) => {
    try {
      return (await f.rpc(actor, "puzzle_media_get", [f.puzzle, piece])).content
        ? 1
        : 0;
    } catch {
      return 0;
    }
  };
  let q = await f.read(1);
  const reveal = await f.call(1, "reveal", { revision: q.revision });
  const piece = reveal.puzzle.reservation.piece;
  const name = piece;
  assert.equal(await direct(1, name), 1);
  assert.equal(await direct(2, name), 0);
  await Promise.all([
    direct(1, name),
    f.call(1, "cancel", { revision: (await f.read(1)).revision }),
  ]);
  assert.equal(await direct(1, name), 0);
  await f.advance(5);
  q = await f.read(1);
  const next = await f.call(1, "reveal", { revision: q.revision });
  const nextName = next.puzzle.reservation.piece;
  await Promise.all([direct(1, nextName), f.rpc(1, "deactivate_my_account")]);
  assert.equal(await direct(1, nextName), 0);
  console.log(
    "PASS: native atomic byte-selection/reservation cancellation and deactivation races; subsequent reads deny.",
  );
  const samples = [];
  await f.exec(
    "update private.puzzle_pieces set position=solution,locked=true where id=$1",
    [piece],
  );
  for (let i = 0; i < 30; i++) {
    const t = performance.now();
    assert.equal(await direct(2, piece), 1);
    samples.push(performance.now() - t);
  }
  samples.sort((a, b) => a - b);
  const parallel = await Promise.all(
    Array.from({ length: 20 }, () => direct(2, piece)),
  );
  assert.ok(parallel.every((x) => x === 1));
  console.log(
    JSON.stringify({
      sampleBytes: 12,
      requests: 30,
      medianMs: samples[15],
      p95Ms: samples[28],
      concurrentReads: 20,
    }),
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
