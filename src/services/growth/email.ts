import { appOrigin } from "../auth/policy";
import type { GrowthDelivery, GrowthMetrics } from "./contracts";
const labels: Record<keyof GrowthMetrics, string> = {
  connectedAtoms: "connected Atoms",
  directBonds: "direct Bonds",
  regions: "regions reached",
  countries: "countries reached",
};
export function growthDelta(previous: GrowthMetrics, current: GrowthMetrics) {
  const delta = {} as GrowthMetrics;
  for (const key of Object.keys(labels) as (keyof GrowthMetrics)[]) {
    if (
      ![previous[key], current[key]].every(
        (n) => Number.isSafeInteger(n) && n >= 0,
      )
    )
      throw new Error("Invalid growth metrics");
    delta[key] = Math.max(0, current[key] - previous[key]);
  }
  return delta;
}
export function growthEmail(
  delivery: GrowthDelivery,
  configuredOrigin: string,
) {
  const origin = appOrigin({
    APP_ORIGIN: configuredOrigin,
    NODE_ENV: "production",
  });
  if (
    !/^[1-9][0-9]*$/.test(delivery.publicId) ||
    !/^[a-f0-9]{64}$/.test(delivery.unsubscribeToken)
  )
    throw new Error("Invalid growth delivery");
  const delta = growthDelta(delivery.previous, delivery.current);
  const lines = (Object.keys(labels) as (keyof GrowthMetrics)[])
    .filter((k) => delta[k] > 0)
    .map((k) => `+${delta[k]} ${labels[k]}`);
  if (!lines.length) throw new Error("No meaningful growth");
  const view = `${origin}/return`;
  // Fragment never reaches HTTP access logs, referrers, or service worker requests.
  const unsubscribe = `${origin}/unsubscribe#${delivery.unsubscribeToken}`;
  const reason =
    "You're receiving this because Weekly Atom Growth Updates are enabled for your Atom.";
  return {
    subject: "Your Atomic Bond network grew",
    text: `ATOMIC BOND\n\nYOUR ATOM GREW\nATOM #${delivery.publicId}\n\nYour connected network grew since your last growth update.\n\n${lines.join("\n")}\n\nVIEW MY ATOM\n${view}\n\nYour network keeps growing through the Bonds people create.\n\n${reason}\n\nUnsubscribe\n${unsubscribe}`,
    html: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f3f6f8;color:#142c40;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${lines.join(" · ")}</div><main style="max-width:560px;margin:auto;padding:24px"><p style="letter-spacing:3px">ATOMIC BOND</p><h1 style="font-size:28px">YOUR ATOM GREW</h1><p>ATOM #${delivery.publicId}</p><p>Your connected network grew since your last growth update.</p><ul style="padding-left:24px;line-height:1.8;font-size:20px">${lines.map((line) => `<li>${line}</li>`).join("")}</ul><p style="margin:32px 0"><a href="${view}" style="display:inline-block;padding:16px 24px;background:#174969;color:white;border-radius:12px;text-decoration:none">VIEW MY ATOM</a></p><p>Your network keeps growing through the Bonds people create.</p><p style="font-size:14px;line-height:1.6">${reason}</p><p style="line-height:2"><a href="${unsubscribe}" style="color:#174969">Unsubscribe</a></p></main></body></html>`,
  };
}
