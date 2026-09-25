import type { AtomScene } from "../types/scene";

export const PULSE_STEP_MS = 600;
export const ACTION_DURATION_MS = 15_000;
/** Preserve BFS order while fitting even deep networks into the action window. */
export function pulseStepMs(maxDistance: number) {
  return Math.min(
    PULSE_STEP_MS,
    Math.max(1, Math.floor(ACTION_DURATION_MS / (maxDistance + 1))),
  );
}

/** Both ordinary nodes and aggregate members activate at their actual BFS distance. */
export function pulseSteps(scene: AtomScene) {
  return Array.from({ length: scene.maxDistance + 1 }, (_, distance) => ({
    distance,
    nodeIds: scene.nodes
      .filter((node) => node.distance === distance)
      .map((node) => node.id),
    edgeIds: scene.edges
      .filter((edge) => edge.distance === distance)
      .map((edge) => edge.id),
    atomCount: scene.nodes
      .filter((node) => node.distance === distance)
      .reduce((sum, node) => sum + node.members.length, 0),
  }));
}
