import Link from "next/link";
import { generateMockGraph, mockAtomId } from "../../data/mock/graph";
import { ParticipationExperience } from "../../components/participation/ParticipationExperience";
import "./explore.css";

export default function ExplorePage() {
  const graph = generateMockGraph();
  return (
    <main className="explore-page">
      <nav className="explore-nav" aria-label="Main navigation">
        <Link href="/" className="wordmark">
          ATOMIC BOND
        </Link>
        <span>See how connected we already are.</span>
      </nav>
      <ParticipationExperience graph={graph} originalAtomId={mockAtomId(0)} />
    </main>
  );
}
