import { notFound } from "next/navigation";
import { ApplicationHeader } from "../../components/navigation/ApplicationHeader";
import {
  PuzzlePlayer,
  type PuzzleRead,
} from "../../components/puzzle/PuzzlePlayer";
import { authClient, ownerContext } from "../../services/auth/server";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "PARTICI-PUZZLE | Atomic Bond",
  robots: { index: false, follow: false },
};
export default async function PuzzlePage() {
  if (process.env.PARTICI_PUZZLE_ENABLED !== "true") notFound();
  const owner = await ownerContext().catch(() => null);
  if (!owner?.user?.email_confirmed_at || owner.atom?.status !== "ACTIVE")
    return (
      <main className="signal-admin">
        <h1>ACTIVE ATOM ACCESS REQUIRED</h1>
        <a href="/auth?mode=access">ACCESS MY ATOM</a>
      </main>
    );
  const client = await authClient();
  const result = await client.rpc("puzzle_request", { p_operation: "read" });
  if (result.error || result.data?.error) notFound();
  return (
    <>
      <ApplicationHeader />
      <PuzzlePlayer initial={result.data as PuzzleRead} />
    </>
  );
}
