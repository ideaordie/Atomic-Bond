import type { BeforeSendEvent } from "@vercel/analytics/next";

// Static page totals only: never collect capabilities, Atom IDs or account routes.
const PAGES = new Set(["/", "/about", "/explore", "/welcome"]);

export function safePageView(
  event: BeforeSendEvent,
  referrer = "",
): BeforeSendEvent | null {
  if (event.type !== "pageview") return null;
  try {
    const url = new URL(event.url);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      !PAGES.has(url.pathname) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    // The SDK also collects document.referrer, outside the beforeSend URL field.
    // Drop the event rather than risk forwarding a capability or identity there.
    if (referrer) {
      const source = new URL(referrer);
      if (
        source.origin !== url.origin ||
        !PAGES.has(source.pathname) ||
        source.username ||
        source.password ||
        source.search ||
        source.hash
      )
        return null;
    }
    return { type: "pageview", url: url.origin + url.pathname };
  } catch {
    return null;
  }
}
