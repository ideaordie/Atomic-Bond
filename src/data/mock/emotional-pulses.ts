import {
  EMOTIONS,
  PULSE_LIFETIME_MS,
  type EmotionalPulse,
} from "../../types/emotional-pulse";
import type { GraphData } from "../../types/graph";
/** Authored synthetic submissions, not emotion inferred from a person's attributes.
 * IDs select deterministic fixture cases only. Caller supplies a repeatable epoch. */
export function mockEmotionalPulses(
  graph: GraphData,
  epoch: number,
): readonly EmotionalPulse[] {
  return [...graph.nodes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .flatMap((node, index) => {
      if (index % 5 > 1 || index === 0) return [];
      const ageHours = index % 5 === 1 ? 1 + (index % 20) : 25 + (index % 10);
      const createdAt = epoch - ageHours * 60 * 60 * 1000;
      return [
        {
          id: `fixture-pulse-${node.id}`,
          atomId: node.id,
          emotion: EMOTIONS[index % EMOTIONS.length]!,
          createdAt,
          expiresAt: createdAt + PULSE_LIFETIME_MS,
        },
      ];
    });
}
