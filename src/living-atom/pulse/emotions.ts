import type { Emotion } from "../../types/emotional-pulse";
export interface EmotionDefinition {
  readonly id: Emotion;
  readonly label: string;
  readonly color: string;
  readonly accessibleLabel: string;
  readonly visualParameters: { readonly glow: number };
}
const define = (
  id: Emotion,
  label: string,
  color: string,
): EmotionDefinition => ({
  id,
  label,
  color,
  accessibleLabel: `${label} — voluntarily shared emotional state`,
  visualParameters: { glow: 0.35 },
});
export const EMOTION_DEFINITIONS: Record<Emotion, EmotionDefinition> = {
  joy: define("joy", "Joy", "#f2cf68"),
  calm: define("calm", "Calm", "#65d9ca"),
  excited: define("excited", "Excited", "#f6aa65"),
  curious: define("curious", "Curious", "#8bdf70"),
  sad: define("sad", "Sad", "#79acfa"),
  anxious: define("anxious", "Anxious", "#e994cc"),
  angry: define("angry", "Angry", "#f08080"),
  afraid: define("afraid", "Afraid", "#b19aee"),
};
export const NEUTRAL_EMOTION_COLOR = "#64788e";
