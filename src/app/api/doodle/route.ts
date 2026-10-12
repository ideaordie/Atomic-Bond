import { checkRateLimit } from "@vercel/firewall";
import { appOrigin } from "../../../services/auth/policy";
import { handleDoodle } from "../../../services/doodle/ingress";
import { executeDoodle } from "../../../services/doodle/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleDoodle(request, {
    enabled:
      process.env.GLOBAL_DOODLE_ENABLED === "true" ||
      process.env.GLOBAL_DOODLE_CONTROLLED_ACCESS === "true",
    origin: appOrigin(process.env),
    ingress: async (incoming) => {
      // Existing isolated test environments only. Never bypass protection on Vercel.
      const url = new URL(incoming.url);
      if (
        !process.env.VERCEL &&
        process.env.AUTH_ALLOW_LOCALHOST === "true" &&
        ["127.0.0.1", "localhost"].includes(url.hostname)
      )
        return { rateLimited: false };
      if (!process.env.VERCEL || process.env.NODE_ENV !== "production")
        return { rateLimited: false, error: "unavailable" };
      return checkRateLimit("atomic-bond-doodle", {
        headers: {
          host: new URL(appOrigin(process.env)).host,
          "x-real-ip": incoming.headers.get("x-real-ip") ?? "",
        },
        timeout: 1500,
      });
    },
    execute: executeDoodle,
  });
}
