"use client";

import { useEffect, useRef, useState } from "react";
import type { Camera, Point, RendererFactory } from "../types/scene";
import type { SpatialScene } from "../types/spatial";
import type { PulseDirection } from "../pulse/presentation";
import { transitionProgress } from "../animation/motion";
import { createAmbientClock } from "../animation/ambient-clock";
import { panCamera, zoomCamera } from "../interaction/camera";
import { createCanvasRenderer } from "./canvas-renderer";
import type { EmotionPaint } from "../pulse/emotion-presentation";

interface Props {
  emotions?: ReadonlyMap<string, EmotionPaint>;
  feelNetwork?: boolean;
  pulseColor?: string;
  scene: SpatialScene;
  camera: Camera;
  reducedMotion: boolean;
  paused: boolean;
  pulseDistance: number | null;
  pulseStartedAt: number;
  pulseDirection: PulseDirection;
  originalId: string;
  inspectedId: string | null;
  arrivalId?: string | null;
  onSelect: (id: string) => void;
  onCamera: (camera: Camera) => void;
  rendererFactory?: RendererFactory;
}

export function AtomCanvas({
  rendererFactory = createCanvasRenderer,
  ...props
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Events and animation use the most recently committed props without recreating the renderer.
  const current = useRef(props);
  useEffect(() => {
    current.current = props;
  });

  useEffect(() => {
    const canvas = canvasRef.current!;
    let renderer: ReturnType<RendererFactory>;
    try {
      renderer = rendererFactory(canvas);
    } catch {
      // Canvas capability is only known after mount; report this one-time initialization failure.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(
        "The visual canvas is unavailable. You can still explore Atoms using the controls below.",
      );
      return;
    }
    let frameId = 0;
    let alive = true;
    let startedAt = performance.now();
    let selectedId = current.current.scene.selected.id;
    let lastPaint = 0;
    let arrivalId: string | null = null;
    let arrivalStarted = 0;
    const ambientClock = createAmbientClock();
    let dirty = true;
    const draw = (time: number) => {
      frameId = 0;
      if (!alive) return;
      const state = current.current;
      if (state.arrivalId && state.arrivalId !== arrivalId) {
        arrivalId = state.arrivalId;
        arrivalStarted = time;
      }
      const arrivalProgress = state.reducedMotion
        ? 1
        : Math.min(1, (time - arrivalStarted) / 2800);
      if (state.scene.selected.id !== selectedId) {
        selectedId = state.scene.selected.id;
        startedAt = time;
        ambientClock.reset();
      }
      const still = state.reducedMotion || state.paused;
      const pulseMoving = state.pulseDistance !== null && !state.reducedMotion;
      if (time - lastPaint >= 30 || dirty) {
        const elapsedMs = ambientClock.sample(time, !still && !document.hidden);
        renderer.draw({
          ...(state.emotions ? { emotions: state.emotions } : {}),
          ...(state.pulseColor ? { pulseColor: state.pulseColor } : {}),
          feelNetwork: state.feelNetwork ?? false,
          scene: state.scene,
          camera: state.camera,
          elapsedMs,
          transition: transitionProgress(time - startedAt, still),
          reducedMotion: state.reducedMotion,
          pulseDistance: state.pulseDistance,
          pulseStartedAt: state.pulseStartedAt,
          pulseDirection: state.pulseDirection,
          now: time,
          originalId: state.originalId,
          inspectedId: state.inspectedId,
          ...(arrivalId
            ? { arrival: { id: arrivalId, progress: arrivalProgress } }
            : {}),
        });
        lastPaint = time;
        dirty = false;
      }
      if (
        (!still || pulseMoving || (arrivalId && arrivalProgress < 1)) &&
        !document.hidden
      )
        frameId = requestAnimationFrame(draw);
    };
    const invalidate = () => {
      dirty = true;
      if (document.hidden) ambientClock.sample(performance.now(), false);
      if (!frameId && alive) frameId = requestAnimationFrame(draw);
    };
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      renderer.resize(bounds.width, bounds.height, window.devicePixelRatio);
      lastPaint = 0;
      invalidate();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    // A DOM event keeps invalidation separate from adapter implementation.
    canvas.addEventListener("scenechange", invalidate);
    document.addEventListener("visibilitychange", invalidate);

    const pointers = new Map<number, Point>();
    let dragStart: Point | null = null;
    let moved = false;
    let gestureCamera = current.current.camera;
    const localPoint = (event: PointerEvent | WheelEvent): Point => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const updateCamera = (camera: Camera) => {
      gestureCamera = camera;
      current.current.onCamera(camera);
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(event.pointerId);
      const point = localPoint(event);
      if (pointers.size === 0) {
        moved = false;
        dragStart = point;
        gestureCamera = current.current.camera;
      } else moved = true;
      pointers.set(event.pointerId, point);
    };
    const move = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      const point = localPoint(event);
      const before = [...pointers.values()];
      pointers.set(event.pointerId, point);
      if (pointers.size === 2) {
        const after = [...pointers.values()];
        const midpoint = (points: Point[]) => ({
          x: (points[0]!.x + points[1]!.x) / 2,
          y: (points[0]!.y + points[1]!.y) / 2,
        });
        const oldMid = midpoint(before);
        const newMid = midpoint(after);
        const oldSpan = Math.hypot(
          before[0]!.x - before[1]!.x,
          before[0]!.y - before[1]!.y,
        );
        const newSpan = Math.hypot(
          after[0]!.x - after[1]!.x,
          after[0]!.y - after[1]!.y,
        );
        const rect = canvas.getBoundingClientRect();
        updateCamera(
          panCamera(
            zoomCamera(gestureCamera, oldSpan > 0 ? newSpan / oldSpan : 1, {
              x: oldMid.x - rect.width / 2,
              y: oldMid.y - rect.height / 2,
            }),
            { x: newMid.x - oldMid.x, y: newMid.y - oldMid.y },
          ),
        );
        moved = true;
      } else if (pointers.size === 1) {
        if (
          dragStart &&
          Math.hypot(point.x - dragStart.x, point.y - dragStart.y) > 6
        )
          moved = true;
        if (moved)
          updateCamera(
            panCamera(gestureCamera, {
              x: point.x - previous.x,
              y: point.y - previous.y,
            }),
          );
      }
    };
    const up = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      if (!moved && event.type === "pointerup") {
        const target = renderer.hitTest(localPoint(event));
        if (target) current.current.onSelect(target.members[0]!);
      }
      if (canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = localPoint(event);
      const rect = canvas.getBoundingClientRect();
      updateCamera(
        zoomCamera(
          current.current.camera,
          Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * 0.003),
          { x: point.x - rect.width / 2, y: point.y - rect.height / 2 },
        ),
      );
    };
    const keyboard = (event: KeyboardEvent) => {
      const directions: Record<string, Point> = {
        ArrowLeft: { x: 30, y: 0 },
        ArrowRight: { x: -30, y: 0 },
        ArrowUp: { x: 0, y: 30 },
        ArrowDown: { x: 0, y: -30 },
      };
      if (directions[event.key]) {
        event.preventDefault();
        updateCamera(panCamera(current.current.camera, directions[event.key]!));
      }
      if (["+", "=", "-"].includes(event.key)) {
        event.preventDefault();
        updateCamera(
          zoomCamera(current.current.camera, event.key === "-" ? 0.8 : 1.25),
        );
      }
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("keydown", keyboard);
    resize();
    return () => {
      alive = false;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      renderer.dispose();
      canvas.removeEventListener("scenechange", invalidate);
      document.removeEventListener("visibilitychange", invalidate);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("keydown", keyboard);
    };
  }, [rendererFactory]);

  useEffect(() => {
    canvasRef.current?.dispatchEvent(new Event("scenechange"));
  }, [props]);

  return (
    <>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="img"
        aria-label={`Living Atom network centered on Atom #${props.scene.selected.publicId}`}
        aria-describedby="network-instructions"
        data-testid="atom-canvas"
        data-emotional-view={props.feelNetwork ? "active" : "structural"}
        data-pulse-color={props.pulseColor ?? "none"}
        data-motion={props.reducedMotion || props.paused ? "still" : "gentle"}
        data-center={props.scene.selected.id}
        data-representation={props.scene.mode}
        data-inspected={props.inspectedId ?? "none"}
        data-zoom={props.camera.zoom.toFixed(2)}
        data-pan={`${Math.round(props.camera.x)},${Math.round(props.camera.y)}`}
      >
        Use the Atom selector and network information to explore this graph
        without the canvas.
      </canvas>
      {error && (
        <p className="canvas-error" role="status">
          {error}
        </p>
      )}
    </>
  );
}
