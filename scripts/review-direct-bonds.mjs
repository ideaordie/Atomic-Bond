// Isolated synthetic data only. Never connects to hosted Supabase.
import { createServer } from "node:http";
import { createDirectFixture } from "../tests/helpers/direct-bond-fixture.mjs";
const f = await createDirectFixture();
let queue = Promise.resolve();
const graph = async () => {
  const edges = (
    await f.exec(
      "select a.public_id::text source,b.public_id::text target from public.bonds q join public.atoms a on a.id=q.atom_a_id join public.atoms b on b.id=q.atom_b_id where q.status='CONFIRMED'",
      [],
    )
  ).rows;
  return {
    nodes: f.people.slice(0, 25).map((p) => ({
      id: p.number,
      publicId: p.number,
      status: "ACTIVE",
      degree: edges.filter(
        (e) => e.source === p.number || e.target === p.number,
      ).length,
      metadata: { synthetic: true },
    })),
    edges: edges.map((e, i) => ({ ...e, id: String(i) })),
  };
};
createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (
    req.method !== "POST" ||
    req.headers.origin ||
    req.headers["content-type"] !== "application/json"
  ) {
    res.writeHead(403).end("{}");
    return;
  }
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 2048) {
      res.writeHead(413).end("{}");
      return;
    }
  }
  const run = async () => {
    try {
      const { owner, operation, payload } = JSON.parse(raw);
      if (!Number.isInteger(owner) || owner < 0 || owner > 25)
        throw Error("Synthetic owner required");
      const data =
        operation === "graph"
          ? await graph()
          : await f.request(owner, operation, payload);
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(400).end(
        JSON.stringify({
          error: [
            "Daily request limit reached",
            "Outstanding request limit reached",
          ].includes(e.message)
            ? e.message
            : "Request unavailable.",
        }),
      );
    }
  };
  queue = queue.then(run, run);
}).listen(54341, "127.0.0.1", () =>
  console.log("Synthetic direct-request database ready at 127.0.0.1:54341"),
);
