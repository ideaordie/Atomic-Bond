import Link from "next/link";
import { connection } from "next/server";
import { ownerContext } from "../../services/auth/server";
import { dataConfiguration } from "../../data/supabase/config";
import { doodleNavigationAccess } from "../../services/doodle/server";
import { ApplicationNavigation } from "./ApplicationNavigation";
export async function ApplicationHeader() {
  await connection();
  const context =
    dataConfiguration(process.env).mode === "supabase"
      ? await ownerContext()
      : null;
  const active =
    context?.atom?.status === "ACTIVE" &&
    Boolean(context?.user?.email_confirmed_at);
  return (
    <header className="shared-application-header">
      <Link href="/">ATOMIC BOND</Link>
      <ApplicationNavigation
        evolve={Boolean(active) && process.env.EVOLVE_ENABLED === "true"}
        owner={Boolean(active)}
        puzzle={
          Boolean(active) && process.env.PARTICI_PUZZLE_ENABLED === "true"
        }
        doodle={Boolean(active) && (await doodleNavigationAccess())}
      />
    </header>
  );
}
