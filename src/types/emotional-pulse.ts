/** Selectable states; retired states are read-only compatibility, never choices. */
export const EMOTIONS = [
  "joyful",
  "excited",
  "curious",
  "calm",
  "content",
  "sad",
  "anxious",
  "frustrated",
  "energized",
  "focused",
  "motivated",
  "wired",
  "tired",
  "drained",
  "restless",
  "lazy",
  "chilling",
  "hungry",
  "caffeinated",
  "tipsy",
  "pooped",
  "cozy",
  "hungover",
  "under_the_weather",
] as const;
export type PulseState = (typeof EMOTIONS)[number];
export const READABLE_EMOTIONS = [...EMOTIONS, "angry", "afraid"] as const;
export type Emotion = (typeof READABLE_EMOTIONS)[number];
export const isSelectablePulse = (value: unknown): value is PulseState =>
  typeof value === "string" && (EMOTIONS as readonly string[]).includes(value);
export const isReadablePulse = (value: unknown): value is Emotion =>
  typeof value === "string" &&
  (READABLE_EMOTIONS as readonly string[]).includes(value);
const DATABASE_STATES: Record<PulseState, string> = {
  joyful: "JOY",
  excited: "EXCITED",
  curious: "CURIOUS",
  calm: "CALM",
  content: "CONTENT",
  sad: "SAD",
  anxious: "ANXIOUS",
  frustrated: "FRUSTRATED",
  energized: "ENERGIZED",
  focused: "FOCUSED",
  motivated: "MOTIVATED",
  wired: "WIRED",
  tired: "TIRED",
  drained: "DRAINED",
  restless: "RESTLESS",
  lazy: "LAZY",
  chilling: "CHILLING",
  hungry: "HUNGRY",
  caffeinated: "CAFFEINATED",
  tipsy: "TIPSY",
  pooped: "POOPED",
  cozy: "COZY",
  hungover: "HUNGOVER",
  under_the_weather: "UNDER_THE_WEATHER",
};
export function pulseToDatabase(value: unknown): string {
  if (!isSelectablePulse(value))
    throw new Error("Select an approved Pulse state");
  return DATABASE_STATES[value];
}
export function pulseFromDatabase(value: unknown): Emotion {
  const canonical = value === "joy" ? "joyful" : value;
  if (!isReadablePulse(canonical))
    throw new Error("Unsupported Pulse state; refresh the application");
  return canonical;
}
/** Connected-network data, never part of unrestricted PublicAtom/GraphNode. */
export interface EmotionalPulse {
  readonly id: string;
  readonly atomId: string;
  readonly emotion: Emotion;
  readonly createdAt: number;
  readonly expiresAt: number;
}
export const PULSE_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const isActivePulse = (pulse: EmotionalPulse, now: number) =>
  pulse.createdAt <= now && now < pulse.expiresAt;
