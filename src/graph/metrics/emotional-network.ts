import { getPerspective } from "../degrees/perspective";
import type { GraphData } from "../../types/graph";
import {
  EMOTIONS,
  isActivePulse,
  type Emotion,
  type EmotionalPulse,
} from "../../types/emotional-pulse";

export function emotionalNetwork(
  graph: GraphData,
  viewerId: string,
  visible: readonly EmotionalPulse[],
  now: number,
) {
  const perspective = getPerspective(graph, viewerId);
  const latest = new Map<string, EmotionalPulse>();
  for (const pulse of visible) {
    if (!perspective.distances.has(pulse.atomId)) continue;
    const old = latest.get(pulse.atomId);
    if (!old || pulse.createdAt >= old.createdAt)
      latest.set(pulse.atomId, pulse);
  }
  const active = [...latest.values()].filter((p) => isActivePulse(p, now));
  const counts = Object.fromEntries(
    EMOTIONS.map((emotion) => [emotion, 0]),
  ) as Record<Emotion, number>;
  const regions = new Map<
    string,
    {
      key: string;
      label: string;
      count: number;
      counts: Record<Emotion, number>;
    }
  >();
  for (const pulse of active) {
    counts[pulse.emotion]++;
    const node = perspective.nodes.get(pulse.atomId)!;
    const label = [
      node.metadata?.region ?? "Unspecified region",
      node.metadata?.countryCode,
    ]
      .filter(Boolean)
      .join(", ");
    const region = regions.get(label) ?? {
      key: label,
      label,
      count: 0,
      counts: Object.fromEntries(
        EMOTIONS.map((emotion) => [emotion, 0]),
      ) as Record<Emotion, number>,
    };
    region.count++;
    region.counts[pulse.emotion]++;
    regions.set(label, region);
  }
  return {
    active,
    connectedCount: perspective.distances.size,
    counts,
    percentages: Object.fromEntries(
      EMOTIONS.map((emotion) => [
        emotion,
        active.length ? (counts[emotion] / active.length) * 100 : 0,
      ]),
    ) as Record<Emotion, number>,
    regions: [...regions.values()].sort((a, b) =>
      a.label.localeCompare(b.label),
    ),
  };
}
