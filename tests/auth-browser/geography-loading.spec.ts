import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Network-fault tests must intercept the page's real chunk requests.
test.use({ serviceWorkers: "block" });

// Identify the real emitted catalog, not an assumed chunk hash.
const chunks = path.join(process.cwd(), ".next/static/chunks");
const geographyFiles = readdirSync(chunks).filter(
  (file) =>
    file.endsWith(".js") &&
    readFileSync(path.join(chunks, file), "utf8").includes("Afghanistan"),
);
const isGeography = (url: string) =>
  geographyFiles.some((file) => new URL(url).pathname.endsWith(`/${file}`));

test("login and initial registration defer geography; one load supports country changes", async ({
  page,
}) => {
  expect(geographyFiles.length).toBeGreaterThan(0);
  let loads = 0;
  page.on("request", (r) => {
    if (isGeography(r.url())) loads++;
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/auth?mode=access");
  await page.getByLabel("Email").fill("synthetic@example.invalid");
  await page.getByRole("button", { name: "Switch to Create my Atom" }).click();
  await expect(page.getByRole("combobox", { name: "Country" })).toBeVisible();
  expect(loads).toBe(0);
  const country = page.getByRole("combobox", { name: "Country" });
  await country.fill("Canada");
  await page.getByRole("option", { name: "Canada CA", exact: true }).click();
  const region = page.getByRole("combobox", {
    name: "State / Province / Region",
  });
  await region.fill("Ontario");
  await region.press("Enter");
  await expect(page.locator("[name=locationId]")).toHaveValue(
    "ab830000-0000-4000-8000-43412d4f4e00",
  );
  await country.fill("United States");
  await country.press("Enter");
  await expect(region).toHaveValue("");
  await expect(page.locator("[name=locationId]")).toHaveValue("");
  await page.getByRole("button", { name: "Switch to Access my Atom" }).click();
  await page.getByRole("button", { name: "Switch to Create my Atom" }).click();
  await country.fill("Canada");
  await expect(
    page.getByRole("option", { name: "Canada CA", exact: true }),
  ).toBeVisible();
  expect(loads).toBe(1);
  expect(errors).toEqual([]);
});

test("slow geography retains input, keeps form layout stable and survives unmount", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/_next/static/chunks/*.js", async (route) => {
    if (isGeography(route.request().url())) await held;
    await route.continue();
  });
  await page.goto("/auth?mode=register");
  // Prove handlers are hydrated before injecting a chunk delay. Native form
  // controls can be visible before React attaches their handlers.
  await page.getByRole("button", { name: "Switch to Access my Atom" }).click();
  await expect(
    page.getByRole("heading", { name: "ACCESS MY ATOM", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to Create my Atom" }).click();
  const submit = page.getByRole("button", {
    name: "Create my Atom",
    exact: true,
  });
  const before = await submit.boundingBox();
  const country = page.getByRole("combobox", { name: "Country" });
  await country.fill("Canada");
  await expect(page.getByText("Loading countries and regions…")).toBeVisible();
  await expect(country).toHaveValue("Canada");
  await expect(page.locator("[name=locationId]")).toHaveValue("");
  expect(await submit.boundingBox()).toEqual(before);
  await page.getByRole("button", { name: "Switch to Access my Atom" }).click();
  release();
  await expect(
    page.getByRole("heading", { name: "ACCESS MY ATOM", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to Create my Atom" }).click();
  await country.fill("Canada");
  await expect(
    page.getByRole("option", { name: "Canada CA", exact: true }),
  ).toBeVisible();
});

test("failed geography is recoverable without a fallback region", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/_next/static/chunks/*.js", async (route) => {
    if (fail && isGeography(route.request().url()))
      return route.abort("failed");
    await route.continue();
  });
  await page.goto("/auth?mode=register");
  await page.getByRole("button", { name: "Switch to Access my Atom" }).click();
  await expect(
    page.getByRole("heading", { name: "ACCESS MY ATOM", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to Create my Atom" }).click();
  const country = page.getByRole("combobox", { name: "Country" });
  await country.fill("Canada");
  await expect(
    page.getByText("Unable to load countries and regions."),
  ).toBeVisible();
  await expect(page.locator("[name=locationId]")).toHaveValue("");
  fail = false;
  await page.getByRole("button", { name: "TRY AGAIN", exact: true }).click();
  await expect(country).toHaveValue("Canada");
  await expect(
    page.getByRole("option", { name: "Canada CA", exact: true }),
  ).toBeVisible();
});
