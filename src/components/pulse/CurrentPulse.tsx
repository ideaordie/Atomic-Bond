import {
  isActivePulse,
  type EmotionalPulse,
} from "../../types/emotional-pulse";
import { EMOTION_DEFINITIONS } from "../../living-atom/pulse/emotions";
export function CurrentPulse({
  pulse,
  now,
}: {
  pulse?: EmotionalPulse;
  now: number;
}) {
  if (!pulse || !isActivePulse(pulse, now)) return null;
  const minutes = Math.max(0, Math.floor((now - pulse.createdAt) / 60_000));
  const age =
    minutes < 1
      ? "just now"
      : minutes < 60
        ? `${minutes} minutes ago`
        : `${Math.floor(minutes / 60)} hours ago`;
  const definition = EMOTION_DEFINITIONS[pulse.emotion];
  return (
    <p className="current-pulse" data-testid="current-pulse">
      <span>CURRENT PULSE</span>
      <strong style={{ color: definition.color }}>{definition.label}</strong>
      <small>Shared {age} · expires after 24 hours</small>
    </p>
  );
}
