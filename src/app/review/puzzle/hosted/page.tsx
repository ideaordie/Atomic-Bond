import { notFound } from "next/navigation";
import { authClient } from "../../../../services/auth/server";
import { HostedPuzzle } from "./view";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Controlled puzzle acceptance",
  robots: { index: false, follow: false },
};
export default async function HostedPuzzlePage() {
  if (process.env.PARTICI_PUZZLE_CONTROLLED_ACCESS !== "true") notFound();
  const c = await authClient();
  const {
    data: { user },
  } = await c.auth.getUser();
  if (!user?.email_confirmed_at) notFound();
  const admin = !(await c.rpc("signal_admin_history")).error;
  if (!admin && (await c.rpc("puzzle_request", { p_operation: "read" })).error)
    notFound();
  return <HostedPuzzle admin={admin} />;
}
