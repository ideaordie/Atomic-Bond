import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { publicAtom, publicGraph } from "../../src/data/supabase/projections";
import { emotionalNetwork } from "../../src/graph/metrics/emotional-network";
import { AtomContextPanel } from "../../src/living-atom/interaction/AtomContextPanel";
it("allowlists a tombstone even if an upstream object contains former identity/location/emotion", () => {
  const raw = {
    publicId: "2",
    createdAt: "2026-10-03",
    status: "DELETED",
    degree: 0,
    displayName: "Former identity",
    xHandle: "old_handle",
    email: "private@example.invalid",
    metadata: { region: "Former region" },
    emotion: "joy",
  };
  expect(publicAtom(raw)).toEqual({
    publicId: "2",
    createdAt: "2026-10-03",
    status: "DELETED",
  });
  const graph = publicGraph({ nodes: [raw], edges: [] });
  expect(graph.nodes[0]).toEqual({
    id: "2",
    publicId: "2",
    degree: 0,
    status: "DELETED",
  });
  const now = Date.now();
  const pulse = {
    id: "p",
    atomId: "2",
    emotion: "joy" as const,
    createdAt: now,
    expiresAt: now + 86400000,
  };
  expect(emotionalNetwork(graph, "2", [pulse], now)).toMatchObject({
    active: [],
    connectedCount: 0,
  });
  const html = renderToStaticMarkup(
    <AtomContextPanel
      graph={graph}
      centerId="2"
      originalId="2"
      atomId="2"
      onView={() => {}}
      onClose={() => {}}
      activePulse={pulse}
      pulseNow={now}
      ownerMode={false}
    />,
  );
  expect(html).toContain("DELETED");
  expect(html).not.toMatch(
    /Former identity|old_handle|Former region|private@|Joy/,
  );
});
