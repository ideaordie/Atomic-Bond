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
  if (!response.ok)
    throw new Error(
      response.status === 401 || response.status === 403
        ? "ACCESS_REQUIRED"
        : "Puzzle unavailable",
    );
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

type Selection = { source: string | null; target: number | null };
const emptySelection: Selection = { source: null, target: null };

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
  const latest = useRef(data);
  const [now, setNow] = useState(
    () => Date.parse(initial?.serverTime || "") || Date.now(),
  );
  const [initialClock] = useState(() => ({ server: now, local: Date.now() }));
  const clock = useRef(initialClock);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const stopped = useRef(false);
  const mounted = useRef(true);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [denied, setDenied] = useState(false);
  const [selection, setSelection] = useState<Selection>(emptySelection);
  const selected = useRef(selection);
  const choose = useCallback((value: Selection) => {
    selected.current = value;
    setSelection(value);
  }, []);
  const nextRead = useRef(0);
  const failures = useRef(0);
  const nextReveal = useRef(0);
  // An uncertain write keeps its request ID until its exact retry is resolved.
  const pending = useRef<PuzzleCommand | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const accept = useCallback(
    (next: PuzzleRead) => {
      if (next.error) throw new Error(next.error);
      if (!mounted.current) return;
      const old = latest.current.puzzle,
        fresh = next.puzzle;
      if (old && fresh?.id === old.id && fresh.revision < old.revision) {
        nextRead.current = Date.now() + 60000;
        return;
      }
      const current = selected.current;
      const changedSquare = (position: number) => {
        const a = old?.board.find((p) => p.position === position),
          b = fresh?.board.find((p) => p.position === position);
        return a?.id !== b?.id || a?.locked !== b?.locked;
      };
      const oldSource = old?.board.find((p) => p.id === current.source);
      const invalid =
        old?.id !== fresh?.id ||
        (current.source && (!oldSource || changedSquare(oldSource.position))) ||
        (current.target !== null && changedSquare(current.target)) ||
        (!current.source &&
          current.target !== null &&
          old?.reservation?.piece !== fresh?.reservation?.piece);
      if (invalid && (current.source || current.target !== null)) {
        choose(emptySelection);
        setMessage("The board or reservation changed. Please select again.");
      }
      latest.current = next;
      setData(next);
      if (next.serverTime) {
        clock.current = {
          server: Date.parse(next.serverTime),
          local: Date.now(),
        };
        setNow(clock.current.server);
      }
      if (failures.current) setMessage("Connection restored.");
      failures.current = 0;
      nextRead.current = Date.now() + 60000;
      setFailed(false);
    },
    [choose],
  );
  const fail = useCallback(
    (error: unknown) => {
      if (!mounted.current) return;
      if (error instanceof Error && error.message === "ACCESS_REQUIRED") {
        stopped.current = true;
        latest.current = {};
        setData({});
        setDenied(true);
        choose(emptySelection);
        setMessage("Securely access your ACTIVE Atom to continue.");
      } else {
        failures.current++;
        nextRead.current =
          Date.now() + Math.min(300000, 60000 * 2 ** (failures.current - 1));
        setFailed(true);
        setMessage(
          "Connection interrupted. Your selection is preserved; we’ll retry automatically.",
        );
      }
    },
    [choose],
  );
  const refresh = useCallback(async () => {
    if (inFlight.current || stopped.current) return;
    inFlight.current = true;
    try {
      accept(await transport({ operation: "read" }));
    } catch (error) {
      fail(error);
    } finally {
      inFlight.current = false;
    }
  }, [accept, fail, transport]);
  const act = useCallback(
    async (command: PuzzleCommand) => {
      if (inFlight.current || stopped.current) return;
      inFlight.current = true;
      setBusy(true);
      pending.current = command;
      try {
        const result = await transport(command);
        if (!mounted.current) return;
        pending.current = null;
        setUncertain(false);
        if (result.error) {
          if (result.error === "STALE_BOARD") choose(emptySelection);
          setMessage(
            result.error === "STALE_BOARD"
              ? "The board changed. Please select again."
              : result.error === "NO_AVAILABLE_PIECE"
                ? "All remaining pieces are reserved. We’ll check again shortly."
                : result.error === "ALREADY_RESERVED"
                  ? "Resuming your reserved piece."
                  : "That action is unavailable. Checking your board and allowances.",
          );
        } else if (command.operation === "reveal") {
          setMessage("");
        } else {
          choose(emptySelection);
          const locked = result.puzzle?.board.find(
            (p) => p.id === command.piece,
          )?.locked;
          setMessage(
            locked
              ? "Perfect fit! Piece locked."
              : "Piece placed. Others can help move it.",
          );
        }
        // Write receipts may be old on retry; only a fresh read advances display state.
        accept(await transport({ operation: "read" }));
      } catch (error) {
        if (mounted.current) setUncertain(Boolean(pending.current));
        fail(error);
      } finally {
        inFlight.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [accept, choose, fail, transport],
  );
  useEffect(() => {
    mounted.current = true;
    const first = setTimeout(() => {
      if (!initial && !document.hidden) void refresh();
    }, 0);
    nextRead.current = Date.now() + 60000;
    const tick = setInterval(() => {
      if (document.hidden || stopped.current) return;
      setNow(clock.current.server + Date.now() - clock.current.local);
      if (Date.now() >= nextRead.current) void refresh();
    }, 1000);
    const visible = () => {
      if (!document.hidden && Date.now() >= nextRead.current) void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      mounted.current = false;
      clearTimeout(first);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [initial, refresh]);
  const puzzle = data.puzzle;
  const ended = Boolean(
    puzzle && (puzzle.status !== "ACTIVE" || !remaining(puzzle.endsAt, now)),
  );
  const reservation =
    puzzle?.reservation && remaining(puzzle.reservation.expiresAt, now)
      ? puzzle.reservation
      : null;
  const revealDeadline = Math.max(
    Date.parse(data.revealAfter || "") || 0,
    puzzle?.reservation && !reservation
      ? Date.parse(puzzle.reservation.expiresAt) + 300000
      : 0,
  );
  const pieceWait = Math.max(
    remaining(data.placeAfter, now),
    revealDeadline - now,
    0,
  );
  useEffect(() => {
    if (
      !puzzle ||
      ended ||
      reservation ||
      pieceWait > 0 ||
      puzzle.board.length === 25 ||
      busy ||
      failed ||
      uncertain ||
      stopped.current ||
      document.hidden ||
      Date.now() < nextReveal.current
    )
      return;
    const timer = setTimeout(() => {
      if (inFlight.current || stopped.current || document.hidden) return;
      nextReveal.current = Date.now() + 60000;
      void act({
        operation: "reveal",
        puzzle: puzzle.id,
        revision: puzzle.revision,
        request: crypto.randomUUID(),
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [
    puzzle,
    ended,
    reservation,
    pieceWait,
    busy,
    failed,
    uncertain,
    now,
    act,
  ]);
  const { source, target } = selection;
  const moving = puzzle?.board.find((p) => p.id === source);
  const destination = puzzle?.board.find((p) => p.position === target);
  const canConfirm =
    !busy &&
    !failed &&
    !uncertain &&
    !ended &&
    target !== null &&
    (source
      ? moving &&
        !moving.locked &&
        target !== moving.position &&
        !destination?.locked &&
        !remaining(data.moveAfter, now)
      : reservation && !destination && !remaining(data.placeAfter, now));
  function select(position: number) {
    if (!puzzle || busy || uncertain) return;
    const piece = puzzle.board.find((p) => p.position === position);
    if (piece?.locked) {
      setMessage("This piece is correctly placed and locked.");
      return;
    }
    if (ended) return;
    setMessage("");
    if (source) {
      choose({
        source,
        target: position === moving?.position ? null : position,
      });
    } else if (piece) {
      if (remaining(data.moveAfter, now)) {
        setMessage(
          `Next move available in ${duration(remaining(data.moveAfter, now))}.`,
        );
        return;
      }
      choose({ source: piece.id, target: null });
    } else if (reservation) choose({ source: null, target: position });
  }
  return (
    <main className="puzzle-player">
      <header>
        <p>ATOMIC BOND</p>
        <h1>PARTICIPUZZLE</h1>
        <p>Many people. One big picture.</p>
      </header>
      <p role="status">{message}</p>
      {denied ? (
        <a href="/auth?mode=access">ACCESS MY ATOM</a>
      ) : !puzzle ? (
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
              : "Checking availability…"}
          </p>
          {data.nextStart && (
            <p aria-label="Time until scheduled puzzle">
              {remaining(data.nextStart, now)
                ? `BEGINS IN ${duration(remaining(data.nextStart, now))}`
                : "Checking scheduled availability…"}
              <br />
              <time dateTime={data.nextStart}>
                {new Date(data.nextStart).toLocaleString("en-US", {
                  timeZone: "UTC",
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
              GLOBAL PROGRESS
              <strong>
                {puzzle.board.filter((p) => p.locked).length} / 25 locked
              </strong>
            </p>
            <p>
              WEEKLY TIME
              <strong>
                {ended
                  ? puzzle.status === "COMPLETE"
                    ? "COMPLETE"
                    : "WINDOW CLOSED"
                  : duration(remaining(puzzle.endsAt, now))}
              </strong>
            </p>
          </div>
          {!ended && (
            <section
              className="puzzle-selection"
              aria-label={source ? "Move a piece" : "Place a piece"}
            >
              {(moving || reservation) && (
                <img
                  alt={
                    moving ? "Selected movable piece" : "Your reserved piece"
                  }
                  src={imageUrl(puzzle.id, moving?.id || reservation!.piece)}
                  width={100}
                  height={100}
                />
              )}
              <div>
                <p>
                  {source
                    ? "Tap where this piece belongs."
                    : reservation
                      ? "Tap an empty square to place your piece."
                      : pieceWait
                        ? `Next piece available in ${duration(pieceWait)}.`
                        : puzzle.board.length === 25
                          ? "Select an unlocked piece to help complete the picture."
                          : "Checking for your next piece…"}
                </p>
                {reservation && (
                  <small>
                    Reserved for{" "}
                    {duration(remaining(reservation.expiresAt, now))}.
                  </small>
                )}
                {target !== null && (
                  <p>
                    {source
                      ? destination
                        ? "Swap preview"
                        : "Move preview"
                      : "Placement preview"}{" "}
                    · square {target + 1}
                  </p>
                )}
                {target !== null && (
                  <button
                    disabled={!canConfirm}
                    onClick={() =>
                      void act({
                        operation: source ? "move" : "place",
                        puzzle: puzzle.id,
                        revision: puzzle.revision,
                        request: crypto.randomUUID(),
                        piece: source || reservation?.piece,
                        to: target,
                      })
                    }
                  >
                    {source ? "MOVE HERE" : "PLACE HERE"}
                  </button>
                )}
                {(source || target !== null) && (
                  <button
                    disabled={busy || uncertain}
                    onClick={() => choose(emptySelection)}
                  >
                    CANCEL selection
                  </button>
                )}
              </div>
            </section>
          )}
          <div
            className="puzzle-board"
            role="group"
            aria-label="Shared puzzle board"
          >
            {Array.from({ length: 25 }, (_, position) => {
              const piece = puzzle.board.find((p) => p.position === position);
              let shown = piece?.id;
              const preview = target !== null && Boolean(canConfirm);
              if (preview && position === target)
                shown = source || reservation?.piece;
              if (preview && moving && position === moving.position)
                shown = destination?.id;
              return (
                <button
                  key={position}
                  disabled={busy || denied}
                  aria-label={`Position ${position + 1}, ${piece?.locked ? "correct and locked" : piece ? "movable piece" : "empty"}${preview && (position === target || position === moving?.position) ? ", preview" : ""}`}
                  aria-pressed={
                    target === position ||
                    Boolean(source && source === piece?.id)
                  }
                  className={
                    preview &&
                    (position === target || position === moving?.position)
                      ? "puzzle-preview"
                      : undefined
                  }
                  onClick={() => select(position)}
                >
                  {shown ? (
                    <img
                      alt=""
                      src={imageUrl(puzzle.id, shown)}
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
            <div className="puzzle-metrics">
              <p>
                PLACE
                <strong>
                  {remaining(data.placeAfter, now)
                    ? duration(remaining(data.placeAfter, now))
                    : "READY"}
                </strong>
              </p>
              <p>
                MOVE
                <strong>
                  {remaining(data.moveAfter, now)
                    ? duration(remaining(data.moveAfter, now))
                    : "READY"}
                </strong>
              </p>
            </div>
          )}
        </>
      )}
      {!denied && (failed || uncertain) && (
        <button
          disabled={busy}
          onClick={() =>
            pending.current ? void act(pending.current) : void refresh()
          }
        >
          {uncertain ? "RETRY ACTION" : "RETRY CONNECTION"}
        </button>
      )}
      <a href="/explore">RETURN TO MY ATOM</a>
    </main>
  );
}
