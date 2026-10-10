"use client";
import { useAppearance } from "../appearance/appearance";
import { scientificPalette } from "../../living-atom/renderer/scientific-palette";
import { useEffect, useRef } from "react";
import type { Emotion } from "../../types/emotional-pulse";
import { EMOTION_DEFINITIONS } from "../../living-atom/pulse/emotions";
import { paintCore } from "../../living-atom/renderer/celestial-paint";

/** Same material as the Living Atom; no persistence, graph state or animation. */
export function PulsePreview({ emotion }: { emotion: Emotion | null }) {
  const appearance = useAppearance();
  const canvas = useRef<HTMLCanvasElement>(null);
  const definition = emotion ? EMOTION_DEFINITIONS[emotion] : null;
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 160, 160);
    paintCore(
      ctx,
      { x: 80, y: 80 },
      34,
      0,
      false,
      definition?.color,
      scientificPalette(appearance),
    );
  }, [definition, appearance]);
  return (
    <div className="pulse-preview" aria-live="polite" aria-atomic="true">
      <canvas ref={canvas} width={160} height={160} aria-hidden="true" />
      <div>
        <strong>{definition?.label ?? "Choose your current state"}</strong>
        <small>
          {definition
            ? `${definition.category} · Preview only`
            : "Nothing is shared until you send."}
        </small>
      </div>
    </div>
  );
}
