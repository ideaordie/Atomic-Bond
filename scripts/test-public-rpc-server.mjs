// Test-only PostgREST-shaped transport backed by the actual migration in PGlite.
// No real credentials, remote project, or production seed is involved.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`create role anon; create role authenticated;
create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
for (const f of (await readdir("supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort())
  await db.exec(await readFile(`supabase/migrations/${f}`, "utf8"));
await db.exec(`insert into public.locations(id,canonical_key,city,region,country,country_code,display_name) values('00000000-0000-0000-0000-000000000001','browser-test','Test City','Test Region','Test Country','US','Test Place');
insert into auth.users values('00000000-0000-0000-0000-000000000002','browser@example.com',now());
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select public.begin_atom('00000000-0000-0000-0000-000000000001','Public Test Atom','@example');
select public.activate_atom();`);
const server = createServer(async (req, res) => {
  if (req.url === "/health") {
    res.end("ready");
    return;
  }
  if (req.url !== "/rest/v1/rpc/public_graph" || req.method !== "POST") {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 2000) throw new Error("Too large");
    }
    const { p_public_id } = JSON.parse(body);
    const result = await db.transaction(async (tx) => {
      await tx.exec("set local role anon");
      return (
        await tx.query("select public.public_graph($1) as result", [
          p_public_id,
        ])
      ).rows[0].result;
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ code: "TEST_RPC_ERROR", message: "Request rejected" }),
    );
  }
});
server.listen(54329, "127.0.0.1");
async function stop() {
  server.close();
  await db.close();
}
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
