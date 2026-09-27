import { expect, it } from "vitest";
import { generateMockGraph, mockAtomId } from "../../src/data/mock/graph";
import { mockEmotionalPulses } from "../../src/data/mock/emotional-pulses";
import { emotionalNetwork } from "../../src/graph/metrics/emotional-network";
import { createScene } from "../../src/living-atom/layout/scene";
import { createSpatialScene } from "../../src/living-atom/layout/spatial";
import { emotionPaint } from "../../src/living-atom/pulse/emotion-presentation";
it("measures deterministic 1000-Atom state-only updates without rebuilding the scene", () => {
  const graph = generateMockGraph(),
    own = mockAtomId(0),
    now = Date.UTC(2026, 8, 27);
  const pulses = mockEmotionalPulses(graph, now);
  const scene = createSpatialScene(
    createScene(graph, own, true),
    graph,
    "networks",
  );
  const samples: number[] = [];
  for (let i = 0; i < 60; i++) {
    const start = performance.now();
    const summary = emotionalNetwork(graph, own, pulses, now + i * 60000);
    const paint = emotionPaint(scene, summary.active, true, own);
    samples.push(performance.now() - start);
    expect(paint.size).toBe(scene.nodes.length);
    expect(scene.representedCount).toBe(640);
  }
  samples.sort((a, b) => a - b);
  console.info(
    JSON.stringify({
      fixtureAtoms: graph.nodes.length,
      renderedGlyphs: scene.nodes.length,
      stateUpdateMedianMs: +samples[30]!.toFixed(2),
      stateUpdateP95Ms: +samples[57]!.toFixed(2),
    }),
  );
});
