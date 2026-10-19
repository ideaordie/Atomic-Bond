"use client";
import { EvolveView } from "../../../components/evolve/EvolveView";
import { ApplicationNavigation } from "../../../components/navigation/ApplicationNavigation";
export function EvolveReview() {
  return (
    <>
      <ApplicationNavigation owner doodle puzzle evolve current="/evolve" />
      <EvolveView local />
    </>
  );
}
