/** Ambient time excludes pauses and hidden-tab time. Pulse uses its own wall clock. */
export function createAmbientClock() {
  let elapsed = 0;
  let previous: number | null = null;
  let wasRunning = false;
  return {
    sample(now: number, running: boolean) {
      if (previous !== null && wasRunning && running)
        elapsed += Math.max(0, now - previous);
      previous = now;
      wasRunning = running;
      return elapsed;
    },
    reset() {
      elapsed = 0;
      previous = null;
      wasRunning = false;
    },
  };
}
