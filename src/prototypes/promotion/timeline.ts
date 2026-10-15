import { clamp } from "../introduction/timeline";
export const DURATION = 30;
export const FPS = 30;
export const FRAMES = DURATION * FPS;
export const FRAME = { width: 1920, height: 1080 } as const;
export const SCENES = [
  {
    start: 0,
    end: 5,
    name: "Connection",
    lines: ["EVERY CONNECTION", "STARTS SOMEWHERE."],
  },
  {
    start: 5,
    end: 10,
    name: "Your world",
    lines: ["TOGETHER, WE BRING", "THE WORLD CLOSER."],
  },
  {
    start: 10,
    end: 16,
    name: "Global Doodle",
    lines: ["SHARE A LITTLE CREATIVITY."],
  },
  {
    start: 16,
    end: 23,
    name: "Partici-Puzzle",
    lines: ["SOLVE SOMETHING TOGETHER."],
  },
  {
    start: 23,
    end: 30,
    name: "Invitation",
    lines: ["CONNECT. CREATE. PLAY. TOGETHER."],
  },
] as const;
export function sampleTimeline(seconds: number) {
  const time = Number.isFinite(seconds)
    ? clamp(seconds / DURATION) * DURATION
    : 0;
  const sceneIndex = Math.max(
    0,
    SCENES.findIndex((s) => time < s.end),
  );
  const index = time === DURATION ? 4 : sceneIndex;
  return { time, sceneIndex: index, scene: SCENES[index]! };
}
export function frameTime(frame: number) {
  return Math.max(0, Math.min(FRAMES - 1, Math.floor(frame))) / FPS;
}
