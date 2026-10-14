import { test, expect, type Page } from "@playwright/test";
import type {
  PuzzleRead,
  PuzzleCommand,
} from "../../src/components/puzzle/PuzzlePlayer";
const id = "11111111-1111-4111-8111-111111111111";
const held = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
async function fixture(page: Page, reserved = false) {
  const start = Date.now();
  const f = {
    now: start,
    calls: [] as PuzzleCommand[],
    denied: false,
    unavailable: false,
    stale: false,
    drop: false,
    lockPlacement: false,
    state: {
      serverTime: new Date(start).toISOString(),
      moveAfter: null,
      puzzle: {
        id,
        revision: 1,
        status: "ACTIVE",
        endsAt: new Date(start + 604800000).toISOString(),
        board: [],
        reservation: reserved
          ? { piece: held, expiresAt: new Date(start + 300000).toISOString() }
          : null,
      },
    } as PuzzleRead,
  };
  await page.clock.install({ time: start });
  await page.route("**/api/puzzle**", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ contentType: "image/png", body: png });
    const c = route.request().postDataJSON() as PuzzleCommand;
    f.calls.push(c);
    if (f.denied)
      return route.fulfill({
        status: 403,
        json: { error: "Puzzle unavailable" },
      });
    if (f.unavailable)
      return route.fulfill({ status: 503, json: { error: "offline" } });
    const p = f.state.puzzle!;
    if (p.reservation && Date.parse(p.reservation.expiresAt) <= f.now) {
      f.state.revealAfter = new Date(
        Date.parse(p.reservation.expiresAt) + 300000,
      ).toISOString();
      p.reservation = null;
    }
    if (c.operation !== "read") {
      if (f.drop) {
        f.drop = false;
        return route.abort();
      }
      if (f.stale) {
        f.stale = false;
        p.revision++;
        return route.fulfill({ json: { error: "STALE_BOARD" } });
      }
      if (c.operation === "reveal") {
        if (p.reservation)
          return route.fulfill({ json: { error: "ALREADY_RESERVED" } });
        p.reservation = {
          piece: held,
          expiresAt: new Date(f.now + 300000).toISOString(),
        };
      } else if (c.operation === "place") {
        p.board.push({ id: held, position: c.to!, locked: f.lockPlacement });
        p.reservation = null;
        f.state.placeAfter = new Date(f.now + 3600000).toISOString();
      } else if (c.operation === "move") {
        const src = p.board.find((b) => b.id === c.piece)!,
          dest = p.board.find((b) => b.position === c.to);
        if (dest) dest.position = src.position;
        src.position = c.to!;
        f.state.moveAfter = new Date(f.now + 3600000).toISOString();
      }
      p.revision++;
    }
    f.state.serverTime = new Date(f.now).toISOString();
    await route.fulfill({ json: structuredClone(f.state) });
  });
  return f;
}
const square = (page: Page, n: number) =>
  page.getByRole("button", { name: new RegExp(`^Position ${n},`) });

test("automatic reservation reuses server state across reload and selection cancellation", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.goto("/review/puzzle/player/api");
  await expect(
    page.getByRole("img", { name: "Your reserved piece" }),
  ).toBeVisible();
  expect(f.calls.filter((c) => c.operation === "reveal")).toHaveLength(1);
  for (const name of [
    "REVEAL MY PIECE",
    "PLACE MY PIECE",
    "MOVE A PIECE",
    "REFRESH BOARD",
  ])
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
      0,
    );
  await square(page, 2).click();
  await expect(square(page, 2)).toHaveAccessibleName(/preview/);
  await page.getByRole("button", { name: "CANCEL selection" }).click();
  await page.reload();
  await expect(
    page.getByRole("img", { name: "Your reserved piece" }),
  ).toBeVisible();
  expect(
    f.calls.filter((c) => c.operation !== "read").map((c) => c.operation),
  ).toEqual(["reveal"]);
});

