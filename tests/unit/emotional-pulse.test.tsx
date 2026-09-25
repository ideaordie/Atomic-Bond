import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EMOTIONS,
  PULSE_LIFETIME_MS,
  type EmotionalPulse,
} from "../../src/types/emotional-pulse";
import { MockPulseService } from "../../src/services/pulses/pulse-service";
import { mockEmotionalPulses } from "../../src/data/mock/emotional-pulses";
import { generateMockGraph, mockAtomId } from "../../src/data/mock/graph";
import { emotionalNetwork } from "../../src/graph/metrics/emotional-network";
import { getPerspective } from "../../src/graph/degrees/perspective";
import { networkReach } from "../../src/graph/metrics/network-reach";
import { createScene } from "../../src/living-atom/layout/scene";
import { createSpatialScene } from "../../src/living-atom/layout/spatial";
import { emotionPaint } from "../../src/living-atom/pulse/emotion-presentation";
import {
  EMOTION_DEFINITIONS,
  NEUTRAL_EMOTION_COLOR,
} from "../../src/living-atom/pulse/emotions";
import { pulseSteps } from "../../src/living-atom/pulse/traversal";
import { CurrentPulse } from "../../src/components/pulse/CurrentPulse";
import { createMockParticipation } from "../../src/services/participation/mock-services";
import type { GraphData } from "../../src/types/graph";

