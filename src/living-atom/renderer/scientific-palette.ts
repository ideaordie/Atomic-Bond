/** Neutral presentation materials; emotional identities live in pulse/emotions.ts. */
export const SCIENTIFIC_PALETTE = {
  background: "#ffffff",
  atmosphere: "#aaaaaa",
  bond: "#888888",
  text: "#111111",
  muted: "#555555",
  highlight: "#ffffff",
  core: "#777777",
  // Structural distance from the centered Atom, not an emotional state.
  layers: ["#888888", "#999999", "#aaaaaa", "#bbbbbb", "#cccccc"],
  shade: "#444444",
  shadow: "#111111",
  regions: ["#888888", "#999999", "#777777", "#aaaaaa", "#666666", "#999999"],
} as const;

export function layerTint(distance: number): string {
  if (distance === 0) return SCIENTIFIC_PALETTE.core;
  return SCIENTIFIC_PALETTE.layers[
    Math.min(distance - 1, SCIENTIFIC_PALETTE.layers.length - 1)
  ]!;
}
