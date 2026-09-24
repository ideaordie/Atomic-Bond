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
    () => atomContext(graph, originalId, atomId),
    [graph, originalId, atomId],
  );
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [atomId]);
  const alias = context.selected.displayName?.trim();
  const homeRegion =
    context.selected.metadata?.homeRegion ??
    [context.selected.metadata?.region, context.selected.metadata?.countryCode]
      .filter(Boolean)
      .join(", ");
  const relationship =
    context.distance === 0
      ? "Your Atom"
      : context.distance === undefined
        ? "Not connected to you"
        : context.distance === 1
          ? "Directly Bonded to you"
          : `${context.distance} Bonds from you`;
  const path = context.path;
  const pathLabels = path.map((node, index) =>
    index === 0 ? "YOU" : node.displayName?.trim() || `ATOM #${node.publicId}`,
  );
  const compactPath = [
    "YOU",
    ...(path.length <= 6
      ? path.slice(1, -1).map(() => "●")
      : [`${path.length - 2} people`]),
    alias || `ATOM #${context.selected.publicId}`,
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
            ATOM #{context.selected.publicId}
          </h2>
          {alias && (
            <p className="context-alias" data-testid="atom-alias">
              {alias}
            </p>
          )}
        </div>
      </div>
      <PublicXProfile profiles={context.selected.socialProfiles} />
      <p
        className="context-relationship"
        data-testid="relationship"
        aria-label={`Connection to you: ${relationship}`}
      >
        {relationship}
      </p>
      <dl className="context-metrics">
        <div>
          <dt>Network</dt>
          <dd>{context.reachableCount} people</dd>
        </div>
        <div>
          <dt>Reach</dt>
          <dd>
            {context.cityCount} known{" "}
            {context.cityCount === 1 ? "city" : "cities"} ·{" "}
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
