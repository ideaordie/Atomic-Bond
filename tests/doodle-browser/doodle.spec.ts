import { test, expect } from "@playwright/test";

test("captured gestures, page scrolling and lightweight paint", async ({
  page,
  context,
}, info) => {
  await page.goto("/review/doodle");
  const canvas = page.getByTestId("doodle-editor");
  await canvas.scrollIntoViewIfNeeded();
  const r = (await canvas.boundingBox())!;
  const touch = Boolean(info.project.use.hasTouch);
  if (touch) {
    const cdp = await context.newCDPSession(page);
    const initialScroll = await page.evaluate(() => scrollY);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: r.x + r.width * 0.2, y: r.y + r.height * 0.2 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: r.x + r.width * 0.8, y: r.y + r.height * 0.7 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    expect(await page.evaluate(() => scrollY)).toBe(initialScroll);
    await cdp.detach();
  } else {
    await page.mouse.move(r.x + r.width * 0.2, r.y + r.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(r.x + r.width + 20, r.y + r.height * 0.7);
    await page.mouse.up();
  }
  await expect(
    page.getByRole("button", { name: "SEND", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "UNDO", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "SEND", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "ERASE", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(canvas).toBeFocused();
  expect(
    await canvas.evaluate((node) => getComputedStyle(node).outlineStyle),
  ).not.toBe("none");
  const measurement = await page.evaluate(async () => {
    // Measure the actual mounted handlers and next paint without adding production instrumentation.
    const surface = document.querySelector<HTMLCanvasElement>(
      '[data-testid="doodle-editor"]',
    )!;
    const r = surface.getBoundingClientRect();
    surface.setPointerCapture = () => {};
    surface.hasPointerCapture = () => false;
    const base = {
      bubbles: true,
      pointerId: 60,
      isPrimary: true,
      button: 0,
      clientX: r.x + 2,
      clientY: r.y + 2,
    };
    const start = performance.now();
    surface.dispatchEvent(new PointerEvent("pointerdown", base));
    for (let i = 0; i < 256; i++)
      surface.dispatchEvent(
        new PointerEvent("pointermove", {
          ...base,
          clientX: r.x + (((i % 64) + 0.5) / 64) * r.width,
          clientY: r.y + ((Math.floor(i / 64) * 12 + 0.5) / 64) * r.height,
        }),
      );
    surface.dispatchEvent(new PointerEvent("pointerup", base));
    const handlersMs = performance.now() - start;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    return { handlersMs, burstToPaintMs: performance.now() - start };
  });
  await info.attach("drawing-burst-performance", {
    body: JSON.stringify(measurement),
    contentType: "application/json",
  });
  console.log(JSON.stringify({ viewport: info.project.name, ...measurement }));
  expect(measurement.handlersMs).toBeLessThan(1500);
  const controls = await page
    .locator(".doodle-page button")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().height),
    );
  expect(controls.every((height) => height >= 44)).toBe(true);
});

test("drawing, stroke undo, preview, local send and expiration in both themes", async ({
  page,
}, info) => {
  await page.goto("/review/doodle");
  const outbound: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() !== "GET" && !url.pathname.startsWith("/__nextjs"))
      outbound.push(request.method() + " " + url.pathname);
  });
  const editor = page.getByTestId("doodle-editor");
  await expect(
    page.getByRole("button", { name: "SEND", exact: true }),
  ).toBeDisabled();
  for (const theme of ["LIGHT", "DARK"]) {
    await page.getByRole("button", { name: theme, exact: true }).click();
    await page.getByRole("button", { name: "RESET EXAMPLES" }).click();
    await expect(page.getByTestId("doodle-viewer")).toHaveAttribute(
      "data-replay",
      "complete",
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: info.outputPath(`${theme.toLowerCase()}-examples.png`),
      fullPage: true,
    });
    await editor.scrollIntoViewIfNeeded();
    const rect = (await editor.boundingBox())!;
    await page.mouse.move(
      rect.x + rect.width * 0.2,
      rect.y + rect.height * 0.3,
    );
    await page.mouse.down();
    await page.mouse.move(
      rect.x + rect.width * 0.8,
      rect.y + rect.height * 0.3,
      { steps: 2 },
    );
    await page.mouse.up();
    await expect(page.locator(".doodle-count")).toContainText("40 dots");
    await page.getByRole("button", { name: "ERASE", exact: true }).click();
    await page.mouse.move(
      rect.x + rect.width * 0.2,
      rect.y + rect.height * 0.3,
    );
    await page.mouse.down();
    await page.mouse.move(
      rect.x + rect.width * 0.8,
      rect.y + rect.height * 0.3,
    );
    await page.mouse.up();
    await expect(page.locator(".doodle-count")).toContainText("0 dots");
    await page.getByRole("button", { name: "UNDO", exact: true }).click();
    await expect(page.locator(".doodle-count")).toContainText("40 dots");
    await page.getByRole("button", { name: "CLEAR", exact: true }).click();
    await page.getByRole("button", { name: "KEEP DRAWING" }).click();
    await expect(page.locator(".doodle-count")).toContainText("40 dots");
    await page.getByRole("button", { name: "PREVIEW", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "YOUR PREVIEW" }),
    ).toBeVisible();
    await expect(page.getByTestId("doodle-viewer").first()).toHaveAttribute(
      "data-replay",
      "complete",
    );
    await page.getByRole("button", { name: "SEND", exact: true }).click();
    await expect(
      page.getByText("YOUR LOCAL DEMO", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "SEND", exact: true }),
    ).toBeDisabled();
    await expect(page.getByTestId("doodle-viewer")).toHaveAttribute(
      "data-replay",
      "complete",
    );
    await expect(page.getByText("60 min remaining")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: info.outputPath(`${theme.toLowerCase()}-doodle.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "DRAW", exact: true }).click();
  }
  await page.getByRole("button", { name: "Next drawing" }).click();
  await page.getByRole("button", { name: "+60 MIN", exact: true }).click();
  await expect(page.getByText("No active demo drawings.")).toBeVisible();
  await page.getByRole("button", { name: "RESET EXAMPLES" }).click();
  await expect(page.getByText("DEMO ATOM A", { exact: true })).toBeVisible();
  expect(outbound).toEqual([]);
});

test("touch/pen capture, keyboard tools, cancellation, clear and reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/review/doodle");
  await expect(page.getByTestId("doodle-viewer")).toHaveAttribute(
    "data-replay",
    "complete",
  );
  const canvas = page.getByTestId("doodle-editor");
  await canvas.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await expect(page.locator(".doodle-count")).toContainText("1 dots");
  await page.getByRole("button", { name: "UNDO", exact: true }).click();
  await canvas.evaluate((node) => {
    const r = node.getBoundingClientRect();
    node.setPointerCapture = () => {};
    node.hasPointerCapture = () => false;
    const base = {
      bubbles: true,
      pointerId: 70,
      pointerType: "touch",
      isPrimary: true,
      button: 0,
      clientX: r.x + 10,
      clientY: r.y + 10,
    };
    node.dispatchEvent(new PointerEvent("pointerdown", base));
    node.dispatchEvent(
      new PointerEvent("pointermove", { ...base, clientX: r.x + 100 }),
    );
    node.dispatchEvent(new PointerEvent("pointercancel", base));
  });
  await expect(page.locator(".doodle-count")).toContainText("0 dots");
  for (const pointerType of ["touch", "pen"]) {
    await canvas.evaluate((node, type) => {
      const r = node.getBoundingClientRect();
      // Synthetic pointer events exercise the common handlers; physical capture is tested with a real mouse separately.
      node.setPointerCapture = () => {};
      node.hasPointerCapture = () => false;
      const base = {
        bubbles: true,
        pointerId: 51,
        pointerType: type,
        isPrimary: true,
        button: 0,
        clientX: r.x + r.width * 0.25,
        clientY: r.y + r.height * 0.5,
      };
      node.dispatchEvent(new PointerEvent("pointerdown", base));
      node.dispatchEvent(
        new PointerEvent("pointermove", {
          ...base,
          clientX: r.x + r.width * 0.75,
        }),
      );
      node.dispatchEvent(
        new PointerEvent("pointerup", {
          ...base,
          clientX: r.x + r.width * 0.75,
        }),
      );
    }, pointerType);
    await expect(page.locator(".doodle-count")).toContainText("33 dots");
    await page.getByRole("button", { name: "UNDO", exact: true }).click();
  }
  await canvas.focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "CLEAR", exact: true }).click();
  await page
    .getByRole("button", { name: "CLEAR DRAWING", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "SEND", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "UNDO", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "SEND", exact: true }),
  ).toBeEnabled();
  expect(
    await canvas.evaluate((node) => getComputedStyle(node).touchAction),
  ).toBe("none");
  expect(
    await page
      .locator(".doodle-page")
      .evaluate((node) => getComputedStyle(node).touchAction),
  ).not.toBe("none");
  await page.getByRole("button", { name: "PREVIEW", exact: true }).click();
  await expect(page.getByTestId("doodle-viewer").first()).toHaveAttribute(
    "data-replay",
    "complete",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "SEND", exact: true }),
  ).toBeDisabled();
});
