import type { EmotionalPulse } from "../../types/emotional-pulse";
import type { SpatialScene } from "../types/spatial";
import { EMOTION_DEFINITIONS, NEUTRAL_EMOTION_COLOR } from "./emotions";
export interface EmotionPaint {
  readonly colors: readonly string[];
  readonly label?: string;
  readonly activeCount: number;
}
/** Precompute density palettes on state/scene changes, never in the animation loop. */
export function emotionPaint(
  scene: SpatialScene,
  visible: readonly EmotionalPulse[],
  feel: boolean,
  ownId: string,
): ReadonlyMap<string, EmotionPaint> {
  const states = new Map(
    visible.filter((p) => feel || p.atomId === ownId).map((p) => [p.atomId, p]),
  );
  return new Map(
    scene.nodes.map((node) => {
      const active = node.members.flatMap((id) =>
        states.has(id) ? [states.get(id)!] : [],
      );
      const colors = node.members.map((id) => {
        const state = states.get(id);
        return state
          ? EMOTION_DEFINITIONS[state.emotion].color
          : feel
            ? NEUTRAL_EMOTION_COLOR
            : node.tint;
      });
      return [
        node.id,
        {
          colors,
          activeCount: active.length,
          ...(node.kind === "atom" && active[0]
            ? { label: EMOTION_DEFINITIONS[active[0].emotion].label }
            : {}),
        },
      ];
    }),
  );
}
