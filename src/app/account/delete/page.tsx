import { connection } from "next/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ownerContext, ownedPublicId } from "../../../services/auth/server";
import { AccountDeletion } from "../../../components/auth/AccountDeletion";
import "../../../components/auth/auth.css";

export default async function DeletePage() {
  await connection();
  const context = await ownerContext();
  if (!context.user) redirect("/auth?mode=access&next=%2Faccount%2Fdelete");
  const { data, error } = await context.client.rpc("account_deletion_status");
  if (
    error ||
    (!ownedPublicId(context) &&
      context.atom?.status !== "DEACTIVATED" &&
      !data?.pending)
  )
    redirect("/auth");
  return (
    <main>
      <section className="auth-panel">
        <Link className="profile-return" href="/owner">
          ← RETURN TO PROFILE &amp; PREFERENCES
        </Link>
        <AccountDeletion initialPending={data?.pending === true} />
      </section>
    </main>
  );
}
