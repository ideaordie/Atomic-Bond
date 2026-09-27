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
  visibleOwnerPulses,
} from "../../services/auth/actions";
import "./auth.css";
import { createNetworkReconciler } from "../../services/pulses/network-reconciliation";
import { usePulseClock } from "../pulse/use-pulse-clock";
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
    [invite, setInvite] = useState<DisplayInvitation | null>(null),
    [error, setError] = useState("");
  const now = usePulseClock(pulses);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [status, setStatus] = useState<
    "ready" | "refreshing" | "unavailable" | "offline"
  >("ready");
  const pendingUntil = useRef(0);
  const localPulse = useRef<EmotionalPulse | null>(null);
  useEffect(() => {
    let cancelled = false;
    let generation = 0;
    const reconciler = createNetworkReconciler({
      clock: Date.now,
      visible: () => document.visibilityState === "visible" && navigator.onLine,
      invitationPending: () => pendingUntil.current > Date.now(),
      refresh: async (topology) => {
        const requestGeneration = generation;
        const beforeSend = localPulse.current;
        setStatus("refreshing");
        try {
          const result = topology
            ? await refreshOwnerNetwork()
            : { graph: null, pulses: await visibleOwnerPulses() };
          if (cancelled || requestGeneration !== generation) return;
          if (result.graph) {
            const updated = result.graph;
            const oldEdges = new Set(graphRef.current.edges.map((e) => e.id));
            const added = updated.edges.find(
              (e) =>
                !oldEdges.has(e.id) &&
                (e.source === publicId || e.target === publicId),
            );
            if (added) {
              setArrival(
                added.source === publicId ? added.target : added.source,
              );
              setNotice("BOND CREATED");
              setInvite(null);
              pendingUntil.current = 0;
            }
            if (JSON.stringify(graphRef.current) !== JSON.stringify(updated)) {
              graphRef.current = updated;
              setGraph(updated);
            }
          }
          // A response begun before a local send must not overwrite that send.
          const own = localPulse.current;
          const next =
            own && own !== beforeSend
              ? [...result.pulses.filter((p) => p.atomId !== publicId), own]
              : result.pulses;
          setPulses((previous) =>
            JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
          );
          setUpdatedAt(Date.now());
          setStatus("ready");
        } catch {
          if (!cancelled && requestGeneration === generation) {
            setPulses([]);
            setStatus(navigator.onLine ? "unavailable" : "offline");
          }
        }
      },
    });
    const resume = () => {
      void reconciler.tick(true);
    };
    const offline = () => {
      generation++;
      setPulses([]);
      setStatus("offline");
    };
    const initial = setTimeout(resume, 0);
    const poll = setInterval(() => {
      void reconciler.tick();
    }, 5_000);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", resume);
    return () => {
      cancelled = true;
      reconciler.dispose();
      clearTimeout(initial);
      clearInterval(poll);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [publicId]);
  async function send(emotion: Emotion) {
    const pulse = await sendOwnerPulse(emotion);
    setPulses((p) => [...p.filter((x) => x.atomId !== publicId), pulse]);
    localPulse.current = pulse;
    setUpdatedAt(Date.now());
  }
  return (
    <>
      <LivingAtom
        graph={graph}
        originalAtomId={publicId}
        synthetic={false}
        creatingBond={creating}
        arrivalId={arrival}
        emotional={{ pulses, now, send, updatedAt, status }}
        onCreateBond={() => {
          if (creatingRef.current) return;
          creatingRef.current = true;
          setCreating(true);
          setError("");
          void createOwnerInvitation()
            .then((value) => {
              pendingUntil.current = Date.parse(value.expiresAt);
              setInvite(value);
            })
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
