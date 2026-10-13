// Disposable native PostgreSQL only. No environment files or hosted credentials.
import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
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
  const f = await createPuzzleFixture(adapter, true);
  const direct = async (actor, name) =>
    adapter.transaction(async (tx) => {
      await tx.exec("set local role authenticated");
      await tx.query(
        "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true),set_config('storage.operation','object.get_authenticated',true)",
        [
          f.people[actor].user,
          JSON.stringify({ session_id: f.people[actor].session }),
        ],
      );
      return (
        await tx.query("select name from storage.objects where name=$1", [name])
      ).rows.length;
    });
  let q = await f.read(1);
  const reveal = await f.call(1, "reveal", { revision: q.revision });
  const piece = reveal.puzzle.reservation.piece;
  const name = (await f.rpc(1, "puzzle_asset", [f.puzzle, piece])).name;
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
  const nextName = (
    await f.rpc(1, "puzzle_asset", [f.puzzle, next.puzzle.reservation.piece])
  ).name;
  await Promise.all([direct(1, nextName), f.rpc(1, "deactivate_my_account")]);
  assert.equal(await direct(1, nextName), 0);
  console.log(
    "PASS: native direct-read/reservation cancellation and deactivation races; subsequent reads deny.",
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
