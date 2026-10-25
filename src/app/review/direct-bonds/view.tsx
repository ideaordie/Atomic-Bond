"use client";
import { useCallback, useEffect, useState } from "react";
import {
  DirectRequests,
  RequestAction,
  DirectPreference,
} from "../../../components/direct-bonds/DirectRequests";
import { LivingAtom } from "../../../living-atom/LivingAtom";
import type { GraphData } from "../../../types/graph";
import type { DirectTransport } from "../../../services/direct-bonds/types";
import { AppearancePreference } from "../../../components/appearance/AppearancePreference";
import "../../../components/auth/auth.css";
async function call(
  owner: number,
  operation: string,
  payload: Record<string, unknown> = {},
) {
  const response = await fetch("/review/direct-bonds/operation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ owner, operation, payload }),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error);
  return result;
}
export function DirectReview() {
  const [owner, setOwner] = useState(1);
  const [graph, setGraph] = useState<GraphData>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const transport: DirectTransport = useCallback(
    (operation, payload) => call(owner, operation, payload),
    [owner],
  );
  const refresh = useCallback(
    async () => setGraph(await call(owner, "graph")),
    [owner],
  );
  useEffect(() => {
    call(owner, "graph")
      .then(setGraph)
      .catch((e) => setError(e.message));
  }, [owner]);
  return (
    <main>
      <section className="auth-panel">
        <h1>DIRECT BOND REQUESTS — LOCAL REVIEW</h1>
        <p>
          Synthetic owners and isolated persistent session data only. Select an
          indirectly connected Atom in the network.
        </p>
        <label>
          Synthetic owner{" "}
          <select
            value={owner}
            onChange={(e) => {
              setOwner(Number(e.target.value));
              setMessage("");
            }}
          >
            {Array.from({ length: 6 }, (_, i) => (
              <option key={i} value={i}>
                Owner {i}
                {i === 0 ? " (bridge)" : ""}
              </option>
            ))}
          </select>
        </label>
        <AppearancePreference />
        {error && <p role="alert">{error}</p>}
        <p role="status">{message}</p>
      </section>
      {graph && (
        <DirectRequests
          key={owner}
          transport={transport}
          onAccepted={async () => {
            await refresh();
            setMessage("BOND CREATED");
          }}
        >
          <LivingAtom
            graph={graph}
            originalAtomId={graph.nodes[owner]!.id}
            requestAction={(target) => (
              <RequestAction
                key={target}
                target={target}
                transport={transport}
              />
            )}
          />
          <section className="auth-panel">
            <DirectPreference transport={transport} />
          </section>
        </DirectRequests>
      )}
    </main>
  );
}