const epoch = Date.UTC(2026, 8, 23);
const graph = generateMockGraph();
const own = mockAtomId(0);
describe("Emotional Pulse lifecycle and boundaries", () => {
  it("includes Curious in deterministic fixtures, visible distributions, regions and replacement", () => {
    const service = new MockPulseService(
      own,
      mockEmotionalPulses(graph, epoch),
      () => epoch,
    );
    const visible = service.visible(graph, own);
    const summary = emotionalNetwork(graph, own, visible, epoch);
    expect(summary.counts.curious).toBe(16);
    expect(summary.percentages.curious).toBe(12.5);
    expect(
      summary.regions.reduce(
        (count, region) => count + region.counts.curious,
        0,
      ),
    ).toBe(16);
    const definition = EMOTION_DEFINITIONS.curious;
    expect(definition.accessibleLabel).toContain("Curious");
    expect(definition.color).not.toBe(EMOTION_DEFINITIONS.calm.color);
    expect(definition.color).not.toBe(EMOTION_DEFINITIONS.joy.color);
    const pulse = service.send("curious");
    expect(
      renderToStaticMarkup(<CurrentPulse pulse={pulse} now={epoch} />),
    ).toContain("Curious");
    const scene = createSpatialScene(
      createScene(graph, own, true),
      graph,
      "regions",
    );
    expect(
      emotionPaint(scene, service.visible(graph, own), true, own).get(
        `atom:${own}`,
      )?.colors,
    ).toEqual([definition.color]);
    const replacement = service.send("calm");
    expect(
      service.visible(graph, own).filter((state) => state.atomId === own),
    ).toEqual([replacement]);
  });
  it.each(EMOTIONS)(
    "creates explicitly selected %s, lasts exactly 24 hours and expires",
    (emotion) => {
      let now = epoch;
      const service = new MockPulseService(own, [], () => now);
      expect(service.visible(graph, own)).toEqual([]);
      const pulse = service.send(emotion);
      expect(pulse.emotion).toBe(emotion);
      expect(pulse.expiresAt - pulse.createdAt).toBe(PULSE_LIFETIME_MS);
      expect(EMOTION_DEFINITIONS[emotion].accessibleLabel).toContain(
        "voluntarily",
      );
      now += PULSE_LIFETIME_MS - 1;
      expect(service.visible(graph, own)).toEqual([pulse]);
      now++;
      expect(service.visible(graph, own)).toEqual([]);
      expect(service.nextExpiration()).toBeUndefined();
    },
  );
  it("replaces the prior state without retaining active history or changing recipients", () => {
    let now = epoch;
    const service = new MockPulseService(
      own,
      mockEmotionalPulses(graph, epoch),
      () => now,
    );
    const others = service.visible(graph, own);
    const old = service.send("sad");
    now += 1000;
    const latest = service.send("calm");
    expect(service.visible(graph, own).filter((p) => p.atomId === own)).toEqual(
      [latest],
    );
    expect(service.visible(graph, own).filter((p) => p.atomId !== own)).toEqual(
      others,
    );
    now = old.expiresAt;
    expect(service.visible(graph, own).find((p) => p.atomId === own)).toEqual(
      latest,
    );
    expect(() => service.send("inferred" as never)).toThrow();
  });
  it("uses deterministic synthetic submissions, excluding expired and disconnected Pulses", () => {
    const fixture = mockEmotionalPulses(graph, epoch);
    expect(mockEmotionalPulses(graph, epoch)).toEqual(fixture);
    expect(fixture.some((p) => p.expiresAt <= epoch)).toBe(true);
    expect(fixture.length).toBeLessThan(graph.nodes.length);
    const service = new MockPulseService(own, fixture, () => epoch);
    const visible = service.visible(graph, own);
    const connected = getPerspective(graph, own).distances;
    expect(
      visible.every((p) => connected.has(p.atomId) && p.expiresAt > epoch),
    ).toBe(true);
    expect(visible.length).toBeGreaterThan(0);
    expect(() => service.visible(graph, mockAtomId(720))).toThrow("viewer");
    expect(emotionalNetwork(graph, own, fixture, epoch).active).toEqual(
      visible,
    );
  });
  it("uses active visible submissions as the percentage denominator and canonical regional groups", () => {
    const tiny: GraphData = {
      nodes: [0, 1, 2, 3].map((n) => ({
        id: String(n),
        publicId: String(n),
        degree: 1,
        metadata: {
          region: n === 2 ? "Florida" : "Ontario",
          countryCode: n === 2 ? "US" : "CA",
          city: "Example",
        },
      })),
      edges: [
        { id: "a", source: "0", target: "1" },
        { id: "b", source: "1", target: "2" },
      ],
    };
    const pulses: EmotionalPulse[] = [0, 1, 2, 3].map((n) => ({
      id: String(n),
      atomId: String(n),
      emotion: n === 1 ? "sad" : "calm",
      createdAt: epoch - (n === 2 ? 25 : 1) * 3600000,
      expiresAt: epoch + (n === 2 ? -1 : 23) * 3600000,
    }));
    const summary = emotionalNetwork(tiny, "0", pulses, epoch);
    expect(summary.connectedCount).toBe(3);
    expect(summary.active).toHaveLength(2);
    expect(summary.percentages.calm).toBe(50);
    expect(summary.percentages.sad).toBe(50);
    expect(summary.regions).toHaveLength(1);
    expect(summary.regions[0]?.count).toBe(2);
    expect(networkReach(tiny, "0")).toMatchObject({
      people: 3,
      direct: 1,
      countries: ["CA", "US"],
    });
    expect(emotionalNetwork(tiny, "0", [], epoch).percentages.joy).toBe(0);
  });
  it("keeps full-network traversal exact while changing zoom aggregation", () => {
    const base = createScene(graph, own, true);
    const perspective = getPerspective(graph, own);
    expect(base.representedCount).toBe(640);
    for (const step of pulseSteps(base)) {
      const ids = base.nodes
        .filter((n) => step.nodeIds.includes(n.id))
        .flatMap((n) => n.members);
      expect(
        ids.every((id) => perspective.distances.get(id) === step.distance),
      ).toBe(true);
      expect(step.atomCount).toBe(ids.length);
    }
    const near = createSpatialScene(base, graph, "people");
    const far = createSpatialScene(base, graph, "regions");
    expect(far.nodes.filter((n) => n.kind === "atom").length).toBeLessThan(
      near.nodes.filter((n) => n.kind === "atom").length,
    );
    const visible = new MockPulseService(
      own,
      mockEmotionalPulses(graph, epoch),
      () => epoch,
    ).visible(graph, own);
    const paints = emotionPaint(far, visible, true, own);
    expect([...paints.values()].reduce((n, p) => n + p.activeCount, 0)).toBe(
      visible.length,
    );
    expect(paints.get(`atom:${own}`)?.colors).toEqual([NEUTRAL_EMOTION_COLOR]);
    expect([...paints.values()].some((p) => new Set(p.colors).size > 2)).toBe(
      true,
    );
    expect(near.nodes.length).toBeLessThan(graph.nodes.length / 2);
  });
  it("omits expired/absent context and keeps Pulse out of unrestricted profile serialization", () => {
    const service = new MockPulseService(own, [], () => epoch);
    const pulse = service.send("joy");
    expect(
      renderToStaticMarkup(<CurrentPulse pulse={pulse} now={epoch} />),
    ).toContain("Joy");
    expect(
      renderToStaticMarkup(
        <CurrentPulse pulse={pulse} now={pulse.expiresAt} />,
      ),
    ).toBe("");
    expect(renderToStaticMarkup(<CurrentPulse now={epoch} />)).toBe("");
    const { atoms } = createMockParticipation(graph);
    const publicData = JSON.stringify([
      atoms.get(own),
      atoms.toGraphNode(own),
      graph,
    ]);
    expect(publicData).not.toMatch(
      /emotion|expiresAt|email|authentication|notificationPreferences/,
    );
  });
});
