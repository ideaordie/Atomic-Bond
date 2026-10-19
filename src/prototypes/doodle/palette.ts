/** Version 2 palette: indices are permanent protocol values, not theme tokens. */
export const PALETTE = [
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Red", hex: "#CF5A53" },
  { name: "Orange", hex: "#B86B00" },
  { name: "Yellow", hex: "#E3C32E" },
  { name: "Green", hex: "#438B52" },
  { name: "Blue", hex: "#4A7FC1" },
  { name: "Purple", hex: "#9A66CC" },
] as const;
export function luminance(hex: string) {
  const c = hex
    .replace("#", "")
    .match(/../g)!
    .map((x) => parseInt(x, 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return c[0]! * 0.2126 + c[1]! * 0.7152 + c[2]! * 0.0722;
}
export function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
