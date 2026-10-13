"use client";
/* eslint-disable @next/next/no-img-element -- private no-store media must bypass image optimization */
import { useCallback, useEffect, useRef, useState } from "react";
import "./puzzle-player.css";

export type PuzzleSnapshot = {
  id: string;
  revision: number;
  endsAt: string;
  status: string;
  board: { id: string; position: number; locked: boolean }[];
  reservation: null | { piece: string; expiresAt: string };
};
export type PuzzleRead = {
  puzzle?: PuzzleSnapshot | null;
  status?: string;
  error?: string;
  serverTime?: string;
  nextStart?: string | null;
  firstCommunity?: boolean;
  placeAfter?: string | null;
  moveAfter?: string | null;
  revealAfter?: string | null;
};
export type PuzzleCommand = {
  operation: string;
  puzzle?: string;
  revision?: number;
  request?: string;
  piece?: string | undefined;
  to?: number | undefined;
};
export async function puzzleRequest(
  command: PuzzleCommand,
): Promise<PuzzleRead> {
  const response = await fetch("/api/puzzle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Puzzle unavailable");
  return response.json();
}
const media = (puzzle: string, piece?: string) =>
  `/api/puzzle?puzzle=${puzzle}${piece ? `&piece=${piece}` : ""}`;
const remaining = (deadline: string | null | undefined, now: number) =>
  Math.max(0, Date.parse(deadline || "") - now) || 0;
function duration(ms: number) {
  const minutes = Math.ceil(ms / 60000);
  return minutes > 1440
    ? `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`
    : minutes > 60
      ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
      : `${minutes} min`;
}

