import { expect, test } from "@playwright/test";

test("creative review is not available in the production build", async ({
  request,
}) => {
  const response = await request.get("/review/introduction");
  // Root loading.tsx starts a streamed response before Next's notFound boundary.
  // Such responses can be HTTP 200; the review itself must never be rendered.
  expect([200, 404]).toContain(response.status());
  const html = await response.text();
  expect(html).toContain("This page could not be found");
  expect(html).not.toContain("A world brought to life.");
  expect(html).not.toContain('data-testid="introduction-canvas"');
});
