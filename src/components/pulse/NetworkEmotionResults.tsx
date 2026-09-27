import { useRef, useState } from "react";
import type { emotionalNetwork } from "../../graph/metrics/emotional-network";
import type { networkReach } from "../../graph/metrics/network-reach";
import { EMOTIONS } from "../../types/emotional-pulse";
import { EMOTION_DEFINITIONS } from "../../living-atom/pulse/emotions";

export function NetworkEmotionResults({
  summary,
  reach,
  now,
  updatedAt,
  status,
}: {
  summary: ReturnType<typeof emotionalNetwork>;
  reach: ReturnType<typeof networkReach>;
  now: number;
  updatedAt: number;
  status: "ready" | "refreshing" | "unavailable" | "offline";
}) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const close = () => {
    setExpanded(false);
    toggle.current?.focus({ preventScroll: true });
  };
  const available = status === "ready" || status === "refreshing";
  const age = Math.max(0, Math.floor((now - updatedAt) / 60_000));
  return (
    <section className="network-now" aria-label="Your Network Now">
      <button
        ref={toggle}
        className="network-now-toggle"
        type="button"
        aria-expanded={expanded}
        aria-controls="network-now-details"
        onClick={() => setExpanded(!expanded)}
      >
        <strong>
          YOUR NETWORK NOW{" "}
          <span aria-hidden="true">{expanded ? "−" : "+"}</span>
        </strong>
        <span data-testid="active-pulse-count">
          {available
            ? `${summary.active.length} active ${summary.active.length === 1 ? "Pulse" : "Pulses"}`
            : "Emotional state unavailable"}{" "}
          · {summary.connectedCount} connected{" "}
          {summary.connectedCount === 1 ? "Atom" : "Atoms"}
        </span>
      </button>
      {expanded && (
        <div
          id="network-now-details"
          className="network-emotion-results"
          role="region"
          aria-label="Your Network Now details"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
        >
          <header>
            <h2>YOUR NETWORK NOW</h2>
            <button
              type="button"
              aria-label="Close Your Network Now"
              onClick={close}
            >
              ×
            </button>
          </header>
          <p role="status" className="measurement-status">
            {status === "offline"
              ? "Offline · reconnect to update emotional state"
              : status === "unavailable"
                ? "Update unavailable · retrying automatically"
                : status === "refreshing"
                  ? "Updating your connected network…"
                  : `Updated ${age === 0 ? "just now" : `${age} ${age === 1 ? "minute" : "minutes"} ago`}`}
          </p>
          <div
            className="emotion-distribution"
            aria-busy={status === "refreshing"}
          >
            {!available ? (
              <p>
                Emotional colors are hidden until we can update your network.
                Your last confirmed connections remain visible.
              </p>
            ) : (
              <>
                <p>
                  <strong>
                    {summary.active.length} active{" "}
                    {summary.active.length === 1 ? "Pulse" : "Pulses"}
                  </strong>{" "}
                  across {summary.connectedCount} connected{" "}
                  {summary.connectedCount === 1 ? "Atom" : "Atoms"}, including
                  you.
                </p>
                {summary.active.length === 0 && (
                  <p>
                    No active Pulses right now. Atoms remain neutral until
                    someone chooses to share.
                  </p>
                )}
                {summary.connectedCount === 1 && (
                  <p>Your network begins with you. Create a Bond to connect.</p>
                )}
                <p>
                  Recent feelings voluntarily shared in your connected network,
                  not the general population.
                </p>
                <ul>
                  {EMOTIONS.map((emotion) => (
                    <li key={emotion}>
                      <span
                        className="emotion-label"
                        style={{
                          borderLeftColor: EMOTION_DEFINITIONS[emotion].color,
                        }}
                      >
                        {EMOTION_DEFINITIONS[emotion].label}
                      </span>
                      <span>
                        {summary.counts[emotion]} ·{" "}
                        {summary.percentages[emotion].toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
                <p>
                  Percentages use {summary.active.length} active visible Pulses
                  only. Atoms without an active Pulse remain neutral.
                </p>
                <p>
                  Known network reach: {reach.cities.length}{" "}
                  {reach.cities.length === 1 ? "city" : "cities"} ·{" "}
                  {reach.regions.length}{" "}
                  {reach.regions.length === 1 ? "region" : "regions"} ·{" "}
                  {reach.countries.length}{" "}
                  {reach.countries.length === 1 ? "country" : "countries"}.
                  Geography may be incomplete.
                </p>
                {summary.regions.map((region) => (
                  <p key={region.key}>
                    {region.label}:{" "}
                    <strong>
                      {region.count} active{" "}
                      {region.count === 1 ? "Pulse" : "Pulses"}
                    </strong>
                  </p>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
