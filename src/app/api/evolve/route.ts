import { checkRateLimit } from "@vercel/firewall";
import { appOrigin } from "../../../services/auth/policy";
import { handleEvolve } from "../../../services/evolve/ingress";
import { executeEvolve } from "../../../services/evolve/production";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleEvolve(request, {
    enabled: process.env.EVOLVE_ENABLED === "true",
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
      return checkRateLimit("atomic-bond-evolve", {
        headers: {
          host: new URL(appOrigin(process.env)).host,
          "x-real-ip": incoming.headers.get("x-real-ip") ?? "",
        },
        timeout: 1500,
      });
    },
    execute: executeEvolve,
  });
}
