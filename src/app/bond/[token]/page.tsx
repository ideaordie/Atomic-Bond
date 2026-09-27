import Link from "next/link";
import { connection } from "next/server";
import { ownerContext, ownedPublicId } from "../../../services/auth/server";
import { BondConfirmation } from "../../../components/auth/BondConfirmation";
import "../../../components/auth/auth.css";
export default async function BondPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await connection();
  const { token } = await params;
  const context = await ownerContext();
  const { services } = context;
  let invite;
  try {
    invite = await services.bonds.read(token);
  } catch {
    return (
      <main>
        <section className="auth-panel">
          <h1>Invitation unavailable</h1>
          <p>
            This invitation is invalid, expired, cancelled or already accepted.
          </p>
          <Link href="/explore">Explore</Link>
        </section>
      </main>
    );
  }
  return (
    <main>
      <section className="auth-panel">
        <h1>Confirm your Bond</h1>
        <p>Atom #{invite.creatorPublicId} has invited you to connect.</p>
        {ownedPublicId(context) ? (
          <BondConfirmation token={token} />
        ) : (
          <div className="entry-actions">
            <Link
              href={`/auth?mode=register&next=${encodeURIComponent(`/bond/${token}`)}`}
            >
              CREATE MY ATOM
            </Link>
            <Link
              href={`/auth?mode=access&next=${encodeURIComponent(`/bond/${token}`)}`}
            >
              I ALREADY HAVE AN ATOM
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
