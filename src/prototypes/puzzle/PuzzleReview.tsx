"use client";
import { useEffect, useState } from "react";
import {
  selectAppearance,
  useAppearance,
} from "../../components/appearance/appearance";
import { ARTWORK, tileStyle } from "./artwork";
import {
  almostComplete,
  createPuzzle,
  ended,
  HOUR,
  lockedCount,
  nextPuzzle,
  playerFor,
  tick,
  transact,
  WEEK,
  type Action,
  type Puzzle,
} from "./model";
import "./puzzle.css";

const remaining = (ms: number) =>
  ms <= 0 ? "READY" : `${Math.ceil(ms / 60000)} min`;
export function PuzzleReview() {
  const [state, setState] = useState(() => createPuzzle());
  const [actor, setActor] = useState("demo-1");
  const [mode, setMode] = useState<"place" | "move">("place");
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const [message, setMessage] = useState(
    "Reveal a piece to begin. This shared board uses simulated participants only.",
  );
  const [auto, setAuto] = useState(true);
  const appearance = useAppearance();
  useEffect(() => {
    const timer = setInterval(
      () =>
        setState((s) => {
          const updated = tick(s, s.now + 1000);
          return auto ? nextPuzzle(updated) : updated;
        }),
      1000,
    );
    return () => clearInterval(timer);
  }, [auto]);
  const player = playerFor(state, actor);
  const done = ended(state);
  const count = lockedCount(state);
  function run(action: Action) {
    const result = transact(state, actor, state.revision, action);
    setState(result.state);
    setMessage(result.message);
    if (result.ok) {
      setFrom(null);
      setTo(null);
    }
  }
  function load(s: Puzzle, text: string) {
    setState(s);
    setFrom(null);
    setTo(null);
    setMessage(text);
  }
  function select(position: number) {
    if (mode === "move" && from === null) {
      if (
        state.board[position] === null ||
        state.board[position] === position
      ) {
        setMessage("Select a placed, unlocked piece first.");
        return;
      }
      setFrom(position);
      setTo(null);
      setMessage("Now select an empty square or another unlocked piece.");
    } else {
      setTo(position);
    }
  }
  return (
    <main className="puzzle-page">
      <header className="puzzle-top">
        <span className="wordmark">ATOMIC BOND · LOCAL PROTOTYPE</span>
        <div role="group" aria-label="Appearance">
          {(["light", "dark"] as const).map((theme) => (
            <button
              key={theme}
              aria-pressed={appearance === theme}
              onClick={() => selectAppearance(theme)}
            >
              {theme.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      <header className="puzzle-title">
        <p className="eyebrow">ONE SHARED WEEKLY PICTURE</p>
        <h1>PARTICI-PUZZLE</h1>
        <p className="puzzle-tagline">Many people. One big picture.</p>
        <p>
          Reveal a piece. Find its place. Help the world complete the picture.
        </p>
      </header>
      <div className="puzzle-layout">
        <section className="puzzle-board-panel" aria-label="Shared puzzle">
          <div className="puzzle-progress">
            <strong>{count} / 25 LOCKED</strong>
            <span>
              WEEK {state.week} ·{" "}
              {done
                ? "ENDED"
                : `${Math.ceil((state.start + WEEK - state.now) / HOUR)} hours left`}
            </span>
          </div>
          <progress
            aria-label="Correctly locked pieces"
            value={count}
            max={25}
          />
          <div
            className="puzzle-board"
            role="group"
            aria-label="Puzzle board, five rows and five columns"
          >
            {state.board.map((piece, position) => (
              <button
                key={position}
                className={`puzzle-cell ${piece === position ? "locked" : ""}`}
                style={piece !== null ? tileStyle(piece) : undefined}
                aria-label={`Row ${Math.floor(position / 5) + 1}, column ${(position % 5) + 1}: ${piece === null ? "empty" : piece === position ? "locked piece" : "unlocked piece"}`}
                aria-pressed={to === position || from === position}
                disabled={done || piece === position}
                onClick={() => select(position)}
              >
                {piece === null ? (
                  <span>{position + 1}</span>
                ) : (
                  <span className="puzzle-state">
                    {piece === position ? "✓" : "↔"}
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="puzzle-legend">
            ✓ Locked in place · ↔ Available to move
          </p>
        </section>
        <section className="puzzle-actions" aria-label="Your actions">
          {done ? (
            <>
              <h2>
                {state.completedAt !== undefined
                  ? "PUZZLE COMPLETE!"
                  : "THIS WEEK HAS ENDED"}
              </h2>
              <p>
                {state.completedAt !== undefined
                  ? "We made the big picture together."
                  : "Every piece helped. The placed pieces remain visible."}
              </p>
              {state.completedAt !== undefined && (
                <div
                  className="puzzle-complete-image"
                  role="img"
                  aria-label="Complete synthetic landscape: mountains, river, trees and sun"
                  style={{ backgroundImage: `url("${ARTWORK}")` }}
                />
              )}
              <p>
                {state.contributors.length} participating Atoms ·{" "}
                {state.placements} placements · {state.moves} corrective moves
              </p>
              {state.completedAt !== undefined && (
                <p>
                  Completed in{" "}
                  {Math.max(
                    1,
                    Math.ceil((state.completedAt - state.start) / 60000),
                  )}{" "}
                  simulated minutes.
                </p>
              )}
            </>
          ) : (
            <>
              <h2>YOUR NEXT PIECE</h2>
              <div
                key={player.reservation?.piece ?? "empty"}
                className="puzzle-preview"
                role="img"
                aria-label={
                  player.reservation
                    ? "Your reserved image piece"
                    : "No piece reserved"
                }
                style={
                  player.reservation
                    ? tileStyle(player.reservation.piece)
                    : undefined
                }
              >
                {!player.reservation && "?"}
              </div>
              <p>
                {player.reservation
                  ? `Reserved · ${remaining(player.reservation.until - state.now)} left`
                  : "A small part of something bigger."}
              </p>
              <button
                className="puzzle-primary"
                disabled={
                  !!player.reservation ||
                  player.placeAt > state.now ||
                  (player.revealAt ?? 0) > state.now
                }
                onClick={() => {
                  setMode("place");
                  run({ type: "reveal" });
                }}
              >
                REVEAL MY PIECE
              </button>
              {player.reservation && (
                <>
                  <button
                    disabled={to === null || mode !== "place"}
                    onClick={() => to !== null && run({ type: "place", to })}
                  >
                    PLACE MY PIECE
                  </button>
                  <button onClick={() => run({ type: "cancel" })}>
                    CANCEL RESERVATION
                  </button>
                </>
              )}
              <p>PLACE · {remaining(player.placeAt - state.now)}</p>
              <p>REVEAL · {remaining((player.revealAt ?? 0) - state.now)}</p>
              <button
                aria-pressed={mode === "move"}
                disabled={player.moveAt > state.now}
                onClick={() => {
                  setMode(mode === "move" ? "place" : "move");
                  setFrom(null);
                  setTo(null);
                  setMessage(
                    "Select an unlocked piece, then its destination. Locked pieces stay put.",
                  );
                }}
              >
                MOVE A PIECE
              </button>
              {mode === "move" && (
                <button
                  disabled={from === null || to === null}
                  onClick={() =>
                    from !== null &&
                    to !== null &&
                    run({ type: "move", from, to })
                  }
                >
                  {to !== null && state.board[to] !== null
                    ? "CONFIRM SWAP"
                    : "CONFIRM MOVE"}
                </button>
              )}
              <p>MOVE · {remaining(player.moveAt - state.now)}</p>
              <p className="puzzle-help">
                One placement and one move per hour, independently. Select
                squares by tap, click, or keyboard; dragging is not required.
              </p>
            </>
          )}
        </section>
      </div>
      <p className="puzzle-feedback" role="status" aria-live="polite">
        {message}
      </p>
      <details className="puzzle-simulation" open>
        <summary>LOCAL SIMULATION CONTROLS</summary>
        <p>
          One shared in-memory board; six synthetic ACTIVE participants. Refresh
          resets it. No production accounts or data. The bundled artwork is
          inspectable and is not a secret asset.
        </p>
        <label>
          Simulated participant{" "}
          <select
            value={actor}
            onChange={(e) => {
              setActor(e.target.value);
              setFrom(null);
              setTo(null);
              setMode("place");
            }}
          >
            {Array.from({ length: 6 }, (_, i) => (
              <option key={i} value={`demo-${i + 1}`}>
                Demo Atom {i + 1}
              </option>
            ))}
          </select>
        </label>
        <div className="puzzle-sim-buttons">
          <button onClick={() => setState(tick(state, state.now + 5 * 60000))}>
            +5 MINUTES
          </button>
          <button onClick={() => setState(tick(state, state.now + HOUR))}>
            +60 MINUTES
          </button>
          <button
            onClick={() => {
              setAuto(false);
              setState(tick(state, state.start + WEEK));
            }}
          >
            END WEEK
          </button>
          <button
            disabled={state.now < state.start + WEEK}
            onClick={() => {
              setAuto(true);
              load(
                nextPuzzle(state),
                "The next scheduled puzzle has begun. Existing rolling cooldowns remain.",
              );
            }}
          >
            NEXT WEEK
          </button>
          <button
            onClick={() =>
              load(
                almostComplete(state.now),
                "Completion fixture: swap the first two unlocked pieces to finish.",
              )
            }
          >
            DEMO FINAL SWAP
          </button>
          <button
            onClick={() => {
              const a = transact(state, "demo-5", state.revision, {
                type: "reveal",
              });
              const b = transact(a.state, "demo-6", state.revision, {
                type: "reveal",
              });
              load(
                b.state,
                `Simultaneous snapshot: first ${a.ok ? "accepted" : "rejected"}; second ${b.ok ? "accepted" : "rejected"}. ${b.message}`,
              );
            }}
          >
            SIMULATE CONCURRENT REVEALS
          </button>
          <button
            onClick={() => {
              if (!player.reservation) return;
              setMode("place");
              setTo(player.reservation.piece);
              setMessage(
                "Review helper selected the correct destination. Press PLACE MY PIECE.",
              );
            }}
            disabled={!player.reservation}
          >
            SHOW CORRECT DESTINATION
          </button>
          <button
            onClick={() => {
              setAuto(true);
              load(
                createPuzzle(),
                "Fresh local puzzle. Nothing was changed in production.",
              );
            }}
          >
            RESET DEMO
          </button>
        </div>
        <label>
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => setAuto(e.target.checked)}
          />{" "}
          Automatically start the next scheduled week
        </label>
      </details>
    </main>
  );
}