export function PuzzlePlayer({
  initial,
  transport = puzzleRequest,
  imageUrl = media,
}: {
  initial?: PuzzleRead;
  transport?: typeof puzzleRequest;
  imageUrl?: typeof media;
}) {
  const [data, setData] = useState<PuzzleRead>(initial || {});
  const [now, setNow] = useState(
    () => Date.parse(initial?.serverTime || "") || Date.now(),
  );
  const [initialClock] = useState(() => ({
    server: Date.parse(initial?.serverTime || "") || Date.now(),
    local: Date.now(),
  }));
  const clock = useRef(initialClock);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(
      "Select a board position after revealing a piece.",
    ),
    [mode, setMode] = useState<"place" | "move">("place"),
    [source, setSource] = useState<string | null>(null),
    [target, setTarget] = useState<number | null>(null);
  const inFlight = useRef(false);
  const accept = useCallback((next: PuzzleRead) => {
    if (next.error) throw new Error(next.error);
    setData(next);
    if (next.serverTime) {
      clock.current = {
        server: Date.parse(next.serverTime),
        local: Date.now(),
      };
      setNow(clock.current.server);
    }
  }, []);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      accept(await transport({ operation: "read" }));
    } catch {
      setData({});
      setMessage(
        "Puzzle unavailable. Please refresh or securely access your Atom again.",
      );
    } finally {
      inFlight.current = false;
    }
  }, [accept, transport]);
  useEffect(() => {
    const firstRead = setTimeout(() => {
      if (!initial) void refresh();
    }, 0);
    const tick = setInterval(
      () => setNow(clock.current.server + Date.now() - clock.current.local),
      1000,
    );
    const poll = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30000);
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearTimeout(firstRead);
      clearInterval(tick);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [initial, refresh]);
  const puzzle = data.puzzle;
  const ended = Boolean(
    puzzle &&
    (puzzle.status !== "ACTIVE" || remaining(puzzle.endsAt, now) === 0),
  );
  const reservation =
    puzzle?.reservation && remaining(puzzle.reservation.expiresAt, now) > 0
      ? puzzle.reservation
      : null;
  const destination = puzzle?.board.find((p) => p.position === target);
  const moving = puzzle?.board.find((p) => p.id === source);
  async function act(operation: string) {
    if (!puzzle || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const result = await transport({
        operation,
        puzzle: puzzle.id,
        revision: puzzle.revision,
        request: crypto.randomUUID(),
        ...(operation === "place"
          ? { piece: reservation?.piece, to: target ?? undefined }
          : operation === "move"
            ? { piece: source || undefined, to: target ?? undefined }
            : {}),
      });
      if (result.error)
        setMessage(
          result.error === "STALE_BOARD"
            ? "The board changed. Review the refreshed board and try again."
            : "That action is not currently available. Review the refreshed board and allowances.",
        );
      else {
        setMessage(
          operation === "cancel"
            ? "Reservation cancelled. A five-minute reveal cooldown applies."
            : "Board updated.",
        );
        setSource(null);
        setTarget(null);
      }
      accept(await transport({ operation: "read" }));
    } catch {
      setData({});
      setMessage("Could not confirm the action. Refresh before trying again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="puzzle-player">
      <header>
        <p>ATOMIC BOND</p>
        <h1>PARTICI-PUZZLE</h1>
        <p>Many people. One big picture.</p>
      </header>
      <p role="status">{puzzle ? message : ""}</p>
      {!puzzle ? (
        <section>
          <h2>
            {data.firstCommunity && data.nextStart
              ? `OUR FIRST COMMUNITY PUZZLE BEGINS ${new Date(data.nextStart).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).toUpperCase()}`
              : data.status === "WAITING"
                ? "THE NEXT PICTURE IS ON ITS WAY"
                : "YOUR SHARED PUZZLE"}
          </h2>
          <p>
            {data.status === "WAITING"
              ? "Return when the next weekly puzzle begins."
              : "Use refresh to check availability."}
          </p>
          {data.nextStart && (
            <p aria-label="Time until scheduled puzzle">
              {remaining(data.nextStart, now) > 0
                ? `BEGINS IN ${duration(remaining(data.nextStart, now))}`
                : "Checking scheduled availability…"}
              <br />
              <time dateTime={data.nextStart}>
                {new Date(data.nextStart).toLocaleString("en-US", {
                  timeZone: "UTC",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}{" "}
                UTC
              </time>
            </p>
          )}
        </section>
      ) : (
        <>
          <div className="puzzle-metrics">
            <p>
              GLOBAL PROGRESS{" "}
              <strong>
                {puzzle.board.filter((p) => p.locked).length} / 25 locked
              </strong>
            </p>
            <p>
              WEEKLY TIME{" "}
              <strong>
                {ended
                  ? puzzle.status === "COMPLETE"
                    ? "COMPLETE"
                    : "WINDOW CLOSED"
                  : duration(remaining(puzzle.endsAt, now))}
              </strong>
            </p>
          </div>
          <div
            className="puzzle-board"
            role="group"
            aria-label="Shared puzzle board"
          >
            {Array.from({ length: 25 }, (_, position) => {
              const piece = puzzle.board.find((p) => p.position === position);
              return (
                <button
                  key={position}
                  disabled={busy || ended || piece?.locked}
                  aria-label={`Position ${position + 1}, ${piece?.locked ? "correct and locked" : piece ? "movable piece" : "empty"}`}
                  aria-pressed={target === position || source === piece?.id}
                  onClick={() => {
                    if (mode === "move" && !source && piece) {
                      setSource(piece.id);
                      setTarget(null);
                    } else setTarget(position);
                  }}
                >
                  {piece ? (
                    <img
                      alt=""
                      src={imageUrl(puzzle.id, piece.id)}
                      width={100}
                      height={100}
                    />
                  ) : (
                    <span>{position + 1}</span>
                  )}
                  {piece?.locked && (
                    <span className="puzzle-lock" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {ended ? (
            <section>
              <h2>
                {puzzle.status === "COMPLETE"
                  ? "ONE COMPLETE PICTURE"
                  : "THIS WEEK’S PICTURE"}
              </h2>
              <img
                className="puzzle-complete"
                alt="Completed weekly puzzle artwork"
                src={imageUrl(puzzle.id)}
                width={500}
                height={500}
              />
            </section>
          ) : (
            <>
              <div className="puzzle-metrics">
                <p>
                  PLACE{" "}
                  <strong>
                    {remaining(data.placeAfter, now)
                      ? duration(remaining(data.placeAfter, now))
                      : "READY"}
                  </strong>
                </p>
                <p>
                  MOVE{" "}
                  <strong>
                    {remaining(data.moveAfter, now)
                      ? duration(remaining(data.moveAfter, now))
                      : "READY"}
                  </strong>
                </p>
              </div>
              <div className="puzzle-actions">
                <button
                  aria-pressed={mode === "place"}
                  onClick={() => {
                    setMode("place");
                    setSource(null);
                    setTarget(null);
                  }}
                >
                  PLACE MY PIECE
                </button>
                <button
                  aria-pressed={mode === "move"}
                  onClick={() => {
                    setMode("move");
                    setSource(null);
                    setTarget(null);
                  }}
                >
                  MOVE A PIECE
                </button>
              </div>
              {mode === "place" ? (
                <section aria-label="Place a piece">
                  {reservation ? (
                    <>
                      <img
                        alt="Your reserved piece"
                        src={imageUrl(puzzle.id, reservation.piece)}
                        width={100}
                        height={100}
                      />
                      <p>
                        Reserved for{" "}
                        {duration(remaining(reservation.expiresAt, now))}.
                        Choose an empty position.
                      </p>
                      <button
                        disabled={
                          busy ||
                          target === null ||
                          Boolean(destination) ||
                          remaining(data.placeAfter, now) > 0
                        }
                        onClick={() => void act("place")}
                      >
                        CONFIRM PLACEMENT
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => void act("cancel")}
                      >
                        CANCEL RESERVATION
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        disabled={
                          busy ||
                          remaining(data.placeAfter, now) > 0 ||
                          remaining(data.revealAfter, now) > 0
                        }
                        onClick={() => void act("reveal")}
                      >
                        REVEAL MY PIECE
                      </button>
                      {remaining(data.revealAfter, now) > 0 && (
                        <p>
                          Reveal available in{" "}
                          {duration(remaining(data.revealAfter, now))}.
                        </p>
                      )}
                    </>
                  )}
                </section>
              ) : (
                <section aria-label="Move a piece">
                  <p>
                    {source
                      ? "Choose another position. An unlocked piece there will swap with yours."
                      : "Select an unlocked board piece, then its destination."}
                  </p>
                  <button
                    disabled={
                      busy ||
                      !moving ||
                      moving.locked ||
                      target === null ||
                      target === moving.position ||
                      Boolean(destination?.locked) ||
                      remaining(data.moveAfter, now) > 0
                    }
                    onClick={() => void act("move")}
                  >
                    {destination ? "CONFIRM SWAP" : "CONFIRM MOVE"}
                  </button>
                  <button
                    onClick={() => {
                      setSource(null);
                      setTarget(null);
                    }}
                  >
                    CLEAR SELECTION
                  </button>
                </section>
              )}
            </>
          )}
        </>
      )}
      <button disabled={busy} onClick={() => void refresh()}>
        REFRESH BOARD
      </button>
      <p className="puzzle-help">
        Correct pieces lock permanently. PLACE and MOVE each have an independent
        rolling 60-minute allowance, including across weekly puzzles.
        Reservations last five minutes.
      </p>
    </main>
  );
}
