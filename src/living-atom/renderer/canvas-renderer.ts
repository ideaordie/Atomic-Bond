import { spatialPositions } from "../animation/spatial-motion";
import { arrivalVisibility } from "../animation/bond-arrival";
import { pulsePhase } from "../pulse/presentation";
import { pulseStepMs } from "../pulse/traversal";
import type {
  AtomRenderer,
  Point,
  RenderFrame,
  VisualNode,
} from "../types/scene";
import type { SpatialNode } from "../types/spatial";
import { depthOrder, projectPoint } from "./projection";
import {
  createStarfield,
  glow,
  paintCore,
  paintPerson,
} from "./celestial-paint";

function curvePoint(
  a: Point,
  control: Point,
  b: Point,
  progress: number,
): Point {
  const t = Math.max(0, Math.min(1, progress));
  return {
    x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * control.x + t * t * b.x,
    y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * control.y + t * t * b.y,
  };
}

export function createCanvasRenderer(canvas: HTMLCanvasElement): AtomRenderer {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable in this browser.");
  let width = 1;
  let height = 1;
  let ratio = 1;
  let background: HTMLCanvasElement | null = null;
  let targets: {
    node: VisualNode;
    point: Point;
    radius: number;
    depth: number;
  }[] = [];
  let cachedScene: RenderFrame["scene"] | null = null;
  let nodeMap = new Map<string, SpatialNode>();
  let arrivalKey: string | undefined;
  let revealedMembers = new Set<string>();

  return {
    resize(w, h, pixelRatio) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      ratio = Math.min(2, Math.max(1, pixelRatio));
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      background = createStarfield(canvas, width, height, ratio);
    },
    draw(frame) {
      const { scene, camera } = frame;
      const energyColor = frame.pulseColor ?? "#ffda8b";
      if (frame.arrival?.id !== arrivalKey) {
        arrivalKey = frame.arrival?.id;
        const previousMembers = new Set(
          cachedScene?.nodes.flatMap((node) => node.members),
        );
        revealedMembers = new Set(
          scene.nodes
            .flatMap((node) => node.members)
            .filter((id) => !previousMembers.has(id)),
        );
      }
      if (scene !== cachedScene) {
        nodeMap = new Map(scene.nodes.map((node) => [node.id, node]));
        cachedScene = scene;
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (background) ctx.drawImage(background, 0, 0, width, height);
      const scale =
        (Math.min(width, height) / (scene.extent * 2)) * camera.zoom;
      const phase = pulsePhase(
        frame.pulseStartedAt,
        frame.now,
        frame.reducedMotion,
        pulseStepMs(scene.maxDistance),
      );
      const alpha = frame.reducedMotion ? 1 : 0.3 + frame.transition * 0.7;
      const worldPositions = spatialPositions(scene.nodes, frame.elapsedMs);
      const arrival =
        scene.selected.id === frame.originalId ? frame.arrival : undefined;
      const arrivalNode =
        arrival && scene.nodes.find((node) => node.members[0] === arrival.id);
      const visibility = (node: SpatialNode) =>
        !arrival ||
        node === arrivalNode ||
        node.distance === 0 ||
        !node.members.every((id) => revealedMembers.has(id))
          ? 1
          : arrivalVisibility(arrival.progress, node.distance);
      if (arrivalNode && arrival && arrival.progress < 1) {
        const position = worldPositions.get(arrivalNode.id)!;
        const approach = Math.max(0, 1 - arrival.progress / 0.35) ** 2;
        worldPositions.set(arrivalNode.id, {
          ...position,
          x: position.x + 360 * approach,
          y: position.y - 180 * approach,
          z: position.z + 160 * approach,
        });
      }
      const positions = new Map(
        scene.nodes.map((node) => [
          node.id,
          projectPoint(
            worldPositions.get(node.id)!,
            width,
            height,
            scene.extent,
            camera,
          ),
        ]),
      );
      const coreRadius = Math.max(24, Math.min(42, 43 * scale));
      targets = [];
      const commands: { z: number; id: string; draw: () => void }[] = [];

      for (const edge of scene.edges) {
        const a = nodeMap.get(edge.source)!;
        const b = nodeMap.get(edge.target)!;
        const start = a.distance <= b.distance ? a : b;
        const end = start === a ? b : a;
        const from = positions.get(start.id)!;
        const to = positions.get(end.id)!;
        const direct = start.distance === 0;
        const active = frame.pulseDistance === edge.distance;
        const sameLevel = start.distance === end.distance;
        const control = {
          x:
            (from.point.x + to.point.x) / 2 +
            (to.depth - from.depth) * scale * 0.06,
          y:
            (from.point.y + to.point.y) / 2 -
            Math.min(18, Math.abs(to.depth - from.depth) * scale * 0.06),
        };
        const length =
          Math.hypot(to.point.x - from.point.x, to.point.y - from.point.y) || 1;
        const origin = direct
          ? curvePoint(
              from.point,
              control,
              to.point,
              Math.min(0.45, coreRadius / length),
            )
          : from.point;
        commands.push({
          z: (from.depth + to.depth) / 2,
          id: edge.id,
          draw: () => {
            ctx.save();
            const depthAlpha = Math.max(
              0.4,
              Math.min(1.2, (from.perspective + to.perspective) / 2),
            );
            ctx.globalAlpha =
              alpha *
              Math.min(visibility(start), visibility(end)) *
              (arrival &&
              arrivalNode &&
              (edge.source === arrivalNode.id || edge.target === arrivalNode.id)
                ? Math.max(0, Math.min(1, (arrival.progress - 0.2) / 0.3))
                : 1) *
              depthAlpha *
              (active
                ? sameLevel
                  ? 0.12
                  : 0.7
                : direct
                  ? 0.5
                  : sameLevel
                    ? 0.035
                    : edge.distance <= 3
                      ? 0.13
                      : 0.09);
            ctx.strokeStyle = active
              ? energyColor
              : direct
                ? "#dcae64"
                : end.tint;
            ctx.lineWidth = active && !sameLevel ? 1.3 : direct ? 0.95 : 0.5;
            if (direct || (active && !sameLevel)) {
              ctx.shadowColor = active ? energyColor : "#dfa85b";
              ctx.shadowBlur = active ? 8 : 4;
            }
            ctx.beginPath();
            ctx.moveTo(origin.x, origin.y);
            ctx.quadraticCurveTo(control.x, control.y, to.point.x, to.point.y);
            ctx.stroke();
            if (
              active &&
              !frame.reducedMotion &&
              !sameLevel &&
              frame.pulseDirection === "outgoing"
            ) {
              const energy = curvePoint(
                origin,
                control,
                to.point,
                Math.min(1, phase / 0.72),
              );
              ctx.globalAlpha = 0.95;
              glow(ctx, energy, 9, energyColor, 0.65);
              ctx.fillStyle = energyColor;
              ctx.beginPath();
              ctx.arc(energy.x, energy.y, 1.8, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          },
        });
      }

      for (const node of scene.nodes) {
        const projected = positions.get(node.id)!;
        const point = projected.point;
        const active =
          (arrival &&
            arrivalNode &&
            arrival.progress > 0.4 &&
            arrival.progress < 0.72 &&
            (node.id === arrivalNode.id || node.distance === 0)) ||
          (frame.pulseDistance === node.distance &&
            (phase > 0.7 || node.distance === 0 || frame.reducedMotion));
        const emotion = frame.emotions?.get(node.id);
        const tint =
          active && frame.pulseColor
            ? energyColor
            : (emotion?.colors[0] ?? node.tint);
        commands.push({
          z: projected.depth,
          id: node.id,
          draw: () => {
            ctx.save();
            const brightness = Math.min(
              1,
              Math.max(0.4, projected.perspective * 0.85),
            );
            ctx.globalAlpha = alpha * brightness * visibility(node);
            if (node.kind === "aggregate") {
              const densityAlpha =
                scene.mode === "people"
                  ? 0.25
                  : scene.mode === "regions"
                    ? 1
                    : 0.72;
              ctx.globalAlpha = alpha * densityAlpha * visibility(node);
              const radius =
                (30 + Math.sqrt(node.members.length) * 8) *
                scale *
                projected.perspective;
              glow(
                ctx,
                point,
                Math.max(12, radius * 1.8),
                tint,
                active ? 0.5 : 0.14,
              );
              for (let i = 0; i < node.particles.length; i++) {
                const particleColor =
                  active && frame.pulseColor
                    ? energyColor
                    : (emotion?.colors[
                        Math.floor(
                          (i * emotion.colors.length) / node.particles.length,
                        )
                      ] ?? node.tint);
                const particle = node.particles[i]!;
                const drift = Math.sin(frame.elapsedMs / 6000 + i) * 3;
                const shimmer =
                  0.85 + Math.sin(frame.elapsedMs / 4200 + i) * 0.15;
                ctx.globalAlpha =
                  alpha *
                  densityAlpha *
                  brightness *
                  shimmer *
                  visibility(node);
                const x =
                  point.x +
                  (particle.x + drift) * scale * projected.perspective;
                const y = point.y + particle.y * scale * projected.perspective;
                if (i % 9 === 0)
                  glow(
                    ctx,
                    { x, y },
                    active ? 9 : 5,
                    particleColor,
                    active ? 0.75 : 0.4,
                  );
                ctx.fillStyle = particleColor;
                ctx.beginPath();
                ctx.arc(x, y, i % 7 === 0 ? 1.3 : 0.65, 0, Math.PI * 2);
                ctx.fill();
              }
            } else {
              const center = node.distance === 0;
              const radius = center
                ? coreRadius
                : Math.max(
                    node.distance === 1 ? 7.5 : 3.2,
                    (node.distance === 1 ? 15 : 8) * scale,
                  ) * projected.perspective;
              if (center)
                paintCore(
                  ctx,
                  point,
                  radius,
                  frame.elapsedMs,
                  active,
                  frame.feelNetwork ||
                    emotion?.activeCount ||
                    (active && frame.pulseColor)
                    ? tint
                    : undefined,
                );
              else {
                glow(
                  ctx,
                  point,
                  radius * 3.2,
                  tint,
                  active ? 0.6 : node.distance === 1 ? 0.25 : 0.16,
                );
                const sphere = ctx.createRadialGradient(
                  point.x - radius * 0.3,
                  point.y - radius * 0.4,
                  0,
                  point.x,
                  point.y,
                  radius,
                );
                sphere.addColorStop(0, `${tint}d9`);
                sphere.addColorStop(0.6, `${tint}59`);
                sphere.addColorStop(1, "#102238e6");
                ctx.fillStyle = sphere;
                ctx.strokeStyle = active ? energyColor : `${tint}cc`;
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                if (node.distance <= 2)
                  paintPerson(
                    ctx,
                    point,
                    radius,
                    active ? "#fff8e0" : "#e4eff0cc",
                  );
                if (node.distance === 1) {
                  ctx.strokeStyle = `${tint}19`;
                  ctx.lineWidth = 0.5;
                  ctx.beginPath();
                  ctx.ellipse(
                    point.x,
                    point.y,
                    radius * 2.5,
                    radius * 0.95,
                    node.orbit.inclination,
                    0.2,
                    4.8,
                  );
                  ctx.stroke();
                }
              }
              if (node.members[0] === frame.inspectedId) {
                ctx.strokeStyle = "#def5ff";
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 4]);
                ctx.beginPath();
                ctx.arc(point.x, point.y, radius + 6, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
              }
              targets.push({
                node,
                point,
                radius: Math.max(14, radius + 5),
                depth: projected.depth,
              });
              if (center) {
                ctx.globalAlpha = 1;
                ctx.textAlign = "center";
                ctx.font = "600 11px Arial";
                ctx.fillStyle = "#f5deb6";
                ctx.fillText(
                  scene.selected.id === frame.originalId
                    ? "YOU"
                    : `ATOM #${scene.selected.publicId}`,
                  point.x,
                  point.y + radius + 22,
                );
                if (emotion?.label) {
                  ctx.font = "10px Arial";
                  ctx.fillText(emotion.label, point.x, point.y + radius + 36);
                }
              }
            }
            ctx.restore();
          },
        });
      }
      for (const command of depthOrder(commands)) command.draw();
      if (scene.mode !== "people") {
        for (const region of scene.regions.filter(
          (candidate) => candidate.representedCount > 0,
        )) {
          const point = projectPoint(
            region.anchor,
            width,
            height,
            scene.extent,
            camera,
          ).point;
          ctx.textAlign = "center";
          ctx.fillStyle = "#b9d6e4";
          ctx.font = `${width < 500 ? 10 : 11}px Arial`;
          const labelY = point.y + (region.anchor.y > 180 ? 76 : -57);
          ctx.fillText(region.label, point.x, labelY);
          if (width >= 500 || scene.mode === "regions") {
            ctx.fillStyle = "#7898b0";
            ctx.font = "10px Arial";
            ctx.fillText(
              frame.feelNetwork
                ? `${scene.nodes.filter((node) => node.regionKey === region.key).reduce((sum, node) => sum + (frame.emotions?.get(node.id)?.activeCount ?? 0), 0)} active Pulses`
                : `${region.reachableCount} people in reach`,
              point.x,
              labelY + 15,
            );
          }
        }
      }
    },
    hitTest(point) {
      return targets
        .map((target) => ({
          ...target,
          distance: Math.hypot(
            point.x - target.point.x,
            point.y - target.point.y,
          ),
        }))
        .filter((target) => target.distance <= target.radius)
        .sort((a, b) => a.distance - b.distance || a.depth - b.depth)[0]?.node;
    },
    dispose() {
      targets = [];
      background = null;
      nodeMap.clear();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
