"use client";
import { useState } from "react";
import {
  scheduleControlledPuzzle,
  checkControlledStorage,
  checkControlledCleanup,
} from "./actions";
type Board = {
  id: string;
  revision: number;
  status: string;
  board: { id: string; position: number; locked: boolean }[];
  reservation: null | { piece: string; expiresAt: string };
};
export function HostedPuzzle({ admin }: { admin: boolean }) {
  const [puzzle, setPuzzle] = useState<Board | null>(null),
    [message, setMessage] = useState(
      "Controlled acceptance only. Public participation is disabled.",
    ),
    [busy, setBusy] = useState(false),
    [batch, setBatch] = useState(""),
    [scheduledStart, setScheduledStart] = useState(""),
    [selected, setSelected] = useState(""),
    [probeName, setProbeName] = useState(""),
    [probeBucket, setProbeBucket] = useState("puzzle-tiles"),
    [position, setPosition] = useState(0);
  async function request(operation: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/puzzle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation,
          puzzle: puzzle?.id,
          revision: puzzle?.revision,
          request: crypto.randomUUID(),
          piece:
            operation === "place"
              ? puzzle?.reservation?.piece
              : selected || undefined,
          to: position,
        }),
        cache: "no-store",
      });
      const data = await r.json();
      if (data.puzzle) setPuzzle(data.puzzle);
      setMessage(data.error || data.status || "Operation accepted.");
    } catch {
      setMessage("Operation unavailable.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main style={{ maxWidth: 700, margin: "2rem auto", padding: "1rem" }}>
      <h1>PARTICI-PUZZLE — CONTROLLED ACCEPTANCE</h1>
      <p role="status">{message}</p>
      {admin ? (
        <section>
          <h2>Administrator preparation</h2>
          <p>Use only a disposable, authorized JPEG or PNG, at most 3 MB.</p>
          <label>
            Test image{" "}
            <input
              type="file"
              accept="image/png,image/jpeg"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy(true);
                try {
                  const r = await fetch("/api/puzzle", {
                    method: "POST",
                    headers: { "Content-Type": "application/octet-stream" },
                    body: file,
                    cache: "no-store",
                  });
                  const result = await r.json();
                  if (!r.ok || !result.batch) throw Error();
                  setBatch(result.batch);
                  setMessage("Prepared private batch READY.");
                } catch {
                  setMessage("Preparation unavailable.");
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
          <button
            disabled={busy || !batch}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await scheduleControlledPuzzle(
                  batch,
                  new Date(scheduledStart || Date.now() + 60000).toISOString(),
                );
                setMessage(
                  r.ok
                    ? "Controlled puzzle scheduled."
                    : "Schedule unavailable.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            SCHEDULE CONTROLLED PUZZLE
          </button>
          <label>
            Scheduled start (optional)
            <input
              type="datetime-local"
              value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)}
            />
          </label>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await checkControlledCleanup();
                setMessage(
                  r.ok
                    ? `Cleanup plan: ${r.eligibleObjects} eligible objects. No Storage objects deleted.`
                    : "Cleanup unavailable.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            CHECK BOUNDED CLEANUP
          </button>
        </section>
      ) : (
        <section>
          <h2>Approved test owner</h2>
          <button disabled={busy} onClick={() => request("read")}>
            REFRESH BOARD
          </button>
          <button disabled={busy || !puzzle} onClick={() => request("reveal")}>
            REVEAL MY PIECE
          </button>
          <button
            disabled={busy || !puzzle?.reservation}
            onClick={() => request("cancel")}
          >
            CANCEL RESERVATION
          </button>
          {puzzle?.reservation && (
            <p>
              Reservation expires{" "}
              {new Date(puzzle.reservation.expiresAt).toLocaleTimeString()}.
              {/* eslint-disable-next-line @next/next/no-img-element -- authenticated, non-cacheable tile route */}
              <img
                alt="Your reserved piece"
                width={100}
                height={100}
                src={`/api/puzzle?puzzle=${puzzle.id}&piece=${puzzle.reservation.piece}`}
              />
            </p>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5,minmax(0,1fr))",
              gap: 4,
            }}
          >
            {Array.from({ length: 25 }, (_, i) => {
              const piece = puzzle?.board.find((p) => p.position === i);
              return (
                <button
                  key={i}
                  aria-label={`Position ${i + 1}${piece?.locked ? ", locked" : ""}`}
                  onClick={() => {
                    setPosition(i);
                    setSelected(piece?.id || "");
                  }}
                  style={{ aspectRatio: "1", padding: 2, overflow: "hidden" }}
                >
                  {piece ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- authenticated tile route */}
                      <img
                        alt={`Piece at position ${i + 1}`}
                        src={`/api/puzzle?puzzle=${puzzle!.id}&piece=${piece.id}`}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }}
                      />
                    </>
                  ) : (
                    i + 1
                  )}
                </button>
              );
            })}
          </div>
          <label>
            Destination (1–25){" "}
            <input
              type="number"
              min={1}
              max={25}
              value={position + 1}
              onChange={(e) => setPosition(Number(e.target.value) - 1)}
            />
          </label>
          <button
            disabled={busy || !puzzle?.reservation}
            onClick={() => request("place")}
          >
            PLACE MY PIECE
          </button>
          <button disabled={busy || !selected} onClick={() => request("move")}>
            MOVE SELECTED PIECE / SWAP
          </button>
        </section>
      )}
      {!admin && (
        <section aria-label="Controlled Storage authorization check">
          <h2>Storage authorization check</h2>
          <label>
            Test bucket
            <select
              value={probeBucket}
              onChange={(e) => setProbeBucket(e.target.value)}
            >
              <option value="puzzle-tiles">puzzle-tiles</option>
              <option value="puzzle-originals">puzzle-originals</option>
            </select>
          </label>
          <label>
            Opaque test object
            <input
              value={probeName}
              onChange={(e) => setProbeName(e.target.value)}
              autoComplete="off"
            />
          </label>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await checkControlledStorage(probeBucket, probeName);
                setMessage(`Storage ${r.result}; ${r.bytes} bytes.`);
              } catch {
                setMessage("Storage UNAVAILABLE; 0 bytes.");
              } finally {
                setBusy(false);
              }
            }}
          >
            CHECK STORAGE READ
          </button>
        </section>
      )}
      <p>
        <a href="/explore">RETURN TO ATOMIC BOND</a>
      </p>
    </main>
  );
}
