/** Presentation-only timing. Confirmation and graph mutation belong to services. */
export function arrivalVisibility(progress: number, distance: number): number {
  const start = distance <= 2 ? 0.55 : 0.75;
  return Math.max(0, Math.min(1, (progress - start) / (1 - start)));
}
