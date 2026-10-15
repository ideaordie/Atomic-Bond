"use client";

import { useEffect, useRef, useState } from "react";
import { paintPromotion } from "../../prototypes/promotion/paint";
import {
  DURATION,
  FRAME,
  SCENES,
  sampleTimeline,
} from "../../prototypes/promotion/timeline";

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
        paintPromotion(
          ctx!,
          media.matches
            ? [4, 8, 14.8, 22, 29][scene]!
            : Math.floor(time * 30) / 30,
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
          src="/promotion-poster.png"
          width={FRAME.width}
          height={FRAME.height}
          alt="Atomic Bond. Connect. Create. Play. Together. One world. More ways to connect. Join free."
          hidden={ready}
        />
        <canvas
          ref={canvas}
          width={FRAME.width}
          height={FRAME.height}
          hidden={!ready}
          data-testid="welcome-canvas"
          role="img"
          aria-label="Synthetic animation: Atoms connect across a world map, a heart joins Global Doodle, and participants complete a collaborative puzzle. Connect. Create. Play. Together."
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
          {reduced ? "Reduced motion · still scenes" : "30 seconds · no sound"}
        </span>
        <details>
          <summary>Read introduction</summary>
          {SCENES.map((scene) => (
            <p key={scene.start}>{scene.lines.join(" ")}</p>
          ))}
          <p>
            ONE WORLD. MORE WAYS TO CONNECT. ATOMICBOND.IDEAORDIE.COM. JOIN
            FREE.
          </p>
        </details>
      </div>
    </section>
  );
}
