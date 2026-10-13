"use client";
/* eslint-disable @next/next/no-img-element -- development-only private artwork review */
import { useState } from "react";
import { ApplicationNavigation } from "../../../../components/navigation/ApplicationNavigation";
import {
  PuzzlePlayer,
  type PuzzleRead,
  type PuzzleCommand,
} from "../../../../components/puzzle/PuzzlePlayer";
import { selectAppearance } from "../../../../components/appearance/appearance";
const id = "11111111-1111-4111-8111-111111111111";
const piece = (n: number) =>
  `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;
export function PlayerReview({ images }: { images: string[] }) {
  const [scene, setScene] = useState("Hidden board");
  const [version, setVersion] = useState(0);
  const [now] = useState(() => Date.now());
  const initial: PuzzleRead = {
    serverTime: new Date(now).toISOString(),
    puzzle: {
      id,
      revision: 1,
      endsAt: new Date(now + 7 * 86400000).toISOString(),
      status: scene === "Completed" ? "COMPLETE" : "ACTIVE",
      board:
        scene === "Completed"
          ? Array.from({ length: 25 }, (_, n) => ({
              id: piece(n),
              position: n,
              locked: true,
            }))
          : scene === "Placements"
            ? [
                { id: piece(0), position: 0, locked: true },
                { id: piece(1), position: 7, locked: false },
              ]
            : [],
      reservation:
        scene === "Revealed piece"
          ? {
              piece: piece(12),
              expiresAt: new Date(now + 300000).toISOString(),
            }
          : null,
    },
  };
  const imageUrl = (_: string, p?: string) =>
    p ? images[Number(p.slice(-12)) + 1]! : images[0]!;
  return (
    <>
      <ApplicationNavigation owner doodle puzzle current="/partici-puzzle" />
      <aside className="puzzle-player">
        <h2>PRIVATE LOCAL ARTWORK REVIEW</h2>
        <p>
          Presentation fixtures only. No production requests, game changes or
          schedule.
        </p>
        {["Hidden board", "Revealed piece", "Placements", "Completed"].map(
          (s) => (
            <button
              key={s}
              onClick={() => {
                setScene(s);
                setVersion((v) => v + 1);
              }}
            >
              {s}
            </button>
          ),
        )}
        <button onClick={() => selectAppearance("light")}>LIGHT</button>
        <button onClick={() => selectAppearance("dark")}>DARK</button>
        <details>
          <summary>CONNECTED LANDSCAPE — full artwork and 25 tiles</summary>
          <img
            alt="Connected Landscape original artwork"
            src={images[0]}
            width={500}
            height={500}
            style={{ width: "100%", height: "auto" }}
          />
          <div className="puzzle-board">
            {images.slice(1).map((src, n) => (
              <img
                key={n}
                src={src}
                alt={`Artwork tile ${n + 1}`}
                width={100}
                height={100}
              />
            ))}
          </div>
        </details>
      </aside>
      <PuzzlePlayer
        key={`${scene}-${version}`}
        initial={initial}
        imageUrl={imageUrl}
        transport={async (command: PuzzleCommand) => {
          if (command.operation !== "read") return { error: "REVIEW_ONLY" };
          return initial;
        }}
      />
    </>
  );
}
