"use client";
import { useEffect, useRef, useState } from "react";
import { DoodleComposer } from "../../prototypes/doodle/DoodleComposer";
import {
  requestDoodle,
  type DoodleFeed,
  type DoodleRequest,
} from "../../services/doodle/client";
import type { Drawing } from "../../prototypes/doodle/model";
import "../../prototypes/doodle/doodle.css";
import "./doodle-feed.css";
type Published = {
  id: string;
  serverTime: string;
  publishedAt: string;
  expiresAt: string;
  nextEligibleAt: string;
};
export function DoodlePublishing({
  request = requestDoodle,
  returnHref = "/explore",
}: {
  request?: DoodleRequest;
  returnHref?: string;
}) {
  const [published, setPublished] = useState<Published | null>(null),
    [busy, setBusy] = useState(false),
    [paused, setPaused] = useState(true),
    [message, setMessage] = useState(""),
    [remaining, setRemaining] = useState(0),
    [revision, setRevision] = useState(0),
    [retry, setRetry] = useState(false);
  const sending = useRef(false),
    pending = useRef<{ id: string; drawing: Drawing } | null>(null),
    deadline = useRef({ at: 0, server: 0, local: 0 });
  const sync = (serverTime: string, next: string | null) => {
    deadline.current = {
      at: next ? Date.parse(next) : 0,
      server: Date.parse(serverTime),
      local: performance.now(),
    };
    setRemaining(Math.max(0, deadline.current.at - deadline.current.server));
  };
  useEffect(() => {
    let cancelled = false;
    void request<DoodleFeed>("read")
      .then((data) => {
        if (!cancelled) {
          setPaused(data.submissionsPaused);
          sync(data.serverTime, data.nextEligibleAt);
        }
      })
      .catch(() => {
        if (!cancelled)
          setMessage("Unable to verify access. Your draft remains here.");
      });
    return () => {
      cancelled = true;
    };
  }, [request]);
  useEffect(() => {
    const timer = setInterval(() => {
      const d = deadline.current;
      setRemaining(
        Math.max(0, d.at - d.server - (performance.now() - d.local)),
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const send = async (drawing: Drawing) => {
    if (sending.current) return false;
    sending.current = true;
    setBusy(true);
    setMessage("");
    if (!pending.current)
      pending.current = { id: crypto.randomUUID(), drawing };
    try {
      const result = await request<Published>("publish", [
        pending.current.id,
        pending.current.drawing,
      ]);
      sync(result.serverTime, result.nextEligibleAt);
      setPublished(result);
      pending.current = null;
      setRetry(false);
    } catch {
      setRetry(true);
      setMessage(
        "Publication could not be confirmed. Your draft is preserved. Retry sends the same drawing safely.",
      );
      try {
        const state = await request<DoodleFeed>("read");
        setPaused(state.submissionsPaused);
        sync(state.serverTime, state.nextEligibleAt);
      } catch {}
    } finally {
      sending.current = false;
      setBusy(false);
    }
    return false;
  };
  const wait = `${Math.floor(remaining / 60000)}:${String(Math.ceil(remaining / 1000) % 60).padStart(2, "0")}`;
  return (
    <main className="doodle-page doodle-publishing">
      <header>
        <p>ATOMIC BOND</p>
        <h1>GLOBAL DOODLE</h1>
        <a href={returnHref}>RETURN TO MY ATOM</a>
      </header>
      {published ? (
        <section className="doodle-panel" aria-label="Publication complete">
          <h2>DOODLE PUBLISHED</h2>
          <p>LIVE FOR 7 DAYS</p>
          <a className="doodle-create" href={returnHref}>
            RETURN TO MY ATOM
          </a>
          <button
            disabled={remaining > 0}
            onClick={() => {
              setPublished(null);
              setRevision((n) => n + 1);
            }}
          >
            DRAW ANOTHER
          </button>
          {remaining > 0 && <p>Next drawing in {wait}</p>}
        </section>
      ) : (
        <>
          <p>
            Monochrome drawings remain live for 7 days. Do not include private
            information.
          </p>
          {paused && <p role="status">NEW SUBMISSIONS PAUSED</p>}
          {remaining > 0 && <p>Next submission in {wait}</p>}
          <DoodleComposer
            key={revision}
            simplified
            editingLocked={retry}
            busy={busy}
            paused={paused || (remaining > 0 && !retry)}
            onSubmit={send}
          />
        </>
      )}
      {message && <p role="alert">{message}</p>}
    </main>
  );
}
