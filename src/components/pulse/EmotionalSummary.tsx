import type { emotionalNetwork } from "../../graph/metrics/emotional-network";
export function EmotionalSummary({
  summary,
}: {
  summary: ReturnType<typeof emotionalNetwork>;
}) {
  return (
    <aside
      className="emotional-summary"
      aria-label="Connected network emotional summary"
    >
      <p>YOUR NETWORK RIGHT NOW</p>
      <strong data-testid="active-pulse-count">
        {summary.active.length} active Pulses
      </strong>
      <small>
        across {summary.connectedCount} connected Atoms, including you
      </small>
    </aside>
  );
}
