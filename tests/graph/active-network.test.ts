import { expect, it } from "vitest";
import { activeNetwork } from "../../src/graph/active-network";
import { networkReach } from "../../src/graph/metrics/network-reach";
import { emotionalNetwork } from "../../src/graph/metrics/emotional-network";
import type { GraphData } from "../../src/types/graph";
it.each(["DORMANT", "DEACTIVATED", "DELETED"] as const)(
  "excludes %s bridge from reach, degree and emotional authorization",
  (status) => {
    const stored: GraphData = {
      nodes: [1, 2, 3].map((n) => ({
        id: String(n),
        publicId: String(n),
        degree: n === 2 ? 2 : 1,
        status: n === 2 ? status : ("ACTIVE" as const),
      })),
      edges: [
        { id: "a", source: "1", target: "2" },
        { id: "b", source: "2", target: "3" },
      ],
    };
    const active = activeNetwork(stored);
    expect(active.nodes.map((n) => n.id)).toEqual(["1", "3"]);
    expect(active.edges).toEqual([]);
    expect(active.nodes.every((n) => n.degree === 0)).toBe(true);
    expect(networkReach(active, "1").people).toBe(1);
    expect(networkReach(stored, "1").people).toBe(1);
    expect(
      emotionalNetwork(
        stored,
        "1",
        [
          {
            id: "p",
            atomId: "3",
            emotion: "joyful",
            createdAt: 1,
            expiresAt: 10000,
          },
        ],
        2,
      ).active,
    ).toEqual([]);
    expect(stored.edges).toHaveLength(2);
  },
);
