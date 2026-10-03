"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GraphData } from "../types/graph";
import { createScene } from "./layout/scene";
import { createSpatialScene, viewScale } from "./layout/spatial";
import { AtomCanvas } from "./renderer/AtomCanvas";
import {
  INITIAL_CAMERA,
  returnToOriginal,
  selectAtom,
  zoomCamera,
} from "./interaction/camera";
import { useReducedMotion } from "./interaction/use-reduced-motion";
import { ACTION_DURATION_MS, pulseStepMs, pulseSteps } from "./pulse/traversal";
import { idlePulse, type PulsePresentation } from "./pulse/presentation";
import { AtomContextPanel } from "./interaction/AtomContextPanel";
import "./living-atom.css";
import "./controls.css";
import { PulseComposer } from "../components/pulse/PulseComposer";
import { NetworkEmotionResults } from "../components/pulse/NetworkEmotionResults";
import { EMOTION_DEFINITIONS } from "./pulse/emotions";
import { emotionPaint } from "./pulse/emotion-presentation";
import { emotionalNetwork } from "../graph/metrics/emotional-network";
import { networkReach } from "../graph/metrics/network-reach";
import type { Emotion, EmotionalPulse } from "../types/emotional-pulse";

const EMPTY_PULSES: readonly EmotionalPulse[] = [];

export interface LivingAtomProps {
  ownerMode?: boolean;
  synthetic?: boolean;
  emotional?: {
    pulses: readonly EmotionalPulse[];
    now: number;
    send: (emotion: Emotion) => void | Promise<void>;
    updatedAt?: number;
    status?: "ready" | "refreshing" | "unavailable" | "offline";
  };
  graph: GraphData;
  originalAtomId: string;
  onCreateBond?: () => void;
  creatingBond?: boolean;
  arrivalId?: string | null;
}

