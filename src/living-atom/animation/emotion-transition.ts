import type { EmotionPaint } from "../pulse/emotion-presentation";
/** Cross-fade material colors only. Membership/layout never change here. */
export function blendEmotionPaints(
  previous: ReadonlyMap<string, EmotionPaint>,
  next: ReadonlyMap<string, EmotionPaint>,
  progress: number,
): ReadonlyMap<string, EmotionPaint> {
  if (progress >= 1) return next;
  const t = Math.max(0, progress);
  const color = (a: string, b: string) => {
    if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return b;
    return (
      "#" +
      [1, 3, 5]
        .map((i) =>
          Math.round(
            parseInt(a.slice(i, i + 2), 16) * (1 - t) +
              parseInt(b.slice(i, i + 2), 16) * t,
          )
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")
    );
  };
  return new Map(
    [...next].map(([id, paint]) => [
      id,
      {
        ...paint,
        colors: paint.colors.map((target, i) =>
          color(previous.get(id)?.colors[i] ?? target, target),
        ),
      },
    ]),
  );
}
