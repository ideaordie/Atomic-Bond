"use client";
import { useCallback, useState } from "react";
import { selectAppearance } from "../../components/appearance/appearance";
import { DoodleComposer } from "./DoodleComposer";
import { DoodleEditor, type Drawing } from "./model";
import { DoodleBitmap } from "../../components/doodle/DoodleBitmap";
import { DoodleFeedPanel } from "../../components/doodle/DoodleFeedPanel";
import { ReplayReview } from "./DoodleProductionReview";
import type { DoodleRequest } from "../../services/doodle/client";
import "./doodle.css";
function sample(version: 1 | 2) {
  const editor = new DoodleEditor(version);
  for (let color = 1; color <= 8; color++)
    for (let row = 16; row < 48; row++) {
      editor.begin(row * 64 + color * 6 - 3, true, color);
      editor.move(row * 64 + color * 6 + 1);
      editor.finish();
    }
  return editor.export();
}
const legacy = sample(1),
  colored = sample(2);
export function ColorReview() {
  const [drawing, setDrawing] = useState<Drawing>(colored);
  const [sent, setSent] = useState(false);
  const request = useCallback<DoodleRequest>(
    async <T,>(action: string) => {
      if (!["read", "readNetwork"].includes(action))
        throw new Error("Read-only synthetic feed");
      const now = Date.now();
      const items = [drawing, legacy].map((d, i) => ({
        id: `synthetic-${i}`,
        version: d.version,
        bitmap: d.bitmap,
        atomNumber: String(i + 1),
        publishedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 604800000).toISOString(),
        score: 0,
        own: true,
        appreciated: false,
      }));
      return {
        serverTime: new Date(now).toISOString(),
        submissionsPaused: false,
        items,
        hall: items,
        refreshed: [],
        nextCursor: null,
        nextEligibleAt: null,
      } as T;
    },
    [drawing],
  );
  return (
    <main className="doodle-page">
      <h1>GLOBAL DOODLE COLOR REVIEW</h1>
      <p>Local synthetic data only. No publication or database requests.</p>
      <button onClick={() => selectAppearance("light")}>LIGHT</button>
      <button onClick={() => selectAppearance("dark")}>DARK</button>
      <DoodleComposer
        colorEnabled
        simplified
        busy={false}
        onSubmit={async (d) => {
          setDrawing(d);
          setSent(true);
          return true;
        }}
      />
      {sent && <p role="status">Local drawing submitted. Preview updated.</p>}
      <h2>LEGACY MONOCHROME</h2>
      <DoodleBitmap bitmap={legacy.bitmap} label="Legacy monochrome drawing" />
      <h2>MIXED FEEDS</h2>
      <DoodleFeedPanel request={request} createHref="#" />
      <h2>ADMINISTRATOR REPLAY</h2>
      <ReplayReview key={drawing.bitmap} drawing={drawing} />
    </main>
  );
}
