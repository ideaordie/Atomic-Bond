import { describe, expect, it } from "vitest";
import { safePageView } from "../../src/services/analytics/page-view";

const origin = "https://atomicbond.ideaordie.com";
describe("aggregate page-view privacy", () => {
  it.each(["/", "/about", "/explore"])(
    "allows only a general page %s",
    (path) => {
      expect(safePageView({ type: "pageview", url: origin + path })).toEqual({
        type: "pageview",
        url: origin + path,
      });
    },
  );
  it.each([
    "/auth",
    "/auth/confirm?token_hash=test",
    "/bond/test-capability",
    "/unsubscribe?token=test",
    "/return",
    "/owner",
    "/account/delete",
    "/account/reactivate",
    "/admin",
    "/admin/network",
    "/admin/signals",
    "/a/1",
    "/explore?atom=1",
    "/about?email=synthetic%40example.invalid",
    "/explore#access_token=test",
    "/unknown/test",
  ])("does not report sensitive or unapproved URL %s", (path) => {
    expect(safePageView({ type: "pageview", url: origin + path })).toBeNull();
  });
  it.each(["/auth/confirm?token_hash=test", "/bond/test", "/owner", "/a/1"])(
    "does not leak a sensitive referrer %s",
    (path) => {
      expect(
        safePageView(
          { type: "pageview", url: origin + "/explore" },
          origin + path,
        ),
      ).toBeNull();
    },
  );
  it("allows a safe internal referrer but drops external referrers and custom events", () => {
    const event = { type: "pageview" as const, url: origin + "/about" };
    expect(safePageView(event, origin + "/")).toEqual(event);
    expect(safePageView(event, "https://example.invalid/private")).toBeNull();
    expect(safePageView({ ...event, type: "event" })).toBeNull();
    expect(safePageView({ ...event, url: "invalid" })).toBeNull();
  });
});
