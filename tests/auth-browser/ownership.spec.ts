import { selectHomeRegion } from "./home-region";
import { expect, test } from "@playwright/test";
test("new invitation verification, owner actions, logout and cross-device same Atom restoration", async ({
  page,
  browser,
  request,
}, info) => {
  const email = `owner-${info.project.name}@example.invalid`;
  const invite = await (
    await request.get("http://127.0.0.1:54330/__test/invite")
  ).json();
  await page.goto(`/bond/${invite.token}`);
  await expect(page.getByText(/has invited you to connect/)).toBeVisible();
  await page.getByRole("link", { name: "CREATE MY ATOM", exact: true }).click();
  await page.getByLabel("Email").fill(email.toUpperCase());
  await page.getByLabel("Name / alias").fill("Verified owner");
  await page.getByLabel("X handle").fill("@curious_owner");
  await selectHomeRegion(page);
  await page.screenshot({
    path: info.outputPath("registration.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Create my Atom", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("secure link");
  const { link } = await (
    await request.get(`http://127.0.0.1:54330/__test/mail?email=${email}`)
  ).json();
  expect(link).toBeTruthy();
  const fresh = await browser.newContext({
    viewport: info.project.use.viewport ?? { width: 390, height: 844 },
  });
  const receiver = await fresh.newPage();
  await receiver.goto(link);
  await receiver
    .getByRole("button", { name: "VERIFY / ACCESS MY ATOM" })
    .click();
  await expect(receiver).toHaveURL(`/bond/${invite.token}`);
  await receiver.getByRole("button", { name: "CONFIRM BOND" }).click();
  await expect(
    receiver.getByText("BOND CREATED", { exact: true }),
  ).toBeVisible();
  const number = (
    await receiver.getByTestId("selected-atom").innerText()
  ).replace("#", "");
  await expect(receiver.getByTestId("selected-atom")).toHaveText(`#${number}`);
  await receiver.reload();
  await expect(receiver.getByTestId("selected-atom")).toHaveText(`#${number}`);
  await receiver.screenshot({
    path: info.outputPath("owner-network.png"),
    fullPage: true,
  });
  await receiver.getByRole("button", { name: "Pulse", exact: true }).click();
  await receiver.getByRole("radio", { name: "Curious", exact: true }).check();
  await receiver
    .getByRole("button", { name: "Send Pulse", exact: true })
    .click();
  await expect(
    receiver.getByRole("dialog", { name: "How are you feeling?" }),
  ).toHaveCount(0);
  await receiver.getByRole("link", { name: "Profile & preferences" }).click();
  await expect(receiver.getByLabel("Pulse notifications")).toHaveCount(0);
  const returnLink = receiver.getByRole("link", {
    name: "RETURN TO MY ATOM",
    exact: true,
  });
  await expect(returnLink).toBeInViewport();
  await expect(returnLink).toHaveAttribute("href", "/explore");
  const returnBox = await returnLink.boundingBox();
  const aliasBox = await receiver.getByLabel("Name / alias").boundingBox();
  expect(returnBox!.height).toBeGreaterThanOrEqual(44);
  expect(returnBox!.y + returnBox!.height).toBeLessThanOrEqual(aliasBox!.y);
  await returnLink.focus();
  await returnLink.press("Tab");
  await receiver.keyboard.press("Shift+Tab");
  await expect(returnLink).toBeFocused();
  expect(
    await returnLink.evaluate((el) => getComputedStyle(el).outlineStyle),
  ).not.toBe("none");
  await receiver.screenshot({
    path: info.outputPath("profile-return-navigation.png"),
    fullPage: true,
  });
  await returnLink.press("Enter");
  await expect(receiver).toHaveURL("/explore");
  await expect(receiver.getByTestId("selected-atom")).toHaveText(`#${number}`);
  const mainNav = receiver.getByRole("navigation", { name: "Main navigation" });
  await expect(
    mainNav.getByRole("link", { name: "MY ATOM", exact: true }),
  ).toHaveCount(0);
  await expect(
    mainNav.getByRole("link", { name: "Profile & preferences" }),
  ).toBeVisible();
  expect(
    await receiver.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await receiver.screenshot({
    path: info.outputPath("owner-navigation.png"),
    fullPage: true,
  });
  await receiver.getByRole("link", { name: "Profile & preferences" }).click();
  await receiver.getByLabel("Name / alias").fill("Updated owner");
  await receiver
    .getByLabel("Weekly updates", { exact: true })
    .selectOption("off");
  await expect(
    receiver.getByText("Weekly updates are OFF.", { exact: true }),
  ).toBeVisible();
  await receiver
    .getByLabel("Weekly updates", { exact: true })
    .selectOption("on");
  await expect(
    receiver.getByText("Weekly updates are ON.", { exact: true }),
  ).toBeVisible();
  await receiver.getByRole("button", { name: "Save", exact: true }).click();
  await expect(receiver.locator("form").getByRole("status")).toContainText(
    "saved",
  );
  await receiver.screenshot({
    path: info.outputPath("owner-settings.png"),
    fullPage: true,
  });
  expect(
    await receiver.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await receiver
    .getByRole("button", { name: "Sign out on this device" })
    .click();
  await expect(
    receiver.getByRole("link", { name: "ACCESS MY ATOM", exact: true }),
  ).toBeVisible();
  await receiver.reload();
  await expect(
    receiver.getByRole("link", { name: "CREATE MY ATOM", exact: true }),
  ).toBeVisible();
  await receiver.goto(link);
  await receiver
    .getByRole("button", { name: "VERIFY / ACCESS MY ATOM" })
    .click();
  await expect(receiver.getByRole("main").getByRole("alert")).toContainText(
    "already used",
  );
  const anotherInvite = await (
    await request.get("http://127.0.0.1:54330/__test/invite")
  ).json();
  await page.goto(`/bond/${anotherInvite.token}`);
  await page.getByRole("link", { name: "ACCESS MY ATOM", exact: true }).click();
  await expect(page.getByLabel("Country", { exact: false })).toHaveCount(0);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me an access link" }).click();
  await expect(page.getByRole("status")).toContainText("secure link");
  const returning = await (
    await request.get(`http://127.0.0.1:54330/__test/mail?email=${email}`)
  ).json();
  await receiver.goto(returning.link);
  await receiver
    .getByRole("button", { name: "VERIFY / ACCESS MY ATOM" })
    .click();
  await expect(receiver).toHaveURL(`/bond/${anotherInvite.token}`);
  await expect(
    receiver.getByText("YOU ARE ALREADY BONDED", { exact: true }),
  ).toBeVisible();
  await expect(
    receiver.getByRole("button", { name: "CONFIRM BOND" }),
  ).toHaveCount(0);
  await receiver.goto("/explore");
  await expect(receiver.getByTestId("selected-atom")).toHaveText(`#${number}`);
  expect(await receiver.content()).not.toContain(email);
  await receiver.goto(`/bond/${invite.token}`);
  await expect(receiver.getByRole("heading")).toHaveText(
    "Invitation unavailable",
  );
  await fresh.close();
});
test("expired access link cannot establish an owner session or allocate an Atom", async ({
  page,
  request,
}, info) => {
  const email = `expired-${info.project.name}@example.invalid`;
  const before = await (
    await request.get("http://127.0.0.1:54330/__test/counts")
  ).json();
  await request.post(
    "http://127.0.0.1:54330/auth/v1/otp?redirect_to=" +
      encodeURIComponent("http://127.0.0.1:3104/auth/confirm"),
    { data: { email, create_user: true } },
  );
  const { link } = await (
    await request.get(`http://127.0.0.1:54330/__test/mail?email=${email}`)
  ).json();
  await request.get("http://127.0.0.1:54330/__test/expire-access");
  await page.goto(link);
  await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "expired",
  );
  await page.goto("/owner");
  await expect(page.getByRole("heading")).toHaveText("CREATE MY ATOM");
  expect(
    await (await request.get("http://127.0.0.1:54330/__test/counts")).json(),
  ).toEqual(before);
});
test("expired invitation stays expired and malformed access fails safely", async ({
  page,
  request,
}) => {
  const invite = await (
    await request.get("http://127.0.0.1:54330/__test/invite")
  ).json();
  await request.get("http://127.0.0.1:54330/__test/expire-invites");
  await page.goto(`/bond/${invite.token}`);
  await expect(page.getByRole("heading")).toHaveText("Invitation unavailable");
  await page.goto("/auth/confirm#token_hash=invalid&next=https://evil.example");
  await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "could not be completed",
  );
  expect(page.url()).toContain("/auth/confirm");
});
