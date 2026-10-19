// Runs before authentication, JSON parsing or database access. Dependency injection
// lets tests exercise the same boundary without a deployed Firewall rule.
export async function handleDoodle(
  request: Request,
  dependencies: {
    enabled: boolean;
    origin: string;
    ingress: (
      request: Request,
    ) => Promise<{ rateLimited: boolean; error?: string }>;
    execute: (body: unknown) => Promise<{
      data?: unknown;
      error?: string;
      retryAfterSeconds?: number;
    }>;
  },
) {
  const reply = (status: number, body: unknown, retry?: number) =>
    Response.json(body, {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        ...(retry ? { "Retry-After": String(retry) } : {}),
      },
    });
  if (!dependencies.enabled) return reply(404, { error: "Unavailable" });
  if (request.method !== "POST")
    return reply(405, { error: "Method not allowed" });
  try {
    const limit = await dependencies.ingress(request);
    if (limit.error)
      return reply(503, { error: "Request protection unavailable" });
    if (limit.rateLimited)
      return reply(429, { error: "Please wait before retrying" }, 60);
  } catch {
    return reply(503, { error: "Request protection unavailable" });
  }
  if (
    request.headers.get("origin") !== dependencies.origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return reply(403, { error: "Origin rejected" });
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim() !==
      "application/json" ||
    (request.headers.has("content-encoding") &&
      request.headers.get("content-encoding") !== "identity")
  )
    return reply(415, { error: "JSON required" });
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 70000))
    return reply(413, { error: "Request too large" });
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  const reader = request.body?.getReader();
  if (!reader) return reply(400, { error: "Invalid request" });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel();
  }, 5000);
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 70000) {
        await reader.cancel();
        return reply(413, { error: "Request too large" });
      }
      chunks.push(part.value);
    }
    if (timedOut) return reply(408, { error: "Request timed out" });
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(body),
      );
    } catch {
      return reply(400, { error: "Invalid request" });
    }
    const result = await dependencies.execute(parsed);
    if (result.error)
      return reply(
        result.error === "RATE_LIMITED" ? 429 : 403,
        {
          error:
            result.error === "SUBMISSIONS_PAUSED"
              ? "New submissions are paused."
              : "Operation rejected. Check access, cooldown and request limits.",
        },
        result.retryAfterSeconds,
      );
    if (
      request.headers.get("X-Doodle-Formats") !== "1,2" &&
      containsColorDrawing(result.data)
    )
      return reply(409, {
        error: "Reload Atomic Bond to view color drawings.",
      });
    return reply(200, { data: result.data });
  } catch {
    return reply(403, {
      error: "Operation unavailable. Verify your account access.",
    });
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

/** Capability negotiation prevents old open tabs from feeding v2 into a v1 decoder. */
export function containsColorDrawing(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsColorDrawing);
  const record = value as Record<string, unknown>;
  return (
    (record.version === 2 && typeof record.bitmap === "string") ||
    Object.values(record).some(containsColorDrawing)
  );
}
