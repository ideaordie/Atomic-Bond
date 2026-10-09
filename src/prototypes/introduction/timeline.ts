import { EMOTION_DEFINITIONS } from "../../living-atom/pulse/emotions";

export const DURATION = 25;
export const FRAME = { width: 1920, height: 1080 } as const;
export const SCENES = [
  {
    start: 0,
    end: 4,
    name: "The isolated Atom",
    lines: ["SOCIAL MEDIA WAS SUPPOSED", "TO CONNECT US."],
  },
  {
    start: 4,
    end: 8,
    name: "The first Bond",
    lines: ["BUT CONNECTION IS", "MORE THAN FOLLOWERS."],
  },
  {
    start: 8,
    end: 15,
    name: "The network comes alive",
    lines: ["ONE CONNECTION", "LEADS TO ANOTHER."],
  },
  {
    start: 15,
    end: 21,
    name: "Global connection",
    lines: ["DISCOVER HOW FAR YOUR", "CONNECTIONS CAN REACH."],
  },
  {
    start: 21,
    end: 25,
    name: "The invitation",
    lines: ["YOU ARE MORE CONNECTED", "THAN YOU KNOW."],
  },
] as const;

export const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const ease = (n: number) => {
  const v = clamp(n);
  return v * v * (3 - 2 * v);
};
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;
export const progress = (t: number, from: number, to: number) =>
  ease((t - from) / (to - from));
export const project = (longitude: number, latitude: number) => ({
  x: 960 + longitude * 4.35,
  y: 675 - latitude * 3.9,
});

// Invented regional concentrations, never participant locations or reach statistics.
const hubs = [
  [-100, 38],
  [-52, -15],
  [12, 49],
  [22, -15],
  [78, 23],
  [123, 35],
  [138, -25],
] as const;
export const PALETTE = Object.values(EMOTION_DEFINITIONS)
  .slice(0, 24)
  .map((e) => e.color);
export interface StoryAtom {
  index: number;
  parent: number | null;
  birth: number;
  x: number;
  y: number;
  longitude: number;
  latitude: number;
  color: string;
}
function makeGraph(): StoryAtom[] {
  const nodes: StoryAtom[] = [];
  for (let i = 0; i < 72; i++) {
    const angle = i * 2.399963;
    const radius = 115 + Math.sqrt(i / 71) * 535;
    const x = i === 0 ? 760 : i === 1 ? 1160 : 960 + Math.cos(angle) * radius;
    const y = i < 2 ? 635 : 645 + Math.sin(angle) * radius * 0.43;
    let parent = i === 0 ? null : i === 1 ? 0 : 1;
    if (i > 2) {
      let best = Infinity;
      // Each new Atom joins an existing branch, not the central Atom repeatedly.
      for (let j = 1; j < i; j++) {
        const p = nodes[j]!;
        const distance = Math.hypot(x - p.x, y - p.y);
        if (distance < best) {
          best = distance;
          parent = j;
        }
      }
    }
    const hub = hubs[i % hubs.length]!;
    nodes.push({
      index: i,
      parent,
      birth: i === 0 ? 0 : i === 1 ? 4.3 : 8 + (i - 2) * 0.085,
      x,
      y,
      longitude: hub[0] + Math.cos(angle) * (3 + (i % 13)),
      latitude: hub[1] + Math.sin(angle) * (3 + (i % 8)),
      color: PALETTE[(i * 7) % 24]!,
    });
  }
  return nodes;
}
export const STORY_ATOMS: readonly StoryAtom[] = makeGraph();

export function sampleTimeline(seconds: number) {
  const time = Number.isFinite(seconds)
    ? Math.max(0, Math.min(DURATION, seconds))
    : 0;
  const sceneIndex = SCENES.findIndex((s) => time < s.end);
  const index = sceneIndex < 0 ? 4 : sceneIndex;
  const scene = SCENES[index]!;
  const textOpacity =
    index === 4
      ? progress(time, 21, 21.65)
      : (index === 0 ? 1 : progress(time, scene.start, scene.start + 0.55)) *
        (1 - progress(time, scene.end - 0.35, scene.end));
  return {
    time,
    sceneIndex: index,
    scene,
    textOpacity,
    map: progress(time, 15, 18),
    finale: progress(time, 21, 22.4),
    nodes: STORY_ATOMS.filter((n) => time >= n.birth),
  };
}
