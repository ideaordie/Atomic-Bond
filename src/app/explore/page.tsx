import Link from "next/link";
import { connection } from "next/server";
import { exploreSource } from "../../services/participation/explore-source";
import { LivingAtom } from "../../living-atom/LivingAtom";
import { ParticipationExperience } from "../../components/participation/ParticipationExperience";
import "./explore.css";
import { ownerContext } from "../../services/auth/server";
import { OwnerExperience } from "../../components/auth/OwnerExperience";
import "../../components/participation/participation.css";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ atom?: string }>;
}) {
  await connection();
  const requested = (await searchParams).atom;
  const owner =
    process.env.ATOMIC_BOND_DATA_MODE === "supabase"
      ? await ownerContext()
      : null;
  const ownerId =
    owner?.user?.email_confirmed_at &&
    owner.atom &&
    ["ACTIVE", "DORMANT"].includes(owner.atom.status)
      ? owner.atom.publicId
      : null;
  const source = await exploreSource(
    process.env,
    requested || ownerId || undefined,
  );
  const ownView = Boolean(ownerId && (!requested || requested === ownerId));
  return (
    <main className="explore-page">
      <nav className="explore-nav" aria-label="Main navigation">
        <Link href="/" className="wordmark">
          ATOMIC BOND
        </Link>
        <span>See how connected we already are.</span>
        {source.mode === "supabase" && (
          <div className="auth-entry">
            <Link href={ownerId ? "/explore" : "/auth"}>
              {ownerId ? "MY ATOM" : "CREATE YOUR ATOM / SIGN IN"}
            </Link>
            {ownerId && <Link href="/owner">Profile &amp; preferences</Link>}
          </div>
        )}
      </nav>
      {source.mode === "mock" ? (
        <ParticipationExperience
          graph={source.graph}
          originalAtomId={source.centerId}
        />
      ) : ownView && ownerId && owner ? (
        <OwnerExperience
          graph={source.graph}
          publicId={ownerId}
          initialPulses={await owner.services.pulses.visible()}
        />
      ) : source.centerId && source.graph.nodes.length ? (
        <LivingAtom
          graph={source.graph}
          originalAtomId={source.centerId}
          ownerMode={false}
          synthetic={false}
        />
      ) : (
        <p role="status">
          No active Atoms are available yet. Create your Atom with a verified
          email to begin.
        </p>
      )}
    </main>
  );
}
