import { execFileSync } from "node:child_process";
// Native PostgreSQL, isolated loopback fixture; never uses a hosted connection.
import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createServer } from "node:net";
import assert from "node:assert/strict";
import { createDirectFixture } from "../tests/helpers/direct-bond-fixture.mjs";
const root = resolve("artifacts/database-tests");
await mkdir(root, { recursive: true });
const directory = await mkdtemp(root + sep + "direct-");
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
async function stopFixture() {
  if (!postgres.process) return;
  const target = resolve(directory);
  if (!target.startsWith(root + sep))
    throw new Error("Not an isolated fixture");
  execFileSync(
    resolve(
      "node_modules/.pnpm/@embedded-postgres+windows-x64@18.4.0-beta.17/node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe",
    ),
    ["stop", "-D", target, "-m", "fast", "-w", "-t", "30"],
    { stdio: "pipe", windowsHide: true },
  );
  postgres.process = undefined;
}
let started = false,
  admin;

try {
  await postgres.initialise();

  await postgres.start();

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
  const f = await createDirectFixture(adapter);
  const send = (from, to) => f.request(from, "create", f.target(to));
  const duplicates = await Promise.all(
    Array.from({ length: 12 }, () => send(1, 2)),
  );
  assert.equal(new Set(duplicates.map((r) => r.id)).size, 1);
  const accepted = await Promise.all(
    Array.from({ length: 12 }, () =>
      f.request(2, "accept", { id: duplicates[0].id }),
    ),
  );
  assert.equal(accepted.filter((r) => !r.replayed).length, 1);
  const limits = await Promise.allSettled(
    Array.from({ length: 8 }, (_, i) => send(3, i + 4)),
  );
  assert.equal(limits.filter((r) => r.status === "fulfilled").length, 5);
  const r = await send(12, 13);
  const race = await Promise.allSettled([
    f.request(13, "accept", { id: r.id }),
    f.request(12, "cancel", { id: r.id }),
  ]);
  assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
  const reverse = await Promise.all([send(14, 15), send(15, 14)]);
  const reverseRace = await Promise.allSettled([
    f.request(15, "accept", { id: reverse[0].id }),
    f.request(14, "accept", { id: reverse[1].id }),
  ]);
  assert.equal(reverseRace.filter((r) => r.status === "fulfilled").length, 1);
  const external = await f.rpc(16, "create_bond_invitation");
  const direct = await send(16, 17);
  await Promise.allSettled([
    f.request(17, "accept", { id: direct.id }),
    f.rpc(17, "accept_bond_invitation", [external.token]),
  ]);
  assert.equal(
    (
      await f.exec(
        "select count(*)::int n from public.bonds where atom_a_id=least($1::uuid,$2::uuid) and atom_b_id=greatest($1::uuid,$2::uuid)",
        [f.people[16].atom, f.people[17].atom],
      )
    ).rows[0].n,
    1,
  );
  const lifecycle = await send(18, 19);
  const lifecycleRace = await Promise.allSettled([
    f.rpc(18, "deactivate_my_account"),
    f.request(19, "accept", { id: lifecycle.id }),
  ]);
  assert.equal(lifecycleRace[0].status, "fulfilled");
  assert.notEqual(
    (
      await f.exec(
        "select state from private.direct_bond_requests where id=$1",
        [lifecycle.id],
      )
    ).rows[0].state,
    "PENDING",
  );
  const inactive = await send(20, 21);
  await f.rpc(20, "deactivate_my_account");
  await assert.rejects(() => f.request(21, "accept", { id: inactive.id }));
  await Promise.all([
    adapter.transaction((c) =>
      c.query("select private.direct_bond_cleanup(10)"),
    ),
    adapter.transaction((c) =>
      c.query("select private.direct_bond_cleanup(10)"),
    ),
  ]);
  console.log(
    "PASS native PostgreSQL: duplicate creation, double acceptance, sender limits, cancel/accept race, reciprocal/external acceptance, lifecycle race and concurrent cleanup.",
  );
} finally {
  await admin?.end();
  if (started) {
    if (process.platform === "win32") await stopFixture();
    else await postgres.stop();
  }
  // Disposable fixture is retained under ignored artifacts for diagnostics; no production connection exists.
}
