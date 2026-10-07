import type { GraphData } from "../../types/graph";

/** Presentation only. The supplied graph contains authoritative confirmed edges. */
export function firstBondEligible(
  graph: GraphData,
  ownerId: string,
  activeOwner: boolean,
) {
  return (
    activeOwner &&
    graph.nodes.some(
      (n) => n.id === ownerId && (!n.status || n.status === "ACTIVE"),
    ) &&
    !graph.edges.some((e) => e.source === ownerId || e.target === ownerId)
  );
}

/** One incomplete, neutral gesture every five seconds; never a Pulse or graph edge. */
export function invitationGesture(elapsedMs: number, still: boolean) {
  const cycle = Math.floor(elapsedMs / 5000);
  const progress = (elapsedMs % 5000) / 2200;
  return {
    marker: cycle % 4,
    progress: still || progress > 1 ? 0 : progress * 0.78,
    opacity: still || progress > 1 ? 0 : Math.sin(progress * Math.PI) * 0.45,
  };
}
