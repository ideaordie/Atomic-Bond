import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ownerContext } from "../../../../services/auth/server";
import { registrationIntent } from "../../../../services/auth/registration-intent";
import { BondConfirmation } from "../../../../components/auth/BondConfirmation";
export default async function RegistrationInvitationPage() {
  await connection();
  const context = await ownerContext();
  if (!context.user?.email_confirmed_at) redirect("/auth");
  if (!context.atom || context.atom.status === "PENDING")
    redirect("/auth/register/details");
  if (context.atom.status !== "ACTIVE") redirect("/explore");
  const intent = await registrationIntent(context);
  if (!intent) redirect("/explore");
  let invite;
  try {
    invite = await context.services.bonds.read(intent.invitation);
  } catch {
    return (
      <main>
        <section className="auth-panel">
          <h1>Invitation unavailable</h1>
          <p>
            This invitation is expired, cancelled or already accepted. Your Atom
            is ready. Ask the inviter for a new invitation if you still want to
            connect.
          </p>
          <Link href="/explore">MY ATOM</Link>
        </section>
      </main>
    );
  }
  return (
    <main>
      <BondConfirmation token="" registrationInvitation>
        <h1>YOU’VE BEEN INVITED TO BOND</h1>
        <p>
          Your Atom is ready. Complete your connection with the person who
          invited you.
        </p>
        <p>Atom #{invite.creatorPublicId} has invited you to connect.</p>
        <p>
          Confirm before{" "}
          <time dateTime={invite.expiresAt}>
            {new Date(invite.expiresAt)
              .toISOString()
              .replace("T", " ")
              .replace("Z", " UTC")}
          </time>
          . Opening this invitation does not extend its deadline.
        </p>
      </BondConfirmation>
    </main>
  );
}
