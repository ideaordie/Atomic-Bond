import {
  expect,
  test,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { selectHomeRegion } from "./home-region";
const fixture = "http://127.0.0.1:54330";
async function mail(request: APIRequestContext, email: string) {
  return (
    await (await request.get(`${fixture}/__test/mail?email=${email}`)).json()
  ).link as string;
}
async function existingOwner(
  page: Page,
  request: APIRequestContext,
  email: string,
) {
  await page.goto("/auth?mode=register");
  await page.getByLabel("Email").fill(email);
  await selectHomeRegion(page);
  await page
    .getByRole("button", { name: "Create my Atom", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("secure link");
  await page.goto(await mail(request, email));
  await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(
    page.getByRole("heading", { name: "YOUR ATOM IS READY" }),
  ).toBeVisible();
  const number = (
    await page.locator(".auth-panel p").first().innerText()
  ).replace("ATOM #", "");
  await page.goto("/owner");
  await page.getByRole("button", { name: "Sign out on this device" }).click();
  return number;
}
async function requestInviteAccess(
  page: Page,
  request: APIRequestContext,
  email: string,
) {
  const invite = await (await request.get(`${fixture}/__test/invite`)).json();
  await page.goto(`/bond/${invite.token}`);
  await page.getByRole("link", { name: "ACCESS MY ATOM", exact: true }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me an access link" }).click();
  await expect(page.getByRole("status")).toContainText("secure link");
  return { invite, link: await mail(request, email) };
}

test("existing owner resumes a bound invitation in a fresh context after reload, explicitly accepts, and cannot replay", async ({
  page,
  browser,
  request,
}, info) => {
  const email = `continuation-${info.project.name}@example.invalid`;
  await existingOwner(page, request, email);
  const { invite, link } = await requestInviteAccess(page, request, email);
  expect(link).toContain("#continuation=");
  expect(link).not.toContain(invite.token);
  const context = await browser.newContext({
    viewport: info.project.use.viewport ?? { width: 390, height: 844 },
  });
  const recipient = await context.newPage();
  await recipient.goto(link);
  await expect(recipient).toHaveURL(/\/auth\/confirm\?flow=[a-f0-9]{32}$/);
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name.startsWith("ab-bond-auth-"))).toMatchObject(
    { httpOnly: true, sameSite: "Lax", secure: true },
  );
  await recipient.reload();
  await recipient
    .getByRole("button", { name: "VERIFY / ACCESS MY ATOM" })
    .click();
  await expect(recipient).toHaveURL(`/bond/${invite.token}`);
  const before = await (await request.get(`${fixture}/__test/counts`)).json();
  await expect(
    recipient.getByRole("heading", { name: "YOU’VE BEEN INVITED TO BOND" }),
  ).toBeVisible();
  await recipient.getByRole("button", { name: "ACCEPT BOND" }).focus();
  await expect(
    recipient.getByRole("button", { name: "ACCEPT BOND" }),
  ).toBeFocused();
  for (const theme of ["light", "dark"]) {
    await recipient.evaluate(
      (theme) => (document.documentElement.dataset.appearance = theme),
      theme,
    );
    await recipient.screenshot({
      path: info.outputPath(`invitation-${theme}.png`),
    });
    expect(
      await recipient.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await recipient.getByRole("button", { name: "ACCEPT BOND" }).click();
  await expect(recipient.getByTestId("selected-atom")).toBeVisible();
  const after = await (await request.get(`${fixture}/__test/counts`)).json();
  expect(after.bonds).toBe(before.bonds + 1);
  await recipient.goto(link);
  await recipient
    .getByRole("button", { name: "VERIFY / ACCESS MY ATOM" })
    .click();
  await expect(recipient.getByRole("main").getByRole("alert")).toContainText(
    "already used",
  );
  await recipient.goto(`/bond/${invite.token}`);
  await expect(recipient.getByRole("heading")).toHaveText(
    "Invitation unavailable",
  );
  expect(
    (await (await request.get(`${fixture}/__test/counts`)).json()).bonds,
  ).toBe(after.bonds);
  await context.close();
});

for (const change of ["expire", "cancel", "dismiss"] as const) {
  test(`invitation ${change} during authentication is safe and does not create a Bond`, async ({
    page,
    request,
  }, info) => {
    const email = `continuation-${change}-${info.project.name}@example.invalid`;
    await existingOwner(page, request, email);
    const { invite, link } = await requestInviteAccess(page, request, email);
    const before = await (await request.get(`${fixture}/__test/counts`)).json();
    await page.goto(link);
    await expect(page).toHaveURL(/\?flow=/);
    if (change !== "dismiss")
      await request.get(`${fixture}/__test/${change}-invites`);
    await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
    await expect(page).toHaveURL(`/bond/${invite.token}`);
    if (change === "dismiss") {
      await page.getByRole("link", { name: "NOT NOW", exact: true }).click();
      await expect(page).toHaveURL("/explore");
      await page.reload();
      await expect(page).toHaveURL("/explore");
    } else
      await expect(page.getByRole("heading")).toHaveText(
        "Invitation unavailable",
      );
    expect(
      (await (await request.get(`${fixture}/__test/counts`)).json()).bonds,
    ).toBe(before.bonds);
  });
}

test("altered continuation fails without authentication, and simultaneous links do not overwrite cookies", async ({
  page,
  browser,
  request,
}, info) => {
  const email = `continuation-tamper-${info.project.name}@example.invalid`;
  await existingOwner(page, request, email);
  const first = await requestInviteAccess(page, request, email);
  const second = await requestInviteAccess(page, request, email);
  const context = await browser.newContext();
  const a = await context.newPage(),
    b = await context.newPage();
  await a.goto(first.link);
  await expect(a).toHaveURL(/\?flow=/);
  await b.goto(second.link);
  await expect(b).toHaveURL(/\?flow=/);
  expect(a.url()).not.toBe(b.url());
  expect(
    (await context.cookies()).filter((c) => c.name.startsWith("ab-bond-auth-")),
  ).toHaveLength(2);
  // A flow locator cannot redeem a different encrypted cookie, even in one browser.
  const saved = (await context.cookies()).filter((c) =>
    c.name.startsWith("ab-bond-auth-"),
  );
  const firstId = new URL(a.url()).searchParams.get("flow");
  const own = saved.find((c) => c.name === `ab-bond-auth-${firstId}`)!;
  const foreign = saved.find((c) => c.name !== own.name)!;
  await context.addCookies([{ ...own, value: foreign.value }]);
  await a.reload();
  await a.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(a.getByRole("main").getByRole("alert")).toContainText(
    "unavailable",
  );
  await context.addCookies(saved);
  await a.goto(first.link);
  await expect(a).toHaveURL(/\?flow=/);
  await b.getByRole("button", { name: "NOT NOW", exact: true }).click();
  await a.reload();
  await a.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(a).toHaveURL(`/bond/${first.invite.token}`);
  const broken = second.link.replace(/continuation=./, "continuation=!");
  await b.goto(broken);
  await expect(b.getByRole("main").getByRole("alert")).toContainText(
    "unavailable",
  );
  await expect(
    b.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }),
  ).toBeDisabled();
  await context.close();
});

test("a different existing session cannot substitute its owner for the emailed flow", async ({
  page,
  request,
}, info) => {
  const a = `bound-owner-a-${info.project.name}@example.invalid`;
  const b = `bound-owner-b-${info.project.name}@example.invalid`;
  const number = await existingOwner(page, request, a);
  const pending = await requestInviteAccess(page, request, a);
  await existingOwner(page, request, b);
  await page.goto("/auth?mode=access");
  await page.getByLabel("Email").fill(b);
  await page.getByRole("button", { name: "Email me an access link" }).click();
  await expect(page.getByRole("status")).toContainText("secure link");
  await page.goto(await mail(request, b));
  await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(
    page.getByRole("heading", { name: "WELCOME BACK" }),
  ).toBeVisible();
  await page.goto(pending.link);
  await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  await expect(page).toHaveURL(`/bond/${pending.invite.token}`);
  await page.getByRole("link", { name: "NOT NOW", exact: true }).click();
  await expect(page.getByTestId("selected-atom")).toHaveText(`#${number}`);
});
