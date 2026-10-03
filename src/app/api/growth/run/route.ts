import { growthStore } from "../../../../data/growth/store";
import {
  runGrowth,
  schedulerAuthorized,
} from "../../../../services/growth/scheduler";
import { ResendNotificationService } from "../../../../services/notifications/resend-notification-service";
import { resendTransport } from "../../../../services/notifications/resend-transport";
import { appOrigin } from "../../../../services/auth/policy";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: Request) {
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  };
  if (
    !schedulerAuthorized(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  )
    return new Response(null, { status: 401, headers });
  try {
    const url = new URL(request.url);
    if (
      [...url.searchParams.keys()].some(
        (key) => !["dryRun", "after"].includes(key),
      )
    )
      return new Response(null, { status: 400, headers });
    const enabled = process.env.GROWTH_EMAIL_ENABLED === "true";
    const dryRun = url.searchParams.get("dryRun") !== "false";
    const sender = new ResendNotificationService(
      enabled && !dryRun
        ? resendTransport()
        : {
            send: async () => {
              throw new Error("Dry run cannot send");
            },
          },
      process.env.RESEND_FROM_EMAIL || "",
    );
    const result = await runGrowth(growthStore, sender, {
      dryRun,
      enabled,
      origin: appOrigin(process.env),
      after: url.searchParams.get("after") || "0",
      onlyAtom: process.env.GROWTH_TEST_ATOM || undefined,
      batchSize: Number(process.env.GROWTH_BATCH_SIZE || 50),
      maxBatches: 3,
      sendCap: Number(process.env.GROWTH_SEND_CAP || 1),
      intervalMs: 1000,
      maxDurationMs: 210000,
    });
    return Response.json(result, { headers });
  } catch {
    return Response.json(
      { error: "Growth operation unavailable" },
      { status: 503, headers },
    );
  }
}
