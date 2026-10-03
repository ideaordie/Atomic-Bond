import { growthStore } from "../../../../data/growth/store";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  };
  // Fixed-length body; no query-string capability and no cookie/session operation.
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error();
    let value = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      value += new TextDecoder().decode(chunk.value);
      if (value.length > 64) {
        await reader.cancel();
        throw new Error();
      }
    }
    if (!/^[a-f0-9]{64}$/.test(value))
      return Response.json({ success: false }, { status: 400, headers });
    const success = await growthStore.unsubscribe(value);
    return Response.json({ success }, { status: success ? 200 : 400, headers });
  } catch {
    return Response.json({ success: false }, { status: 503, headers });
  }
}
