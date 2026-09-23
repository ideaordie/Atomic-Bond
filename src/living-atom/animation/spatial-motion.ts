import type { Point3D, SpatialNode } from "../types/spatial";

export function orbitalPosition(
  node: SpatialNode,
  elapsedMs: number,
  reducedMotion: boolean,
): Point3D {
  if (reducedMotion || node.distance === 0)
    return { x: node.x, y: node.y, z: node.z };
  const orbit = node.orbit;
  const phase = orbit.phase + elapsedMs * orbit.speed;
  const dx = (Math.cos(phase) - Math.cos(orbit.phase)) * orbit.radiusX;
  const dy = (Math.sin(phase) - Math.sin(orbit.phase)) * orbit.radiusY;
  return {
    x:
      node.x +
      dx * Math.cos(orbit.inclination) -
      dy * Math.sin(orbit.inclination),
    y:
      node.y +
      dx * Math.sin(orbit.inclination) +
      dy * Math.cos(orbit.inclination),
    z:
      node.z +
      (Math.sin(phase + orbit.depthPhase) -
        Math.sin(orbit.phase + orbit.depthPhase)) *
        orbit.depthRadius,
  };
}

/** Shared world positions for nodes, Bonds and hit targets in the same frame. */
export function spatialPositions(
  nodes: readonly SpatialNode[],
  elapsedMs: number,
) {
  const positions = new Map(
    nodes.map((node) => [node.id, orbitalPosition(node, elapsedMs, false)]),
  );
  for (const node of nodes) {
    const parent = node.orbit.parentId && positions.get(node.orbit.parentId);
    if (!parent) continue;
    const local = positions.get(node.id)!;
    positions.set(node.id, {
      x: local.x + parent.x - node.orbit.anchor.x,
      y: local.y + parent.y - node.orbit.anchor.y,
      z: local.z + parent.z - node.orbit.anchor.z,
    });
  }
  return positions;
}