export function LivingAtom({
  graph,
  originalAtomId,
  onCreateBond,
  creatingBond = false,
  arrivalId,
  emotional,
  ownerMode = true,
  synthetic = true,
}: LivingAtomProps) {
  const [selection, setSelection] = useState({
    originalId: originalAtomId,
    selectedId: originalAtomId,
  });
  const canvasContainer = useRef<HTMLDivElement>(null);
  const focusCanvas = () =>
    canvasContainer.current
      ?.querySelector("canvas")
      ?.focus({ preventScroll: true });
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [camera, setCamera] = useState(INITIAL_CAMERA);
  const [paused, setPaused] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const emotionalView = ownerMode && Boolean(emotional);
  const [sentEmotion, setSentEmotion] = useState<Emotion | null>(null);
  const pulseButton = useRef<HTMLButtonElement>(null);
  const traversalStartedAt = useRef(0);
  const [pulse, setPulse] = useState<PulsePresentation>(() =>
    idlePulse(originalAtomId),
  );
  const reducedMotion = useReducedMotion();
  const baseScene = useMemo(
    () => createScene(graph, selection.selectedId, emotionalView),
    [graph, selection.selectedId, emotionalView],
  );
  const mode = viewScale(camera.zoom);
  const scene = useMemo(
    () => createSpatialScene(baseScene, graph, mode),
    [baseScene, graph, mode],
  );
  const steps = useMemo(() => pulseSteps(scene), [scene]);
  const emotionalSummary = useMemo(
    () =>
      emotionalNetwork(
        graph,
        originalAtomId,
        emotionalView ? (emotional?.pulses ?? EMPTY_PULSES) : EMPTY_PULSES,
        emotional?.now ?? 0,
      ),
    [graph, originalAtomId, emotional?.pulses, emotional?.now, emotionalView],
  );
  const paints = useMemo(
    () =>
      emotionPaint(
        scene,
        emotionalSummary.active,
        emotionalView,
        originalAtomId,
      ),
    [scene, emotionalSummary.active, emotionalView, originalAtomId],
  );
  const reach = useMemo(
    () => networkReach(graph, originalAtomId),
    [graph, originalAtomId],
  );
  const ownPulse = emotionalSummary.active.find(
    (p) => p.atomId === originalAtomId,
  );
  const running = pulse.distance !== null;
  const isMine = ownerMode && selection.selectedId === originalAtomId;

  useEffect(() => {
    if (!running) return;
    const stepMs = pulseStepMs(scene.maxDistance);
    const stop = window.setTimeout(
      () => {
        setPulse((previous) => ({
          ...previous,
          distance: null,
          completed: true,
        }));
      },
      Math.max(
        0,
        ACTION_DURATION_MS - (performance.now() - traversalStartedAt.current),
      ),
    );
    const timer = window.setInterval(() => {
      setPulse((previous) => {
        if (previous.distance === null) return previous;
        const distance = Math.floor(
          (performance.now() - traversalStartedAt.current) / stepMs,
        );
        return distance <= scene.maxDistance
          ? {
              ...previous,
              distance,
              stepStartedAt: traversalStartedAt.current + distance * stepMs,
            }
          : previous;
      });
    }, stepMs);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [running, scene.maxDistance, selection.selectedId]);

  const inspect = useCallback((id: string) => {
    setInspectedId(id);
  }, []);
  const recenter = (id: string) => {
    setSelection((state) => selectAtom(state, id));
    setCamera(INITIAL_CAMERA);
    setPulse(idlePulse(id));
    setSentEmotion(null);
    setInspectedId(null);
    focusCanvas();
  };
  const home = () => {
    setSelection(returnToOriginal);
    setCamera(INITIAL_CAMERA);
    setPulse(idlePulse(originalAtomId));
    setSentEmotion(null);
    setInspectedId(null);
  };
  const representedIds = new Set(scene.nodes.flatMap((node) => node.members));
  const reached =
    pulse.distance === null
      ? 0
      : steps
          .slice(0, pulse.distance + 1)
          .reduce((sum, step) => sum + step.atomCount, 0);
  const pulseMessage =
    pulse.distance !== null
      ? pulse.distance === 0
        ? "PULSE SENT · Your Pulse begins here."
        : `Reaching through Bonds · ${reached} people illuminated`
      : pulse.completed
        ? `Pulse complete · PULSE SENT · ${reach.people} connected Atoms reached, including you · ${reach.regions.length} regions · ${reach.countries.length} countries`
        : isMine && scene.directCount === 0
          ? "Your network begins here. Create your first Bond with someone you know."
          : "One connection opens another world.";

  return (
    <div className="living-atom spatial-shell" data-testid="living-atom">
      <h1 className="sr-only">The Living Atom</h1>
      <div className="atom-stage" ref={canvasContainer}>
        <AtomCanvas
          emotions={paints}
          feelNetwork={emotionalView}
          {...(sentEmotion
            ? { pulseColor: EMOTION_DEFINITIONS[sentEmotion].color }
            : {})}
          scene={scene}
          camera={camera}
          reducedMotion={reducedMotion}
          paused={paused}
          pulseDistance={pulse.distance}
          pulseStartedAt={pulse.stepStartedAt}
          pulseDirection={pulse.direction}
          originalId={ownerMode ? originalAtomId : ""}
          inspectedId={inspectedId}
          arrivalId={arrivalId ?? null}
          onSelect={inspect}
          onCamera={setCamera}
        />
        <label className="canvas-keyboard-selector">
          Select an Atom
          <select
            aria-label="Select an Atom"
            value={inspectedId ?? ""}
            onChange={(event) => {
              if (event.target.value) inspect(event.target.value);
            }}
          >
            <option value="">Choose an Atom</option>
            {graph.nodes
              .filter((node) => representedIds.has(node.id))
              .map((node) => (
                <option key={node.id} value={node.id}>
                  ATOM #{node.publicId}
                  {node.displayName ? ` - ${node.displayName}` : ""}
                </option>
              ))}
          </select>
        </label>
      </div>

      {
        <div className="reach-readout" aria-label="Network information">
          <div>
            <span>{isMine ? "MY BONDS" : "THEIR BONDS"}</span>
            <strong data-testid="direct-count">{scene.directCount}</strong>
            <small>people</small>
          </div>
          <div>
            <span>{isMine ? "MY NETWORK" : "THEIR NETWORK"}</span>
            <strong data-testid="reachable-count">
              {scene.reachableCount}
            </strong>
            <small>people, including {isMine ? "you" : "this Atom"}</small>
          </div>
          <div>
            <span>REGIONAL REACH</span>
            <strong>
              {scene.regionCount}{" "}
              <em>{scene.regionCount === 1 ? "region" : "regions"}</em>
            </strong>
            <small>
              {scene.countryCount}{" "}
              {scene.countryCount === 1 ? "country" : "countries"}
            </small>
          </div>
          <p>
            {synthetic && ownerMode
              ? "Coarse, synthetic geography"
              : "Coarse geography"}
          </p>
        </div>
      }
      {emotionalView && (
        <NetworkEmotionResults
          summary={emotionalSummary}
          reach={reach}
          now={emotional?.now ?? 0}
          updatedAt={emotional?.updatedAt ?? emotional?.now ?? 0}
          status={emotional?.status ?? "ready"}
        />
      )}
      <div className="perspective-label" aria-live="polite">
        <span>{isMine ? "YOUR PERSPECTIVE" : "VIEWING THEIR NETWORK"}</span>
        <strong data-testid="selected-atom">#{scene.selected.publicId}</strong>
        {isMine && ownPulse && (
          <p className="own-pulse-label" data-testid="own-pulse">
            Your Pulse: {EMOTION_DEFINITIONS[ownPulse.emotion].label} · active
            for 24 hours
          </p>
        )}
      </div>
      {!ownerMode && (
        <div
          className="secondary-actions"
          role="group"
          aria-label="Network exploration"
        >
          <button
            type="button"
            className="my-atom"
            onClick={home}
            aria-label={ownerMode ? "My Atom" : "Starting Atom"}
            title={
              ownerMode
                ? "Return to your own network perspective"
                : "Return to the starting Atom"
            }
          >
            <span>{ownerMode ? "My Atom" : "Starting Atom"}</span>
          </button>
        </div>
      )}
      {inspectedId && (
        <AtomContextPanel
          ownerMode={ownerMode}
          graph={graph}
          centerId={selection.selectedId}
          originalId={originalAtomId}
          atomId={inspectedId}
          {...(emotionalSummary.active.find((p) => p.atomId === inspectedId)
            ? {
                activePulse: emotionalSummary.active.find(
                  (p) => p.atomId === inspectedId,
                )!,
              }
            : {})}
          pulseNow={emotional?.now ?? 0}
          onView={() => recenter(inspectedId)}
          onClose={() => {
            setInspectedId(null);
            focusCanvas();
          }}
        />
      )}

      <div className="spatial-dock">
        <div
          className="primary-actions"
          role="group"
          aria-label="Primary network actions"
        >
          {isMine && onCreateBond && (
            <button
              type="button"
              className="create-bond"
              onClick={onCreateBond}
              disabled={creatingBond}
              aria-busy={creatingBond}
            >
              {creatingBond ? "Creating invitation…" : "CREATE BOND"}
            </button>
          )}

          {ownerMode && !isMine && (
            <button
              type="button"
              className="create-bond"
              onClick={home}
              aria-label="My Atom"
              title="Return to your own network perspective"
            >
              MY ATOM
            </button>
          )}

          <button
            type="button"
            className="pulse-button"
            disabled={!emotionalView}
            ref={pulseButton}
            onClick={() => {
              if (running) setPulse(idlePulse(selection.selectedId));
              else {
                setComposerOpen(true);
                setInspectedId(null);
              }
            }}
          >
            <span aria-hidden="true" className="pulse-symbol">
              ◉
            </span>
            {running ? "Stop Pulse" : "Pulse"}
          </button>
        </div>
        <p
          className="pulse-status"
          role="status"
          data-testid="pulse-status"
          data-degree={pulse.distance ?? "idle"}
        >
          {pulseMessage}
        </p>

        <div className="dock-navigation" aria-label="View controls">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setCamera((value) => zoomCamera(value, 1.25))}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setCamera((value) => zoomCamera(value, 0.8))}
          >
            −
          </button>
          <button
            type="button"
            aria-label="Fit"
            onClick={() => setCamera(INITIAL_CAMERA)}
          >
            ◎<span>Recenter</span>
          </button>
          <button
            type="button"
            disabled={reducedMotion}
            aria-label={
              reducedMotion
                ? "Motion reduced"
                : paused
                  ? "Resume motion"
                  : "Pause motion"
            }
            aria-pressed={paused || reducedMotion}
            onClick={() => setPaused((value) => !value)}
          >
            <span aria-hidden="true" className="motion-symbol">
              {paused ? "▶" : "Ⅱ"}
            </span>
            <span aria-hidden="true">Motion</span>
          </button>
        </div>
        <div className="scale-controls" aria-label="Network scale">
          <span>VIEW</span>
          {(
            [
              ["people", "People", 1.65],
              ["networks", "Networks", 1],
              ["regions", "Regions", 0.7],
            ] as const
          ).map(([key, label, zoom]) => (
            <button
              key={key}
              type="button"
              aria-pressed={mode === key}
              onClick={() => setCamera({ ...INITIAL_CAMERA, zoom })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {composerOpen && (
        <PulseComposer
          synthetic={synthetic}
          onClose={() => {
            setComposerOpen(false);
            pulseButton.current?.focus();
          }}
          onSend={async (emotion) => {
            await emotional?.send(emotion);
            if (!isMine) home();
            setSentEmotion(emotion);
            traversalStartedAt.current = performance.now();
            setPulse({
              ...idlePulse(originalAtomId),
              distance: 0,
              stepStartedAt: performance.now(),
            });
            setComposerOpen(false);
            pulseButton.current?.focus();
          }}
        />
      )}

      <p id="network-instructions" className="sr-only">
        Select an Atom to inspect it, then choose View their network. Drag to
        pan, pinch or use zoom controls. Arrow keys pan and plus/minus zoom when
        the canvas is focused. Tab to the accessible Atom selector for keyboard
        selection.
      </p>

      <p className="simulation-label">
        {[
          synthetic && ownerMode
            ? "Synthetic network"
            : ownerMode
              ? null
              : "Public network",
          reducedMotion ? "Reduced motion" : paused ? "Motion paused" : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
  );
}
