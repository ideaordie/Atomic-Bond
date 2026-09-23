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
import { PULSE_STEP_MS, pulseSteps } from "./pulse/traversal";
import { idlePulse, type PulsePresentation } from "./pulse/presentation";
import { AggregateExplorer } from "./interaction/AggregateExplorer";
import { AtomContextPanel } from "./interaction/AtomContextPanel";
import "./living-atom.css";

export interface LivingAtomProps {
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
  const [pulse, setPulse] = useState<PulsePresentation>(() =>
    idlePulse(originalAtomId),
  );
  const reducedMotion = useReducedMotion();
  const baseScene = useMemo(
    () => createScene(graph, selection.selectedId),
    [graph, selection.selectedId],
  );
  const mode = viewScale(camera.zoom);
  const scene = useMemo(
    () => createSpatialScene(baseScene, graph, mode),
    [baseScene, graph, mode],
  );
  const steps = useMemo(() => pulseSteps(scene), [scene]);
  const running = pulse.distance !== null;
  const isMine = selection.selectedId === originalAtomId;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setPulse((previous) => {
        if (previous.distance === null) return previous;
        return previous.distance < scene.maxDistance
          ? {
              ...previous,
              distance: previous.distance + 1,
              stepStartedAt: performance.now(),
            }
          : { ...previous, distance: null, completed: true };
      });
    }, PULSE_STEP_MS);
    return () => window.clearInterval(timer);
  }, [running, scene.maxDistance, selection.selectedId]);

  const inspect = useCallback((id: string) => {
    setInspectedId(id);
    setToolsOpen(false);
  }, []);
  const recenter = (id: string) => {
    setSelection((state) => selectAtom(state, id));
    setCamera(INITIAL_CAMERA);
    setPulse(idlePulse(id));
    setInspectedId(null);
    toolsToggle.current?.focus({ preventScroll: true });
  };
  const home = () => {
    setSelection(returnToOriginal);
    setCamera(INITIAL_CAMERA);
    setPulse(idlePulse(originalAtomId));
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
        ? `Pulse complete · ${scene.representedCount} people illuminated`
        : "One connection opens another world.";

  return (
    <div className="living-atom spatial-shell" data-testid="living-atom">
      <h1 className="sr-only">The Living Atom</h1>
      <div className="atom-stage">
        <AtomCanvas
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

      {isMine && onCreateBond && (
        <button type="button" className="create-bond" onClick={onCreateBond}>
          CREATE BOND
        </button>
      )}

      <div className="reach-readout" aria-label="Network information">
        <div>
          <span>{isMine ? "MY BONDS" : "THEIR BONDS"}</span>
          <strong data-testid="direct-count">{scene.directCount}</strong>
          <small>people</small>
        </div>
        <div>
          <span>{isMine ? "MY NETWORK" : "THEIR NETWORK"}</span>
          <strong data-testid="reachable-count">{scene.reachableCount}</strong>
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
      <div className="perspective-label" aria-live="polite">
        <span>{isMine ? "YOUR PERSPECTIVE" : "VIEWING THEIR NETWORK"}</span>
        <strong data-testid="selected-atom">#{scene.selected.publicId}</strong>
      </div>
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

      {inspectedId && (
        <AtomContextPanel
          graph={graph}
          centerId={selection.selectedId}
          originalId={originalAtomId}
          atomId={inspectedId}
          onView={() => recenter(inspectedId)}
          onClose={() => {
            setInspectedId(null);
            toolsToggle.current?.focus({ preventScroll: true });
          }}
        />
      )}

      <div className="spatial-dock">
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
          <button type="button" className="my-atom" onClick={home}>
            ⌂<span>My Atom</span>
          </button>
        </div>
        <div className="pulse-control">
          <button
            type="button"
            className="pulse-button"
            onClick={() =>
              setPulse(
                running
                  ? idlePulse(selection.selectedId)
                  : {
                      ...idlePulse(selection.selectedId),
                      distance: 0,
                      stepStartedAt: performance.now(),
                    },
              )
            }
          >
            <span aria-hidden="true" className="pulse-symbol">
              ◉
            </span>
            {running ? "Stop Pulse" : "Send Pulse"}
          </button>
          <p
            className="pulse-status"
            role="status"
            data-testid="pulse-status"
            data-degree={pulse.distance ?? "idle"}
          >
            {pulseMessage}
          </p>
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
