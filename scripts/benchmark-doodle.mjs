// Synthetic local measurements; not a production SLA.
import {
  createDoodleFixture,
  seedDoodleReview,
} from "../tests/helpers/doodle-fixture.mjs";
const f = await createDoodleFixture();
try {
  await seedDoodleReview(f);
  const times = [];
  let feed;
  for (let i = 0; i < 50; i++) {
    const start = performance.now();
    feed = await f.rpc(1, "read_doodles");
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const storage = (
    await f.exec(
      "select count(*)::int records,sum(octet_length(bitmap)+coalesce(octet_length(replay),0))::int bytes from private.doodles",
    )
  ).rows[0];
  console.log(
    JSON.stringify({
      environment: "synthetic PGlite on this Windows machine",
      samples: 50,
      readMedianMs: +times[25].toFixed(2),
      readP95Ms: +times[47].toFixed(2),
      feedBytes: Buffer.byteLength(JSON.stringify(feed)),
      replayIncluded: false,
      storage,
    }),
  );
} finally {
  await f.db.close();
}
