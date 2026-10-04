// Loopback-only Auth test mechanism + real migrated SQL. Never deploy this fixture.
import { createServer } from "node:http";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`,
);
for (const f of (await readdir("supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort())
  await db.exec(await readFile(`supabase/migrations/${f}`, "utf8"));
const users = new Map(),
  tokens = new Map(),
  links = new Map(),
  mail = new Map();
await db.exec(
  "create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade)",
);
const claimsByUser = new Map();
let failNextRemoval = false;
const owner = randomUUID();
users.set("inviter@example.invalid", {
  id: owner,
  email: "inviter@example.invalid",
  user_metadata: {},
  email_confirmed_at: new Date().toISOString(),
  aud: "authenticated",
  role: "authenticated",
});
await db.query("insert into auth.users values($1,$2,now())", [
  owner,
  "inviter@example.invalid",
]);
async function rpc(name, args = [], user = null, admin = false) {
  return db.transaction(async (tx) => {
    await tx.exec(
      `set local role ${admin ? "service_role" : user ? "authenticated" : "anon"}`,
    );
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
      user || "",
    ]);
    await tx.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify(claimsByUser.get(user) || {}),
    ]);
    return (
      await tx.query(
        `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as result`,
        args,
      )
    ).rows[0].result;
  });
}
const place = (
  await db.query(
    "select id from public.locations order by display_name limit 1",
  )
).rows[0].id;
await rpc("begin_atom", [place, "Inviting Atom", null], owner);
await rpc("activate_atom", [], owner);
async function session(user) {
  const seconds = Math.floor(Date.now() / 1000);
  const sessionId = randomUUID();
  await db.query("insert into auth.sessions values($1,$2)", [
    sessionId,
    user.id,
  ]);
  const claims = {
    session_id: sessionId,
    amr: [{ method: "otp", timestamp: seconds }],
  };
  claimsByUser.set(user.id, claims);
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      aud: "authenticated",
      role: "authenticated",
      iat: seconds,
      exp: seconds + 3600,
      ...claims,
    }),
  ).toString("base64url");
  const head = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const value = `${head}.${payload}`;
  const token = `${value}.${createHmac("sha256", "local-test-only").update(value).digest("base64url")}`;
  const refresh = randomBytes(24).toString("hex");
  tokens.set(token, user);
  tokens.set(refresh, user);
  return {
    access_token: token,
    refresh_token: refresh,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: seconds + 3600,
    user,
  };
}
const methods = {
  account_deletion_status: [],
  delete_my_account: ["p_confirmation"],
  account_cleanup_pending: ["p_user"],
  account_cleanup_finish: ["p_user"],
  public_graph: ["p_public_id"],
  canonical_locations: ["p_query"],
  canonical_location: ["p_id"],
  my_atom: [],
  begin_atom: ["p_location_id", "p_display_name", "p_x_handle"],
  activate_atom: [],
  create_bond_invitation: [],
  resolve_bond_invitation: ["p_token"],
  accept_bond_invitation: ["p_token"],
  cancel_bond_invitation: ["p_id"],
  send_emotional_pulse: ["p_emotion"],
  connected_emotional_pulses: [],
  my_notification_preferences: [],
  update_notification_preferences: ["p_growth_digest", "p_pulse_notifications"],
  update_my_atom: ["p_display_name", "p_x_handle", "p_location_id"],
};
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:54330");
  const reply = (status, data) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  try {
    if (url.pathname === "/health") return reply(200, { ready: true });
    if (url.pathname === "/__test/fail-removal-once") {
      failNextRemoval = true;
      return reply(200, {});
    }
    if (url.pathname === "/__test/invite")
      return reply(200, await rpc("create_bond_invitation", [], owner));
    if (url.pathname === "/__test/mail")
      return reply(200, {
        link: mail.get(url.searchParams.get("email")) || null,
      });
    if (url.pathname === "/__test/expire-access") {
      for (const entry of links.values()) entry.expires = 0;
      return reply(200, {});
    }
    if (url.pathname === "/__test/stale-auth") {
      for (const claims of claimsByUser.values())
        claims.amr[0].timestamp -= 3600;
      return reply(200, {});
    }
    if (url.pathname === "/__test/expire-invites") {
      await db.exec(
        "update public.bond_invitations set created_at=now()-interval '10 minutes',expires_at=now()-interval '5 minutes' where status='ACTIVE'",
      );
      return reply(200, {});
    }
    if (url.pathname === "/__test/counts")
      return reply(
        200,
        (
          await db.query(
            "select (select count(*) from public.atoms)::int atoms,(select count(*) from public.bonds)::int bonds",
          )
        ).rows[0],
      );
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 16000) throw new Error();
    }
    const body = raw ? JSON.parse(raw) : {};
    const bearer = req.headers.authorization?.replace(/^Bearer /, "");
    const current = tokens.get(bearer);
    const admin = req.headers.apikey === "sb_secret_account_deletion_test_only";
    if (
      url.pathname.startsWith("/auth/v1/admin/users/") &&
      req.method === "DELETE"
    ) {
      if (!admin) return reply(403, {});
      if (failNextRemoval) {
        failNextRemoval = false;
        return reply(503, {
          code: "unexpected_failure",
          message: "Fixture unavailable",
        });
      }
      const id = url.pathname.split("/").at(-1);
      const user = [...users.values()].find((u) => u.id === id);
      if (!user)
        return reply(404, { code: "user_not_found", message: "Not found" });
      await db.query("delete from auth.users where id=$1", [id]);
      users.delete(user.email);
      for (const [key, value] of tokens)
        if (value.id === id) tokens.delete(key);
      for (const [key, value] of links)
        if (value.user.id === id) links.delete(key);
      return reply(200, { user });
    }
    if (url.pathname === "/auth/v1/otp") {
      const email = body.email.trim().toLowerCase();
      let user = users.get(email);
      if (!user && body.create_user !== false) {
        user = {
          id: randomUUID(),
          email,
          user_metadata: body.data || {},
          aud: "authenticated",
          role: "authenticated",
        };
        users.set(email, user);
        await db.query("insert into auth.users values($1,$2,null)", [
          user.id,
          email,
        ]);
      }
      if (user) {
        const hash =
            (body.code_challenge ? "pkce_" : "") +
            randomBytes(32).toString("hex"),
          redirect = new URL(url.searchParams.get("redirect_to"));
        const link = `${redirect.origin}/auth/confirm#${new URLSearchParams({ token_hash: hash, next: redirect.searchParams.get("next") || "/explore" })}`;
        links.set(hash, { user, expires: Date.now() + 3600000 });
        mail.set(email, link);
      }
      return reply(200, {});
    }
    if (url.pathname === "/auth/v1/verify") {
      const entry = links.get(body.token_hash);
      if (!entry || entry.expires < Date.now())
        return reply(403, {
          error_code: "otp_expired",
          msg: "Invalid or expired token",
        });
      links.delete(body.token_hash);
      entry.user.email_confirmed_at = new Date().toISOString();
      await db.query(
        "update auth.users set email_confirmed_at=now() where id=$1",
        [entry.user.id],
      );
      return reply(200, await session(entry.user));
    }
    if (url.pathname === "/auth/v1/user")
      return current
        ? reply(200, current)
        : reply(401, { msg: "Invalid session" });
    if (url.pathname === "/auth/v1/token") {
      const user = tokens.get(body.refresh_token);
      return user
        ? reply(200, await session(user))
        : reply(401, { msg: "Invalid refresh" });
    }
    if (url.pathname === "/auth/v1/logout") {
      tokens.delete(bearer);
      return reply(200, {});
    }
    const name = url.pathname.replace("/rest/v1/rpc/", "");
    if (name in methods)
      return reply(
        200,
        await rpc(
          name,
          methods[name].map((k) => body[k] ?? null),
          current?.id,
          admin,
        ),
      );
    return reply(404, {});
  } catch {
    return reply(400, {
      code: "TEST_REQUEST_DENIED",
      message: "Request denied",
    });
  }
});
server.listen(54330, "127.0.0.1");
process.once("SIGTERM", async () => {
  server.close();
  await db.close();
});
