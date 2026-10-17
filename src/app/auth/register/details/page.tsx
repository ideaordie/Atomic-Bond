import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ownerContext } from "../../../../services/auth/server";
import { AccessForm } from "../../../../components/auth/AccessForm";
export default async function RegistrationDetailsPage() {
  await connection();
  const context = await ownerContext();
  if (!context.user?.email_confirmed_at) redirect("/auth");
  if (context.atom && context.atom.status !== "PENDING")
    redirect(
      context.atom.status === "DEACTIVATED"
        ? "/account/reactivate"
        : "/auth/register/invitation",
    );
  return (
    <main>
      <AccessForm next="/explore" verified invitedRegistration />
    </main>
  );
}
