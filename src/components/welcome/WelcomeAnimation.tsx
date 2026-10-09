"use client";

import { useEffect, useRef, useState } from "react";
import { paintIntroduction } from "../../prototypes/introduction/paint";
import {
  DURATION,
  FRAME,
  SCENES,
  sampleTimeline,
} from "../../prototypes/introduction/timeline";

export function WelcomeAnimation() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<{ play(): void; pause(): void } | null>(null);
  const [phase, setPhase] = useState<"paused" | "playing" | "ended">("paused");
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const element = canvas.current!;
    const ctx = element.getContext("2d");
    if (!ctx) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let time = 0,
      frame = 0,
      last = 0,
      lastStill = -1,
      running = false;
    function paint() {
      const scene = sampleTimeline(time).sceneIndex;
      if (!media.matches || scene !== lastStill) {
        paintIntroduction(
          ctx!,
          media.matches ? [2, 7.6, 14.3, 20, 25][scene]! : time,
        );
        lastStill = scene;
      }
      element.dataset.time = time.toFixed(3);
    }
    function pause() {
      running = false;
      cancelAnimationFrame(frame);
      setPhase(time >= DURATION ? "ended" : "paused");
    }
    function tick(now: number) {
      if (!running) return;
      time = Math.min(DURATION, time + (now - last) / 1000);
      last = now;
      paint();
      if (time >= DURATION) pause();
      else frame = requestAnimationFrame(tick);
    }
    function play() {
      if (running) return;
      if (time >= DURATION) {
        time = 0;
        lastStill = -1;
      }
      running = true;
      last = performance.now();
      setPhase("playing");
      paint();
      frame = requestAnimationFrame(tick);
    }
    function preference() {
      pause();
      setReduced(media.matches);
      lastStill = -1;
      if (media.matches) {
        time = DURATION;
        setPhase("ended");
      }
      paint();
    }
    const visibility = () => {
      if (document.hidden) pause();
    };
    controller.current = { play, pause };
    media.addEventListener("change", preference);
    document.addEventListener("visibilitychange", visibility);
    // Initialization is intentionally deferred to the first paint: SSR retains the poster/CTA.
    frame = requestAnimationFrame(() => {
      setReady(true);
      setReduced(media.matches);
      if (media.matches) {
        time = DURATION;
        setPhase("ended");
        paint();
      } else {
        paint();
        if (!document.hidden) play();
      }
    });
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      controller.current = null;
      media.removeEventListener("change", preference);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return (
    <section
      aria-label="Atomic Bond introduction"
      className="welcome-animation"
    >
      <figure className="welcome-frame">
        {/* Static same-renderer fallback, including no-JavaScript or unavailable Canvas. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/introduction-poster.png"
          width={FRAME.width}
          height={FRAME.height}
          alt="A solitary Atom. Social media was supposed to connect us. Illustrative network, not live participant data."
          hidden={ready}
        />
        <canvas
          ref={canvas}
          width={FRAME.width}
          height={FRAME.height}
          hidden={!ready}
          data-testid="welcome-canvas"
          role="img"
          aria-label="Illustrative animation: a solitary Atom forms a Bond, connections branch through other people, and a colorful network spans a stylized world map. You are more connected than you know."
        />
        <figcaption className="welcome-sr">
          Synthetic illustration, not live participant data. Connection does not
          automatically assign an emotional state.
        </figcaption>
      </figure>
      <div className="welcome-playback">
        <button
          type="button"
          disabled={!ready}
          onClick={() =>
            phase === "playing"
              ? controller.current?.pause()
              : controller.current?.play()
          }
        >
          {phase === "playing"
            ? "PAUSE"
            : phase === "ended"
              ? "REPLAY"
              : "PLAY"}
        </button>
        <span>
          {reduced ? "Reduced motion · still scenes" : "25 seconds · no sound"}
        </span>
        <details>
          <summary>Read introduction</summary>
          {SCENES.map((scene) => (
            <p key={scene.start}>{scene.lines.join(" ")}</p>
          ))}
          <p>CREATE YOUR ATOM. MAKE A BOND. SEE WHERE IT LEADS.</p>
        </details>
      </div>
    </section>
  );
}
