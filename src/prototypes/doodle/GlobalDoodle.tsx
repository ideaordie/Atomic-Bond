"use client";
import { useEffect, useState } from "react";
import {
  selectAppearance,
  useAppearance,
} from "../../components/appearance/appearance";
import { DrawingCanvas, DoodlePlayback } from "./DoodleCanvas";
import {
  activeDoodles,
  DoodleEditor,
  dotCount,
  submitDoodle,
  type Drawing,
} from "./model";
import { demoDoodles } from "./fixtures";
import "./doodle.css";

export function GlobalDoodle({ initialTime }: { initialTime: number }) {
  const [editor] = useState(() => new DoodleEditor());
  const [revision, setRevision] = useState(0);
  const [tool, setTool] = useState<"draw" | "erase">("draw");
  const [preview, setPreview] = useState<Drawing | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState(
    "Nothing is published. Refreshing resets this demo.",
  );
  const [feed, setFeed] = useState(() => demoDoodles(initialTime));
  const [selected, setSelected] = useState("example-0");
  const [clock, setClock] = useState(initialTime);
  const [offset, setOffset] = useState(0);
  const appearance = useAppearance();
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const now = clock + offset;
  const active = activeDoodles(feed, now);
  const index = Math.max(
    0,
    active.findIndex((item) => item.id === selected),
  );
  const current = active[index];
  const count = dotCount(editor.bits);
  const changed = () => {
    setRevision((n) => n + 1);
    setConfirmClear(false);
  };
  const browse = (direction: number) =>
    setSelected(
      active[(index + direction + active.length) % active.length]!.id,
    );
  const send = () => {
    if (!count || editor.drawing) return;
    const id = crypto.randomUUID();
    const drawing = editor.export();
    setFeed((items) => submitDoodle(items, drawing, now, id));
    setSelected(id);
    editor.clear();
    setPreview(null);
    changed();
    setMessage(
      "Sent to this browser’s demo only. Your drawing is visible here for 60 simulated minutes.",
    );
  };
  return (
    <main className="doodle-page">
      <header className="doodle-header">
        <p className="wordmark">ATOMIC BOND</p>
        <div className="doodle-appearance" role="group" aria-label="Appearance">
          {(["light", "dark"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={appearance === value}
              onClick={() => selectAppearance(value)}
            >
              {value.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      <div className="doodle-intro">
        <p className="doodle-kicker">LOCAL INTERACTIVE PROTOTYPE · 12.0</p>
        <h1>GLOBAL DOODLE</h1>
        <p>A small drawing. A passing moment.</p>
        <p className="doodle-muted">
          Draw with dots, then watch it join a simulated world of drawings.
          Nothing leaves this browser.
        </p>
      </div>
      <div className="doodle-layout">
        <section className="doodle-panel" aria-labelledby="doodle-draw-title">
          <div className="doodle-panel-heading">
            <h2 id="doodle-draw-title">
              {preview ? "YOUR PREVIEW" : "MAKE YOUR MARK"}
            </h2>
            <span>64 × 64</span>
          </div>
          {preview ? (
            <DoodlePlayback
              drawing={preview}
              description="Preview of your dot drawing"
            />
          ) : (
            <>
              <div
                className="doodle-tools"
                role="group"
                aria-label="Drawing tools"
              >
                <button
                  type="button"
                  aria-pressed={tool === "draw"}
                  onClick={() => setTool("draw")}
                >
                  DRAW
                </button>
                <button
                  type="button"
                  aria-pressed={tool === "erase"}
                  onClick={() => setTool("erase")}
                >
                  ERASE
                </button>
                <button
                  type="button"
                  disabled={!editor.canUndo}
                  onClick={() => {
                    editor.undo();
                    changed();
                  }}
                >
                  UNDO
                </button>
                <button
                  type="button"
                  disabled={!count}
                  onClick={() => setConfirmClear(true)}
                >
                  CLEAR
                </button>
              </div>
              <DrawingCanvas
                editor={editor}
                tool={tool}
                revision={revision}
                onChange={changed}
              />
            </>
          )}
          <div className="doodle-count" aria-live="polite">
            <span>{count.toLocaleString()} dots</span>
            <span>LOCAL ONLY</span>
          </div>
          {confirmClear && (
            <div
              className="doodle-confirm"
              role="group"
              aria-label="Confirm clear"
            >
              <p>
                Clear your drawing? This removes every dot. You can undo this
                step.
              </p>
              <div>
                <button type="button" onClick={() => setConfirmClear(false)}>
                  KEEP DRAWING
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editor.clear();
                    changed();
                    setMessage("Canvas cleared. Undo restores the drawing.");
                  }}
                >
                  CLEAR DRAWING
                </button>
              </div>
            </div>
          )}
          <div className="doodle-actions">
            {preview ? (
              <button type="button" onClick={() => setPreview(null)}>
                BACK TO DRAWING
              </button>
            ) : (
              <button
                type="button"
                disabled={!count}
                onClick={() => setPreview(editor.export())}
              >
                PREVIEW
              </button>
            )}
            <button
              type="button"
              className="doodle-primary"
              disabled={!count}
              onClick={send}
            >
              SEND
            </button>
          </div>
          <p id="doodle-input-help" className="doodle-help">
            {preview
              ? "A short replay, followed by your complete drawing."
              : `${tool === "draw" ? "Draw" : "Erase"} with a finger, mouse or pen. Undo reverses a whole stroke. Keyboard: focus the canvas, move with arrow keys, then press Space to mark a dot.`}
          </p>
          {!preview && editor.strokes === null && (
            <p className="doodle-help">
              Replay limit reached. Your complete drawing is preserved as a
              still image.
            </p>
          )}
        </section>
        <aside className="doodle-feed-column">
          <section className="doodle-panel" aria-labelledby="doodle-feed-title">
            <div className="doodle-panel-heading">
              <h2 id="doodle-feed-title">GLOBAL DOODLE</h2>
              <span>DEMO FEED</span>
            </div>
            {current ? (
              <>
                <div className="doodle-attribution">
                  <span>{current.attribution}</span>
                  <span>
                    {Math.floor((now - current.createdAt) / 60000)} min ago
                  </span>
                </div>
                <DoodlePlayback
                  key={current.id}
                  drawing={current.drawing}
                  description={current.description}
                />
                <div className="doodle-lifetime">
                  <span>{current.description}</span>
                  <span>
                    {Math.max(1, Math.ceil((current.expiresAt - now) / 60000))}{" "}
                    min remaining
                  </span>
                </div>
                <nav
                  className="doodle-browse"
                  aria-label="Browse demo drawings"
                >
                  <button
                    type="button"
                    aria-label="Previous drawing"
                    disabled={active.length < 2}
                    onClick={() => browse(-1)}
                  >
                    ←
                  </button>
                  <span aria-live="polite">
                    {index + 1} / {active.length}
                  </span>
                  <button
                    type="button"
                    aria-label="Next drawing"
                    disabled={active.length < 2}
                    onClick={() => browse(1)}
                  >
                    →
                  </button>
                </nav>
              </>
            ) : (
              <div className="doodle-empty">
                <p>THIS MOMENT HAS PASSED</p>
                <p>No active demo drawings.</p>
                <p>Send a drawing or reset the examples below.</p>
              </div>
            )}
            <p className="doodle-help">
              One drawing at a time. Each disappears after 60 minutes. These are
              synthetic examples, not real participants.
            </p>
          </section>
          <section className="doodle-time" aria-labelledby="doodle-time-title">
            <h2 id="doodle-time-title">TRY THE ONE-HOUR LIFETIME</h2>
            <p>Advance the demo clock to watch drawings expire.</p>
            <div className="doodle-time-actions">
              <button
                type="button"
                onClick={() => setOffset((n) => n + 15 * 60000)}
              >
                +15 MIN
              </button>
              <button
                type="button"
                onClick={() => setOffset((n) => n + 60 * 60000)}
              >
                +60 MIN
              </button>
              <button
                type="button"
                onClick={() => {
                  setFeed(demoDoodles(now));
                  setSelected("example-0");
                  setMessage(
                    "Synthetic examples reset. Your canvas has not changed.",
                  );
                }}
              >
                RESET EXAMPLES
              </button>
            </div>
            <p className="doodle-help" role="status">
              Clock advanced {offset / 60000} min · {active.length} active
              drawings
            </p>
          </section>
        </aside>
      </div>
      <p className="doodle-message" role="status">
        {message}
      </p>
      <footer>
        LOCAL DEMONSTRATION ONLY · No server submissions, real identities or
        shared feed. Drawings are held in memory, with at most 24 demo items.
      </footer>
    </main>
  );
}
