"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useAppearance } from "../../components/appearance/appearance";
import { DoodleEditor, SIDE, replayFrame, type Drawing } from "./model";
import { paintDoodle } from "./paint";

export function DrawingCanvas({
  editor,
  tool,
  color = 1,
  revision,
  onChange,
}: {
  editor: DoodleEditor;
  tool: "draw" | "erase";
  color?: number;
  revision: number;
  onChange: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointer = useRef<number | null>(null);
  const frame = useRef(0);
  const cursor = useRef(32 * SIDE + 32);
  const keyboard = useRef(false);
  const appearance = useAppearance();
  const redraw = () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      if (canvas.current)
        paintDoodle(
          canvas.current,
          editor.bits,
          true,
          keyboard.current ? cursor.current : null,
        );
    });
  };
  useEffect(() => {
    const node = canvas.current!;
    const observer = new ResizeObserver(() =>
      paintDoodle(
        node,
        editor.bits,
        true,
        keyboard.current ? cursor.current : null,
      ),
    );
    observer.observe(node);
    paintDoodle(
      node,
      editor.bits,
      true,
      keyboard.current ? cursor.current : null,
    );
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [editor, revision, appearance]);
  const point = (event: { clientX: number; clientY: number }) => {
    const rect = canvas.current!.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(
        63,
        Math.floor(((event.clientX - rect.left) / rect.width) * SIDE),
      ),
    );
    const y = Math.max(
      0,
      Math.min(
        63,
        Math.floor(((event.clientY - rect.top) / rect.height) * SIDE),
      ),
    );
    return y * SIDE + x;
  };
  const finish = (event: PointerEvent<HTMLCanvasElement>, cancel = false) => {
    if (pointer.current !== event.pointerId) return;
    if (!cancel) editor.move(point(event));
    editor.finish(cancel);
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    redraw();
    onChange();
  };
  return (
    <canvas
      ref={canvas}
      className="doodle-canvas doodle-editor"
      data-testid="doodle-editor"
      tabIndex={0}
      role="application"
      aria-label="64 by 64 dot drawing canvas"
      aria-describedby="doodle-input-help"
      onPointerDown={(event) => {
        if (pointer.current !== null || event.button !== 0 || !event.isPrimary)
          return;
        event.preventDefault();
        event.currentTarget.focus();
        keyboard.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
        pointer.current = event.pointerId;
        editor.begin(point(event), tool === "draw", color);
        redraw();
      }}
      onPointerMove={(event) => {
        if (pointer.current !== event.pointerId) return;
        const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
        for (const sample of samples) editor.move(point(sample));
        editor.move(point(event));
        redraw();
      }}
      onPointerUp={(event) => finish(event)}
      onPointerCancel={(event) => finish(event, true)}
      onLostPointerCapture={(event) => finish(event, true)}
      onBlur={() => {
        keyboard.current = false;
        if (editor.drawing) {
          editor.finish(true);
          pointer.current = null;
          onChange();
        }
        redraw();
      }}
      onKeyDown={(event) => {
        if (editor.drawing) return;
        const x = cursor.current % SIDE,
          y = Math.floor(cursor.current / SIDE);
        let next = cursor.current;
        if (event.key === "ArrowLeft") next = y * SIDE + Math.max(0, x - 1);
        else if (event.key === "ArrowRight")
          next = y * SIDE + Math.min(63, x + 1);
        else if (event.key === "ArrowUp") next = Math.max(0, y - 1) * SIDE + x;
        else if (event.key === "ArrowDown")
          next = Math.min(63, y + 1) * SIDE + x;
        else if (event.key === " " || event.key === "Enter") {
          editor.begin(next, tool === "draw", color);
          editor.finish();
          onChange();
        } else return;
        event.preventDefault();
        keyboard.current = true;
        cursor.current = next;
        redraw();
      }}
    >
      Draw an image on a 64 by 64 dot grid.
    </canvas>
  );
}

export function DoodlePlayback({
  drawing,
  description,
}: {
  drawing: Drawing;
  description: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [replay, setReplay] = useState(0);
  const appearance = useAppearance();
  useEffect(() => {
    const node = canvas.current!;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      progress = 0,
      start: number | null = null;
    const render = () => paintDoodle(node, replayFrame(drawing, progress));
    const finish = () => {
      cancelAnimationFrame(frame);
      progress = 1;
      node.dataset.replay = "complete";
      render();
    };
    const tick = (time: number) => {
      start ??= time;
      progress = Math.min(1, (time - start) / 2400);
      render();
      if (progress < 1) frame = requestAnimationFrame(tick);
      else node.dataset.replay = "complete";
    };
    const change = () => {
      if (media.matches) finish();
    };
    const visibility = () => {
      if (document.hidden) finish();
    };
    const observer = new ResizeObserver(render);
    observer.observe(node);
    if (media.matches || !drawing.strokes?.length) finish();
    else {
      node.dataset.replay = "playing";
      render();
      frame = requestAnimationFrame(tick);
    }
    media.addEventListener("change", change);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      media.removeEventListener("change", change);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [drawing, replay, appearance]);
  return (
    <div className="doodle-playback">
      <canvas
        ref={canvas}
        className="doodle-canvas"
        role="img"
        aria-label={description}
        data-testid="doodle-viewer"
      >
        {description}
      </canvas>
      <button
        type="button"
        onClick={() => setReplay((n) => n + 1)}
        disabled={!drawing.strokes?.length}
      >
        REPLAY
      </button>
    </div>
  );
}
