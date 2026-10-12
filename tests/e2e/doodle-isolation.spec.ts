import { expect, test } from "@playwright/test";
test("Global Doodle prototype is unavailable in production builds", async ({
  request,
}) => {
  const response = await request.get("/review/doodle");
  const html = await response.text();
  expect(html).toContain("This page could not be found");
  expect(html).not.toContain('data-testid="doodle-editor"');
  expect(html).not.toContain("MAKE YOUR MARK");
  const candidate = await request.get("/review/doodle/production");
  expect(await candidate.text()).toContain("This page could not be found");
  expect(await (await request.get("/review/doodle/network")).text()).toContain(
    "This page could not be found",
  );
  expect(
    (
      await request.post("/api/review/doodle-network", {
        data: { actor: 1, action: "read" },
      })
    ).status(),
  ).toBe(404);
  const api = await request.post("/api/review/doodle", {
    data: { actor: 0, action: "queue" },
  });
  expect(api.status()).toBe(404);
  for (const path of ["/doodle", "/global-doodle", "/admin/doodle"]) {
    expect(await (await request.get(path)).text()).toContain(
      "This page could not be found",
    );
  }
  expect(
    (
      await request.post("/api/doodle", { data: { action: "read", args: [] } })
    ).status(),
  ).toBe(404);
});