test("move and swap are directly selectable while holding a reservation; locked selection is informational", async ({
  page,
}) => {
  const f = await fixture(page, true);
  f.state.puzzle!.board = [
    { id: other, position: 0, locked: false },
    { id: "44444444-4444-4444-8444-444444444444", position: 1, locked: false },
    { id: "55555555-5555-4555-8555-555555555555", position: 2, locked: true },
  ];
  await page.goto("/review/puzzle/player/api");
  await square(page, 3).click();
  await expect(page.getByRole("status")).toContainText("locked");
  await square(page, 1).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Tap where this piece belongs.")).toBeVisible();
  await square(page, 2).click();
  await expect(page.getByText(/Swap preview/)).toBeVisible();
  await expect(square(page, 1)).toHaveAccessibleName(/preview/);
  await page.getByRole("button", { name: "MOVE HERE", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Your reserved piece" }),
  ).toBeVisible();
  expect(f.state.puzzle!.reservation?.piece).toBe(held);
  expect(f.calls.filter((c) => c.operation === "move")).toHaveLength(1);
});

test("60-second refresh preserves safe previews and clears affected squares", async ({
  page,
}) => {
  const f = await fixture(page, true);
  await page.goto("/review/puzzle/player/api");
  await square(page, 2).click();
  f.state.puzzle!.revision++;
  f.state.puzzle!.board = [{ id: other, position: 4, locked: true }];
  f.now += 60000;
  await page.clock.fastForward(60000);
  await expect(square(page, 5)).toHaveAccessibleName(/locked/);
  await expect(page.getByRole("button", { name: "PLACE HERE" })).toBeEnabled();
  f.state.puzzle!.revision++;
  f.state.puzzle!.board.push({
    id: "44444444-4444-4444-8444-444444444444",
    position: 1,
    locked: false,
  });
  f.now += 60000;
  await page.clock.fastForward(60000);
  await expect(page.getByRole("status")).toContainText("select again");
  await expect(page.getByRole("button", { name: "PLACE HERE" })).toHaveCount(0);
  expect(f.calls.filter((c) => c.operation === "reveal")).toHaveLength(0);
});

test("expiry removes preview, respects reveal cooldown; access denial stops polling", async ({
  page,
}) => {
  const f = await fixture(page, true);
  await page.goto("/review/puzzle/player/api");
  await square(page, 2).click();
  f.now += 300000;
  await page.clock.fastForward(300000);
  await expect(
    page.getByRole("img", { name: "Your reserved piece" }),
  ).toHaveCount(0);
  await expect(page.getByText(/Next piece available in/)).toBeVisible();
  expect(f.calls.filter((c) => c.operation === "reveal")).toHaveLength(0);
  f.denied = true;
  f.now += 60000;
  await page.clock.fastForward(60000);
  await expect(
    page.getByRole("link", { name: "ACCESS MY ATOM" }),
  ).toBeVisible();
  const count = f.calls.length;
  await page.clock.fastForward(600000);
  expect(f.calls.length).toBe(count);
});

test("uncertain confirmation retries the identical request; stale board clears selection", async ({
  page,
}) => {
  const f = await fixture(page, true);
  await page.goto("/review/puzzle/player/api");
  await square(page, 2).click();
  f.drop = true;
  await page.getByRole("button", { name: "PLACE HERE" }).click();
  await page.getByRole("button", { name: "RETRY ACTION" }).click();
  await expect(page.getByText("YOU HAVE 1 MOVE AVAILABLE")).toBeVisible();
  const writes = f.calls.filter((c) => c.operation === "place");
  expect(writes).toHaveLength(2);
  expect(writes[0]).toEqual(writes[1]);
  await square(page, 2).click();
  await square(page, 3).click();
  f.stale = true;
  await page.getByRole("button", { name: "MOVE HERE" }).click();
  await expect(page.getByRole("status")).toContainText("select again");
  await expect(page.getByRole("button", { name: "MOVE HERE" })).toHaveCount(0);
});

test("hidden tabs pause polling and failed refresh backs off without losing a selection", async ({
  page,
}) => {
  const f = await fixture(page, true);
  await page.goto("/review/puzzle/player/api");
  await square(page, 2).click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const count = f.calls.length;
  await page.clock.fastForward(180000);
  expect(f.calls.length).toBe(count);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => f.calls.length).toBeGreaterThan(count);
  f.unavailable = true;
  const firstFailure = page.waitForResponse((r) => r.status() === 503);
  await page.clock.fastForward(61000);
  await (await firstFailure).finished();
  await page.clock.runFor(100);
  await expect(
    page.getByRole("button", { name: "RETRY CONNECTION" }),
  ).toBeVisible();
  const secondFailure = page.waitForResponse((r) => r.status() === 503);
  await page.clock.fastForward(61000);
  await (await secondFailure).finished();
  await page.clock.runFor(100);
  const failed = f.calls.length;
  await page.clock.fastForward(60000);
  expect(f.calls.length).toBe(failed);
  f.unavailable = false;
  await page.clock.fastForward(61000);
  await expect(page.getByRole("button", { name: "PLACE HERE" })).toBeEnabled();
});

