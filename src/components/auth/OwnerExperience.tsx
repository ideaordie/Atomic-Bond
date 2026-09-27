"use client";

import { useEffect, useRef, useState } from "react";
import { BondInvitation, type DisplayInvitation } from "./BondInvitation";
import type { GraphData } from "../../types/graph";
import type { EmotionalPulse, Emotion } from "../../types/emotional-pulse";
import { LivingAtom } from "../../living-atom/LivingAtom";
import {
  createOwnerInvitation,
  sendOwnerPulse,
  refreshOwnerNetwork,
} from "../../services/auth/actions";
import "./auth.css";
export function OwnerExperience({
  graph: initialGraph,
  publicId,
  initialPulses,
  initialArrivalId = null,
}: {
  graph: GraphData;
  publicId: string;
  initialPulses: readonly EmotionalPulse[];
  initialArrivalId?: string | null;
}) {
  const [graph, setGraph] = useState(initialGraph);
  const [arrival, setArrival] = useState(initialArrivalId);
  const graphRef = useRef(initialGraph);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [notice, setNotice] = useState(initialArrivalId ? "BOND CREATED" : "");
  const [pulses, setPulses] = useState(initialPulses),
    [now, setNow] = useState(0),
    [invite, setInvite] = useState<DisplayInvitation | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    let loading = false;
    const refresh = async () => {
      if (loading) return;
      loading = true;
      try {
        const result = await refreshOwnerNetwork();
        if (!cancelled) {
          setError("");
          const added = result.graph.edges.find(
            (e) =>
              !graphRef.current.edges.some((old) => old.id === e.id) &&
              (e.source === publicId || e.target === publicId),
          );
          if (added) {
            setArrival(added.source === publicId ? added.target : added.source);
            setNotice("BOND CREATED");
            setInvite(null);
          }
          if (
            JSON.stringify(graphRef.current) !== JSON.stringify(result.graph)
          ) {
            graphRef.current = result.graph;
            setGraph(result.graph);
          }
          setPulses(result.pulses);
        }
      } catch {
        if (!cancelled)
          setError(
            "Network update unavailable. Your last confirmed view is shown; reconnect or refresh to retry.",
          );
      } finally {
        loading = false;
      }
    };
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 10000);
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      clearInterval(poll);
      window.removeEventListener("focus", refresh);
    };
  }, [publicId]);
  async function send(emotion: Emotion) {
    const pulse = await sendOwnerPulse(emotion);
    setPulses((p) => [...p.filter((x) => x.atomId !== publicId), pulse]);
    setNow(Date.now());
  }
  return (
    <>
      <LivingAtom
        graph={graph}
        originalAtomId={publicId}
        synthetic={false}
        arrivalId={arrival}
        emotional={{ pulses, now, send }}
        onCreateBond={() => {
          if (creatingRef.current) return;
          creatingRef.current = true;
          setCreating(true);
          setError("");
          void createOwnerInvitation()
            .then(setInvite)
            .catch(() =>
              setError(
                "Unable to create an invitation. Sign in again or retry.",
              ),
            )
            .finally(() => {
              creatingRef.current = false;
              setCreating(false);
            });
        }}
      />
      {error && <p role="alert">{error}</p>}
      <p className="bond-update" role="status">
        {creating ? "Preparing your invitation…" : notice}
      </p>
      {invite && (
        <BondInvitation
          invite={invite}
          publicId={publicId}
          close={() => setInvite(null)}
        />
      )}
    </>
  );
}
