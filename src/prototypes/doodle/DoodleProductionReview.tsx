"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  selectAppearance,
  useAppearance,
} from "../../components/appearance/appearance";
import { DoodleComposer } from "./DoodleComposer";
import { DoodlePlayback } from "./DoodleCanvas";
import { decode, type Drawing } from "./model";
import { reviewFrame } from "./review-frame";
import { paintDoodle } from "./paint";
import "./doodle.css";
import "./production-review.css";

type Item = {
  id: string;
  atomNumber: string;
  bitmap: string;
  publishedAt: string;
  expiresAt: string;
  score: number;
  appreciated: boolean;
  own: boolean;
  state?: string;
  fingerprint?: string;
  reportCount?: number;
  reportCategories?: string[];
  submittedAt?: string;
};
type Feed = {
  serverTime: string;
  submissionsPaused: boolean;
  items: Item[];
  hall: Item[];
  mine: { id: string; state: string }[];
};
type Decision = {
  id: string;
  drawingId: string | null;
  atomNumber: string | null;
  action: string;
  createdAt: string;
};
type Queue = { threshold: number; submissionsPaused: boolean; items: Item[] };

function Bitmap({
  bitmap,
  description,
}: {
  bitmap: string;
  description: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const appearance = useAppearance();
  useEffect(() => {
    const node = ref.current!;
    const draw = () => paintDoodle(node, decode(bitmap));
    const observer = new ResizeObserver(draw);
    observer.observe(node);
    draw();
    return () => observer.disconnect();
  }, [bitmap, appearance]);
  return (
    <canvas
      ref={ref}
      className="doodle-canvas"
      role="img"
      aria-label={description}
    />
  );
}
function ReplayReview({ drawing }: { drawing: Drawing }) {
  const [step, setStep] = useState(0);
  const ref = useRef<HTMLCanvasElement>(null);
  const appearance = useAppearance();
  const total = drawing.strokes?.reduce((n, s) => n + s.points.length, 0) ?? 0;
  useEffect(() => {
    const node = ref.current!;
    const draw = () => paintDoodle(node, reviewFrame(drawing, step));
    const observer = new ResizeObserver(draw);
    observer.observe(node);
    draw();
    return () => observer.disconnect();
  }, [drawing, step, total, appearance]);
  return (
    <div className="doodle-review-sequence">
      <DoodlePlayback
        drawing={drawing}
        description="Submitted drawing replay"
      />
      <p>Inspect erased and intermediate content before approval.</p>
      {drawing.strokes === null && (
        <p className="doodle-help">
          Static-only submission: no replay was retained. Review the complete
          final bitmap; no intermediate animation will be published.
        </p>
      )}
      <canvas
        ref={ref}
        className="doodle-canvas"
        role="img"
        aria-label={`Replay point ${step} of ${total}`}
      />
      <label>
        REPLAY POINT {step} / {total}
        <input
          aria-label="Replay point"
          type="range"
          min={0}
          max={total}
          value={step}
          onChange={(e) => setStep(Number(e.target.value))}
        />
      </label>
      <div className="doodle-actions">
        <button disabled={!step} onClick={() => setStep((n) => n - 1)}>
          PREVIOUS POINT
        </button>
        <button disabled={step === total} onClick={() => setStep((n) => n + 1)}>
          NEXT POINT
        </button>
      </div>
    </div>
  );
}

export function DoodleProductionReview({
  production = false,
  administrator = false,
}: {
  production?: boolean;
  administrator?: boolean;
}) {
  const [actor, setActor] = useState(1);
  const [tab, setTab] = useState<"live" | "hall" | "admin">(
    administrator ? "admin" : "live",
  );
  const [feed, setFeed] = useState<Feed | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [queueCursor, setQueueCursor] = useState<(string | undefined)[]>([]);
  const [queueView, setQueueView] = useState("ALL");
  const [history, setHistory] = useState<Decision[]>([]);
  const [restrictionNumber, setRestrictionNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    production
      ? "Drawings are public to active participants for one hour. Do not include private information."
      : "Synthetic local database. No production participants or publication.",
  );
  const [replay, setReplay] = useState<{ id: string; drawing: Drawing } | null>(
    null,
  );
  const [review, setReview] = useState<{ item: Item; drawing: Drawing } | null>(
    null,
  );
  const [reviewed, setReviewed] = useState(false);
  const [threshold, setThreshold] = useState(5);
  const [stats, setStats] = useState<string>("");
  const appearance = useAppearance();
  // Hide expired copies between reads without additional polling.
  useEffect(() => {
    if (!feed?.items.length) return;
    const deadline = Math.min(
      ...feed.items.map((item) => Date.parse(item.expiresAt)),
    );
    const timer = setTimeout(
      () => {
        setFeed((current) =>
          current
            ? {
                ...current,
                serverTime: new Date(deadline).toISOString(),
                items: current.items.filter(
                  (item) => Date.parse(item.expiresAt) > deadline,
                ),
              }
            : null,
        );
        setReplay((current) =>
          current &&
          feed.items.some(
            (item) =>
              item.id === current.id && Date.parse(item.expiresAt) <= deadline,
          )
            ? null
            : current,
        );
      },
      Math.max(0, deadline - Date.parse(feed.serverTime)),
    );
    return () => clearTimeout(timer);
  }, [feed]);
  const request = useCallback(
    async (action: string, args: unknown[] = []) => {
      const response = await fetch(
        production ? "/api/doodle" : "/api/review/doodle",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            production ? { action, args } : { actor, action, args },
          ),
          cache: "no-store",
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Operation rejected");
      return result.data;
    },
    [actor, production],
  );
  const refresh = useCallback(async () => {
    const data: Feed = await request("read");
    setFeed(data);
    setReplay((current) =>
      current &&
      [...data.items, ...data.hall].some((item) => item.id === current.id)
        ? current
        : null,
    );
    if (tab === "admin") {
      const q: Queue = await request("queue", [
        queueCursor[0],
        queueCursor[1],
        queueView,
      ]);
      setQueue(q);
      setHistory(await request("history"));
      setThreshold(q.threshold);
    }
  }, [request, tab, queueCursor, queueView]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data: Feed = await request("read");
        if (!cancelled) {
          setFeed(data);
          setReplay((current) =>
            current &&
            [...data.items, ...data.hall].some((item) => item.id === current.id)
              ? current
              : null,
          );
        }
        if (tab === "admin") {
          const q: Queue = await request("queue", [
            queueCursor[0],
            queueCursor[1],
            queueView,
          ]);
          const decisions: Decision[] = await request("history");
          if (!cancelled) {
            setQueue(q);
            setHistory(decisions);
            setThreshold(q.threshold);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setFeed(null);
          setQueue(null);
          setReplay(null);
          setReview(null);
          setMessage(e instanceof Error ? e.message : "Access denied");
        }
      }
    };
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60000);
    const focus = () => void load();
    window.addEventListener("focus", focus);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [request, tab, queueCursor, queueView]);
  const perform = async (
    action: string,
    args: unknown[] = [],
    success = production ? "Updated." : "Updated in the synthetic database.",
  ) => {
    setBusy(true);
    try {
      const result = await request(action, args);
      setMessage(
        action !== "submit" && typeof result === "string" ? result : success,
      );
      await refresh();
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Operation rejected");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const showReplay = async (item: Item, admin = false) => {
    setBusy(true);
    try {
      const drawing: Drawing = await request(admin ? "review" : "replay", [
        item.id,
      ]);
      if (admin) {
        setReviewed(false);
        setReview({ item, drawing });
      } else setReplay({ id: item.id, drawing });
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  };
  const moderation = async (action: string) => {
    if (!review) return;
    if (
      await perform("moderate", [
        review.item.id,
        action,
        review.item.fingerprint,
      ])
    )
      setReview(null);
  };
  const cards = (items: Item[], hall = false) => (
    <div className={hall ? "doodle-hall-grid" : "doodle-live-grid"}>
      {items.map((item, i) => (
        <article className="doodle-panel doodle-card" key={item.id}>
          <div className="doodle-panel-heading">
            <h3>
              {hall ? `#${i + 1} · ` : ""}ATOM {item.atomNumber}
            </h3>
            <span>{item.score} appreciations</span>
          </div>
          <Bitmap
            bitmap={item.bitmap}
            description={`Drawing by synthetic Atom ${item.atomNumber}`}
          />
          <p className="doodle-help">
            {hall
              ? new Date(item.publishedAt).toLocaleDateString()
              : `Expires ${new Date(item.expiresAt).toLocaleTimeString()}`}
          </p>
          <div className="doodle-actions">
            {!hall && (
              <button
                disabled={busy || item.own || item.appreciated}
                aria-pressed={item.appreciated}
                onClick={() =>
                  void perform("vote", [item.id], "Appreciation recorded once.")
                }
              >
                {item.own
                  ? "YOUR DRAWING"
                  : item.appreciated
                    ? "APPRECIATED"
                    : "APPRECIATE"}
              </button>
            )}
            <button disabled={busy} onClick={() => void showReplay(item)}>
              REPLAY
            </button>
          </div>
          <details>
            <summary>REPORT DRAWING</summary>
            <div className="doodle-report-options">
              {["ABUSE", "PERSONAL_INFORMATION", "SEXUAL", "OTHER"].map(
                (category) => (
                  <button
                    disabled={busy}
                    key={category}
                    onClick={() =>
                      void perform(
                        "report",
                        [item.id, category],
                        "Report received for administrator review.",
                      )
                    }
                  >
                    {category.replaceAll("_", " ")}
                  </button>
                ),
              )}
            </div>
          </details>
        </article>
      ))}
    </div>
  );
  return (
    <main className="doodle-page doodle-production">
      <header className="doodle-header">
        <p className="wordmark">ATOMIC BOND</p>
        <div className="doodle-appearance" role="group" aria-label="Appearance">
          {(["light", "dark"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={appearance === value}
              onClick={() => selectAppearance(value)}
            >
              {value.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      <div className="doodle-intro">
        <p className="doodle-kicker">
          {production ? "GLOBAL CANVAS" : "TASK 12.1 · LOCAL SYNTHETIC REVIEW"}
        </p>
        <h1>GLOBAL DOODLE</h1>
        <p>A small drawing. A passing moment.</p>
        <p className="doodle-muted">
          {production
            ? "Share a temporary drawing, appreciate others, and explore the Top 10."
            : "Review submission, appreciation and the Top 10. This is an isolated database, not a live network."}
        </p>
        {production ? (
          <a href="/explore">RETURN TO ATOMIC BOND</a>
        ) : (
          <a href="/review/doodle">Original approved editor prototype</a>
        )}
      </div>
      {!production && (
        <section className="doodle-time">
          <h2>LOCAL TEST CONTROLS</h2>
          <label>
            SYNTHETIC SESSION
            <select
              aria-label="Synthetic session"
              value={actor}
              onChange={(e) => {
                setActor(Number(e.target.value));
                setFeed(null);
                setQueue(null);
                setReview(null);
                setReplay(null);
              }}
            >
              <option value={-1}>Anonymous</option>
              {Array.from({ length: 26 }, (_, i) => (
                <option key={i} value={i}>
                  {i === 0 ? "Administrator" : `Participant ${i}`} (synthetic)
                </option>
              ))}
            </select>
          </label>
          <div className="doodle-time-actions">
            {[1, 60, 1441].map((n) => (
              <button
                disabled={busy}
                key={n}
                onClick={() => void perform("advance", [n])}
              >
                +{n === 1441 ? "24 HOURS" : `${n} MIN`}
              </button>
            ))}
            <button disabled={busy} onClick={() => void perform("cleanup")}>
              RUN CLEANUP
            </button>
            <button disabled={busy} onClick={() => void perform("reset")}>
              RESET FIXTURES
            </button>
            <button
              disabled={busy || actor < 0}
              onClick={() =>
                void perform(
                  "deactivate",
                  [],
                  "Deactivated; owner access ended.",
                ).then(() => {
                  setFeed(null);
                  setQueue(null);
                  setReplay(null);
                  setReview(null);
                })
              }
            >
              DEACTIVATE TEST OWNER
            </button>
            <button
              disabled={busy || actor < 0}
              onClick={() =>
                void perform(
                  "reactivate",
                  [],
                  "Fresh synthetic verification and explicit reactivation completed.",
                )
              }
            >
              VERIFY & REACTIVATE TEST OWNER
            </button>
            <button
              onClick={async () => {
                const s = await request("stats");
                setStats(
                  `${s.records} records · ${s.payload_bytes} payload bytes · ${s.hall_count}/10 Hall entries`,
                );
              }}
            >
              STORAGE COUNTS
            </button>
          </div>
          <p role="status">{stats}</p>
          <p className="doodle-help">
            Seed: ten Hall entries and two live drawings, one with eight
            appreciations. Advance 60 minutes, then use administrator review to
            approve the qualifying replacement.
          </p>
        </section>
      )}
      <p className="doodle-message" role="status">
        {message}
      </p>
      <nav className="doodle-tabs" aria-label="Global Doodle sections">
        {(["live", "hall", "admin"] as const)
          .filter((value) => !production || administrator || value !== "admin")
          .map((value) => (
            <button
              key={value}
              aria-pressed={tab === value}
              onClick={() => {
                setTab(value);
                setReview(null);
                setReplay(null);
              }}
            >
              {value === "live"
                ? "LIVE DRAWINGS"
                : value === "hall"
                  ? "HALL OF FAME"
                  : "MODERATION REVIEW"}
            </button>
          ))}
      </nav>
      {tab === "live" && (
        <div className="doodle-layout">
          {feed?.submissionsPaused && (
            <p role="status">
              NEW SUBMISSIONS PAUSED. Existing drawings remain available until
              their deadline.
            </p>
          )}
          <DoodleComposer
            paused={feed?.submissionsPaused ?? false}
            busy={busy || !feed}
            onSubmit={(drawing) =>
              perform(
                "submit",
                [crypto.randomUUID(), drawing],
                "Published immediately. Your drawing is visible for one hour.",
              )
            }
          />
          <div className="doodle-feed-column">
            <h2>LIVE DRAWINGS</h2>
            <div className="doodle-actions">
              <button
                disabled={busy}
                onClick={() =>
                  void refresh().catch((error) => setMessage(String(error)))
                }
              >
                LATEST DRAWINGS
              </button>
              {feed?.items.length === 20 && (
                <button
                  disabled={busy}
                  onClick={async () => {
                    const last = feed.items[feed.items.length - 1]!;
                    setBusy(true);
                    try {
                      setFeed(
                        await request("read", [last.publishedAt, last.id]),
                      );
                      setReplay(null);
                    } catch (error) {
                      setMessage(String(error));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  EARLIER DRAWINGS
                </button>
              )}
            </div>
            {feed?.items.length ? (
              cards(feed.items)
            ) : (
              <p>No live drawings available.</p>
            )}
            {feed && (
              <>
                <h3>YOUR SUBMISSIONS</h3>
                {feed.mine.map((m) => (
                  <p key={m.id}>{m.state}</p>
                ))}
              </>
            )}
          </div>
        </div>
      )}
      {tab === "hall" && (
        <section>
          <h2>GLOBAL DOODLE HALL OF FAME</h2>
          <p>Up to ten drawings. Final scores only; no ongoing voting.</p>
          {feed?.hall.length ? (
            cards(feed.hall, true)
          ) : (
            <p>No qualifying drawings.</p>
          )}
        </section>
      )}
      {tab === "admin" && (
        <section className="doodle-panel">
          <h2>PRIVATE MODERATION QUEUE</h2>
          {queue ? (
            <>
              <p>
                New submissions: {queue.submissionsPaused ? "PAUSED" : "OPEN"}
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  void perform("pause", [!queue.submissionsPaused])
                }
              >
                {queue.submissionsPaused
                  ? "RESUME SUBMISSIONS"
                  : "PAUSE NEW SUBMISSIONS"}
              </button>
              <label>
                MODERATION VIEW
                <select
                  value={queueView}
                  onChange={(e) => {
                    setQueueView(e.target.value);
                    setQueueCursor([]);
                  }}
                >
                  <option value="ALL">All current drawings</option>
                  <option value="REPORTED">Reported drawings</option>
                  <option value="ACTIVE">Active drawings</option>
                  <option value="CANDIDATE">Hall candidates</option>
                  <option value="HALL">Hall of Fame</option>
                </select>
              </label>
              <label>
                QUALIFICATION MINIMUM
                <input
                  type="number"
                  min={5}
                  max={1000000}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                />
              </label>
              <button
                disabled={busy}
                onClick={() =>
                  void perform(
                    "threshold",
                    [threshold],
                    "Threshold updated for future publications only.",
                  )
                }
              >
                SAVE MINIMUM
              </button>
              <p className="doodle-help">
                Applies to future publications. Inspect reported drawings
                promptly. Review the full replay before Hall promotion. Review
                pages contain at most 25 drawings; use Next Review Page to
                continue. New submissions appear on a fresh pass from the first
                page.
              </p>
              <div className="doodle-moderation-list">
                {queue.items.map((item) => (
                  <article key={item.id}>
                    <Bitmap
                      bitmap={item.bitmap}
                      description="Private review thumbnail"
                    />
                    <div>
                      <p>
                        ATOM {item.atomNumber} · {item.state}
                      </p>
                      <p>
                        {item.score} appreciations · {item.reportCount} reports
                      </p>
                      {Boolean(item.reportCount) && (
                        <p>{item.reportCategories?.join(", ")}</p>
                      )}
                      <button
                        disabled={busy}
                        onClick={() => void showReplay(item, true)}
                      >
                        REVIEW {item.state}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="doodle-actions">
                <button disabled={busy} onClick={() => setQueueCursor([])}>
                  FIRST REVIEW PAGE
                </button>
                <button
                  disabled={busy || queue.items.length < 25}
                  onClick={() => {
                    const last = queue.items.at(-1)!;
                    setQueueCursor([last.submittedAt, last.id]);
                  }}
                >
                  NEXT REVIEW PAGE
                </button>
              </div>
              <section aria-label="Moderation history">
                <label>
                  POSTING RESTRICTION — ATOM NUMBER
                  <input
                    type="text"
                    inputMode="numeric"
                    value={restrictionNumber}
                    onChange={(e) => setRestrictionNumber(e.target.value)}
                  />
                </label>
                <button
                  disabled={busy || !/^[1-9][0-9]*$/.test(restrictionNumber)}
                  onClick={() =>
                    void perform("restrictAtom", [restrictionNumber, true])
                  }
                >
                  RESTRICT ATOM POSTING
                </button>
                <button
                  disabled={busy || !/^[1-9][0-9]*$/.test(restrictionNumber)}
                  onClick={() =>
                    void perform("restrictAtom", [restrictionNumber, false])
                  }
                >
                  RESTORE ATOM POSTING
                </button>
                <h3>MODERATION DECISIONS</h3>
                {history.map((decision) => (
                  <p key={decision.id}>
                    {decision.action} ·{" "}
                    {new Date(decision.createdAt).toLocaleString()}{" "}
                    {decision.atomNumber && `· ATOM ${decision.atomNumber}`} ·{" "}
                    {decision.drawingId
                      ? "Drawing " + decision.drawingId.slice(0, 8)
                      : "No retained drawing"}
                  </p>
                ))}
                <button
                  disabled={busy}
                  onClick={() =>
                    void request("history")
                      .then(setHistory)
                      .catch((e) => setMessage(String(e)))
                  }
                >
                  LATEST DECISIONS
                </button>
                <button
                  disabled={busy || history.length < 25}
                  onClick={() =>
                    void request("history", [history.at(-1)?.id])
                      .then(setHistory)
                      .catch((e) => setMessage(String(e)))
                  }
                >
                  EARLIER DECISIONS
                </button>
              </section>
            </>
          ) : (
            <p>
              Administrator authorization required. Select the synthetic
              administrator to review.
            </p>
          )}
        </section>
      )}
      {replay && (
        <section className="doodle-panel" aria-label="Drawing replay">
          <h2>DRAWING REPLAY</h2>
          <button onClick={() => setReplay(null)}>CLOSE REPLAY</button>
          <DoodlePlayback
            drawing={replay.drawing}
            description="Selected drawing replay"
          />
        </section>
      )}
      {review && (
        <section className="doodle-panel" aria-label="Moderation decision">
          <h2>REVIEW · {review.item.state}</h2>
          <button onClick={() => setReview(null)}>CLOSE REVIEW</button>
          <ReplayReview key={review.item.id} drawing={review.drawing} />
          <label className="doodle-review-check">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            I reviewed the bitmap and intermediate replay content.
          </label>
          <div className="doodle-time-actions">
            {review.item.state === "CANDIDATE" && (
              <button
                disabled={!reviewed || busy}
                onClick={() => void moderation("PROMOTE")}
              >
                APPROVE HALL PROMOTION
              </button>
            )}
            {review.item.state === "CANDIDATE" && (
              <button disabled={busy} onClick={() => void moderation("REJECT")}>
                REJECT
              </button>
            )}
            <button disabled={busy} onClick={() => void moderation("REMOVE")}>
              REMOVE DRAWING
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void perform(
                  "restrict",
                  [review.item.id, true],
                  "Doodle posting restricted.",
                )
              }
            >
              RESTRICT POSTING
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void perform(
                  "restrict",
                  [review.item.id, false],
                  "Doodle posting restriction lifted.",
                )
              }
            >
              LIFT RESTRICTION
            </button>
          </div>
        </section>
      )}
      <footer>
        {production
          ? "Drawings are visible to ACTIVE participants. Do not include private personal information. Reports are reviewed by administrators."
          : "LOCAL SYNTHETIC DATA ONLY · No hosted migration or production publication. Drawings and votes use the candidate PostgreSQL operations."}
      </footer>
    </main>
  );
}
