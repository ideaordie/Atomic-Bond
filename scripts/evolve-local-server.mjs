// Isolated local test infrastructure. No environment credentials or hosted URLs.
import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { createEvolveFixture } from "../tests/helpers/evolve-fixture.mjs";

const name = process.argv[2] ?? "evolve-local-db";
if (!/^[a-z0-9-]{1,60}$/.test(name))
  throw new Error("Invalid local fixture name");
const directory = `artifacts/${name}`;
await mkdir(directory, { recursive: true });
const db = new PGlite(directory + "/data", { extensions: { pgcrypto } });
const initialized = (
  await db.query("select to_regclass('private.evolve_settings') present")
).rows[0].present;
const source = await readFile(
  "supabase/candidates/202610210001_evolve.sql",
  "utf8",
);
const fingerprint = createHash("sha256").update(source).digest("hex");
if (!initialized) {
  const fixture = await createEvolveFixture(db);
  await fixture.enable();
  await db.exec(`create table private.evolve_local_sessions(token_hash text primary key, user_id uuid, session_id uuid, expires_at timestamptz);
    create table private.evolve_local_cleanup(at timestamptz default clock_timestamp(), succeeded boolean, removed integer);
    create or replace function private.evolve_now() returns timestamptz language sql volatile set search_path='' as $$select clock_timestamp()$$;`);
  await writeFile(directory + "/schema.sha256", fingerprint);
} else if (
  (await readFile(directory + "/schema.sha256", "utf8")) !== fingerprint
) {
  throw new Error(
    "Local schema changed. Use a new isolated fixture directory; existing data was preserved.",
  );
}
const hash = (value) => createHash("sha256").update(value).digest("hex");
let cleanupRunning = false;
async function cleanup() {
  if (cleanupRunning) return;
  cleanupRunning = true;
  try {
    const result = await db.query("select private.evolve_cleanup(100) removed");
    await db.query(
      "insert into private.evolve_local_cleanup(succeeded,removed) values(true,$1)",
      [result.rows[0].removed],
    );
    await db.exec(
      "delete from private.evolve_local_sessions where expires_at<=clock_timestamp(); delete from private.evolve_local_cleanup where at<clock_timestamp()-interval '30 days'",
    );
  } catch {
    await db.query(
      "insert into private.evolve_local_cleanup(succeeded) values(false)",
    );
  } finally {
    cleanupRunning = false;
  }
}
await cleanup();
setInterval(cleanup, 60_000).unref();
createServer(async (req, res) => {
  const send = (status, value) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
  };
  try {
    if (req.headers.host !== "127.0.0.1:54339" || req.headers.origin)
      return send(403, { error: "Forbidden" });
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 8192) return send(413, { error: "Too large" });
    }
    const input = body ? JSON.parse(body) : {};
    if (req.url === "/fixture/session" && req.method === "POST") {
      const actor = {
        administrator: 0,
        "participant-a": 1,
        "participant-b": 2,
      }[input.fixture];
      if (actor === undefined) return send(400, { error: "Invalid fixture" });
      const user = (
        await db.query("select id from auth.users where email=$1", [
          `fixture-${actor}@example.invalid`,
        ])
      ).rows[0];
      const session = (
        await db.query(
          "insert into auth.sessions(id,user_id) values(gen_random_uuid(),$1) returning id",
          [user.id],
        )
      ).rows[0];
      const token = randomBytes(32).toString("base64url");
      await db.query(
        "insert into private.evolve_local_sessions values($1,$2,$3,clock_timestamp()+interval '8 hours')",
        [hash(token), user.id, session.id],
      );
      return send(200, { token });
    }
    const token = req.headers.authorization?.replace(/^Bearer /, "") ?? "";
    const session = (
      await db.query(
        "select s.*,u.email,u.email_confirmed_at from private.evolve_local_sessions s join auth.users u on u.id=s.user_id join auth.sessions a on a.id=s.session_id where token_hash=$1 and expires_at>clock_timestamp()",
        [hash(token)],
      )
    ).rows[0];
    if (!session) return send(401, { error: "Invalid session" });
    if (req.url === "/auth/v1/user" && req.method === "GET")
      return send(200, {
        id: session.user_id,
        email: session.email,
        email_confirmed_at: session.email_confirmed_at,
        aud: "authenticated",
        role: "authenticated",
        app_metadata: {},
        user_metadata: {},
      });
    if (req.url !== "/rest/v1/rpc/evolve_request" || req.method !== "POST")
      return send(404, { error: "Unavailable" });
    const result = await db.transaction(async (tx) => {
      await tx.exec("set local role authenticated");
      await tx.query(
        "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
        [
          session.user_id,
          JSON.stringify({
            session_id: session.session_id,
            amr: [{ method: "otp", timestamp: Date.now() / 1000 }],
          }),
        ],
      );
      return (
        await tx.query("select public.evolve_request($1,$2::jsonb) result", [
          input.p_operation,
          JSON.stringify(input.p_payload ?? {}),
        ])
      ).rows[0].result;
    });
    send(200, result);
  } catch {
    send(403, { error: "Request rejected" });
  }
}).listen(54339, "127.0.0.1", () =>
  console.log("EVOLVE isolated persistent fixture ready: 127.0.0.1:54339"),
);
