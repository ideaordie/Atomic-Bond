"use client";
import { useMemo, useRef, useState } from "react";
import {
  PuzzleQueueStudio,
  type QueueTransport,
} from "../../../../components/puzzle/PuzzleQueueStudio";
import {
  PuzzlePlayer,
  type PuzzleRead,
} from "../../../../components/puzzle/PuzzlePlayer";
import type { QueueInventory } from "../../../../services/puzzle/queue";
import { ARTWORK } from "../../../../prototypes/puzzle/artwork";
import { selectAppearance } from "../../../../components/appearance/appearance";
const id = (n: number) =>
  `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
function seed(): QueueInventory {
  return {
    now: "2026-10-14T12:00:00Z",
    settings: { enabled: true, paused: false, revision: 0 },
    gates: { public: false, controlled: false },
    cleanup: {
      lastSuccess: "2026-10-14T12:00:00Z",
      lastFailure: null,
      ok: true,
      counts: {},
    },
    current: {
      id: id(1),
      batch: id(11),
      state: "ACTIVE",
      completedAt: null,
      celebrationEndsAt: null,
      placed: 23,
      locked: 23,
    },
    queue: [
      { id: id(2), batch: id(12), ready: true, order: 1 },
      { id: id(3), batch: id(13), ready: true, order: 2 },
    ],
    total: 1,
    batches: [{ id: id(14), ready: true, expiresAt: "2026-10-15T12:00:00Z" }],
    history: [],
  };
}
export function QueueReview() {
  const state = useRef(seed()),
    [version, setVersion] = useState(0),
    [snapshot, setSnapshot] = useState(seed),
    [player, setPlayer] = useState(false);
  function advance() {
    const s = state.current;
    if (
      s.current?.celebrationEndsAt &&
      Date.parse(s.now) >= Date.parse(s.current.celebrationEndsAt)
    )
      s.current = null;
    if (!s.current && !s.settings.paused && s.queue.length) {
      const q = s.queue.shift()!;
      s.current = {
        id: q.id,
        batch: q.batch,
        state: "ACTIVE",
        completedAt: null,
        celebrationEndsAt: null,
        placed: 0,
        locked: 0,
      };
    }
    s.settings.revision++;
  }
  const transport = useMemo<QueueTransport>(
    () => ({
      read: async () => structuredClone(state.current),
      image: () => ARTWORK,
      cleanup: async () => ({ ok: true }),
      upload: async () => {
        const batch = crypto.randomUUID();
        state.current.batches.unshift({
          id: batch,
          ready: true,
          expiresAt: new Date(
            Date.parse(state.current.now) + 86400000,
          ).toISOString(),
        });
        state.current.total++;
        return batch;
      },
      change: async (c) => {
        const s = state.current;
        if (c.revision !== s.settings.revision) return { ok: false };
        if (c.action === "pause") s.settings.paused = true;
        if (c.action === "resume") s.settings.paused = false;
        if (c.action === "add") {
          s.queue.push({
            id: crypto.randomUUID(),
            batch: c.batch!,
            ready: true,
            order: s.queue.length + 1,
          });
          s.batches = s.batches.filter((b) => b.id !== c.batch);
          s.total = s.batches.length;
        }
        if (c.action === "reorder")
          s.queue = c.order!.map((x, i) => ({
            ...s.queue.find((q) => q.id === x)!,
            order: i + 1,
          }));
        if (c.action === "remove")
          s.queue = s.queue.filter((q) => q.id !== c.puzzle);
        if (c.action === "retire") s.current = null;
        s.history.unshift({
          puzzle: c.puzzle ?? null,
          action: c.action.toUpperCase(),
          reason: c.reason ?? null,
          at: s.now,
        });
        advance();
        return { ok: true };
      },
    }),
    [],
  );
  const current = snapshot.current;
  const initial: PuzzleRead = {
    status: current ? current.state : "WAITING",
    serverTime: snapshot.now,
    puzzle: current
      ? {
          id: current.id,
          revision: snapshot.settings.revision,
          endsAt: null,
          completedAt: current.completedAt,
          celebrationEndsAt: current.celebrationEndsAt,
          status: current.state,
          reservation: null,
          board: Array.from({ length: current.locked }, (_, i) => ({
            id: id(i + 100),
            position: i,
            locked: true,
          })),
        }
      : null,
  };
  return (
    <>
      <aside className="puzzle-player">
        <h1>LOCAL QUEUE REVIEW</h1>
        <p>
          Synthetic records only. Time and completion controls below do not
          contact production. Upload simulation uses the same sample artwork;
          PostgreSQL integration tests verify real validation and transitions.
        </p>
        <div className="studio-buttons">
          <button onClick={() => selectAppearance("light")}>LIGHT</button>
          <button onClick={() => selectAppearance("dark")}>DARK</button>
          <button
            onClick={() => {
              setPlayer(!player);
              setSnapshot(structuredClone(state.current));
              setVersion((v) => v + 1);
            }}
          >
            {player ? "SHOW STUDIO" : "SHOW PLAYER"}
          </button>
          <button
            onClick={() => {
              const s = state.current;
              if (s.current) {
                s.current.state = "CELEBRATING";
                s.current.locked = 25;
                s.current.placed = 25;
                s.current.completedAt = s.now;
                s.current.celebrationEndsAt = new Date(
                  Date.parse(s.now) + 3600000,
                ).toISOString();
              }
              setSnapshot(structuredClone(state.current));
              setVersion((v) => v + 1);
            }}
          >
            COMPLETE SYNTHETIC PUZZLE
          </button>
          <button
            onClick={() => {
              state.current.now = new Date(
                Date.parse(state.current.now) + 3600000,
              ).toISOString();
              advance();
              setSnapshot(structuredClone(state.current));
              setVersion((v) => v + 1);
            }}
          >
            ADVANCE ONE HOUR
          </button>
          <button
            onClick={() => {
              state.current = seed();
              setSnapshot(structuredClone(state.current));
              setVersion((v) => v + 1);
            }}
          >
            RESET LOCAL PREVIEW
          </button>
        </div>
      </aside>
      {player ? (
        <PuzzlePlayer
          key={version}
          initial={initial}
          imageUrl={() => ARTWORK}
          transport={async () => initial}
        />
      ) : (
        <PuzzleQueueStudio
          key={version}
          initial={snapshot}
          transport={transport}
        />
      )}
    </>
  );
}
