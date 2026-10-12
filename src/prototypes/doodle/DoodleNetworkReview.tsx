"use client";
import { DoodleFeedPanel } from "../../components/doodle/DoodleFeedPanel";
import { DoodlePublishing } from "../../components/doodle/DoodlePublishing";
import { ParticipationExperience } from "../../components/participation/ParticipationExperience";
import {
  selectAppearance,
  useAppearance,
} from "../../components/appearance/appearance";
import type { DoodleRequest } from "../../services/doodle/client";
import type { GraphData } from "../../types/graph";
import "../../app/explore/explore.css";
import "../../components/participation/participation.css";
const request: DoodleRequest = async (action, args = [], signal) => {
  const r = await fetch("/api/review/doodle-network", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actor: 1, action, args }),
    signal: signal ?? null,
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error);
  return result.data;
};
export function DoodleNetworkReview({
  graph,
  draw,
}: {
  graph: GraphData;
  draw: boolean;
}) {
  const theme = useAppearance();
  return (
    <>
      <div
        style={{
          position: "relative",
          zIndex: 20,
          display: "flex",
          gap: 12,
          padding: 8,
        }}
      >
        <span>LOCAL SYNTHETIC REVIEW · NO PRODUCTION DATA</span>
        <button
          onClick={() => selectAppearance(theme === "dark" ? "light" : "dark")}
        >
          SWITCH THEME
        </button>
        <button
          onClick={async () => {
            await request("advance", [60]);
            location.reload();
          }}
        >
          ADVANCE 60 MINUTES
        </button>
      </div>
      {draw ? (
        <DoodlePublishing
          request={request}
          returnHref="/review/doodle/network"
        />
      ) : (
        <main className="explore-page">
          <div className="owner-doodle-layout">
            <ParticipationExperience
              graph={graph}
              originalAtomId={graph.nodes[0]!.id}
            />
            <DoodleFeedPanel
              request={request}
              createHref="/review/doodle/network?draw=1"
            />
          </div>
        </main>
      )}
    </>
  );
}
