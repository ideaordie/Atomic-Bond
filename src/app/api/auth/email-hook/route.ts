import { deliverAuthEmail } from "../../../../services/auth/email-hook";
import { hookOrigin } from "../../../../services/auth/policy";
import { ResendNotificationService } from "../../../../services/notifications/resend-notification-service";
import { resendTransport } from "../../../../services/notifications/resend-transport";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const secret = process.env.SUPABASE_AUTH_HOOK_SECRET,
      from = process.env.RESEND_FROM_EMAIL;
    if (!secret || !from)
      return new Response("Email delivery is not configured", { status: 503 });
    if (Number(request.headers.get("content-length") || 0) > 65536)
      return new Response(null, { status: 413 });
    const reader = request.body?.getReader();
    if (!reader) return new Response(null, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks).toString("utf8");
    const redirectTo = JSON.parse(body)?.email_data?.redirect_to;
    if (typeof redirectTo !== "string") throw new Error("Invalid callback");
    await deliverAuthEmail(
      body,
      Object.fromEntries(request.headers),
      secret,
      hookOrigin(process.env, redirectTo),
      new ResendNotificationService(resendTransport(), from),
    );
    return Response.json({});
  } catch {
    return Response.json(
      {
        error: {
          http_code: 400,
          message: "Authentication email could not be delivered",
        },
      },
      { status: 400 },
    );
  }
}
