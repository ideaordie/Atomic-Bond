import { scientificPalette, layerTint } from "./scientific-palette";
import { paintInvitation } from "./invitation-paint";
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
import { createStarfield, glow, paintCore } from "./celestial-paint";
import { countryPath, mapScreen, mapTransform } from "../geography/paint";
import { datelineSegments } from "../geography/layout";

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
  let palette = scientificPalette();
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
  let mapData: unknown;
  let mapPath: Path2D | null = null;

  return {
    resize(w, h, pixelRatio) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      ratio = Math.min(2, Math.max(1, pixelRatio));
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      background = createStarfield(canvas, width, height, ratio, palette);
    },
    draw(frame) {
      const nextPalette = scientificPalette(frame.appearance);
      if (nextPalette !== palette) {
        palette = nextPalette;
        background = createStarfield(canvas, width, height, ratio, palette);
      }
      const { scene, camera } = frame;
      const energyColor = frame.pulseColor ?? palette.bond;
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
      const geo = frame.geographic;
      const blend = geo
        ? geo.progress * geo.progress * (3 - 2 * geo.progress)
        : 0;
      if (geo) {
        if (mapData !== geo.layout.geography) {
          mapData = geo.layout.geography;
          mapPath = countryPath(geo.layout.geography);
        }
        const t = mapTransform(width, height, geo.camera);
        ctx.save();
        ctx.globalAlpha = blend * 0.65;
        ctx.strokeStyle = palette.muted;
        ctx.translate(t.x, t.y);
        ctx.scale(t.scale, t.scale);
        ctx.lineWidth = 0.7 / t.scale;
        if (mapPath) ctx.stroke(mapPath);
        ctx.restore();
        if (geo.layout.unlocated) {
          const p = mapScreen({ x: 0, y: 253 }, width, height, geo.camera);
          ctx.save();
          ctx.globalAlpha = blend;
          ctx.fillStyle = palette.muted;
          ctx.font = "10px Arial";
          ctx.textAlign = "center";
          ctx.fillText("LOCATION NOT AVAILABLE", p.x, p.y);
          ctx.restore();
        }
      }
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
      if (geo)
        for (const [id, position] of positions) {
          const world = geo.layout.points.get(id);
          if (!world) continue;
          const destination = mapScreen(world, width, height, geo.camera);
          positions.set(id, {
            point: {
              x: position.point.x + (destination.x - position.point.x) * blend,
              y: position.point.y + (destination.y - position.point.y) * blend,
            },
            perspective:
              position.perspective + (1 - position.perspective) * blend,
            depth: position.depth * (1 - blend),
          });
        }
      const coreRadius =
        Math.max(24, Math.min(42, 43 * scale)) * (1 - blend) + 10 * blend;
      targets = [];
      if (frame.invitation)
        paintInvitation(
          ctx,
          positions.get(`atom:${scene.selected.id}`)!.point,
          Math.min(135, Math.min(width, height) * 0.38) *
            Math.min(1.3, camera.zoom),
          frame.invitation.opacity,
          frame.elapsedMs,
          frame.invitation.still,
          palette.bond,
        );
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
                    ? 0.06
                    : edge.distance <= 3
                      ? 0.22
                      : 0.15);
            ctx.strokeStyle = active ? energyColor : palette.bond;
            ctx.lineWidth = active && !sameLevel ? 1.3 : direct ? 0.95 : 0.5;
            if (direct || (active && !sameLevel)) {
              ctx.shadowColor = energyColor;
              ctx.shadowBlur = active ? 5 : 0;
            }
            ctx.beginPath();
            const ga = geo?.layout.points.get(start.id),
              gb = geo?.layout.points.get(end.id);
            const crossing =
              geo && blend === 1 && ga?.located && gb?.located
                ? datelineSegments(ga, gb)
                : null;
            if (crossing && crossing.length > 1) {
              for (const [a, b] of crossing) {
                const x = mapScreen(a, width, height, geo!.camera),
                  y = mapScreen(b, width, height, geo!.camera);
                ctx.moveTo(x.x, x.y);
                ctx.lineTo(y.x, y.y);
              }
            } else {
              ctx.moveTo(origin.x, origin.y);
              ctx.quadraticCurveTo(
                control.x,
                control.y,
                to.point.x,
                to.point.y,
              );
            }
            ctx.stroke();
            if (
              active &&
              !frame.reducedMotion &&
              !sameLevel &&
              frame.pulseDirection === "outgoing"
            ) {
              let energy = curvePoint(
                origin,
                control,
                to.point,
                Math.min(1, phase / 0.72),
              );
              if (crossing && crossing.length > 1) {
                const t = Math.min(1, phase / 0.72);
                const lengths = crossing.map(([a, b]) =>
                  Math.hypot(a.x - b.x, a.y - b.y),
                );
                const total = lengths.reduce((a, b) => a + b, 0);
                let remaining = t * total;
                for (let i = 0; i < crossing.length; i++) {
                  const [a, b] = crossing[i]!;
                  const length = lengths[i]!;
                  if (remaining <= length || i === crossing.length - 1) {
                    const p = remaining / (length || 1);
                    energy = mapScreen(
                      { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p },
                      width,
                      height,
                      geo!.camera,
                    );
                    break;
                  }
                  remaining -= length;
                }
              }
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
            : (emotion?.colors[0] ?? layerTint(node.distance, palette));
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
              if (blend === 1) {
                const radius = Math.min(
                  9,
                  3 + Math.log2(node.members.length + 1),
                );
                const colors = emotion?.colors.length ? emotion.colors : [tint];
                for (let i = 0; i < colors.length; i++) {
                  ctx.fillStyle = active ? energyColor : colors[i]!;
                  ctx.beginPath();
                  ctx.moveTo(point.x, point.y);
                  ctx.arc(
                    point.x,
                    point.y,
                    radius,
                    (i / colors.length) * Math.PI * 2,
                    ((i + 1) / colors.length) * Math.PI * 2,
                  );
                  ctx.closePath();
                  ctx.fill();
                }
                ctx.fillStyle = palette.text;
                ctx.font = "600 11px Arial";
                ctx.textAlign = "center";
                ctx.fillText(
                  String(node.members.length),
                  point.x,
                  point.y + radius + 14,
                );
                targets.push({
                  node,
                  point,
                  radius: Math.max(10, radius + 3),
                  depth: 0,
                });
                ctx.restore();
                return;
              }
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
                      ] ?? layerTint(node.distance, palette));
                const particle = node.particles[i]!;
                const drift =
                  Math.sin(frame.elapsedMs / 6000 + i) * 3 * (1 - blend);
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
                  (particle.x + drift) *
                    scale *
                    projected.perspective *
                    (1 - blend * 0.8);
                const y =
                  point.y +
                  particle.y *
                    scale *
                    projected.perspective *
                    (1 - blend * 0.8);
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
              const orbitalRadius = center
                ? coreRadius
                : Math.max(
                    node.distance === 1 ? 7.5 : 3.2,
                    (node.distance === 1 ? 15 : 8) * scale,
                  ) * projected.perspective;
              const radius =
                orbitalRadius * (1 - blend) + (center ? 7 : 4) * blend;
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
                  palette,
                );
              else {
                glow(
                  ctx,
                  point,
                  radius * 3.2,
                  tint,
                  active ? 0.35 : node.distance === 1 ? 0.08 : 0.04,
                );
                const sphere = ctx.createRadialGradient(
                  point.x - radius * 0.3,
                  point.y - radius * 0.4,
                  0,
                  point.x,
                  point.y,
                  radius,
                );
                sphere.addColorStop(0, palette.highlight);
                sphere.addColorStop(0.45, tint);
                sphere.addColorStop(1, palette.shade);
                ctx.shadowColor = "#11111130";
                ctx.shadowBlur = radius * 0.45;
                ctx.shadowOffsetY = radius * 0.2;
                ctx.fillStyle = sphere;
                ctx.strokeStyle = active ? energyColor : palette.shade;
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.shadowOffsetY = 0;
                ctx.stroke();
                if (node.distance === 1 && blend < 1) {
                  ctx.strokeStyle = `${palette.bond}45`;
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
                ctx.strokeStyle = palette.bond;
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
                ctx.fillStyle = palette.text;
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
      if (scene.mode !== "people" && !geo) {
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
          ctx.fillStyle = palette.text;
          ctx.font = `${width < 500 ? 10 : 11}px Arial`;
          const labelY = point.y + (region.anchor.y > 180 ? 76 : -57);
          ctx.fillText(region.label, point.x, labelY);
          if (width >= 500 || scene.mode === "regions") {
            ctx.fillStyle = palette.muted;
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
