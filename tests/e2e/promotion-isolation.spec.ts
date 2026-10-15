import { expect, test } from "@playwright/test";
test("campaign review remains unavailable in production", async ({
  request,
}) => {
  const response = await request.get("/review/promotion");
  const html = await response.text();
  expect([200, 404]).toContain(response.status());
  expect(html).toContain("This page could not be found");
  expect(html).not.toContain('data-testid="promotion-canvas"');
});
