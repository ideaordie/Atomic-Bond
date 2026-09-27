import Link from "next/link";
import { connection } from "next/server";
import { ownerContext, ownedPublicId } from "../../../services/auth/server";
import { BondConfirmation } from "../../../components/auth/BondConfirmation";
import "../../../components/auth/auth.css";
import { bondRelationship } from "../../../services/bonds/relationship";
import { xProfileUrl } from "../../../utils/x-profile";
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
            Ask the other person for a new Bond invitation.
          </p>
          <Link href="/explore">Return to Atomic Bond</Link>
        </section>
      </main>
    );
  }
  const graph = await services.bonds.graph(invite.creatorPublicId);
  const inviter = graph.nodes.find(
    (n) => n.publicId === invite.creatorPublicId,
  );
  const ownerId = ownedPublicId(context);
  const relationship = bondRelationship(graph, ownerId, invite.creatorPublicId);
  const identity = (
    <>
      <h1>Confirm your Bond</h1>
      <p>Atom #{invite.creatorPublicId} has invited you to connect.</p>
      {inviter?.displayName && <h2>{inviter.displayName}</h2>}
      {inviter?.socialProfiles?.x && (
        <a
          href={xProfileUrl(inviter.socialProfiles.x.handle)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View @${inviter.socialProfiles.x.handle} on X (opens a new tab)`}
        >
          𝕏 @{inviter.socialProfiles.x.handle}
        </a>
      )}
      {inviter?.metadata?.homeRegion && <p>{inviter.metadata.homeRegion}</p>}
    </>
  );
  return (
    <main>
      {ownerId && relationship === "available" ? (
        <BondConfirmation token={token}>{identity}</BondConfirmation>
      ) : (
        <section className="auth-panel">
          {identity}
          {relationship === "self" ? (
            <>
              <p>
                This is your invitation. Share it with another person; you
                cannot Bond with yourself.
              </p>
              <Link href="/explore">MY ATOM</Link>
            </>
          ) : relationship === "bonded" ? (
            <>
              <p role="status">YOU ARE ALREADY BONDED</p>
              <Link href="/explore">MY ATOM</Link>
            </>
          ) : (
            <>
              <p>
                A Bond confirms that you know or choose to connect with this
                person. Create or access your Atom, then confirm the Bond.
              </p>
              <div className="entry-actions">
                <Link
                  href={`/auth?mode=register&next=${encodeURIComponent(`/bond/${token}`)}`}
                >
                  CREATE MY ATOM
                </Link>
                <Link
                  href={`/auth?mode=access&next=${encodeURIComponent(`/bond/${token}`)}`}
                >
                  ACCESS MY ATOM
                </Link>
              </div>
            </>
          )}
          {!ownerId && (
            <Link href="/" replace>
              DECLINE
            </Link>
          )}
        </section>
      )}
    </main>
  );
}
