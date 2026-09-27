import Link from "next/link";
import { connection } from "next/server";
import { ownerContext } from "../../services/auth/server";
import { AccessForm } from "../../components/auth/AccessForm";
import { nextPath } from "../../services/auth/policy";
export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await connection();
  const { user, atom, services } = await ownerContext();
  const next = nextPath((await searchParams).next);
  if (atom?.publicId)
    return (
      <main>
        <section className="auth-panel">
          <h1>WELCOME BACK</h1>
          <p>ATOM #{atom.publicId}</p>
          <Link href={next}>MY ATOM / CONTINUE</Link>
        </section>
      </main>
    );
  return (
    <main>
      <AccessForm
        locations={await services.locations.search("")}
        next={next}
        verified={Boolean(user?.email_confirmed_at)}
      />
    </main>
  );
}
