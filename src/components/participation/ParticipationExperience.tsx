"use client";

import { useState } from "react";
import type { GraphData } from "../../types/graph";
import type {
  BondResult,
  Invitation,
} from "../../services/participation/contracts";
import { createMockParticipation } from "../../services/participation/mock-services";
import { LivingAtom } from "../../living-atom/LivingAtom";
import { BondFlow } from "./BondFlow";
import "./participation.css";
import { MockPulseService } from "../../services/pulses/pulse-service";
import { mockEmotionalPulses } from "../../data/mock/emotional-pulses";
import { useEmotionalPulses } from "../pulse/use-emotional-pulses";

export function ParticipationExperience({
  graph: initialGraph,
  originalAtomId,
}: {
  graph: GraphData;
  originalAtomId: string;
}) {
  const [services] = useState(() => createMockParticipation(initialGraph));
  const [graph, setGraph] = useState(initialGraph);
  const [pulseService] = useState(
    () =>
      new MockPulseService(
        originalAtomId,
        mockEmotionalPulses(initialGraph, Date.now()),
      ),
  );
  const emotional = useEmotionalPulses(pulseService, graph, originalAtomId);
  const [invite, setInvite] = useState<Invitation | null>(null);
  const [arrival, setArrival] = useState<string | null>(null);
  const [latest, setLatest] = useState<BondResult | null>(null);
  const finish = (result: BondResult) => {
    setGraph(result.graph);
    setArrival(result.recipient.id);
    setLatest(result);
    setInvite(null);
  };
  return (
    <>
      <LivingAtom
        emotional={emotional}
        graph={graph}
        originalAtomId={originalAtomId}
        arrivalId={arrival}
        onCreateBond={() => {
          setLatest(null);
          setInvite(services.bonds.createInvitation(originalAtomId));
        }}
      />
      {latest && (
        <p className="sr-only" role="status">
          Bond created · {latest.after.direct} direct Bonds ·{" "}
          {latest.after.regions.length} regions ·{" "}
          {latest.after.countries.length} countries
        </p>
      )}
      {invite && (
        <BondFlow
          key={invite.code}
          services={services}
          initial={invite}
          onClose={() => setInvite(null)}
          onComplete={finish}
        />
      )}
    </>
  );
}
