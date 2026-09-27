import Link from "next/link";
import { connection } from "next/server";
import { ownerContext, ownedPublicId } from "../../services/auth/server";
import { AccessForm } from "../../components/auth/AccessForm";
import { nextPath } from "../../services/auth/policy";
export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  await connection();
  const context = await ownerContext();
  const { user, atom, services } = context;
  const query = await searchParams;
  const next = nextPath(query.next);
  if (ownedPublicId(context))
    return (
      <main>
        <section className="auth-panel">
          <h1>WELCOME BACK</h1>
          <p>ATOM #{atom!.publicId}</p>
          <Link href={next}>
            {next.startsWith("/bond/")
              ? "Continue to Bond confirmation"
              : "MY ATOM"}
          </Link>
        </section>
      </main>
    );
  return (
    <main>
      <AccessForm
        locations={await services.locations.search("")}
        next={next}
        verified={Boolean(user?.email_confirmed_at)}
        initialMode={query.mode === "access" ? "access" : "register"}
      />
    </main>
  );
}
