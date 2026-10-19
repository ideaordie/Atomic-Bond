import {
  localEvolveOperation,
  localEvolveRequest,
  localEvolveSession,
} from "../../../../services/evolve/server";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const reply = (value: unknown, status = 200) =>
    Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
  if (!localEvolveRequest(request)) return reply({ error: "Unavailable" }, 404);
  try {
    const text = await request.text();
    if (text.length > 8192) return reply({ error: "Request too large" }, 413);
    const { operation, payload = {} } = JSON.parse(text);
    if (operation === "fixture_session") {
      await localEvolveSession(payload.fixture);
      return reply({ ready: true });
    }
    return reply(await localEvolveOperation(operation, payload));
  } catch {
    return reply(
      {
        error:
          "Sign in to the local fixture. Check that its server is running.",
      },
      401,
    );
  }
}
