export const EMOTIONS = [
  "joy",
  "calm",
  "excited",
  "curious",
  "sad",
  "anxious",
  "angry",
  "afraid",
] as const;
export type Emotion = (typeof EMOTIONS)[number];
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
