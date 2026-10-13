// Explicit, loopback-only synthetic review server. No environment credentials.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import {
  createDoodleFixture,
  seedDoodleReview,
  fixtureDrawing,
} from "../tests/helpers/doodle-fixture.mjs";
const next = process.env.DOODLE_REVIEW_NEXT === "true";
const port = next ? 3143 : 3141;
let fixture = await createDoodleFixture(undefined, next, next);
await seedDoodleReview(fixture, next ? 10080 : 60);
if (process.env.DOODLE_NETWORK_REVIEW === "true")
  for (let i = 1; i < 12; i++)
    await fixture.exec(
      "insert into public.bonds(atom_a_id,atom_b_id,status,confirmed_at) values(least($1::uuid,$2::uuid),greatest($1::uuid,$2::uuid),'CONFIRMED',now())",
      [fixture.people[i].atom, fixture.people[i + 1].atom],
    );
if (next) {
  for (let round = 0; round < 5; round++) {
    await fixture.advance(60);
    for (let actor = 2; actor < 26; actor++)
      await fixture.rpc(actor, "submit_doodle", [
        randomUUID(),
        fixtureDrawing(actor + round),
      ]);
  }
}
let serial = Promise.resolve();
// Local analogue of the proposed bounded database cleanup job; never hosted Cron.
setInterval(() => {
  serial = serial.then(async () => {
    try {
      await fixture.exec("select private.cleanup_doodles()");
    } catch {
      console.error(
        "Synthetic Doodle cleanup failed; no production connection.",
      );
    }
  });
}, 300000).unref();
const server = createServer((req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  if (
    req.headers.host !== `127.0.0.1:${port}` ||
    req.method !== "POST" ||
    req.headers["x-doodle-review"] !== "local-synthetic"
  ) {
    res.writeHead(403);
    res.end("{}");
    return;
  }
  let body = "",
    size = 0;
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > 70000) req.destroy();
    else body += chunk;
  });
  req.on("end", () => {
    serial = serial.then(async () => {
      try {
        const { actor = 1, action, args = [] } = JSON.parse(body);
        if (
          !Number.isInteger(actor) ||
          actor < -1 ||
          actor > 25 ||
          !Array.isArray(args)
        )
          throw new Error("Invalid fixture request");
        let data;
        const names = {
          read: "read_doodles",
          readNetwork: "read_network_doodles",
          submit: "submit_doodle",
          publish: "publish_doodle",
          vote: "appreciate_doodle",
          report: "report_doodle",
          replay: "doodle_replay",
          queue: "doodle_admin_queue",
          review: "doodle_admin_replay",
          moderate: "moderate_doodle",
          threshold: "doodle_admin_settings",
          restrict: "restrict_doodle_author",
          pause: "doodle_admin_pause",
          history: "doodle_admin_history",
          restrictAtom: "doodle_admin_restrict_atom",
          deactivate: "deactivate_my_account",
        };
        if (Object.hasOwn(names, action))
          data = await fixture.rpc(actor, names[action], args);
        else if (action === "advance") {
          if (![1, 60, 1441].includes(args[0]))
            throw new Error("Invalid clock change");
          await fixture.advance(args[0]);
          data = true;
        } else if (action === "cleanup")
          data = (
            await fixture.exec("select private.cleanup_doodles() as removed")
          ).rows[0];
        else if (action === "reset") {
          await fixture.db.close();
          fixture = await createDoodleFixture(undefined, next, next);
          await seedDoodleReview(fixture, next ? 10080 : 60);
          if (process.env.DOODLE_NETWORK_REVIEW === "true")
            for (let i = 1; i < 12; i++)
              await fixture.exec(
                "insert into public.bonds(atom_a_id,atom_b_id,status,confirmed_at) values(least($1::uuid,$2::uuid),greatest($1::uuid,$2::uuid),'CONFIRMED',now())",
                [fixture.people[i].atom, fixture.people[i + 1].atom],
              );
          data = true;
        } else if (action === "reactivate") {
          if (actor < 0) throw new Error("Synthetic owner required");
          const p = fixture.people[actor];
          p.session = randomUUID();
          await fixture.exec(
            "insert into auth.sessions(id,user_id) values($1,$2)",
            [p.session, p.user],
          );
          data = await fixture.rpc(actor, "reactivate_my_account");
        } else if (action === "stats")
          data = (
            await fixture.exec(
              `select count(*)::int records,coalesce(sum(octet_length(bitmap)+coalesce(octet_length(replay),0)),0)::int payload_bytes,(select count(*)::int from private.doodle_hall) hall_count from private.doodles`,
            )
          ).rows[0];
        else throw new Error("Unknown fixture operation");
        res.end(JSON.stringify({ data }));
      } catch (error) {
        res.writeHead(400);
        res.end(
          JSON.stringify({
            error:
              error instanceof Error
                ? ({
                    RATE_LIMITED:
                      "Too many requests. Please wait a minute before trying again.",
                    SUBMISSIONS_PAUSED:
                      "New drawings are temporarily paused. Your drawing has not been sent.",
                    OPERATION_REJECTED:
                      "This operation is unavailable or the request is invalid.",
                  }[error.message] ?? error.message)
                : "Operation rejected",
          }),
        );
      }
    });
  });
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Synthetic Doodle review database ready on loopback ${port}. No production connection.`,
  ),
);
