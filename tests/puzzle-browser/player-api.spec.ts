import { test, expect } from "@playwright/test";
test("player uses authorized API, refreshes revisions and preserves independent allowances", async ({
  page,
}) => {
  const id = "11111111-1111-4111-8111-111111111111",
    piece = "22222222-2222-4222-8222-222222222222";
  let revision = 1,
    placed = false,
    reserved = false,
    moved = false;
  const operations: string[] = [];
  await page.route("**/api/puzzle**", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        ),
      });
    const body = route.request().postDataJSON();
    operations.push(body.operation);
    if (body.operation !== "read") {
      expect(body.revision).toBe(revision);
      expect(body.request).toMatch(/^[0-9a-f-]{36}$/);
      if (body.operation === "reveal") reserved = true;
      if (body.operation === "place") {
        expect(body.to).toBe(1);
        expect(body.piece).toBe(piece);
        placed = true;
        reserved = false;
      }
      if (body.operation === "move") {
        expect(body.to).toBe(0);
        expect(body.piece).toBe(piece);
        moved = true;
      }
      revision++;
    }
    return route.fulfill({
      json: {
        serverTime: new Date().toISOString(),
        placeAfter: placed
          ? new Date(Date.now() + 3600000).toISOString()
          : null,
        moveAfter: moved ? new Date(Date.now() + 3600000).toISOString() : null,
        puzzle: {
          id,
          revision,
          status: "ACTIVE",
          endsAt: new Date(Date.now() + 604800000).toISOString(),
          board: placed
            ? [{ id: piece, position: moved ? 0 : 1, locked: moved }]
            : [],
          reservation: reserved
            ? { piece, expiresAt: new Date(Date.now() + 300000).toISOString() }
            : null,
        },
      },
    });
  });
  await page.goto("/review/puzzle/player/api");
  await expect(
    page.getByRole("img", { name: "Your reserved piece" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Position 2, empty", exact: true })
    .click();
  await page.getByRole("button", { name: "PLACE HERE" }).click();
  await expect(page.getByText(/Next piece available in/)).toBeVisible();
  await page
    .getByRole("button", { name: "Position 2, movable piece", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Position 1, empty", exact: true })
    .click();
  await page.getByRole("button", { name: "MOVE HERE", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Position 1, correct and locked",
      exact: true,
    }),
  ).toBeEnabled();
  expect(operations.filter((x) => x !== "read")).toEqual([
    "reveal",
    "place",
    "move",
  ]);
});
