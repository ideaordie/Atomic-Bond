import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { ownerContext, ownedPublicId } from "../../../services/auth/server";
import { AccountDeactivation } from "../../../components/auth/AccountDeactivation";
import { nextPath } from "../../../services/auth/policy";
import "../../../components/auth/auth.css";
export default async function ReactivatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await connection();
  const context = await ownerContext();
  const next = nextPath((await searchParams).next);
  if (ownedPublicId(context)) redirect(next);
  if (
    !context.user?.email_confirmed_at ||
    context.atom?.status !== "DEACTIVATED"
  )
    redirect("/auth?mode=access");
  return (
    <main>
      <section className="auth-panel">
        <AccountDeactivation
          reactivate
          next={next}
          publicId={context.atom.publicId!}
        />
        <div className="account-danger">
          <h2>DELETE ACCOUNT &amp; DATA</h2>
          <p>
            Permanently remove your personal account information. This cannot be
            undone.
          </p>
          <Link className="delete-account-button" href="/account/delete">
            DELETE ACCOUNT
          </Link>
        </div>
        <Link className="profile-return" href="/">
          RETURN TO ATOMIC BOND
        </Link>
      </section>
    </main>
  );
}
