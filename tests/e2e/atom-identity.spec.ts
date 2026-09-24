import { expect, test } from "@playwright/test";

for (const [name, alias, handle] of [
  ["alias-and-x", "Alex".repeat(15), "abcdefghijklmno"],
  ["alias-only", "ALEX", ""],
  ["x-only", "", "example_user"],
  ["neither", "", ""],
]) {
  test(`public identity context: ${name}`, async ({ page, context }, info) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/explore");
    await page
      .getByRole("button", { name: "CREATE BOND", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Simulate recipient", exact: true })
      .click();
    await page
      .getByRole("button", { name: "New to Atomic Bond", exact: true })
      .click();
    await page
      .getByLabel("Email", { exact: false })
      .fill("identity@example.com");
    await page.getByLabel("Name / alias", { exact: false }).fill(alias!);
    await page.getByLabel("X handle", { exact: false }).fill(handle!);
    await page.getByRole("combobox", { name: "Home region" }).fill("Boynton");
    await page.getByRole("option", { name: /Boynton Beach/ }).click();
    await page
      .getByRole("button", { name: "Create my Atom", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Simulate email verification", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm Bond", exact: true })
      .click();
    await page.getByRole("button", { name: "See your network" }).click();
    await page.getByRole("button", { name: "Explore Atoms" }).click();
    await page
      .getByLabel("Select an Atom", { exact: true })
      .selectOption("session-atom-1001");
    const panel = page.getByTestId("atom-context");
    await expect(panel.getByRole("heading")).toHaveText("ATOM #00001001");
    await expect(panel.getByRole("heading")).toBeFocused();
    await expect(page.getByTestId("selected-atom")).toHaveText("#00000001");
    await expect(page.getByTestId("relationship")).toHaveText(
      "Directly Bonded to you",
    );
    await expect(panel.getByTestId("atom-alias")).toHaveCount(alias ? 1 : 0);
    if (alias) await expect(panel.getByTestId("atom-alias")).toHaveText(alias);
    await expect(panel.locator(".public-x-profile")).toHaveCount(
      handle ? 1 : 0,
    );
    expect(await panel.innerText()).not.toContain("identity@example.com");
    expect(
      await panel.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await panel.boundingBox())!.height).toBeLessThanOrEqual(
      info.project.use.viewport!.height * 0.46,
    );
    await page.screenshot({
      path: info.outputPath(`${name}.png`),
      fullPage: true,
    });
    if (handle) {
      const link = panel.getByRole("link", {
        name: `View @${handle} on X (opens in a new tab)`,
      });
      await expect(link).toContainText(`𝕏 @${handle}`);
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await context.route("https://x.com/**", (route) =>
        route.fulfill({ body: "Public profile test" }),
      );
      await link.focus();
      await expect(link).toBeFocused();
      const opened = context.waitForEvent("page");
      await link.press("Enter");
      const popup = await opened;
      await expect(popup).toHaveURL(`https://x.com/${handle}`);
      await popup.close();
      await expect(page.getByTestId("selected-atom")).toHaveText("#00000001");
    }
    const view = panel.getByRole("button", { name: "View their network" });
    await view.focus();
    await expect(view).toBeFocused();
    await view.press("Enter");
    await expect(page.getByTestId("selected-atom")).toHaveText("#00001001");
    // An immediate neighbor of you is two Bonds from the newly centered Atom.
    // Relationship context must still describe the current user, not the camera.
    await page.getByRole("button", { name: "Explore Atoms" }).click();
    await page
      .getByLabel("Select an Atom", { exact: true })
      .selectOption("mock-atom-00000002");
    await expect(page.getByTestId("relationship")).toHaveText(
      "Directly Bonded to you",
    );
    await expect(page.getByTestId("selected-atom")).toHaveText("#00001001");
  });
}
