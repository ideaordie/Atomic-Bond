import { expect, it } from "vitest";
import { publicAtom, publicGraph } from "../../src/data/supabase/projections";
import { emotionalNetwork } from "../../src/graph/metrics/emotional-network";
it.each(["DELETED", "DEACTIVATED"])(
  "allowlists %s even if an upstream object contains identity/location/emotion",
  (status) => {
    const raw = {
      publicId: "2",
      createdAt: "2026-10-03",
      status,
      degree: 0,
      displayName: "Former identity",
      xHandle: "old_handle",
      email: "private@example.invalid",
      metadata: { region: "Former region" },
      emotion: "joyful",
    };
    expect(publicAtom(raw)).toEqual({
      publicId: "2",
      createdAt: "2026-10-03",
      status,
    });
    const graph = publicGraph({ nodes: [raw], edges: [] });
    expect(graph).toEqual({ nodes: [], edges: [] });
    const now = Date.now();
    const pulse = {
      id: "p",
      atomId: "2",
      emotion: "joyful" as const,
      createdAt: now,
      expiresAt: now + 86400000,
    };
    expect(emotionalNetwork(graph, "2", [pulse], now)).toMatchObject({
      active: [],
      connectedCount: 0,
    });
    expect(JSON.stringify(graph)).not.toMatch(
      /Former identity|old_handle|Former region|private@|Joy/,
    );
  },
);
