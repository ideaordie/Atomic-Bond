"use client";

import { useMemo, useState } from "react";
import type { GraphData } from "../../types/graph";
import type { VisualNode } from "../types/scene";

const PAGE_SIZE = 40;

/** Keep keyboard exploration bounded too, even when a glyph summarizes thousands. */
export function AggregateExplorer({
  groups,
  graph,
  onSelect,
}: {
  groups: readonly VisualNode[];
  graph: GraphData;
  onSelect: (id: string) => void;
}) {
  const [groupId, setGroupId] = useState(groups[0]!.id);
  const [page, setPage] = useState(0);
  const group =
    groups.find((candidate) => candidate.id === groupId) ?? groups[0]!;
  const nodes = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph],
  );
  const start = page * PAGE_SIZE;
  return (
    <details className="aggregate-details">
      <summary>Explore grouped Atoms</summary>
      <p>
        Each group contains Atoms at the same graph distance. Select a member to
        inspect their connection, then choose View their network.
      </p>
      <div className="exploration-tools">
        <label>
          Network group
          <select
            aria-label="Network group"
            value={group.id}
            onChange={(event) => {
              setGroupId(event.target.value);
              setPage(0);
            }}
          >
            {groups.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Select a grouped Atom
          <select
            value=""
            onChange={(event) => {
              if (event.target.value) onSelect(event.target.value);
            }}
          >
            <option value="">Choose an Atom…</option>
            {group.members.slice(start, start + PAGE_SIZE).map((id) => (
              <option key={id} value={id}>
                Atom #{nodes.get(id)!.publicId}
              </option>
            ))}
          </select>
        </label>
      </div>
      {group.members.length > PAGE_SIZE && (
        <div className="group-pagination">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous members
          </button>
          <span>
            {start + 1}–{Math.min(start + PAGE_SIZE, group.members.length)} of{" "}
            {group.members.length}
          </span>
          <button
            type="button"
            disabled={start + PAGE_SIZE >= group.members.length}
            onClick={() => setPage((value) => value + 1)}
          >
            Next members
          </button>
        </div>
      )}
    </details>
  );
}
