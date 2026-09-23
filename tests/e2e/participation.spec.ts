import { expect, test, type Page, type TestInfo } from "@playwright/test";

test.setTimeout(60_000);

async function capture(page: Page, info: TestInfo, name: string) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const dialog = page.getByRole("dialog");
  if (await dialog.count())
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
  await page.screenshot({
    path: info.outputPath(`${name}.png`),
    fullPage: true,
  });
}
async function invitation(page: Page) {
  await page.getByRole("button", { name: "CREATE BOND", exact: true }).click();
  await page
    .getByRole("button", { name: "Simulate recipient", exact: true })
    .click();
}
test("new Atom participation, canonical location, verification and Living Atom integration", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/explore");
  await capture(page, info, "01-create-bond");
  const action = page.getByRole("button", { name: "CREATE BOND", exact: true });
  expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await action.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("AB-000001", { exact: true })).toBeVisible();
  await capture(page, info, "02-invitation");
  await page.getByRole("link", { name: "/explore#invite=AB-000001" }).click();
  await page
    .getByRole("button", { name: "New to Atomic Bond", exact: true })
    .click();
  await capture(page, info, "03-create-atom");
  await page.getByLabel("Email", { exact: false }).fill("bad-email");
  await page
    .getByRole("button", { name: "Create my Atom", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    "Enter a valid email address.",
  );
  await page
    .getByLabel("Email", { exact: false })
    .fill("private.person@example.com");
  const location = page.getByRole("combobox", { name: "Home region" });
  await location.fill("Boynton");
  await capture(page, info, "04-autocomplete");
  await page
    .getByRole("button", { name: "Create my Atom", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    "Select a home region from the location results.",
  );
  await location.focus();
  await location.press("ArrowDown");
  await location.press("Enter");
  await expect(page.getByText("✓ Boynton Beach")).toBeVisible();
  await location.fill("Boynton edited");
  await expect(page.getByText("✓ Boynton Beach")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Create my Atom", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    "Select a home region from the location results.",
  );
  await location.fill("Boynton");
  await page.getByRole("option", { name: /Boynton Beach/ }).click();
  await capture(page, info, "05-canonical-location");
  await page
    .getByRole("button", { name: "Create my Atom", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Verify your email" }),
  ).toBeVisible();
  await expect(
    page.getByText("p•••@example.com", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm Bond", exact: true }),
  ).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toContain(
    "private.person@example.com",
  );
  await expect(page.getByTestId("direct-count")).toHaveText("12");
  await capture(page, info, "06-verification");
  await page
    .getByRole("button", { name: "Simulate email verification", exact: true })
    .click();
  await capture(page, info, "07-confirmation");
  await page.getByRole("button", { name: "Confirm Bond", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "⚛ BOND CREATED" }),
  ).toBeVisible();
  await expect(page.getByText("640 → 641", { exact: true })).toBeVisible();
  await expect(
    page.getByText("New country reached: United States", { exact: true }),
  ).toBeVisible();
  await capture(page, info, "08-bond-created");
  await page.getByRole("button", { name: "See your network" }).click();
  await expect(page.getByTestId("direct-count")).toHaveText("13");
  await expect(page.getByTestId("reachable-count")).toHaveText("641");
  await expect(action).toBeFocused();
  await capture(page, info, "09-living-atom");
  await page.getByRole("button", { name: "Explore Atoms" }).click();
  await page
    .getByLabel("Select an Atom", { exact: true })
    .selectOption("session-atom-1001");
  await expect(page.getByTestId("relationship")).toHaveText(
    "Directly Bonded to you",
  );
  await expect(page.getByText("Bond created: Just now")).toBeVisible();
  await expect(
    page.getByText("Home region: Boynton Beach, Florida, United States"),
  ).toBeVisible();
  await capture(page, info, "10-new-atom-context");
  await page.getByRole("button", { name: "View their network" }).click();
  await expect(page.getByTestId("selected-atom")).toHaveText("#00001001");
  await expect(page.getByTestId("direct-count")).toHaveText("1");
  await expect(
    page.getByRole("button", { name: "CREATE BOND", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "My Atom" }).click();
  await page.getByRole("button", { name: "Regions", exact: true }).click();
  await capture(page, info, "11-regional-reach");
  await page.getByRole("button", { name: "Send Pulse", exact: true }).click();
  await expect(page.getByTestId("pulse-status")).toContainText(
    "Pulse complete",
    { timeout: 10_000 },
  );
  const canvas = page.getByTestId("atom-canvas");
  const still = await canvas.screenshot();
  await page.waitForTimeout(120);
  expect(await canvas.screenshot()).toEqual(still);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(canvas).toHaveAttribute("data-motion", "gentle");
  const moving = await canvas.screenshot();
  await page.waitForTimeout(1200);
  expect(await canvas.screenshot()).not.toEqual(moving);
  expect(errors).toEqual([]);
});

test("existing Atom, duplicate prevention, decline, and expiration remain private and non-mutating", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/explore");
  await invitation(page);
  await page.getByRole("button", { name: "I already have an Atom" }).click();
  await page.getByRole("button", { name: "Use Atom #00000002" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    "YOU ARE ALREADY BONDED",
  );
  await expect(page.getByTestId("direct-count")).toHaveText("12");
  await page.getByRole("button", { name: "Use Atom #00000541" }).click();
  await page.getByRole("button", { name: "Decline", exact: true }).click();
  await expect(
    page.getByText("No Bond was created. Your network is unchanged."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Return to My Atom" }).click();
  await invitation(page);
  await page.getByRole("button", { name: "I already have an Atom" }).click();
  await page.getByRole("button", { name: "Use Atom #00000541" }).click();
  await page.getByRole("button", { name: "Confirm Bond", exact: true }).click();
  await expect(page.getByText("640 → 820", { exact: true })).toBeVisible();
  await expect(
    page.getByText("New country reached: South Africa", { exact: true }),
  ).toBeVisible();
  await capture(page, info, "12-existing-network-impact");
  await page.getByRole("button", { name: "See your network" }).click();
  await expect(page.getByTestId("reachable-count")).toHaveText("820");
  await invitation(page);
  await page.getByRole("button", { name: "I already have an Atom" }).click();
  await page.getByRole("button", { name: "Use Atom #00000541" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    "YOU ARE ALREADY BONDED",
  );
  await page.clock.fastForward(300_500);
  await expect(
    page.getByRole("heading", { name: "Invitation expired" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm Bond", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByTestId("direct-count")).toHaveText("13");
});
