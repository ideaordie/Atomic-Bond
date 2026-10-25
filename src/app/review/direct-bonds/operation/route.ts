export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.VERCEL ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    !origin ||
    new URL(origin).host !== request.headers.get("host")
  )
    return new Response(null, { status: 404 });
  const raw = await request.text();
  if (raw.length > 2048) return new Response(null, { status: 413 });
  try {
    const response = await fetch("http://127.0.0.1:54341", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw,
      cache: "no-store",
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { error: "Start the isolated fixture server." },
      { status: 503 },
    );
  }
}
