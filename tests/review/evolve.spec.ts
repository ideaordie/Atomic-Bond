import { expect, test } from "@playwright/test";

test("persistent authorized participation and private administrator review", async ({
  page,
}, info) => {
  await page.goto("/review/evolve");
  await page
    .getByRole("button", { name: "participant-a", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "LOCAL ADMIN VIEW", exact: true }),
  ).toHaveCount(0);
  if (info.project.name === "mobile") {
    const text = "A persistent synthetic idea for local review";
    await expect(
      page.getByLabel("One improvement you would love to see"),
    ).toBeEnabled();
    await page.getByLabel("One improvement you would love to see").fill(text);
    await page
      .getByRole("button", { name: "PROPOSE IDEA", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("IDEA RECEIVED");
    await page.reload();
    await expect(page.getByRole("article", { name: text })).toBeVisible();
    await page
      .getByRole("button", { name: "participant-b", exact: true })
      .click();
    await expect(page.getByRole("article", { name: text })).toHaveCount(0);
    await page
      .getByRole("button", { name: "administrator", exact: true })
      .click();
    await page
      .getByRole("button", { name: "LOCAL ADMIN VIEW", exact: true })
      .click();
    const card = page.getByRole("article", { name: text });
    await card
      .getByRole("textbox", { name: "Explanation", exact: true })
      .fill("Reviewed for local testing. No development promise.");
    await card
      .getByRole("button", { name: "SAVE DECISION", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("decision saved");
    await page.screenshot({
      path: "artifacts/evolve-admin-mobile.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "participant-b", exact: true })
      .click();
    await card
      .getByRole("button", { name: "Support this idea", exact: true })
      .click();
    await expect(card).toContainText("1 support");
    await page.reload();
    await expect(
      card.getByRole("button", { name: "Withdraw support", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await card
      .getByRole("button", { name: "Withdraw support", exact: true })
      .click();
    await expect(card).toContainText("0 support");
  }
  await expect(
    page.getByRole("button", { name: /Switch to .* mode/ }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "SHARE AN IDEA" })).toHaveCount(
    0,
  );
  const links = page
    .getByRole("navigation", { name: "Application navigation" })
    .getByRole("link");
  await expect(links).toHaveText([
    "MY ATOM",
    "EVOLVE",
    "GLOBAL DOODLE",
    "PARTICIPUZZLE",
    "ABOUT",
    "SETTINGS",
  ]);
  const destinations = [
    "/explore",
    "/evolve",
    "/global-doodle",
    "/partici-puzzle",
    "/about",
    "/owner",
  ];
  for (const [i, destination] of destinations.entries())
    await expect(links.nth(i)).toHaveAttribute("href", destination);
  await expect(links.nth(1)).toHaveAttribute("aria-current", "page");
  await links.last().scrollIntoViewIfNeeded();
  await expect(links.last()).toBeInViewport();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      localStorage.setItem("atomic-bond-appearance", value);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "atomic-bond-appearance",
          newValue: value,
        }),
      );
    }, theme);
    await expect(page.locator("html")).toHaveAttribute(
      "data-appearance",
      theme,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/evolve-${info.project.name}-${theme}.png`,
      fullPage: true,
    });
  }
});

test("local API denies missing sessions and cross-origin requests; participant cannot moderate", async ({
  request,
}) => {
  const endpoint = "/review/evolve/api";
  expect(
    (
      await request.post(endpoint, {
        headers: { Origin: "https://unrelated.invalid" },
        data: { operation: "list" },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.post(endpoint, {
        headers: { Origin: "http://127.0.0.1:3140" },
        data: { operation: "list" },
      })
    ).status(),
  ).toBe(401);
  const signedIn = await request.post(endpoint, {
    headers: { Origin: "http://127.0.0.1:3140" },
    data: {
      operation: "fixture_session",
      payload: { fixture: "participant-b" },
    },
  });
  expect(signedIn.status()).toBe(200);
  const denied = await request.post(endpoint, {
    headers: { Origin: "http://127.0.0.1:3140" },
    data: { operation: "admin_list", payload: {} },
  });
  expect((await denied.json()).error).toBe("FORBIDDEN");
  expect(denied.headers()["cache-control"]).toBe("no-store");
});

test("status recognition, independent history and author withdrawal survive refresh", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "One persistent database lifecycle cycle after all viewport captures.",
  );
  await page.goto("/review/evolve");
  await page
    .getByRole("button", { name: "administrator", exact: true })
    .click();
  await page
    .getByRole("button", { name: "LOCAL ADMIN VIEW", exact: true })
    .click();
  const card = page.getByRole("article", {
    name: "A persistent synthetic idea for local review",
  });
  await card
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("LIVE");
  await card
    .getByRole("textbox", { name: "Explanation", exact: true })
    .fill("Synthetic local release completed.");
  await card
    .getByRole("button", { name: "SAVE DECISION", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("decision saved");
  await page.getByText("PUBLISH DEVELOPMENT HISTORY", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Implemented improvement", exact: true })
    .fill("Synthetic interface improvement");
  await page.getByLabel("Completion date", { exact: true }).fill("2026-01-01");
  await page
    .getByRole("textbox", {
      name: "Independent factual explanation",
      exact: true,
    })
    .fill("Improved keyboard navigation.");
  await page
    .getByLabel("I reviewed this independent summary", { exact: false })
    .check();
  await page
    .getByRole("button", { name: "PUBLISH HISTORY", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("history published");
  await page
    .getByRole("button", { name: "participant-a", exact: true })
    .click();
  await expect(card).toContainText("YOU HELPED SHAPE THIS.");
  page.once("dialog", (dialog) => dialog.accept());
  await card
    .getByRole("button", { name: "WITHDRAW IDEA", exact: true })
    .click();
  await expect(card).toContainText("WITHDRAWN");
  await page
    .getByRole("button", { name: "participant-b", exact: true })
    .click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(card).toHaveCount(0);
  await page.getByText("DEVELOPMENT HISTORY", { exact: true }).click();
  await expect(
    page.getByText("Synthetic interface improvement", { exact: true }),
  ).toBeVisible();
});
