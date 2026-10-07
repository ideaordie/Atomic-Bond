import Link from "next/link";
import { connection } from "next/server";
import { exploreSource } from "../../services/participation/explore-source";
import { LivingAtom } from "../../living-atom/LivingAtom";
import { ParticipationExperience } from "../../components/participation/ParticipationExperience";
import "../../app/explore/explore.css";
import { ownerContext, ownedPublicId } from "../../services/auth/server";
import { dataConfiguration } from "../../data/supabase/config";
import { redirect, notFound } from "next/navigation";
import { OwnerExperience } from "../../components/auth/OwnerExperience";
import "../../components/participation/participation.css";

export async function NetworkPage({
  requested,
  publicView = false,
}: {
  requested?: string | undefined;
  publicView?: boolean;
}) {
  await connection();
  const mode = dataConfiguration(process.env).mode;
  const owner = mode === "supabase" ? await ownerContext() : null;
  const ownerId = owner ? ownedPublicId(owner) : null;
  if (!requested && owner?.atom?.status === "DEACTIVATED")
    redirect("/account/reactivate");
  if (mode === "supabase" && !requested && !ownerId) redirect("/");
  if (mode === "supabase" && requested && !/^[1-9][0-9]*$/.test(requested))
    notFound();
  const source = await exploreSource(
    process.env,
    requested || ownerId || undefined,
  );
  if (source.mode === "supabase" && requested && !source.graph.nodes.length) {
    return (
      <main className="signal-admin">
        <h1>ATOM UNAVAILABLE</h1>
        <p>This Atom is not currently available.</p>
        <Link href="/">RETURN TO ATOMIC BOND</Link>
      </main>
    );
  }
  const ownView =
    !publicView && Boolean(ownerId && (!requested || requested === ownerId));
  return (
    <main className="explore-page">
      <nav className="explore-nav" aria-label="Main navigation">
        <div>
          <Link href="/" className="wordmark">
            ATOMIC BOND
          </Link>
          {source.mode === "supabase" && (
            <p className="network-view-label">
              {ownView
                ? `MY ATOM #${ownerId}`
                : `PUBLIC ATOM VIEW · ATOM #${requested}${source.graph.nodes.find((node) => node.publicId === requested)?.status === "DELETED" ? " · DELETED" : ""}`}
            </p>
          )}
        </div>
        <span>See how connected we already are.</span>
        <div className="auth-entry">
          <Link href="/about">ABOUT</Link>
          {ownerId && <Link href="/owner">Profile &amp; preferences</Link>}
          {source.mode === "supabase" && !ownerId && (
            <Link href="/auth">CREATE MY ATOM</Link>
          )}
          {source.mode === "supabase" && !ownerId && (
            <Link href="/auth?mode=access">ACCESS MY ATOM</Link>
          )}
        </div>
      </nav>
      {source.mode === "mock" ? (
        <ParticipationExperience
          graph={source.graph}
          originalAtomId={source.centerId}
        />
      ) : ownView && ownerId && owner ? (
        <OwnerExperience
          activeOwner={owner.atom?.status === "ACTIVE"}
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
