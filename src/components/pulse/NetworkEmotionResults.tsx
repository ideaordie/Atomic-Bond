"use client";
import { useEffect, useRef, useState } from "react";
import type { GraphData } from "../../types/graph";
import { EMOTIONS, type EmotionalPulse } from "../../types/emotional-pulse";
import { emotionalNetwork } from "../../graph/metrics/emotional-network";
import { EMOTION_DEFINITIONS } from "../../living-atom/pulse/emotions";

export function NetworkEmotionResults({
  graph,
  viewerId,
  pulses,
  now,
  onClose,
}: {
  graph: GraphData;
  viewerId: string;
  pulses: readonly EmotionalPulse[];
  now: number;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const latest = useRef({ graph, viewerId, pulses, now });
  useEffect(() => {
    latest.current = { graph, viewerId, pulses, now };
  }, [graph, viewerId, pulses, now]);
  const [result, setResult] = useState<{
    viewerId: string;
    summary: ReturnType<typeof emotionalNetwork>;
  } | null>(null);
  const measuring = !result || result.viewerId !== viewerId;
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let frame: number;
    // Measure on opening, then once per minute. Keep the result DOM mounted
    // during background updates so scrolling and keyboard focus are preserved.
    const measure = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      frame = requestAnimationFrame(() => {
        timer = setTimeout(() => {
          const current = latest.current;
          setResult({
            viewerId: current.viewerId,
            summary: emotionalNetwork(
              current.graph,
              current.viewerId,
              current.pulses,
              // The owner clock uses zero until its first client tick.
              current.now || Date.now(),
            ),
          });
        }, 0);
      });
    };
    measure();
    const interval = setInterval(measure, 60_000);
    return () => {
      clearInterval(interval);
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [viewerId]);
  const summary = measuring ? null : result.summary;
  return (
    <section
      className="network-emotion-results"
      role="region"
      aria-labelledby="network-emotion-results-heading"
    >
      <header>
        <h2 id="network-emotion-results-heading" ref={heading} tabIndex={-1}>
          NETWORK EMOTION RESULTS
        </h2>
        <button
          type="button"
          aria-label="Close network emotion results"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <p role="status" className="measurement-status">
        {measuring
          ? "Measuring your connected network…"
          : "Results ready · updates once per minute"}
      </p>
      <div className="emotion-distribution" aria-busy={measuring}>
        {measuring ? (
          <div
            className="measurement-track"
            role="progressbar"
            aria-label="Calculating network emotion results"
          >
            <span />
          </div>
        ) : (
          summary && (
            <>
              <p>
                <strong>{summary.active.length} active Pulses</strong> across{" "}
                {summary.connectedCount} connected Atoms, including you.
              </p>
              <p>
                Recent voluntary submissions only. Not population sentiment.
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
                only. Others remain neutral.
              </p>
              {summary.regions.map((region) => (
                <p key={region.key}>
                  Among active Pulses in your connected {region.label} network:{" "}
                  <strong>{region.count} active Pulses</strong>.
                </p>
              ))}
            </>
          )
        )}
      </div>
    </section>
  );
}
