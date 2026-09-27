/** Neutral presentation materials; emotional identities live in pulse/emotions.ts. */
export const SCIENTIFIC_PALETTE = {
  background: "#f3f6f8",
  atmosphere: "#96b0c5",
  bond: "#527da1",
  text: "#22364b",
  muted: "#4e6478",
  highlight: "#ffffff",
  core: "#8da9bf",
  // Structural distance from the centered Atom, not an emotional state.
  layers: ["#bca06d", "#729fbe", "#a291bb", "#79a89f", "#a59c91"],
  shade: "#304c66",
  shadow: "#294663",
  regions: ["#6c8da8", "#7895ac", "#63839e", "#8a9eae", "#587e9d", "#7a899d"],
} as const;

export function layerTint(distance: number): string {
  if (distance === 0) return SCIENTIFIC_PALETTE.core;
  return SCIENTIFIC_PALETTE.layers[
    Math.min(distance - 1, SCIENTIFIC_PALETTE.layers.length - 1)
  ]!;
}
