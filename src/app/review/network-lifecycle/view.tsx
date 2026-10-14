"use client";
import { useMemo, useState } from "react";
import { HomeRegionEditor } from "../../../components/auth/HomeRegionEditor";
import { AppearancePreference } from "../../../components/appearance/AppearancePreference";
import { LivingAtom } from "../../../living-atom/LivingAtom";
import { activeNetwork } from "../../../graph/active-network";
import { connectedComponent } from "../../../living-atom/geography/layout";
import {
  COUNTRIES,
  canonicalRegion,
} from "../../../services/locations/canonical-regions";
import type { GraphNode } from "../../../types/graph";
import "../../../components/auth/auth.css";

export function NetworkLifecycleReview() {
  const [state, setState] = useState<GraphNode["status"]>("ACTIVE");
  const [place, setPlace] = useState(canonicalRegion("US", "US-FL")!);
  const graph = useMemo(
    () =>
      connectedComponent(
        activeNetwork({
          nodes: [1, 2, 3, 4, 5].map((id) => ({
            id: String(id),
            publicId: String(id),
            degree: 0,
            status: id === 2 ? (state ?? "ACTIVE") : "ACTIVE",
            metadata:
              id === 1
                ? {
                    countryCode: place.countryCode,
                    region: place.subdivisionName ?? "",
                    homeRegion: place.displayName,
                    subdivisionCode: place.subdivisionCode ?? "",
                  }
                : {
                    countryCode: "GB",
                    region: "England",
                    subdivisionCode: "GB-ENG",
                  },
          })),
          edges: [
            [1, 2],
            [2, 3],
            [3, 4],
            [4, 5],
          ].map(([a, b]) => ({
            id: `${a}:${b}`,
            source: String(a),
            target: String(b),
          })),
        }),
        "1",
      ),
    [state, place],
  );
  return (
    <main>
      <section className="auth-panel">
        <h1>HOME REGION & ACTIVE NETWORK</h1>
        <p>
          Local synthetic preview. No production account or Bond is changed.
        </p>
        <AppearancePreference />
        <HomeRegionEditor
          current={place.displayName}
          save={async (form) => {
            const id = form.get("locationId");
            for (const country of COUNTRIES)
              for (const sub of country.subdivisions.length
                ? country.subdivisions
                : [{ code: "" }]) {
                const selected = canonicalRegion(country.code, sub.code);
                if (selected?.id === id) {
                  setPlace(selected);
                  return { saved: true };
                }
              }
            return { error: "Select a canonical country and region." };
          }}
        />
        <label htmlFor="bridge-state">Synthetic bridge Atom #2</label>
        <select
          id="bridge-state"
          value={state}
          onChange={(e) => setState(e.target.value as GraphNode["status"])}
        >
          <option>ACTIVE</option>
          <option>DEACTIVATED</option>
          <option>DORMANT</option>
          <option>DELETED</option>
        </select>
        <p role="status">
          {graph.nodes.length} ACTIVE Atoms · {graph.edges.length} visible
          Bonds. All four Bond records remain stored in this fixture.
        </p>
      </section>
      <LivingAtom
        graph={graph}
        originalAtomId="1"
        authorizeMap={async () => ({ ownerId: "1", graph })}
      />
    </main>
  );
}
