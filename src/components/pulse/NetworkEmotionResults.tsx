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
  const [result, setResult] = useState<{
    graph: GraphData;
    pulses: readonly EmotionalPulse[];
    now: number;
    viewerId: string;
    summary: ReturnType<typeof emotionalNetwork>;
  } | null>(null);
  const measuring =
    !result ||
    result.graph !== graph ||
    result.pulses !== pulses ||
    result.now !== now ||
    result.viewerId !== viewerId;
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    // Let the pending indicator paint before running the real local calculation.
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => {
        setResult({
          graph,
          pulses,
          now,
          viewerId,
          summary: emotionalNetwork(graph, viewerId, pulses, now),
        });
      }, 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [graph, viewerId, pulses, now]);
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
          : "Results ready · updates automatically"}
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
                    <span style={{ color: EMOTION_DEFINITIONS[emotion].color }}>
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