test("cooldown never reveals early and an older snapshot cannot replace a newer board", async ({
  page,
}) => {
  const f = await fixture(page);
  f.state.placeAfter = new Date(f.now + 120000).toISOString();
  f.state.puzzle!.revision = 8;
  f.state.puzzle!.board = [{ id: other, position: 0, locked: true }];
  await page.goto("/review/puzzle/player/api");
  await expect(page.getByText(/Next piece available in/)).toBeVisible();
  expect(f.calls.filter((c) => c.operation === "reveal")).toHaveLength(0);
  f.state.puzzle!.revision = 7;
  f.state.puzzle!.board = [];
  f.now += 60000;
  await page.clock.fastForward(60000);
  await expect(square(page, 1)).toHaveAccessibleName(/locked/);
  expect(f.calls.filter((c) => c.operation === "reveal")).toHaveLength(0);
  f.state.puzzle!.revision = 9;
  f.state.puzzle!.board = [{ id: other, position: 0, locked: true }];
  f.now += 61000;
  await page.clock.fastForward(61000);
  await expect(
    page.getByRole("img", { name: "Your reserved piece" }),
  ).toBeVisible();
  expect(f.calls.filter((c) => c.operation === "reveal")).toHaveLength(1);
});

test("MOVE instruction persists through time, refresh and reload, then returns to countdown after MOVE", async ({
  page,
}, info) => {
  const f = await fixture(page, true);
  await page.goto("/review/puzzle/player/api");
  await square(page, 2).click();
  await page.getByRole("button", { name: "PLACE HERE" }).click();
  const instruction = page.getByText("YOU HAVE 1 MOVE AVAILABLE", {
    exact: true,
  });
  await expect(instruction).toBeVisible();
  await expect(page.getByText(/Next piece available in/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Dismiss move guidance" }),
  ).toHaveCount(0);
  f.now += 120000;
  await page.clock.fastForward(120000);
  await expect(instruction).toBeVisible();
  await page.reload();
  await expect(instruction).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.appearance = value;
    }, theme);
    await page.screenshot({
      path: `artifacts/persistent-move-${info.project.name}-${theme}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await square(page, 2).focus();
  await page.keyboard.press("Enter");
  await square(page, 3).click();
  await page.getByRole("button", { name: "MOVE HERE" }).click();
  await expect(instruction).toHaveCount(0);
  await expect(page.getByText(/Next piece available in/)).toBeVisible();
});

test("MOVE instruction tracks refreshed locked pieces and cooldown", async ({
  page,
}) => {
  const f = await fixture(page, true);
  await page.goto("/review/puzzle/player/api");
  await square(page, 2).click();
  await page.getByRole("button", { name: "PLACE HERE" }).click();
  const instruction = page.getByText("YOU HAVE 1 MOVE AVAILABLE", {
    exact: true,
  });
  await expect(instruction).toBeVisible();
  f.state.puzzle!.board[0]!.locked = true;
  f.state.puzzle!.revision++;
  f.now += 60000;
  await page.clock.fastForward(60000);
  await expect(instruction).toHaveCount(0);
  await expect(page.getByText(/Next piece available in/)).toBeVisible();
  f.state.puzzle!.board.push({ id: other, position: 2, locked: false });
  f.state.puzzle!.revision++;
  f.now += 60000;
  await page.clock.fastForward(60000);
  await expect(instruction).toBeVisible();
  f.state.moveAfter = new Date(f.now + 3600000).toISOString();
  f.now += 60000;
  await page.clock.fastForward(60000);
  await expect(instruction).toHaveCount(0);
  await expect(page.getByText(/Next piece available in/)).toBeVisible();
});

for (const scenario of ["cooldown", "locked board", "failed"]) {
  test(`persistent MOVE instruction absent for ${scenario}`, async ({
    page,
  }) => {
    const f = await fixture(page, true);
    if (scenario === "cooldown")
      f.state.moveAfter = new Date(f.now + 3600000).toISOString();
    if (scenario === "locked board") f.lockPlacement = true;
    await page.goto("/review/puzzle/player/api");
    await square(page, 2).click();
    if (scenario === "failed") f.stale = true;
    await page.getByRole("button", { name: "PLACE HERE" }).click();
    await expect(page.getByRole("status")).toContainText(
      scenario === "failed"
        ? "select again"
        : scenario === "locked board"
          ? "locked"
          : "Piece placed",
    );
    await expect(page.getByText("YOU HAVE 1 MOVE AVAILABLE")).toHaveCount(0);
  });
}
