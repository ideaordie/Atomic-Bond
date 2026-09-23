import type { Camera, Point } from "../types/scene";

export const INITIAL_CAMERA: Camera = { zoom: 1, x: 0, y: 0 };
export const MIN_ZOOM = 0.65;
export const MAX_ZOOM = 4;

/** Cursor-anchored zoom; translations use CSS pixels. */
export function zoomCamera(
  camera: Camera,
  factor: number,
  anchor: Point = { x: 0, y: 0 },
): Camera {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * factor));
  const ratio = zoom / camera.zoom;
  return {
    zoom,
    x: anchor.x - (anchor.x - camera.x) * ratio,
    y: anchor.y - (anchor.y - camera.y) * ratio,
  };
}

export function panCamera(camera: Camera, delta: Point): Camera {
  return { ...camera, x: camera.x + delta.x, y: camera.y + delta.y };
}

export interface SelectionState {
  readonly originalId: string;
  readonly selectedId: string;
}
export function selectAtom(state: SelectionState, id: string): SelectionState {
  return { ...state, selectedId: id };
}
export function returnToOriginal(state: SelectionState): SelectionState {
  return selectAtom(state, state.originalId);
}
