import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  if (
    process.env.NODE_ENV !== "development" ||
    !["127.0.0.1", "localhost"].includes(url.hostname)
  )
    return new NextResponse(null, { status: 404 });
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (
    !origin ||
    !host ||
    !["http://" + host, "https://" + host].includes(origin)
  )
    return new NextResponse(null, { status: 403 });
  if (Number(request.headers.get("content-length")) > 70000)
    return new NextResponse(null, { status: 413 });
  const body = await request.text();
  if (new TextEncoder().encode(body).length > 70000)
    return new NextResponse(null, { status: 413 });
  try {
    const response = await fetch("http://127.0.0.1:3143", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Doodle-Review": "local-synthetic",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Local synthetic database unavailable. Start scripts/review-doodle.mjs.",
      },
      { status: 503 },
    );
  }
}
