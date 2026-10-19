"use client";
import { memo, useEffect, useRef } from "react";
import { useAppearance } from "../appearance/appearance";
import { decode } from "../../prototypes/doodle/model";
import { paintDoodle } from "../../prototypes/doodle/paint";
export const DoodleBitmap = memo(function DoodleBitmap({
  bitmap,
  version = 1,
  label,
}: {
  bitmap: string;
  version?: 1 | 2;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const appearance = useAppearance();
  useEffect(() => {
    const node = ref.current!;
    const bits = decode(bitmap, version);
    const draw = () => paintDoodle(node, bits);
    const observer = new ResizeObserver(draw);
    observer.observe(node);
    draw();
    return () => observer.disconnect();
  }, [bitmap, version, appearance]);
  return (
    <canvas ref={ref} className="doodle-canvas" role="img" aria-label={label} />
  );
});
