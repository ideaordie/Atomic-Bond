import { DoodleEditor, LIFETIME, type Doodle } from "./model";

type XY = readonly [number, number];
const circle = (
  cx: number,
  cy: number,
  radius: number,
  start = 0,
  end = Math.PI * 2,
): XY[] =>
  Array.from({ length: 97 }, (_, i) => [
    Math.round(cx + radius * Math.cos(start + ((end - start) * i) / 96)),
    Math.round(cy + radius * Math.sin(start + ((end - start) * i) / 96)),
  ]);
export function demoDoodles(now: number): Doodle[] {
  const heart: XY[] = Array.from({ length: 129 }, (_, i) => {
    const t = (i * Math.PI * 2) / 128;
    return [
      Math.round(32 + 1.35 * 16 * Math.sin(t) ** 3),
      Math.round(
        30 -
          1.35 *
            (13 * Math.cos(t) -
              5 * Math.cos(2 * t) -
              2 * Math.cos(3 * t) -
              Math.cos(4 * t)),
      ),
    ];
  });
  const shapes: { description: string; paths: XY[][]; age: number }[] = [
    { description: "Heart", paths: [heart], age: 3 },
    {
      description: "Smiley face",
      paths: [
        circle(32, 32, 23),
        circle(24, 25, 2),
        circle(40, 25, 2),
        circle(32, 32, 13, 0.2, Math.PI - 0.2),
      ],
      age: 14,
    },
    {
      description: "Abstract waves",
      paths: Array.from({ length: 4 }, (_, j) =>
        Array.from(
          { length: 49 },
          (_, i) =>
            [8 + i, Math.round(17 + j * 9 + 5 * Math.sin(i / 7 + j))] as XY,
        ),
      ),
      age: 36,
    },
    {
      description: "Geometric diamond",
      paths: [
        [
          [32, 7],
          [56, 32],
          [32, 56],
          [8, 32],
          [32, 7],
        ],
        [
          [32, 17],
          [47, 32],
          [32, 47],
          [17, 32],
          [32, 17],
        ],
      ],
      age: 59,
    },
  ];
  return shapes.map(({ description, paths, age }, i) => {
    const editor = new DoodleEditor();
    for (const path of paths) {
      const first = path[0]!;
      editor.begin(first[1] * 64 + first[0], true);
      for (const [x, y] of path.slice(1)) editor.move(y * 64 + x);
      editor.finish();
    }
    const createdAt = now - age * 60000;
    return {
      id: `example-${i}`,
      attribution: `DEMO ATOM ${String.fromCharCode(65 + i)}`,
      description,
      createdAt,
      expiresAt: createdAt + LIFETIME,
      drawing: editor.export(),
    };
  });
}
