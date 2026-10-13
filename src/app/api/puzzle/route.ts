import { authClient } from "../../../services/auth/server";
import { appOrigin } from "../../../services/auth/policy";
import { puzzleHttp } from "../../../services/puzzle/http";
import { checkRateLimit } from "@vercel/firewall";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  const enabled =
    process.env.PARTICI_PUZZLE_ENABLED === "true" ||
    process.env.PARTICI_PUZZLE_CONTROLLED_ACCESS === "true";
  if (enabled && process.env.VERCEL) {
    const limit = await checkRateLimit("atomic-bond-puzzle", {
      headers: {
        host: new URL(appOrigin(process.env)).host,
        "x-real-ip": request.headers.get("x-real-ip") ?? "",
      },
      timeout: 1500,
    }).catch(() => ({ error: "unavailable", rateLimited: false }));
    if (limit.error || limit.rateLimited)
      return new Response(null, {
        status: limit.error ? 503 : 429,
        headers: { "Cache-Control": "private, no-store", "Retry-After": "60" },
      });
  }
  return puzzleHttp(request, {
    enabled,
    origin: appOrigin(process.env),
    client: authClient,
  });
}
export const GET = handle;
export const POST = handle;
