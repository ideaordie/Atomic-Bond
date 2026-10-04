import { test, expect } from "@playwright/test";
import { selectHomeRegion } from "./home-region";

test("two-stage deletion, recent access, anonymous return and permanent public tombstone", async ({
  page,
  request,
  context,
}, info) => {
  const email = `deletion-${info.project.name}@example.invalid`;
  await page.goto("/owner");
  await expect(page).toHaveURL(/\/auth$/);
  await expect(
    page.getByRole("heading", { name: "CREATE MY ATOM" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "DELETE ACCOUNT", exact: true }),
  ).toHaveCount(0);
  await page.goto("/auth?mode=register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Name / alias").fill("Disposable owner");
  await page.getByLabel("X handle").fill("removal_test");
  await selectHomeRegion(page);
  await page
    .getByRole("button", { name: "Create my Atom", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("secure link");
  const verify = async () => {
    const { link } = await (
      await request.get(`http://127.0.0.1:54330/__test/mail?email=${email}`)
    ).json();
    await page.goto(link);
    await page.getByRole("button", { name: "VERIFY / ACCESS MY ATOM" }).click();
  };
  await verify();
  await expect(
    page.getByRole("heading", { name: "YOUR ATOM IS READY" }),
  ).toBeVisible();
  await page.goto("/owner");
  const number = (
    await page.getByRole("heading", { level: 1 }).innerText()
  ).replace("ATOM #", "");
  await page
    .getByRole("button", { name: "DELETE ACCOUNT", exact: true })
    .click();
  await expect(page.getByText("This cannot be undone.")).toBeVisible();
  await page.getByRole("button", { name: "CANCEL", exact: true }).click();
  await page
    .getByRole("button", { name: "DELETE ACCOUNT", exact: true })
    .click();
  await page.getByRole("button", { name: "CONTINUE", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "PERMANENTLY DELETE ACCOUNT" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "CANCEL", exact: true }).click();
  await page
    .getByRole("button", { name: "DELETE ACCOUNT", exact: true })
    .click();
  await page.getByRole("button", { name: "CONTINUE", exact: true }).click();
  await page.getByLabel("Type DELETE").fill("DELETE");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("delete-confirmation.png"),
    fullPage: true,
  });
  await request.get("http://127.0.0.1:54330/__test/stale-auth");
  await page
    .getByRole("button", { name: "PERMANENTLY DELETE ACCOUNT" })
    .click();
  await expect(
    page.getByRole("button", { name: "EMAIL ME A SECURE CONFIRMATION" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "EMAIL ME A SECURE CONFIRMATION" })
    .click();
  await expect(page.getByRole("status").last()).toContainText(
    "Check your email",
  );
  await verify();
  await expect(page).toHaveURL(/\/account\/delete$/);
  await request.get("http://127.0.0.1:54330/__test/fail-removal-once");
  await page
    .getByRole("button", { name: "DELETE ACCOUNT", exact: true })
    .click();
  await page.getByRole("button", { name: "CONTINUE", exact: true }).click();
  await page.getByLabel("Type DELETE").fill("DELETE");
  await page
    .getByRole("button", { name: "PERMANENTLY DELETE ACCOUNT" })
    .click();
  await expect(
    page.getByRole("heading", { name: "FINISH ACCOUNT REMOVAL" }),
  ).toBeVisible();
  await expect(page.getByLabel("Name / alias")).toHaveCount(0);
  await page.getByRole("button", { name: "RETRY SECURE CLEANUP" }).click();
  await expect(
    page.getByRole("heading", { name: "ACCOUNT DELETED" }),
  ).toBeVisible();
  expect(
    (await context.cookies()).filter((c) => c.name.includes("auth-token")),
  ).toEqual([]);
  await page.goto("/owner");
  await expect(page).toHaveURL(/\/auth/);
  const graph = await (
    await request.post("http://127.0.0.1:54330/rest/v1/rpc/public_graph", {
      data: { p_public_id: number },
    })
  ).json();
  expect(graph.nodes).toHaveLength(1);
  expect(graph.nodes[0]).toMatchObject({
    publicId: number,
    status: "DELETED",
    metadata: {},
  });
  expect(JSON.stringify(graph)).not.toMatch(
    /Disposable owner|removal_test|@example/,
  );
  await page.goto(`/a/${number}`);
  await expect(
    page.getByText(`PUBLIC ATOM VIEW · ATOM #${number} · DELETED`),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pulse", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "DELETE ACCOUNT", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Select an Atom", { exact: true }).selectOption(number);
  await expect(page.getByTestId("atom-context")).toContainText("DELETED");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("public-tombstone.png"),
    fullPage: true,
  });
});
