import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import manifest from "../../src/app/manifest";
import {
  DISMISS_MS,
  isIOS,
  isStandalone,
  isSuppressed,
} from "../../src/components/pwa/install-policy";

describe("PWA identity and install policy", () => {
  it("has stable origin-relative identity, standalone metadata and actual icons", () => {
    const value = manifest();
    expect(value).toMatchObject({
      name: "Atomic Bond",
      id: "/",
      start_url: "/",
      scope: "/",
      display: "standalone",
      theme_color: "#ffffff",
    });
    for (const icon of value.icons!) {
      const png = PNG.sync.read(readFileSync(`public${icon.src}`));
      expect(`${png.width}x${png.height}`).toBe(icon.sizes);
    }
    expect(value.icons!.some((icon) => icon.purpose === "maskable")).toBe(true);
    expect(
      PNG.sync.read(readFileSync("public/icons/apple-touch-icon.png")).width,
    ).toBe(180);
  });
  it("detects standalone and iPad desktop UA without treating desktop Macs as iOS", () => {
    expect(isStandalone(true, false)).toBe(true);
    expect(isStandalone(false, true)).toBe(true);
    expect(isStandalone(false)).toBe(false);
    expect(isIOS("iPhone", "iPhone", 5)).toBe(true);
    expect(isIOS("Mac", "MacIntel", 5)).toBe(true);
    expect(isIOS("Mac", "MacIntel", 0)).toBe(false);
    expect(isIOS("Android", "Linux", 5)).toBe(false);
  });
  it("suppresses dismissal for thirty days, then permits a future offer", () => {
    const now = 1000;
    expect(isSuppressed(String(now + DISMISS_MS), now)).toBe(true);
    expect(isSuppressed(String(now + DISMISS_MS), now + DISMISS_MS)).toBe(
      false,
    );
    expect(isSuppressed(null, now)).toBe(false);
    expect(isSuppressed("bad data", now)).toBe(false);
  });
});
