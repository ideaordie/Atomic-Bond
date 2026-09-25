import { PULSE_STEP_MS } from "./traversal";

/** Returning is a future presentation intent only; no communication is implemented. */
export type PulseDirection = "outgoing" | "returning";
export interface PulsePresentation {
  readonly direction: PulseDirection;
  readonly originId: string;
  readonly distance: number | null;
  readonly completed: boolean;
  readonly stepStartedAt: number;
}
export function idlePulse(originId: string): PulsePresentation {
  return {
    direction: "outgoing",
    originId,
    distance: null,
    completed: false,
    stepStartedAt: 0,
  };
}
export function pulsePhase(
  startedAt: number,
  now: number,
  reducedMotion: boolean,
  stepMs = PULSE_STEP_MS,
): number {
  return reducedMotion
    ? 1
    : Math.max(0, Math.min(1, (now - startedAt) / stepMs));
}
