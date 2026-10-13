"use client";
import { useState } from "react";
import { AdminNavigation } from "../admin/AdminNavigation";
import {
  readStudio,
  scheduleStudio,
  cleanupStudio,
} from "../../app/admin/puzzles/actions";
import type { StudioInventory } from "../../services/puzzle/studio";
import "./puzzle-studio.css";
const date = (s: string) =>
  new Date(s)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, " UTC");
export function PuzzleStudio({ initial }: { initial: StudioInventory }) {
  const [inventory, setInventory] = useState(initial),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState(""),
    [start, setStart] = useState(""),
    [approved, setApproved] = useState(false),
    [confirm, setConfirm] = useState(false),
    [cleanupConfirm, setCleanupConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const batch = inventory.batches.find((b) => b.id === selected);
  const parsed = start ? Date.parse(start + "Z") : NaN;
  const end = Number.isFinite(parsed)
    ? new Date(parsed + 168 * 3600000).toISOString()
    : null;
  async function refresh(next = offset) {
    const data = await readStudio(next);
    if (!data) throw Error();
    setInventory(data);
    setOffset(next);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch {
      setMessage(
        "Operation unavailable. Check administrator access, READY status and overlapping schedule windows.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-page puzzle-studio">
      <AdminNavigation />
      <p className="admin-brand">ATOMIC BOND</p>
      <h1>PUZZLE STUDIO</h1>
      <p>
        Prepare private artwork, review the complete 25-piece image and schedule
        a seven-day puzzle.
      </p>
      <p className="studio-gates">
        Public participation: {inventory.gates.public ? "ON" : "OFF"} ·
        Controlled participation: {inventory.gates.controlled ? "ON" : "OFF"}
      </p>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <section aria-labelledby="prepare-title">
        <h2 id="prepare-title">PREPARE ARTWORK</h2>
        <p>
          Use original or appropriately licensed JPEG or PNG artwork, up to 3
          MB. Preparation normalizes the image to 500 × 500 and creates 25
          private tiles. Uploading does not schedule or publish it.
        </p>
        <label className="studio-field">
          Artwork
          <input
            type="file"
            accept="image/png,image/jpeg"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setApproved(false);
              setConfirm(false);
              void run(async () => {
                const r = await fetch("/api/puzzle/studio", {
                  method: "POST",
                  headers: { "Content-Type": "application/octet-stream" },
                  body: file,
                  cache: "no-store",
                });
                const data = await r.json();
                if (!r.ok || !data.ready || !data.batch) throw Error();
                await refresh(0);
                setSelected(data.batch);
                setMessage(
                  "Artwork READY. Review every tile before approving a schedule.",
                );
              });
            }}
          />
        </label>
        <p className="studio-note">
          Unscheduled batches are removed after 24 hours. Keep your original
          file to prepare again if review takes longer.
        </p>
      </section>
      <section aria-labelledby="inventory-title">
        <h2 id="inventory-title">ARTWORK & WEEKLY WINDOWS</h2>
        <button disabled={busy} onClick={() => void run(() => refresh())}>
          REFRESH STATUS
        </button>
        {!inventory.batches.length && <p>No prepared artwork.</p>}
        <div className="studio-batches">
          {inventory.batches.map((b, i) => (
            <article className="admin-card" key={b.id}>
              <h3>
                {b.puzzle?.state ??
                  (b.ready ? "READY — UNSCHEDULED" : "PREPARING")}
              </h3>
              <p>
                Prepared {date(b.createdAt)} · {b.mediaCount}/27 private assets
              </p>
              {b.puzzle ? (
                <>
                  <p>
                    {date(b.puzzle.start)} → {date(b.puzzle.end)}
                  </p>
                  <p>
                    {b.puzzle.placed}/25 placed · {b.puzzle.locked}/25 locked
                  </p>
                </>
              ) : (
                b.expiresAt && (
                  <p>Unscheduled retention ends {date(b.expiresAt)}.</p>
                )
              )}
              <button
                disabled={busy || !b.ready}
                aria-pressed={selected === b.id}
                onClick={() => {
                  setSelected(b.id);
                  setApproved(false);
                  setConfirm(false);
                }}
              >
                PREVIEW ARTWORK {offset + i + 1}
              </button>
            </article>
          ))}
        </div>
        <div className="studio-buttons">
          <button
            disabled={busy || offset === 0}
            onClick={() => void run(() => refresh(Math.max(0, offset - 20)))}
          >
            PREVIOUS
          </button>
          <span>{inventory.total} batches</span>
          <button
            disabled={busy || offset + 20 >= inventory.total}
            onClick={() => void run(() => refresh(offset + 20))}
          >
            NEXT
          </button>
        </div>
      </section>
      {batch && (
        <section aria-labelledby="preview-title">
          <h2 id="preview-title">25-PIECE PREVIEW</h2>
          <figure className="studio-preview">
            <div className="studio-image">
              {/* eslint-disable-next-line @next/next/no-img-element -- private authenticated preview must bypass image optimization/CDN */}
              <img
                src={`/api/puzzle/studio?batch=${batch.id}`}
                alt="Prepared puzzle artwork with a five by five tile guide"
                width={500}
                height={500}
              />
              <div className="studio-grid" aria-hidden="true">
                {Array.from({ length: 25 }, (_, i) => (
                  <span key={i} />
                ))}
              </div>
            </div>
            <figcaption>
              Private administrator preview · 5 × 5 · READY
            </figcaption>
          </figure>
          {!batch.puzzle && (
            <>
              <label className="studio-check">
                <input
                  type="checkbox"
                  checked={approved}
                  disabled={busy}
                  onChange={(e) => {
                    setApproved(e.target.checked);
                    setConfirm(false);
                  }}
                />
                I have reviewed the prepared artwork and approve it for this
                puzzle.
              </label>
              <label className="studio-field">
                Weekly start (UTC)
                <input
                  type="datetime-local"
                  value={start}
                  disabled={busy}
                  onChange={(e) => {
                    setStart(e.target.value);
                    setConfirm(false);
                  }}
                />
              </label>
              <p>
                {end
                  ? `Ends ${date(end)} — exactly 168 hours.`
                  : "Choose a UTC start; the window lasts exactly seven days."}
              </p>
              {!confirm ? (
                <button
                  disabled={busy || !approved || !end}
                  onClick={() => setConfirm(true)}
                >
                  REVIEW SCHEDULE
                </button>
              ) : (
                <div
                  className="studio-confirm"
                  role="group"
                  aria-label="Confirm puzzle schedule"
                >
                  <p>
                    Schedule this approved artwork from{" "}
                    {date(new Date(parsed).toISOString())} to {date(end!)}?
                    Existing windows cannot overlap. Participation gates will
                    not change.
                  </p>
                  <div className="studio-buttons">
                    <button disabled={busy} onClick={() => setConfirm(false)}>
                      CANCEL
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const r = await scheduleStudio(
                            batch.id,
                            new Date(parsed).toISOString(),
                          );
                          if (!r.ok) throw Error();
                          setConfirm(false);
                          setApproved(false);
                          await refresh();
                          setMessage(
                            "Weekly puzzle scheduled. Participation gates are unchanged.",
                          );
                        })
                      }
                    >
                      CONFIRM WEEKLY SCHEDULE
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
      <section aria-labelledby="cleanup-title">
        <h2 id="cleanup-title">CLEANUP HEALTH</h2>
        <p>
          Last successful run:{" "}
          {inventory.cleanup.lastSuccess
            ? date(inventory.cleanup.lastSuccess)
            : "Not recorded"}
          . Current status:{" "}
          {inventory.cleanup.ok === true
            ? "HEALTHY"
            : inventory.cleanup.ok === false
              ? "CHECK REQUIRED"
              : "NOT RECORDED"}
          .
        </p>
        {inventory.cleanup.lastFailure && (
          <p>Last failure: {date(inventory.cleanup.lastFailure)}.</p>
        )}
        <p>
          Latest run removed:{" "}
          {Object.entries(inventory.cleanup.counts)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" · ") || "No counts recorded"}
          .
        </p>
        <p>
          Cleanup removes only expired or abandoned records eligible under
          retention rules. Active and scheduled puzzle media are preserved.
        </p>
        {!cleanupConfirm ? (
          <button disabled={busy} onClick={() => setCleanupConfirm(true)}>
            RUN BOUNDED CLEANUP
          </button>
        ) : (
          <div className="studio-buttons">
            <button disabled={busy} onClick={() => setCleanupConfirm(false)}>
              CANCEL
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const r = await cleanupStudio();
                  if (!r.ok) throw Error();
                  setCleanupConfirm(false);
                  await refresh();
                  setMessage(
                    `Cleanup complete. ${r.removed} eligible legacy manifests retired.`,
                  );
                })
              }
            >
              CONFIRM ELIGIBLE CLEANUP
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
