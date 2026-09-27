import Link from "next/link";
import { connection } from "next/server";
import { exploreSource } from "../../services/participation/explore-source";
import { LivingAtom } from "../../living-atom/LivingAtom";
import { ParticipationExperience } from "../../components/participation/ParticipationExperience";
import "./explore.css";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ atom?: string }>;
}) {
  await connection();
  const source = await exploreSource(process.env, (await searchParams).atom);
  return (
    <main className="explore-page">
      <nav className="explore-nav" aria-label="Main navigation">
        <Link href="/" className="wordmark">
          ATOMIC BOND
        </Link>
        <span>See how connected we already are.</span>
      </nav>
      {source.mode === "mock" ? (
        <ParticipationExperience
          graph={source.graph}
          originalAtomId={source.centerId}
        />
      ) : source.centerId && source.graph.nodes.length ? (
        <LivingAtom
          graph={source.graph}
          originalAtomId={source.centerId}
          ownerMode={false}
        />
      ) : (
        <p role="status">
          No active Atoms are available yet. Verified owner access will be
          enabled in the next identity phase.
        </p>
      )}
    </main>
  );
}
