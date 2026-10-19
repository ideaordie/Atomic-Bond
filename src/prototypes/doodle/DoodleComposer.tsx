"use client";
import { useState } from "react";
import { DoodleEditor, dotCount, type Drawing } from "./model";
import { PALETTE } from "./palette";
import { DrawingCanvas, DoodlePlayback } from "./DoodleCanvas";
/** The approved editor tools and renderer, with a separate submission boundary. */
export function DoodleComposer({
  onSubmit,
  colorEnabled = false,
  busy,
  paused = false,
  simplified = false,
  editingLocked = false,
}: {
  onSubmit: (drawing: Drawing) => Promise<boolean>;
  colorEnabled?: boolean;
  busy: boolean;
  paused?: boolean;
  simplified?: boolean;
  editingLocked?: boolean;
}) {
  const [editor] = useState(() => new DoodleEditor(colorEnabled ? 2 : 1));
  const [revision, setRevision] = useState(0);
  const [color, setColor] = useState(1);
  const [tool, setTool] = useState<"draw" | "erase">("draw");
  const [preview, setPreview] = useState<Drawing | null>(null);
  const [clear, setClear] = useState(false);
  const count = dotCount(editor.bits);
  const changed = () => {
    setRevision((n) => n + 1);
    setClear(false);
  };
  return (
    <section className="doodle-panel">
      <div className="doodle-panel-heading">
        <h2>{preview ? "YOUR PREVIEW" : "MAKE YOUR MARK"}</h2>
        <span>64 × 64</span>
      </div>
      {preview ? (
        <DoodlePlayback
          drawing={preview}
          description="Preview of your dot drawing"
        />
      ) : (
        <div inert={editingLocked || busy}>
          <div className="doodle-tools" role="group" aria-label="Drawing tools">
            <button
              aria-pressed={tool === "draw"}
              onClick={() => setTool("draw")}
            >
              DRAW
            </button>
            <button
              aria-pressed={tool === "erase"}
              onClick={() => setTool("erase")}
            >
              ERASE
            </button>
            <button
              disabled={!editor.canUndo || busy}
              onClick={() => {
                editor.undo();
                changed();
              }}
            >
              UNDO
            </button>
            <button disabled={!count || busy} onClick={() => setClear(true)}>
              CLEAR
            </button>
          </div>
          {editor.version === 2 && (
            <div
              className="doodle-palette"
              role="group"
              aria-label="Drawing colors"
            >
              {PALETTE.map((entry, index) => (
                <button
                  key={entry.name}
                  type="button"
                  aria-label={entry.name}
                  aria-pressed={color === index + 1 && tool === "draw"}
                  onClick={() => {
                    setColor(index + 1);
                    setTool("draw");
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{ backgroundColor: entry.hex }}
                  />
                  {entry.name}
                </button>
              ))}
            </div>
          )}
          <DrawingCanvas
            editor={editor}
            tool={tool}
            color={color}
            revision={revision}
            onChange={changed}
          />
        </div>
      )}
      <div className="doodle-count">
        <span>{count} dots</span>
        <span>YOUR DRAFT</span>
      </div>
      {clear && (
        <div className="doodle-confirm">
          <p>Clear your drawing? You can undo this step.</p>
          <button onClick={() => setClear(false)}>KEEP DRAWING</button>
          <button
            onClick={() => {
              editor.clear();
              changed();
            }}
          >
            CLEAR DRAWING
          </button>
        </div>
      )}
      <div className="doodle-actions">
        {!simplified && (
          <button
            disabled={!count || busy}
            onClick={() => setPreview(preview ? null : editor.export())}
          >
            {preview ? "BACK TO DRAWING" : "PREVIEW"}
          </button>
        )}
        <button
          className="doodle-primary"
          disabled={!count || busy || paused}
          onClick={async () => {
            const drawing = editor.export();
            if (await onSubmit(drawing)) {
              editor.clear();
              setPreview(null);
              changed();
            }
          }}
        >
          SEND
        </button>
      </div>
      <p className="doodle-help" id="doodle-input-help">
        Draw or erase with a finger, mouse or pen. Keyboard: arrows move; Space
        marks a dot. One submission per hour. SEND publishes immediately for{" "}
        {simplified ? "7 days" : "one hour"}.
      </p>
      {editor.strokes === null && (
        <p className="doodle-help">
          Replay limit reached. Your complete drawing is preserved as a still
          image.
        </p>
      )}
    </section>
  );
}
