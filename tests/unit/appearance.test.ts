import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import {
  DARK_PALETTE,
  SCIENTIFIC_PALETTE,
  scientificPalette,
  layerTint,
} from "../../src/living-atom/renderer/scientific-palette";

it("initializes only explicit dark selection before paint, safely handling blocked storage", () => {
  for (const value of [
    null,
    "light",
    "dark",
    "invalid",
    new Error("blocked"),
  ]) {
    const root = { dataset: {} as Record<string, string> };
    let theme = "";
    runInNewContext(readFileSync("public/appearance-init.js", "utf8"), {
      localStorage: {
        getItem: () => {
          if (value instanceof Error) throw value;
          return value;
        },
      },
      document: {
        documentElement: root,
        querySelector: () => ({
          setAttribute: (_: string, v: string) => {
            theme = v;
          },
        }),
      },
    });
    expect(root.dataset.appearance).toBe(value === "dark" ? "dark" : "light");
    expect(theme).toBe(value === "dark" ? "#101010" : "#ffffff");
  }
});
it("neutral palettes are stable objects and leave the default animation palette unchanged", () => {
  expect(scientificPalette()).toBe(SCIENTIFIC_PALETTE);
  expect(scientificPalette("dark")).toBe(DARK_PALETTE);
  expect(SCIENTIFIC_PALETTE.background).toBe("#ffffff");
  expect(layerTint(1, DARK_PALETTE)).not.toBe(layerTint(1));
  for (const color of Object.values(DARK_PALETTE).flat()) {
    expect(color.slice(1, 3)).toBe(color.slice(3, 5));
    expect(color.slice(3, 5)).toBe(color.slice(5, 7));
  }
});
it("both themes provide WCAG text and control contrast", () => {
  const css = readFileSync("public/design-tokens.css", "utf8");
  const light = Object.fromEntries(
    [
      ...css
        .split(":root[data-appearance")[0]!
        .matchAll(/--([\w-]+): (#[a-f0-9]{6});/g),
    ].map((m) => [m[1], m[2]]),
  );
  const dark = {
    ...light,
    ...Object.fromEntries(
      [
        ...css
          .split(":root[data-appearance")[1]!
          .matchAll(/--([\w-]+): (#[a-f0-9]{6});/g),
      ].map((m) => [m[1], m[2]]),
    ),
  };
  const lum = (s: string) => {
    const c = [1, 3, 5]
      .map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return c[0]! * 0.2126 + c[1]! * 0.7152 + c[2]! * 0.0722;
  };
  const contrast = (a: string, b: string) =>
    (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  for (const palette of [light, dark]) {
    for (const bg of ["page", "surface", "surface-muted"]) {
      for (const fg of ["text", "muted"])
        expect(contrast(palette[fg]!, palette[bg]!)).toBeGreaterThanOrEqual(
          4.5,
        );
      expect(
        contrast(palette["control-border"]!, palette[bg]!),
      ).toBeGreaterThanOrEqual(3);
      expect(contrast(palette.focus!, palette[bg]!)).toBeGreaterThanOrEqual(3);
    }
    expect(
      contrast(palette.accent!, palette["on-accent"]!),
    ).toBeGreaterThanOrEqual(4.5);
  }
});

it("switching remains available with blocked storage and saves only a validated appearance", async () => {
  const { vi } = await import("vitest");
  const { selectAppearance } =
    await import("../../src/components/appearance/appearance");
  const root = { dataset: {} as Record<string, string> };
  const events = new EventTarget();
  vi.stubGlobal("window", events);
  vi.stubGlobal("document", {
    documentElement: root,
    querySelector: () => null,
  });
  vi.stubGlobal("localStorage", {
    setItem: () => {
      throw new Error("blocked");
    },
  });
  try {
    expect(selectAppearance("dark")).toBe(false);
    expect(root.dataset.appearance).toBe("dark");
    const save = vi.fn();
    vi.stubGlobal("localStorage", { setItem: save });
    expect(selectAppearance("light")).toBe(true);
    expect(save).toHaveBeenCalledWith("atomic-bond-appearance", "light");
  } finally {
    vi.unstubAllGlobals();
  }
});
