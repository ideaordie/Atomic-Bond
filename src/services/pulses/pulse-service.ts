import type { GraphData } from "../../types/graph";
import {
  EMOTIONS,
  PULSE_LIFETIME_MS,
  isActivePulse,
  type Emotion,
  type EmotionalPulse,
} from "../../types/emotional-pulse";
import { getPerspective } from "../../graph/degrees/perspective";

export interface PulseService {
  /** Production must bind the caller to an authenticated Atom; mock binds at construction. */
  send(emotion: Emotion): EmotionalPulse;
  visible(graph: GraphData, viewerId: string): readonly EmotionalPulse[];
  nextExpiration(): number | undefined;
  now(): number;
}
export class MockPulseService implements PulseService {
  private readonly latest = new Map<string, EmotionalPulse>();
  private sequence = 0;
  constructor(
    private readonly ownerId: string,
    initial: readonly EmotionalPulse[] = [],
    private readonly clock: () => number = Date.now,
  ) {
    for (const pulse of initial) {
      if (
        !EMOTIONS.includes(pulse.emotion) ||
        pulse.expiresAt !== pulse.createdAt + PULSE_LIFETIME_MS
      )
        throw new Error("Invalid Emotional Pulse");
      const previous = this.latest.get(pulse.atomId);
      if (!previous || pulse.createdAt >= previous.createdAt)
        this.latest.set(
          pulse.atomId,
          Object.freeze({
            id: pulse.id,
            atomId: pulse.atomId,
            emotion: pulse.emotion,
            createdAt: pulse.createdAt,
            expiresAt: pulse.expiresAt,
          }),
        );
    }
  }
  now() {
    return this.clock();
  }
  send(emotion: Emotion): EmotionalPulse {
    if (!EMOTIONS.includes(emotion))
      throw new Error("Select an approved emotion");
    const createdAt = this.clock();
    const pulse = Object.freeze({
      id: `local-pulse-${++this.sequence}`,
      atomId: this.ownerId,
      emotion,
      createdAt,
      expiresAt: createdAt + PULSE_LIFETIME_MS,
    });
    this.latest.set(this.ownerId, pulse);
    return pulse;
  }
  visible(graph: GraphData, viewerId: string): readonly EmotionalPulse[] {
    // This mock connection gate is not production authentication/authorization.
    if (viewerId !== this.ownerId)
      throw new Error("Pulse viewer is outside this session");
    const connected = getPerspective(graph, viewerId).distances;
    const now = this.clock();
    return [...this.latest.values()]
      .filter(
        (pulse) => connected.has(pulse.atomId) && isActivePulse(pulse, now),
      )
      .sort((a, b) => a.atomId.localeCompare(b.atomId));
  }
  nextExpiration() {
    const times = [...this.latest.values()]
      .map((p) => p.expiresAt)
      .filter((time) => time > this.clock());
    return times.length ? Math.min(...times) : undefined;
  }
}
