"use client";
/* eslint-disable @next/next/no-img-element -- private media must bypass image optimization */
import { useEffect, useState } from "react";
import { AdminNavigation } from "../admin/AdminNavigation";
import {
  readQueue,
  changeQueue,
  cleanupStudio,
} from "../../app/admin/puzzles/actions";
import type { QueueInventory, QueueCommand } from "../../services/puzzle/queue";
import "./puzzle-studio.css";
export type QueueTransport = {
  read: (offset: number) => Promise<QueueInventory | null>;
  change: (command: QueueCommand) => Promise<{ ok: boolean }>;
  upload: (file: File) => Promise<string>;
  cleanup: () => Promise<{ ok: boolean }>;
  image: (batch: string) => string;
};
const live: QueueTransport = {
  read: readQueue,
  change: changeQueue,
  cleanup: cleanupStudio,
  image: (b) => `/api/puzzle/studio?batch=${b}`,
  upload: async (file) => {
    const r = await fetch("/api/puzzle/studio", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: file,
      cache: "no-store",
    });
    const d = await r.json();
    if (!r.ok || !d.ready || !d.batch) throw Error();
    return d.batch;
  },
};
export function PuzzleQueueStudio({
  initial,
  transport = live,
}: {
  initial: QueueInventory;
  transport?: QueueTransport;
}) {
  const [data, setData] = useState(initial),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState(""),
    [approved, setApproved] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [confirm, setConfirm] = useState<null | {
      action: "remove" | "retire" | "cleanup";
      puzzle?: string;
    }>(null),
    [reason, setReason] = useState(""),
    [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - start), 1000);
    return () => clearInterval(timer);
  }, [data.now]);
  async function refresh(page = offset) {
    const next = await transport.read(page);
    if (!next) throw Error();
    setData(next);
    setOffset(page);
    setElapsed(0);
  }
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !busy)
        void transport
          .read(offset)
          .then((next) => {
            if (next) {
              setData(next);
              setElapsed(0);
            }
          })
          .catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [transport, offset, busy]);
  async function run(operation: () => Promise<void>) {
    setBusy(true);
    try {
      await operation();
    } catch {
      setMessage(
        "Operation unavailable or queue changed. Refresh and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function change(command: Omit<QueueCommand, "revision">) {
    if (
      !(
        await transport.change({ ...command, revision: data.settings.revision })
      ).ok
    )
      throw Error();
    await refresh();
    setMessage("Queue updated.");
  }
  const batch = data.batches.find((b) => b.id === selected),
    current = data.current;
  const minutes = current?.celebrationEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (Date.parse(current.celebrationEndsAt) -
            Date.parse(data.now) -
            elapsed) /
            60000,
        ),
      )
    : 0;
  return (
    <main className="admin-page puzzle-studio">
      <AdminNavigation />
      <p className="admin-brand">ATOMIC BOND</p>
      <h1>PUZZLE STUDIO</h1>
      <p>
        Upload. Preview. Add to queue. Completed puzzles stay visible for one
        hour before the next picture begins.
      </p>
      <p role="status">{message}</p>
      {!data.settings.enabled && (
        <p>
          Queue transition awaits operator approval. Existing puzzles are
          unchanged.
        </p>
      )}
      <section aria-labelledby="current-puzzle">
        <h2 id="current-puzzle">CURRENT PUZZLE</h2>
        {current ? (
          <>
            <p>
              {current.state} · {current.locked} / 25 locked
            </p>
            {current.celebrationEndsAt && (
              <p>
                Celebration ends in {minutes} min
                {data.settings.paused ? " · advancement paused" : ""}
              </p>
            )}
            <button
              onClick={() => {
                setSelected(current.batch);
                setApproved(false);
              }}
            >
              PREVIEW CURRENT ARTWORK
            </button>
            {current.state === "ACTIVE" && (
              <button
                disabled={busy}
                onClick={() => {
                  setReason("");
                  setConfirm({ action: "retire", puzzle: current.id });
                }}
              >
                RETIRE STALLED PUZZLE
              </button>
            )}
          </>
        ) : (
          <p>WAITING FOR THE NEXT PUZZLE</p>
        )}
        <div className="studio-buttons">
          <button
            disabled={busy || !data.settings.enabled}
            onClick={() =>
              void run(() =>
                change({ action: data.settings.paused ? "resume" : "pause" }),
              )
            }
          >
            {data.settings.paused
              ? "RESUME AUTOMATIC ADVANCEMENT"
              : "PAUSE AUTOMATIC ADVANCEMENT"}
          </button>
          <button disabled={busy} onClick={() => void run(() => refresh())}>
            REFRESH STATUS
          </button>
        </div>
        <p className="studio-note">
          Pausing stops the next activation. It does not interrupt active
          gameplay or extend the celebration.
        </p>
      </section>
      <section aria-labelledby="queue-title">
        <h2 id="queue-title">ORDERED QUEUE</h2>
        {!data.queue.length && (
          <p>
            No queued artwork. A READY picture added after celebration can begin
            automatically.
          </p>
        )}
        <ol className="studio-queue">
          {data.queue.map((q, i) => (
            <li key={q.id}>
              <strong>
                {i === 0 ? "NEXT PUZZLE" : `PUZZLE ${i + 1}`} ·{" "}
                {q.ready ? "READY" : "NEEDS ATTENTION"}
              </strong>
              <div className="studio-buttons">
                <button
                  onClick={() => {
                    setSelected(q.batch);
                    setApproved(false);
                  }}
                >
                  PREVIEW QUEUED {i + 1}
                </button>
                {(["up", "down"] as const).map((direction) => (
                  <button
                    key={direction}
                    aria-label={`Move queued puzzle ${i + 1} ${direction}`}
                    disabled={
                      busy ||
                      (direction === "up"
                        ? i === 0
                        : i === data.queue.length - 1)
                    }
                    onClick={() =>
                      void run(async () => {
                        const order = data.queue.map((x) => x.id),
                          j = direction === "up" ? i - 1 : i + 1;
                        [order[i], order[j]] = [order[j]!, order[i]!];
                        await change({ action: "reorder", order });
                      })
                    }
                  >
                    {direction.toUpperCase()}
                  </button>
                ))}
                <button
                  disabled={busy}
                  onClick={() => {
                    setReason("");
                    setConfirm({ action: "remove", puzzle: q.id });
                  }}
                >
                  REMOVE QUEUED {i + 1}
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="upload-title">
        <h2 id="upload-title">UPLOAD NEW PUZZLE</h2>
        <p>
          Original or licensed PNG/JPEG, up to 3 MB. Private preparation creates
          25 tiles. Uploading alone does not publish a puzzle.
        </p>
        <label className="studio-field">
          Artwork
          <input
            type="file"
            accept="image/png,image/jpeg"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                void run(async () => {
                  const id = await transport.upload(file);
                  await refresh(0);
                  setSelected(id);
                  setApproved(false);
                  setMessage("Artwork READY. Preview before adding to queue.");
                });
            }}
          />
        </label>
        <p className="studio-note">
          Unqueued uploads expire after 24 hours. Queued artwork is retained
          while waiting.
        </p>
        <div className="studio-batches">
          {data.batches.map((b, i) => (
            <article key={b.id}>
              <p>
                {b.ready ? "READY" : "PREPARING"} · expires{" "}
                {new Date(b.expiresAt).toLocaleString()}
              </p>
              <button
                disabled={!b.ready || busy}
                onClick={() => {
                  setSelected(b.id);
                  setApproved(false);
                }}
              >
                PREVIEW UPLOAD {offset + i + 1}
              </button>
            </article>
          ))}
        </div>
        <div className="studio-buttons">
          <button
            disabled={offset === 0 || busy}
            onClick={() => void run(() => refresh(offset - 20))}
          >
            PREVIOUS UPLOADS
          </button>
          <button
            disabled={offset + 20 >= data.total || busy}
            onClick={() => void run(() => refresh(offset + 20))}
          >
            NEXT UPLOADS
          </button>
        </div>
      </section>
      {selected && (
        <section aria-label="Artwork preview">
          <figure className="studio-preview">
            <div className="studio-image">
              <img
                src={transport.image(selected)}
                alt="Prepared puzzle artwork with a five by five tile guide"
              />
              <div className="studio-grid" aria-hidden="true">
                {Array.from({ length: 25 }, (_, i) => (
                  <span key={i} />
                ))}
              </div>
            </div>
            <figcaption>Private administrator preview · 25 pieces</figcaption>
          </figure>
          {batch && (
            <>
              <label className="studio-check">
                <input
                  type="checkbox"
                  checked={approved}
                  onChange={(e) => setApproved(e.target.checked)}
                />
                I have reviewed and approve this artwork.
              </label>
              <button
                disabled={
                  busy || !approved || !batch.ready || !data.settings.enabled
                }
                onClick={() =>
                  void run(async () => {
                    await change({ action: "add", batch: selected });
                    setSelected("");
                    setApproved(false);
                  })
                }
              >
                ADD TO QUEUE
              </button>
              <p>
                May begin immediately if no active puzzle or celebration remains
                and advancement is resumed.
              </p>
            </>
          )}
        </section>
      )}
      {confirm && (
        <fieldset className="studio-confirm">
          <legend>
            {confirm.action === "cleanup"
              ? "Confirm bounded cleanup"
              : confirm.action === "retire"
                ? "Confirm stalled-puzzle retirement"
                : "Confirm unused-puzzle removal"}
          </legend>
          <p>
            {confirm.action === "retire"
              ? "Progress is preserved as history. Current reservations are cancelled; PLACE and MOVE cooldowns remain. The next puzzle may start immediately."
              : confirm.action === "remove"
                ? "Only unused queued artwork can be removed. Its content becomes eligible for cleanup after 24 hours."
                : "Only expired content beyond retention is removed. Active and queued artwork is protected."}
          </p>
          {confirm.action !== "cleanup" && (
            <label className="studio-field">
              Reason (8–240 characters)
              <input
                maxLength={240}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          <div className="studio-buttons">
            <button disabled={busy} onClick={() => setConfirm(null)}>
              CANCEL
            </button>
            <button
              disabled={
                busy ||
                (confirm.action !== "cleanup" && reason.trim().length < 8)
              }
              onClick={() =>
                void run(async () => {
                  if (confirm.action === "cleanup") {
                    if (!(await transport.cleanup()).ok) throw Error();
                    await refresh();
                  } else
                    await change({
                      action: confirm.action,
                      puzzle: confirm.puzzle!,
                      reason,
                    });
                  setConfirm(null);
                })
              }
            >
              CONFIRM
            </button>
          </div>
        </fieldset>
      )}
      <section>
        <h2>CLEANUP STATUS</h2>
        <p>
          {data.cleanup.ok ? "Last run succeeded" : "Check cleanup health"} ·{" "}
          {data.cleanup.lastSuccess
            ? new Date(data.cleanup.lastSuccess).toLocaleString()
            : "No successful run"}
        </p>
        <button
          disabled={busy}
          onClick={() => setConfirm({ action: "cleanup" })}
        >
          RUN BOUNDED CLEANUP
        </button>
      </section>
      <section>
        <h2>RECENT QUEUE OPERATIONS</h2>
        <ul>
          {data.history.map((e, i) => (
            <li key={`${e.at}-${i}`}>
              {e.action} · {new Date(e.at).toLocaleString()}
              {e.reason ? ` · ${e.reason}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
