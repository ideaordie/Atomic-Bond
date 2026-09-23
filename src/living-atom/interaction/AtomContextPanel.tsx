"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphData } from "../../types/graph";
import { atomContext } from "./atom-context";
import { PublicXProfile } from "../../components/profile/PublicXProfile";

export function AtomContextPanel({
  graph,
  centerId,
  originalId,
  atomId,
  onView,
  onClose,
}: {
  graph: GraphData;
  centerId: string;
  originalId: string;
  atomId: string;
  onView: () => void;
  onClose: () => void;
}) {
  const [openedAt, setOpenedAt] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setOpenedAt(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const context = useMemo(
    () => atomContext(graph, centerId, atomId),
    [graph, centerId, atomId],
  );
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [atomId]);
  const from = centerId === originalId ? "you" : "this Atom";
  const homeRegion =
    context.selected.metadata?.homeRegion ??
    [context.selected.metadata?.region, context.selected.metadata?.countryCode]
      .filter(Boolean)
      .join(", ");
  const relationship =
    context.distance === 0
      ? "Your current perspective"
      : context.distance === undefined
        ? "Not connected to this perspective"
        : context.distance === 1
          ? `Directly Bonded to ${from}`
          : `${context.distance} Bonds from ${from}`;
  const path = context.path;
  const pathLabels = path.map((node, index) =>
    index === 0
      ? centerId === originalId
        ? "YOU"
        : "CURRENT"
      : `#${node.publicId}`,
  );
  const compactPath =
    pathLabels.length <= 4
      ? pathLabels
      : [
          pathLabels[0]!,
          pathLabels[1]!,
          `… ${pathLabels.length - 3} more …`,
          pathLabels[pathLabels.length - 1]!,
        ];
  return (
    <aside
      className="atom-context"
      aria-label="Selected Atom"
      data-testid="atom-context"
    >
      <button
        className="context-close"
        type="button"
        aria-label="Close selected Atom"
        onClick={onClose}
      >
        ×
      </button>
      <div className="context-title">
        <span className="context-avatar" aria-hidden="true">
          ◉
        </span>
        <div>
          <h2 ref={heading} tabIndex={-1}>
            Atom #{context.selected.publicId}
          </h2>
          <p data-testid="relationship">{relationship}</p>
        </div>
      </div>
      <dl className="context-metrics">
        <div>
          <dt>Network</dt>
          <dd>{context.reachableCount} people</dd>
        </div>
        <div>
          <dt>Reach</dt>
          <dd>
            {context.regionCount} regions · {context.countryCount} countries
          </dd>
        </div>
      </dl>
      {context.distance !== undefined && context.distance > 1 && (
        <p
          className="relationship-path"
          aria-label={`Relationship path: ${pathLabels.join(" to ")}`}
        >
          {compactPath.join(" → ")}
        </p>
      )}
      {context.bondedAt && (
        <p className="bond-date">
          Bond created:{" "}
          {Math.abs(openedAt - Date.parse(context.bondedAt)) < 60_000
            ? "Just now"
            : context.bondedAt.slice(0, 10)}
        </p>
      )}
      {homeRegion && <p className="bond-date">Home region: {homeRegion}</p>}
      <PublicXProfile profiles={context.selected.socialProfiles} />
      <button
        type="button"
        className="view-network"
        onClick={onView}
        disabled={atomId === centerId}
      >
        View their network <span aria-hidden="true">↗</span>
      </button>
    </aside>
  );
}
