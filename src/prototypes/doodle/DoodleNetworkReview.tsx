"use client";
import { DoodleFeedPanel } from "../../components/doodle/DoodleFeedPanel";
import { DoodlePublishing } from "../../components/doodle/DoodlePublishing";
import { ApplicationNavigation } from "../../components/navigation/ApplicationNavigation";
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
  feed,
}: {
  graph: GraphData;
  draw: boolean;
  feed: boolean;
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
          flexWrap: "wrap",
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
      <ApplicationNavigation
        owner
        doodle
        current={feed || draw ? "/global-doodle" : "/explore"}
        hrefs={{
          "/explore": "/review/doodle/network",
          "/global-doodle": "/review/doodle/network?feed=1",
        }}
      />
      {draw ? (
        <DoodlePublishing
          request={request}
          returnHref="/review/doodle/network"
        />
      ) : feed ? (
        <main className="standalone-doodle">
          <DoodleFeedPanel
            request={request}
            createHref="/review/doodle/network?draw=1"
          />
        </main>
      ) : (
        <main className="explore-page">
          <ParticipationExperience
            graph={graph}
            originalAtomId={graph.nodes[0]!.id}
          />
        </main>
      )}
    </>
  );
}
