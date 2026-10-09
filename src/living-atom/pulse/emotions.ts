import type { Emotion } from "../../types/emotional-pulse";
export const PULSE_CATEGORIES = ["FEELING", "ENERGY", "VIBE"] as const;
export type PulseCategory = (typeof PULSE_CATEGORIES)[number];
export interface EmotionDefinition {
  readonly id: Emotion;
  readonly label: string;
  readonly category: PulseCategory;
  readonly color: string;
  readonly accessibleLabel: string;
  readonly visualParameters: { readonly glow: number };
}
const define = (
  id: Emotion,
  label: string,
  color: string,
  category: PulseCategory,
): EmotionDefinition => ({
  id,
  label,
  color,
  category,
  accessibleLabel: label + " — voluntarily shared Pulse state",
  visualParameters: { glow: 0.35 },
});
export const EMOTION_DEFINITIONS: Record<Emotion, EmotionDefinition> = {
  joyful: define("joyful", "Joyful", "#F4C400", "FEELING"),
  excited: define("excited", "Excited", "#FF7417", "FEELING"),
  curious: define("curious", "Curious", "#00B9E8", "FEELING"),
  calm: define("calm", "Calm", "#00BEAC", "FEELING"),
  content: define("content", "Content", "#47BB53", "FEELING"),
  sad: define("sad", "Sad", "#3266E3", "FEELING"),
  anxious: define("anxious", "Anxious", "#8951E8", "FEELING"),
  frustrated: define("frustrated", "Frustrated", "#EB4932", "FEELING"),
  energized: define("energized", "Energized", "#A6CB00", "ENERGY"),
  focused: define("focused", "Focused", "#0088C4", "ENERGY"),
  motivated: define("motivated", "Motivated", "#00A874", "ENERGY"),
  wired: define("wired", "Wired", "#E32AB4", "ENERGY"),
  tired: define("tired", "Tired", "#6461BB", "ENERGY"),
  drained: define("drained", "Drained", "#766078", "ENERGY"),
  restless: define("restless", "Restless", "#B64DEA", "ENERGY"),
  lazy: define("lazy", "Lazy", "#B48DCA", "ENERGY"),
  chilling: define("chilling", "Chilling", "#73CFF0", "VIBE"),
  hungry: define("hungry", "Hungry", "#F59127", "VIBE"),
  caffeinated: define("caffeinated", "Caffeinated", "#DFA000", "VIBE"),
  tipsy: define("tipsy", "Tipsy", "#EF599B", "VIBE"),
  pooped: define("pooped", "Pooped", "#A87535", "VIBE"),
  cozy: define("cozy", "Cozy", "#CEAE55", "VIBE"),
  hungover: define("hungover", "Hungover", "#B9C63C", "VIBE"),
  under_the_weather: define(
    "under_the_weather",
    "Under the Weather",
    "#7896AC",
    "VIBE",
  ),
  angry: define("angry", "Angry", "#f08080", "FEELING"),
  afraid: define("afraid", "Afraid", "#b19aee", "FEELING"),
};
export const NEUTRAL_EMOTION_COLOR = "#777777";
