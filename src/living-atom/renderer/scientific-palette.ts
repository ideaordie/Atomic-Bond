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

export type NeutralPalette = {
  readonly [K in keyof typeof SCIENTIFIC_PALETTE]: K extends
    "layers" | "regions"
    ? readonly string[]
    : string;
};
export const DARK_PALETTE: NeutralPalette = {
  ...SCIENTIFIC_PALETTE,
  background: "#101010",
  atmosphere: "#777777",
  bond: "#949494",
  text: "#f5f5f5",
  muted: "#c2c2c2",
  core: "#aaaaaa",
  shade: "#555555",
  layers: ["#bbbbbb", "#aaaaaa", "#999999", "#888888", "#777777"],
};
export const scientificPalette = (
  appearance: "light" | "dark" = "light",
): NeutralPalette =>
  appearance === "dark" ? DARK_PALETTE : SCIENTIFIC_PALETTE;

export function layerTint(
  distance: number,
  palette: NeutralPalette = SCIENTIFIC_PALETTE,
): string {
  if (distance === 0) return palette.core;
  return palette.layers[Math.min(distance - 1, palette.layers.length - 1)]!;
}
