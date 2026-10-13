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
                { id: piece(7), position: 1, locked: false },
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
          Interactive local fixtures only. No production requests, game changes
          or schedule.
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
      <InteractiveReview
        key={`${scene}-${version}`}
        initial={initial}
        imageUrl={imageUrl}
      />
    </>
  );
}

function InteractiveReview({
  initial,
  imageUrl,
}: {
  initial: PuzzleRead;
  imageUrl: (id: string, piece?: string) => string;
}) {
  const [transport] = useState(() => {
    let state = structuredClone(initial);
    return async (command: PuzzleCommand): Promise<PuzzleRead> => {
      const p = state.puzzle!;
      const now = Date.now();
      if (p.reservation && Date.parse(p.reservation.expiresAt) <= now) {
        state.revealAfter = new Date(
          Date.parse(p.reservation.expiresAt) + 300000,
        ).toISOString();
        p.reservation = null;
      }
      if (command.operation !== "read") {
        if (command.revision !== p.revision) return { error: "STALE_BOARD" };
        if (command.operation === "reveal") {
          if (p.reservation) return { error: "ALREADY_RESERVED" };
          if (
            Date.parse(state.placeAfter || "") > now ||
            Date.parse(state.revealAfter || "") > now
          )
            return { error: "COOLDOWN" };
          const available = [
            12,
            ...Array.from({ length: 25 }, (_, n) => n),
          ].find((n) => !p.board.some((b) => b.id === piece(n)));
          if (available === undefined) return { error: "NO_AVAILABLE_PIECE" };
          p.reservation = {
            piece: piece(available),
            expiresAt: new Date(now + 300000).toISOString(),
          };
        } else if (command.operation === "place") {
          if (
            !p.reservation ||
            p.reservation.piece !== command.piece ||
            command.to === undefined ||
            p.board.some((b) => b.position === command.to)
          )
            return { error: "INVALID_DESTINATION" };
          p.board.push({
            id: command.piece,
            position: command.to,
            locked: Number(command.piece.slice(-12)) === command.to,
          });
          p.reservation = null;
          state.placeAfter = new Date(now + 3600000).toISOString();
        } else if (command.operation === "move") {
          const source = p.board.find((b) => b.id === command.piece),
            dest = p.board.find((b) => b.position === command.to);
          if (
            !source ||
            source.locked ||
            dest?.locked ||
            command.to === undefined
          )
            return { error: "INVALID_MOVE" };
          if (dest) {
            dest.position = source.position;
            dest.locked = Number(dest.id.slice(-12)) === dest.position;
          }
          source.position = command.to;
          source.locked = Number(source.id.slice(-12)) === source.position;
          state.moveAfter = new Date(now + 3600000).toISOString();
        }
        p.revision++;
      }
      state = { ...state, serverTime: new Date(now).toISOString() };
      return structuredClone(state);
    };
  });
  return (
    <PuzzlePlayer initial={initial} transport={transport} imageUrl={imageUrl} />
  );
}
