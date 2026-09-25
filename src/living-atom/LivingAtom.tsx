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
import { AggregateExplorer } from "./interaction/AggregateExplorer";
import { AtomContextPanel } from "./interaction/AtomContextPanel";
import "./living-atom.css";
import "./controls.css";
import { PulseComposer } from "../components/pulse/PulseComposer";
import { NetworkEmotionResults } from "../components/pulse/NetworkEmotionResults";
import { EmotionalSummary } from "../components/pulse/EmotionalSummary";
import { EMOTION_DEFINITIONS } from "./pulse/emotions";
import { emotionPaint } from "./pulse/emotion-presentation";
import { emotionalNetwork } from "../graph/metrics/emotional-network";
import { networkReach } from "../graph/metrics/network-reach";
import type { Emotion, EmotionalPulse } from "../types/emotional-pulse";

const EMPTY_PULSES: readonly EmotionalPulse[] = [];

export interface LivingAtomProps {
  emotional?: {
    pulses: readonly EmotionalPulse[];
    now: number;
    send: (emotion: Emotion) => void;
  };
  graph: GraphData;
  originalAtomId: string;
  onCreateBond?: () => void;
  arrivalId?: string | null;
}

export function LivingAtom({
  graph,
  originalAtomId,
  onCreateBond,
  arrivalId,
  emotional,
}: LivingAtomProps) {
  const [selection, setSelection] = useState({
    originalId: originalAtomId,
    selectedId: originalAtomId,
  });
  const toolsToggle = useRef<HTMLButtonElement>(null);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [camera, setCamera] = useState(INITIAL_CAMERA);
  const [paused, setPaused] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [feelNetwork, setFeelNetwork] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const feelButton = useRef<HTMLButtonElement>(null);
  const [sentEmotion, setSentEmotion] = useState<Emotion | null>(null);
  const pulseButton = useRef<HTMLButtonElement>(null);
  const traversalStartedAt = useRef(0);
  const [pulse, setPulse] = useState<PulsePresentation>(() =>
    idlePulse(originalAtomId),
  );
  const reducedMotion = useReducedMotion();
  const baseScene = useMemo(
    () =>
      createScene(
        graph,
        selection.selectedId,
        feelNetwork || sentEmotion !== null,
      ),
    [graph, selection.selectedId, feelNetwork, sentEmotion],
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
        emotional?.pulses ?? [],
        emotional?.now ?? 0,
      ),
    [graph, originalAtomId, emotional?.pulses, emotional?.now],
  );
  const paints = useMemo(
    () =>
      emotionPaint(scene, emotionalSummary.active, feelNetwork, originalAtomId),
    [scene, emotionalSummary.active, feelNetwork, originalAtomId],
  );
  const reach = useMemo(
    () => networkReach(graph, originalAtomId),
    [graph, originalAtomId],
  );
  const ownPulse = emotionalSummary.active.find(
    (p) => p.atomId === originalAtomId,
  );
  const running = pulse.distance !== null;
  const isMine = selection.selectedId === originalAtomId;

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

  useEffect(() => {
    if (!feelNetwork) return;
    const timer = window.setTimeout(
      () => setFeelNetwork(false),
      ACTION_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [feelNetwork]);

  const inspect = useCallback((id: string) => {
    setInspectedId(id);
    setToolsOpen(false);
  }, []);
  const recenter = (id: string) => {
    setSelection((state) => selectAtom(state, id));
    setCamera(INITIAL_CAMERA);
    setPulse(idlePulse(id));
    setSentEmotion(null);
    setInspectedId(null);
    toolsToggle.current?.focus({ preventScroll: true });
  };
  const home = () => {
    setSelection(returnToOriginal);
    setCamera(INITIAL_CAMERA);
    setPulse(idlePulse(originalAtomId));
    setSentEmotion(null);
    setInspectedId(null);
    setToolsOpen(false);
  };
  const individualNodes = scene.nodes.filter((node) => node.kind === "atom");
  const aggregates = scene.nodes.filter((node) => node.kind === "aggregate");
  const reached =
    pulse.distance === null
      ? 0
      : steps
          .slice(0, pulse.distance + 1)
          .reduce((sum, step) => sum + step.atomCount, 0);
  const pulseMessage =
    pulse.distance !== null
      ? pulse.distance === 0
        ? "Your Pulse begins here."
        : `Reaching through Bonds · ${reached} people illuminated`
      : pulse.completed
        ? `Pulse complete · PULSE SENT · ${reach.people} connected Atoms reached, including you · ${reach.cities.length} known cities · ${reach.regions.length} regions · ${reach.countries.length} countries`
        : "One connection opens another world.";

  return (
    <div className="living-atom spatial-shell" data-testid="living-atom">
      <h1 className="sr-only">The Living Atom</h1>
      <div className="atom-stage">
        <AtomCanvas
          emotions={paints}
          feelNetwork={feelNetwork}
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
          originalId={originalAtomId}
          inspectedId={inspectedId}
          arrivalId={arrivalId ?? null}
          onSelect={inspect}
          onCamera={setCamera}
        />
      </div>

      {!feelNetwork && (
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
              {scene.regionCount} <em>regions</em>
            </strong>
            <small>{scene.countryCount} countries</small>
          </div>
          <p>Coarse, synthetic geography</p>
        </div>
      )}
      {feelNetwork && <EmotionalSummary summary={emotionalSummary} />}
      {resultsOpen && (
        <NetworkEmotionResults
          graph={graph}
          viewerId={originalAtomId}
          pulses={emotional?.pulses ?? EMPTY_PULSES}
          now={emotional?.now ?? 0}
          onClose={() => {
            setResultsOpen(false);
            feelButton.current?.focus({ preventScroll: true });
          }}
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
      <div
        className="secondary-actions"
        role="group"
        aria-label="Network exploration"
      >
        <button
          type="button"
          ref={toolsToggle}
          className="tools-toggle"
          aria-expanded={toolsOpen}
          aria-controls="explorer-tools"
          onClick={() => {
            setToolsOpen((value) => !value);
            setInspectedId(null);
          }}
        >
          Explore Atoms <span aria-hidden="true">⌕</span>
        </button>

        <button
          type="button"
          className="my-atom"
          onClick={home}
          aria-label="My Atom"
        >
          <span>My Atom</span>
        </button>
      </div>
      {inspectedId && (
        <AtomContextPanel
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
            toolsToggle.current?.focus({ preventScroll: true });
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
            >
              CREATE BOND
            </button>
          )}

          <button
            type="button"
            className="pulse-button"
            ref={pulseButton}
            onClick={() => {
              if (running) setPulse(idlePulse(selection.selectedId));
              else {
                setComposerOpen(true);
                setToolsOpen(false);
                setInspectedId(null);
              }
            }}
          >
            <span aria-hidden="true" className="pulse-symbol">
              ◉
            </span>
            {running ? "Stop Pulse" : "Pulse"}
          </button>
          <button
            className="feel-network"
            type="button"
            aria-pressed={feelNetwork}
            ref={feelButton}
            onClick={() => {
              setFeelNetwork((value) => !value);
              setResultsOpen(true);
            }}
          >
            FEEL YOUR NETWORK
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
          onClose={() => {
            setComposerOpen(false);
            pulseButton.current?.focus();
          }}
          onSend={(emotion) => {
            emotional?.send(emotion);
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

      {toolsOpen && (
        <aside
          className="explorer-tools"
          id="explorer-tools"
          aria-label="Exploration tools"
        >
          <div className="tools-heading">
            <h2>Explore your connections</h2>
            <button
              type="button"
              aria-label="Close exploration tools"
              onClick={() => setToolsOpen(false)}
            >
              ×
            </button>
          </div>
          <label>
            Select an Atom
            <select
              aria-label="Select an Atom"
              value={inspectedId ?? ""}
              onChange={(event) => {
                if (event.target.value) inspect(event.target.value);
              }}
            >
              <option value="">Choose a person to explore…</option>
              {individualNodes.map((node) => (
                <option key={node.id} value={node.members[0]}>
                  {node.label}
                  {feelNetwork
                    ? ` · ${paints.get(node.id)?.label ?? "No active Pulse"}`
                    : ""}
                  {node.distance === 0
                    ? " · current center"
                    : node.distance === 1
                      ? " · direct Bond"
                      : " · extended network"}
                </option>
              ))}
            </select>
          </label>
          <p id="network-instructions">
            Select a person, then choose View their network. Drag to pan; pinch,
            use the wheel or + / − to zoom. With the canvas focused, arrow keys
            pan and + / − zoom.
          </p>
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            disabled={reducedMotion}
          >
            {reducedMotion
              ? "Motion reduced"
              : paused
                ? "Resume motion"
                : "Pause motion"}
          </button>
          {aggregates.length > 0 && (
            <AggregateExplorer
              key={`${selection.selectedId}:${mode}`}
              groups={aggregates}
              graph={graph}
              onSelect={inspect}
            />
          )}
          <details className="network-details">
            <summary>Network details</summary>
            <p>
              <span data-testid="represented-count">
                {scene.representedCount}
              </span>{" "}
              people represented, of {scene.reachableCount} reachable. Counts
              include the current center.
            </p>
            <p>
              Displayed through{" "}
              <span data-testid="max-degree">{scene.maxDistance}</span> Bonds.{" "}
              {scene.reachableCount - scene.representedCount} people are beyond
              this view. {scene.disconnectedCount} Atoms are disconnected.
            </p>
            <ul>
              {scene.regions.map((region) => (
                <li key={region.key}>
                  {region.label}: {region.reachableCount} people in reach
                </li>
              ))}
            </ul>
            <p>
              Regional clouds summarize people in view. Background stars are
              decorative. City coverage is partial; distance and weekly growth
              are unavailable. Indirect connection does not imply trust.
            </p>
          </details>
        </aside>
      )}
      {!toolsOpen && (
        <p id="network-instructions" className="sr-only">
          Select an Atom to inspect it, then choose View their network. Drag to
          pan, pinch or use + / − to zoom. Arrow keys pan when the canvas is
          focused. The Explore Atoms menu provides keyboard selectors and motion
          controls.
        </p>
      )}
      <p className="simulation-label">
        Synthetic network <span aria-hidden="true">·</span>{" "}
        {reducedMotion
          ? "Reduced motion"
          : paused
            ? "Motion paused"
            : "A shared human constellation"}
      </p>
    </div>
  );
}
