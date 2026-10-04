import { describe, it, expect } from "vitest";
import {
  safeSignalUrl,
  validateSignal,
} from "../../src/services/signals/model";
describe("Network Signal content security", () => {
  it("accepts bounded global text and optional HTTPS CTA", () => {
    expect(() =>
      validateSignal({
        type: "COMMUNITY",
        title: "Hello",
        message: "Network update",
        linkLabel: null,
        linkUrl: null,
        startsAt: null,
        endsAt: null,
      }),
    ).not.toThrow();
    expect(safeSignalUrl("https://example.com/update?q=1")).toBe(true);
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///tmp/test",
    "http://example.com",
    "https://user:password@example.com",
    "https://example.com\\evil",
    "https://example.com/\n",
  ])("rejects unsafe destination %s", (url) =>
    expect(safeSignalUrl(url)).toBe(false),
  );
  it("rejects sponsorship and excess content", () => {
    expect(() =>
      validateSignal({
        type: "SPONSORED" as "COMMUNITY",
        title: "Test",
        message: "x",
        linkLabel: null,
        linkUrl: null,
        startsAt: null,
        endsAt: null,
      }),
    ).toThrow();
  });
});
