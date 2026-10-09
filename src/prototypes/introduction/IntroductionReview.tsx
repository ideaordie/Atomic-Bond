"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../../living-atom/interaction/use-reduced-motion";
import { DURATION, FRAME, SCENES, sampleTimeline } from "./timeline";
import { paintIntroduction } from "./paint";
import "./review.css";

export function IntroductionReview() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduced = useReducedMotion();
  const state = sampleTimeline(time);
  const displayTime = reduced
    ? [2, 7.6, 14.3, 20, 25][state.sceneIndex]!
    : time;
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (ctx) {
      const started = performance.now();
      paintIntroduction(ctx, displayTime);
      ctx.canvas.dataset.renderMs = (performance.now() - started).toFixed(2);
    }
  }, [displayTime]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous: number | null = null;
    const tick = (now: number) => {
      if (previous !== null) {
        const delta = (now - previous) / 1000;
        setTime((value) => Math.min(DURATION, value + delta));
      }
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  useEffect(() => {
    if (time === DURATION && playing) {
      // Stop the review clock at the exact final frame.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlaying(false);
    }
  }, [time, playing]);
  function seek(value: number) {
    setPlaying(false);
    setTime(value);
  }
  return (
    <main className="intro-review">
      <header>
        <p className="intro-eyebrow">ATOMIC BOND / CREATIVE STUDIO</p>
        <h1>A world brought to life.</h1>
        <p>
          Introduction & X advertisement · Local prototype · 25 seconds · Silent
          · 16:9
        </p>
      </header>
      <figure className="intro-frame">
        <canvas
          ref={canvas}
          width={FRAME.width}
          height={FRAME.height}
          role="img"
          aria-label={`${state.scene.name}. ${state.scene.lines.join(" ")} Synthetic illustrative network, not live participant data.`}
          data-testid="introduction-canvas"
          data-time={time.toFixed(3)}
          data-scene={state.sceneIndex}
        />
        <figcaption className="intro-sr">
          Illustrative story: an isolated Atom forms a mutually chosen Bond,
          then connections branch through other people and span a stylized world
          map. Colors draw from the Pulse palette; forming a Bond does not
          assign a real emotional state.
        </figcaption>
      </figure>
      <section
        className="intro-controls"
        aria-label="Animation review controls"
      >
        <div className="intro-transport">
          <button
            onClick={() => {
              if (time === DURATION) setTime(0);
              setPlaying(true);
            }}
            disabled={playing}
          >
            PLAY
          </button>
          <button onClick={() => setPlaying(false)} disabled={!playing}>
            PAUSE
          </button>
          <button onClick={() => seek(0)}>RESTART</button>
          <output aria-label="Current time">{time.toFixed(1)} / 25.0 s</output>
        </div>
        <label className="intro-timeline">
          TIMELINE
          <input
            aria-label="Timeline seconds"
            type="range"
            min="0"
            max={DURATION}
            step="any"
            value={time}
            onChange={(event) => seek(Number(event.target.value))}
            onInput={(event) => seek(Number(event.currentTarget.value))}
          />
        </label>
        <nav className="intro-scenes" aria-label="Scene selection">
          {SCENES.map((scene, i) => (
            <button
              key={scene.start}
              aria-pressed={state.sceneIndex === i}
              onClick={() => seek(i === 4 ? 25 : scene.start + 1.5)}
            >
              <span>0{i + 1}</span>
              {scene.name}
              <small>
                {scene.start}–{scene.end}s
              </small>
            </button>
          ))}
        </nav>
      </section>
      <section className="intro-notes" aria-label="Prototype notes">
        <p role="status">
          {reduced
            ? "Reduced motion: five still compositions replace continuous movement. Play advances the story; scene buttons and the timeline remain available."
            : "Paused on arrival. Play the full sequence, or scrub directly to any frame."}
        </p>
        <p>
          All geography and connections are illustrative. No live data, real
          identities, or production statistics. The CTA is artwork for review,
          not a registration control.
        </p>
        <details>
          <summary>Read the complete script</summary>
          {SCENES.map((s) => (
            <p key={s.start}>
              <strong>
                {s.start}–{s.end}s — {s.name}
              </strong>
              <br />
              {s.lines.join(" ")}
            </p>
          ))}
          <p>CREATE YOUR ATOM. MAKE A BOND. SEE WHERE IT LEADS.</p>
        </details>
      </section>
    </main>
  );
}
