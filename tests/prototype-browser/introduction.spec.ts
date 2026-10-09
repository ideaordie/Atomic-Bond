import { test, expect } from "@playwright/test";
test("five deterministic compositions, review controls, bounds and capture", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/review/introduction");
  const canvas = page.getByTestId("introduction-canvas");
  await expect(canvas).toHaveAttribute("data-render-ms", /\d/);
  await expect(canvas).toHaveAttribute("width", "1920");
  await expect(canvas).toHaveAttribute("height", "1080");
  const seek = async (seconds: number) => {
    await page
      .getByRole("slider", { name: "Timeline seconds" })
      .fill(String(Number(seconds.toFixed(2))));
    await expect(canvas).toHaveAttribute("data-time", seconds.toFixed(3));
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
  };
  const pixels = () => canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());
  for (const [i, t] of [2, 7.6, 14.3, 20, 25].entries()) {
    await seek(t);
    await expect(canvas).toHaveAttribute("data-scene", String(i));
    await canvas.screenshot({ path: info.outputPath(`scene-${i + 1}.png`) });
  }
  await seek(11.25);
  const before = await pixels();
  await seek(23);
  await seek(2);
  await seek(11.25);
  expect(await pixels()).toBe(before);
  const bounds = await canvas.boundingBox();
  expect(bounds!.width / bounds!.height).toBeCloseTo(16 / 9, 2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "RESTART", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-time", "0.000");
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-time")))
    .toBeGreaterThan(0.1);
  await page.getByRole("button", { name: "PAUSE", exact: true }).click();
  const paused = await pixels();
  await page.waitForTimeout(150);
  expect(await pixels()).toBe(paused);
  await seek(24.8);
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-time", "25.000");
  await expect(
    page.getByRole("button", { name: "PLAY", exact: true }),
  ).toBeEnabled();
  expect(errors).toEqual([]);
  await page.screenshot({
    path: info.outputPath("review.png"),
    fullPage: true,
  });
  if (info.project.name === "desktop") {
    const samples: number[] = [];
    for (let i = 0; i < 40; i++) {
      await seek(8 + i * 0.4);
      samples.push(Number(await canvas.getAttribute("data-render-ms")));
    }
    samples.sort((a, b) => a - b);
    const result = {
      resolution: "1920x1080",
      samples: samples.length,
      medianPaintMs: samples[20],
      p95PaintMs: samples[38],
    };
    await info.attach("render-cost", {
      body: JSON.stringify(result),
      contentType: "application/json",
    });
    console.log(JSON.stringify(result));
    expect(samples[38]).toBeLessThan(50);
    await seek(25);
    await info.attach("final-1080p.png", {
      body: Buffer.from((await pixels()).split(",")[1]!, "base64"),
      contentType: "image/png",
    });
  }
});

test("reduced motion uses stable still scenes and keyboard controls", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/review/introduction");
  const canvas = page.getByTestId("introduction-canvas");
  await expect(canvas).toHaveAttribute("data-render-ms", /\d/);
  await expect(page.locator("p[role='status']")).toContainText(
    "five still compositions",
  );
  const pixels = () => canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await page.getByRole("slider").fill("1");
  const a = await pixels();
  await page.getByRole("slider").fill("3");
  expect(await pixels()).toBe(a);
  await page.getByRole("button", { name: /The invitation/ }).click();
  await expect(canvas).toHaveAttribute("data-scene", "4");
  await page.getByRole("slider").focus();
  await page.keyboard.press("Home");
  await expect(canvas).toHaveAttribute("data-time", "0.000");
});
