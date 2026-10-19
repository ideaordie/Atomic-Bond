import { expect, test } from "@playwright/test";

test("production cannot issue local EVOLVE fixture sessions or expose the disabled feature", async ({
  request,
}) => {
  // Next streams its not-found view with HTTP 200 for these page responses.
  for (const path of ["/review/evolve", "/evolve", "/admin/evolve"]) {
    const html = await (await request.get(path)).text();
    expect(html).toContain("This page could not be found");
    expect(html).not.toContain("PROPOSE IDEA");
    expect(html).not.toContain("LOCAL TEST SESSION");
  }
  expect(
    (
      await request.post("/review/evolve/api", {
        headers: { Origin: "http://127.0.0.1:3100" },
        data: {
          operation: "fixture_session",
          payload: { fixture: "administrator" },
        },
      })
    ).status(),
  ).toBe(404);
  const response = await request.post("/api/evolve", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: { operation: "submit", payload: { body: "Should never be stored" } },
  });
  expect(response.status()).toBe(404);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
});
