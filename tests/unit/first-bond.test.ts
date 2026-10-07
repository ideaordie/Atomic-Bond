import { describe, it, expect } from "vitest";
import {
  firstBondEligible,
  invitationGesture,
} from "../../src/living-atom/animation/first-bond";
import type { GraphData } from "../../src/types/graph";
describe("first Bond presentation", () => {
  const graph: GraphData = {
    nodes: [{ id: "1", publicId: "1", degree: 0, status: "ACTIVE" }],
    edges: [],
  };
  it("requires the ACTIVE owner and zero confirmed incident edges, not a stored onboarding flag", () => {
    expect(firstBondEligible(graph, "1", true)).toBe(true);
    expect(firstBondEligible(graph, "1", false)).toBe(false);
    expect(
      firstBondEligible(
        { ...graph, nodes: [{ id: "1", publicId: "1", degree: 0 }] },
        "1",
        true,
      ),
    ).toBe(true);
    expect(firstBondEligible(graph, "other", true)).toBe(false);
    for (const status of ["DORMANT", "DEACTIVATED", "DELETED"] as const)
      expect(
        firstBondEligible(
          { ...graph, nodes: [{ ...graph.nodes[0]!, status }] },
          "1",
          true,
        ),
      ).toBe(false);
    for (const [source, target] of [
      ["1", "2"],
      ["2", "1"],
    ])
      expect(
        firstBondEligible(
          {
            ...graph,
            edges: [{ id: "bond", source: source!, target: target! }],
          },
          "1",
          true,
        ),
      ).toBe(false);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toHaveLength(0);
  });
  it("rotates one incomplete neutral gesture every five seconds and disables motion when still", () => {
    for (let i = 0; i < 4; i++) {
      const gesture = invitationGesture(i * 5000 + 1100, false);
      expect(gesture.marker).toBe(i);
      expect(gesture.progress).toBeLessThan(1);
      expect(gesture.opacity).toBeGreaterThan(0);
      expect(invitationGesture(i * 5000 + 3000, false).opacity).toBe(0);
      expect(invitationGesture(i * 5000 + 1100, true).opacity).toBe(0);
    }
  });
});
