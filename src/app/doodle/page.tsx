import { ApplicationHeader } from "../../components/navigation/ApplicationHeader";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { doodlePageAccess } from "../../services/doodle/server";
import { ownerContext } from "../../services/auth/server";
import { DoodlePublishing } from "../../components/doodle/DoodlePublishing";
export default async function DoodlePage() {
  await connection();
  if (
    process.env.GLOBAL_DOODLE_ENABLED !== "true" &&
    process.env.GLOBAL_DOODLE_CONTROLLED_ACCESS !== "true"
  )
    notFound();
  const owner = await ownerContext().catch(() => null);
  if (!owner?.user?.email_confirmed_at || owner.atom?.status !== "ACTIVE") {
    if (process.env.GLOBAL_DOODLE_ENABLED !== "true") notFound();
    return (
      <main className="signal-admin">
        <h1>ACTIVE ATOM ACCESS REQUIRED</h1>
        <a href="/auth?mode=access">ACCESS MY ATOM</a>
      </main>
    );
  }
  if (!(await doodlePageAccess())) notFound();
  return (
    <>
      <ApplicationHeader />
      <DoodlePublishing
        colorEnabled={process.env.GLOBAL_DOODLE_COLOR_ENABLED === "true"}
      />
    </>
  );
}
