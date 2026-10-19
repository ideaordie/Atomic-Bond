import { notFound } from "next/navigation";
import { ownerContext } from "../../services/auth/server";
import { ApplicationHeader } from "../../components/navigation/ApplicationHeader";
import { EvolveView } from "../../components/evolve/EvolveView";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "EVOLVE | Atomic Bond",
  robots: { index: false, follow: false },
};
export default async function Page() {
  if (process.env.EVOLVE_ENABLED !== "true") notFound();
  const owner = await ownerContext().catch(() => null);
  if (!owner?.user?.email_confirmed_at || owner.atom?.status !== "ACTIVE")
    return (
      <main className="signal-admin">
        <h1>ACTIVE ATOM ACCESS REQUIRED</h1>
        <a href="/auth?mode=access">ACCESS MY ATOM</a>
      </main>
    );
  return (
    <>
      <ApplicationHeader />
      <EvolveView />
    </>
  );
}
