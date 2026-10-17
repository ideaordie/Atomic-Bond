import { test, expect } from "@playwright/test";
import { selectHomeRegion } from "./home-region";

test("verified owner can recover a callback reload without another email", async ({
  page,
  request,
}, info) => {
  const email = `callback-recovery-${info.project.name}@example.invalid`;
  await page.goto("/auth?mode=register");
  await page.getByLabel("Email").fill(email);
  await selectHomeRegion(page);
  await page
    .getByRole("button", { name: "Create my Atom", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("secure link");
  const { link } = await (
    await request.get(`http://127.0.0.1:54330/__test/mail?email=${email}`)
  ).json();
  await page.goto(link);
  await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(
    page.getByRole("heading", { name: "YOUR ATOM IS READY" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("link", { name: "MY ATOM", exact: true }),
  ).toBeVisible();
  await page.goto("/auth/confirm?flow=invalid");
  await expect(
    page.getByRole("link", { name: "MY ATOM", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "MY ATOM", exact: true }).click();
  await expect(page.getByText(/^MY ATOM #/)).toBeVisible();
});

for (const variant of ["skip", "corrupt", "missing", "substitute"] as const) {
  test(`invitation authentication ${variant} preserves owner access without implicit acceptance`, async ({
    page,
    request,
    browser,
  }, info) => {
    const email = `recovery-${variant}-${info.project.name}@example.invalid`;
    const invite = await (
      await request.get("http://127.0.0.1:54330/__test/invite")
    ).json();
    await page.goto(`/bond/${invite.token}`);
    await page
      .getByRole("link", { name: "CREATE MY ATOM", exact: true })
      .click();
    await page.getByLabel("Email").fill(email);
    await selectHomeRegion(page);
    await page
      .getByRole("button", { name: "Create my Atom", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("secure link");
    const { link } = await (
      await request.get(`http://127.0.0.1:54330/__test/mail?email=${email}`)
    ).json();
    const url = new URL(link);
    const fragment = new URLSearchParams(url.hash.slice(1));
    if (variant === "corrupt") fragment.set("continuation", "corrupted");
    if (variant === "missing") fragment.delete("continuation");
    if (variant === "substitute") {
      // An independently valid OTP cannot restore another flow's invitation binding.
      await request.post(
        "http://127.0.0.1:54330/auth/v1/otp?redirect_to=" +
          encodeURIComponent("http://127.0.0.1:3104/auth/confirm"),
        { data: { email, create_user: false } },
      );
      const other = await (
        await request.get(`http://127.0.0.1:54330/__test/mail?email=${email}`)
      ).json();
      fragment.delete("access");
      fragment.set(
        "token_hash",
        new URLSearchParams(new URL(other.link).hash.slice(1)).get(
          "token_hash",
        )!,
      );
    }
    url.hash = fragment.toString();
    const fresh = await browser.newContext({
      viewport: info.project.use.viewport ?? { width: 390, height: 844 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1",
    });
    // This is Chromium with a Safari-like UA, not physical Safari verification.
    if (variant === "missing")
      await fresh.addInitScript(() => {
        Object.defineProperty(navigator, "standalone", {
          value: true,
          configurable: true,
        });
      });
    const recipient = await fresh.newPage();
    await recipient.goto(url.toString());
    await expect(recipient).toHaveURL(/\?flow=/);
    if (variant !== "skip") await recipient.reload();
    const before = await (
      await request.get("http://127.0.0.1:54330/__test/counts")
    ).json();
    await recipient
      .getByRole("button", {
        name: variant === "skip" ? "NOT NOW" : "VERIFY / ACCESS MY ATOM",
        exact: true,
      })
      .click();
    await expect(
      recipient.getByRole("link", { name: "MY ATOM", exact: true }),
    ).toBeVisible();
    // Optional installation dismissal is a separate action and preserves the session.
    const install = recipient.getByRole("region", {
      name: "Install Atomic Bond",
    });
    if (await install.isVisible())
      await install
        .getByRole("button", { name: "NOT NOW", exact: true })
        .click();
    await recipient.reload();
    await recipient.getByRole("link", { name: "MY ATOM", exact: true }).click();
    await expect(recipient.getByText(/^MY ATOM #/)).toBeVisible();
    const after = await (
      await request.get("http://127.0.0.1:54330/__test/counts")
    ).json();
    expect(after.bonds).toBe(before.bonds);
    await fresh.close();
  });
}

// Backward compatibility is tested separately from newly generated fragments.
test("already-issued sealed-only email remains usable and repeated staging is bounded", async ({
  page,
  request,
}, info) => {
  const email = `legacy-recovery-${info.project.name}@example.invalid`;
  const invite = await (
    await request.get("http://127.0.0.1:54330/__test/invite")
  ).json();
  await page.goto(`/bond/${invite.token}`);
  await page.getByRole("link", { name: "CREATE MY ATOM", exact: true }).click();
  await page.getByLabel("Email").fill(email);
  await selectHomeRegion(page);
  await page
    .getByRole("button", { name: "Create my Atom", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("secure link");
  const { link } = await (
    await request.get(`http://127.0.0.1:54330/__test/mail?email=${email}`)
  ).json();
  const old = new URL(link);
  const fragment = new URLSearchParams(old.hash.slice(1));
  fragment.delete("token_hash");
  fragment.delete("access");
  old.hash = fragment.toString();
  for (let i = 0; i < 3; i++) {
    await page.goto(old.toString());
    await expect(page).toHaveURL(/\?flow=/);
    expect(
      (await page.context().cookies()).filter((c) =>
        c.name.startsWith("ab-bond-auth-"),
      ),
    ).toHaveLength(1);
  }
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.appearance = theme;
    }, theme);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath(`callback-${theme}.png`) });
  }
  await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(page).toHaveURL(`/bond/${invite.token}`);
  await expect(page.getByRole("button", { name: "ACCEPT BOND" })).toBeVisible();
  await page.getByRole("link", { name: "NOT NOW", exact: true }).click();
  await expect(page.getByText(/^MY ATOM #/)).toBeVisible();
});
