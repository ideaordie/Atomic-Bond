"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { selectAppearance, useAppearance } from "../appearance/appearance";
import styles from "./view.module.css";

const stages = [
  "PROPOSED",
  "UNDER REVIEW",
  "PLANNED",
  "LIVE",
  "DEFERRED",
  "DECLINED",
] as const;
type Stage = (typeof stages)[number];
type Idea = {
  createdAt: string;
  id: string;
  revision: number;
  moderation: string;
  withdrawnAt: string | null;
  supportCount: number;
  acknowledgmentEligible: boolean;
  authorAlias?: string | null;
  text: string;
  stage: Stage;
  reason: string;
  supported: boolean;
  mine?: boolean;
};
export function EvolveView({
  local = false,
  administrator = false,
}: {
  local?: boolean;
  administrator?: boolean;
}) {
  const appearance = useAppearance();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [draft, setDraft] = useState("");
  const [attribution, setAttribution] = useState(false);
  const [nextSubmission, setNextSubmission] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<
    { id: string; improvement: string; explanation: string }[]
  >([]);
  const [more, setMore] = useState(false);
  const [canAdmin, setCanAdmin] = useState(false);
  const generation = useRef(0);
  const [filter, setFilter] = useState("ALL IDEAS");
  const [admin, setAdmin] = useState(administrator);
  const [acknowledge, setAcknowledge] = useState(true);
  const [message, setMessage] = useState("");
  const eligible = ready && !nextSubmission;
  const request = useCallback(
    async (operation: string, payload: Record<string, unknown> = {}) => {
      const response = await fetch(
        local ? "/review/evolve/api" : "/api/evolve",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation, payload }),
          cache: "no-store",
        },
      );
      const result = await response.json();
      if (!response.ok || result.error)
        throw new Error(result.error ?? "Request failed");
      return result;
    },
    [local],
  );
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    try {
      const session = await request("session");
      const result = await request(
        admin && session.data.isAdmin ? "admin_list" : "list",
      );
      if (current !== generation.current) return;
      setCanAdmin(session.data.isAdmin);
      setRevision(result.revision);
      setNextSubmission(
        result.nextSubmissionAt && result.nextSubmissionAt > result.serverTime
          ? result.nextSubmissionAt
          : null,
      );
      setIdeas(
        result.data.map((idea: Record<string, unknown>) => ({
          ...idea,
          text: idea.body ?? "Content removed",
          stage: idea.status,
          reason: idea.explanation,
        })),
      );
      setMore(result.data.length === 25);
      setReady(true);
    } catch (error) {
      if (current !== generation.current) return;
      setIdeas([]);
      setReady(false);
      setCanAdmin(false);
      setMessage(error instanceof Error ? error.message : "Request failed");
    }
  }, [admin, request]);
  useEffect(() => {
    const generationRef = generation;
    void Promise.resolve().then(refresh);
    const visibleRefresh = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(visibleRefresh, 30_000);
    window.addEventListener("pageshow", visibleRefresh);
    document.addEventListener("visibilitychange", visibleRefresh);
    return () => {
      ++generationRef.current;
      window.clearInterval(timer);
      window.removeEventListener("pageshow", visibleRefresh);
      document.removeEventListener("visibilitychange", visibleRefresh);
    };
  }, [refresh]);
  async function act(
    operation: string,
    payload: Record<string, unknown>,
    message: string,
  ) {
    if (busy) return;
    setBusy(true);
    ++generation.current;
    try {
      await request(operation, payload);
      setMessage(message);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Request failed. Refresh and try again.",
      );
    } finally {
      await refresh();
      setBusy(false);
    }
  }
  const visible = ideas.filter(
    (idea) =>
      filter === "ALL IDEAS" ||
      (filter === "MY CONTRIBUTIONS"
        ? idea.supported || idea.mine
        : idea.stage === filter),
  );
  function switchFixture(event: React.MouseEvent<HTMLButtonElement>) {
    const fixture = event.currentTarget.dataset.fixture;
    if (local && fixture)
      void act(
        "fixture_session",
        { fixture },
        `Signed in to synthetic ${fixture}.`,
      );
  }
  function updateStage(
    id: string,
    stage: Stage,
    reason: string,
    moderation: string,
  ) {
    const idea = ideas.find((idea) => idea.id === id);
    if (idea)
      void act(
        "moderate",
        {
          id,
          revision: idea.revision,
          status: stage,
          moderation,
          explanation: reason,
        },
        "Administrator decision saved.",
      );
  }
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className="wordmark">ATOMIC BOND</span>
        <button
          onClick={() =>
            selectAppearance(appearance === "dark" ? "light" : "dark")
          }
          aria-label={`Switch to ${appearance === "dark" ? "light" : "dark"} mode`}
        >
          {appearance === "dark" ? "LIGHT" : "DARK"}
        </button>
      </header>
      <p className={styles.prototype}>
        {local ? "LOCAL DATABASE - SYNTHETIC DATA" : "SHAPED BY OUR COMMUNITY"}
      </p>
      <section className={styles.hero} aria-labelledby="evolve-title">
        <div className={styles.orbit} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className={styles.kicker}>A LITTLE IDEA. A SHARED FUTURE.</p>
        <h1 id="evolve-title">
          EVOLVE<span aria-hidden="true">.</span>
        </h1>
        <h2>
          YOU DON&apos;T JUST USE ATOMIC BOND.
          <br />
          YOU HELP SHAPE WHAT IT BECOMES.
        </h2>
        <p>
          Something could be simpler. Something could bring us closer.
          <br className={styles.desktopBreak} /> Start with one small idea.
        </p>
        <a className={styles.primary} href="#suggestion">
          SHARE AN IDEA <span aria-hidden="true">↗</span>
        </a>
        <details className={styles.how}>
          <summary>How your contribution makes a difference</summary>
          <p>
            Ideas help us understand what matters. Support signals shared
            interest—not a promise, deadline, or automatic decision.
          </p>
          <p>
            Administrators weigh feasibility, safety, accessibility and the
            purpose of Atomic Bond. Every status decision includes an
            explanation.
          </p>
          <p>
            Verified ACTIVE Atoms only; one suggestion per 24 hours; up to 250
            characters. One equal support vote per idea, withdrawable at any
            time. Support multiple ideas. No paid influence, Bond weighting or
            personal rankings.
          </p>
        </details>
      </section>
      <div className={styles.workspace}>
        <section className={styles.ideas} aria-labelledby="ideas-title">
          <div className={styles.sectionHeading}>
            <h2 id="ideas-title">ROOM TO GROW</h2>
            <span>{visible.length} ideas</span>
          </div>
          <label className={styles.filter}>
            EXPLORE{" "}
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              {["ALL IDEAS", "MY CONTRIBUTIONS", ...stages].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <div className={styles.list}>
            {visible.map((idea) => (
              <article
                className={styles.card}
                key={idea.id}
                aria-label={idea.text}
              >
                <div className={styles.cardMeta}>
                  <span>
                    {idea.moderation === "PENDING"
                      ? "AWAITING REVIEW"
                      : idea.withdrawnAt
                        ? "WITHDRAWN"
                        : idea.stage}
                  </span>
                  <span>{idea.mine ? "YOUR IDEA" : "COMMUNITY IDEA"}</span>
                </div>
                <h3>{idea.text}</h3>
                {idea.authorAlias && (
                  <p className={styles.small}>
                    Suggested by {idea.authorAlias}
                  </p>
                )}
                {idea.stage === "LIVE" &&
                  acknowledge &&
                  idea.acknowledgmentEligible && (
                    <p className={styles.recognition}>
                      YOU HELPED SHAPE THIS.
                      <br />
                      <span>
                        Your contribution was part of the conversation.
                      </span>
                    </p>
                  )}
                <div className={styles.cardActions}>
                  <button
                    aria-pressed={idea.supported}
                    aria-label={
                      idea.supported ? "Withdraw support" : "Support this idea"
                    }
                    disabled={
                      busy ||
                      idea.moderation !== "VISIBLE" ||
                      !!idea.withdrawnAt
                    }
                    onClick={async () => {
                      await act(
                        "support",
                        { id: idea.id, supported: !idea.supported, revision },
                        idea.supported
                          ? "Support withdrawn."
                          : "Your support is added.",
                      );
                    }}
                  >
                    {idea.supported ? "SUPPORTED ✓" : "SUPPORT +"}
                  </button>
                  <span>{idea.supportCount} support</span>
                  {idea.mine &&
                    !idea.withdrawnAt &&
                    idea.moderation !== "REMOVED" && (
                      <button
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Withdraw this idea? It will be hidden and all support removed.",
                            )
                          )
                            void act(
                              "withdraw",
                              { id: idea.id, revision },
                              "Idea withdrawn.",
                            );
                        }}
                      >
                        WITHDRAW IDEA
                      </button>
                    )}
                  <details>
                    <summary>WHY THIS STATUS?</summary>
                    <p>{idea.reason}</p>
                    <ol
                      className={styles.progress}
                      aria-label="Possible idea progression"
                    >
                      {stages.slice(0, 4).map((stage) => (
                        <li
                          key={stage}
                          aria-current={
                            idea.stage === stage ? "step" : undefined
                          }
                        >
                          {stage}
                        </li>
                      ))}
                    </ol>
                    <p className={styles.small}>
                      A possible path, not a guaranteed sequence. Ideas may be
                      deferred or declined.
                    </p>
                  </details>
                </div>
                {admin && canAdmin && (
                  <Decision
                    key={`${idea.id}-${idea.stage}`}
                    idea={idea}
                    save={updateStage}
                    request={request}
                  />
                )}
              </article>
            ))}
            {!visible.length && (
              <p>No ideas here yet. There is room for yours.</p>
            )}
          </div>
          {more && (
            <button
              disabled={busy}
              onClick={async () => {
                const last = ideas.at(-1);
                if (!last) return;
                setBusy(true);
                const currentGeneration = ++generation.current;
                try {
                  const result = await request(
                    admin && canAdmin ? "admin_list" : "list",
                    { before: last.createdAt, beforeId: last.id },
                  );
                  if (currentGeneration !== generation.current) return;
                  setIdeas((current) => [
                    ...current,
                    ...result.data.map((idea: Record<string, unknown>) => ({
                      ...idea,
                      text: idea.body ?? "Content removed",
                      stage: idea.status,
                      reason: idea.explanation,
                    })),
                  ]);
                  setMore(result.data.length === 25);
                } catch {
                  setMessage("Refresh before loading more ideas.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              MORE IDEAS
            </button>
          )}
          <details
            onToggle={async (event) => {
              if (event.currentTarget.open) {
                try {
                  setHistory((await request("development_history")).data);
                } catch {
                  setHistory([]);
                }
              }
            }}
          >
            <summary>DEVELOPMENT HISTORY</summary>
            {history.map((entry) => (
              <p key={entry.id}>
                <strong>{entry.improvement}</strong>
                <br />
                {entry.explanation}
              </p>
            ))}
            {!history.length && <p>No published development history yet.</p>}
          </details>
        </section>
        <aside className={styles.aside}>
          <section
            className={styles.compose}
            id="suggestion"
            aria-labelledby="suggestion-title"
          >
            <p className={styles.kicker}>WHAT IF WE…</p>
            <h2 id="suggestion-title">
              Make it better,
              <br />
              together.
            </h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const text = draft.trim();
                if (!eligible || !text || text.length > 250) return;
                void act(
                  "submit",
                  { body: text, attribution, revision },
                  "IDEA RECEIVED � awaiting administrator review.",
                );
                setDraft("");
                setFilter("ALL IDEAS");
              }}
            >
              <label htmlFor="idea">
                One improvement you would love to see
              </label>
              <textarea
                id="idea"
                rows={4}
                maxLength={250}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="I wish we could…"
                aria-describedby="idea-help idea-count"
                disabled={!eligible}
              />
              <label>
                <input
                  type="checkbox"
                  checked={attribution}
                  onChange={(e) => setAttribution(e.target.checked)}
                />{" "}
                Use my existing public alias (optional)
              </label>
              <div className={styles.counter}>
                <span id="idea-help">
                  Keep it kind. Leave out private information.
                </span>
                <span id="idea-count">{draft.length}/250</span>
              </div>
              <button
                className={styles.primary}
                disabled={busy || !eligible || !draft.trim()}
              >
                {eligible ? "PROPOSE IDEA" : "IDEA SHARED ✓"}
              </button>
              <p className={styles.small}>
                {eligible
                  ? "One suggestion per 24 hours. Small ideas welcome."
                  : nextSubmission
                    ? `Next suggestion: ${new Date(nextSubmission).toLocaleString()}.`
                    : "Sign in with a verified ACTIVE Atom."}
              </p>
            </form>
          </section>
          <section className={styles.preferences} aria-label="Review controls">
            {local && <p className={styles.kicker}>LOCAL TEST SESSION</p>}
            <label>
              <input
                type="checkbox"
                checked={acknowledge}
                onChange={(e) => setAcknowledge(e.target.checked)}
              />{" "}
              Show my LIVE acknowledgments
            </label>
            {local &&
              ["participant-a", "participant-b", "administrator"].map(
                (fixture) => (
                  <button
                    key={fixture}
                    disabled={busy}
                    data-fixture={fixture}
                    onClick={switchFixture}
                  >
                    {fixture}
                  </button>
                ),
              )}
            {local && canAdmin && (
              <button aria-pressed={admin} onClick={() => setAdmin(!admin)}>
                {admin ? "EXIT LOCAL ADMIN" : "LOCAL ADMIN VIEW"}
              </button>
            )}
            {canAdmin && admin && (
              <ReleaseHistory
                publish={(payload) =>
                  act(
                    "publish_history",
                    payload,
                    "Independent release history published.",
                  )
                }
              />
            )}
            {local && (
              <p className={styles.small}>
                Loopback-only synthetic sessions. Ideas and support persist in
                the isolated local database. Production authentication is
                unchanged.
              </p>
            )}
          </section>
        </aside>
      </div>
      <p role="status" className={styles.feedback}>
        {message}
      </p>
      <footer className={styles.footer}>
        SHAPED BY PEOPLE. BUILT WITH CARE.
        <br />
        <span>Ideas inform development. Every voice has equal weight.</span>
      </footer>
    </main>
  );
}

function Decision({
  idea,
  save,
  request,
}: {
  idea: Idea;
  request: (
    operation: string,
    payload: Record<string, unknown>,
  ) => Promise<{ data: unknown[] }>;
  save: (id: string, stage: Stage, reason: string, moderation: string) => void;
}) {
  const [audit, setAudit] = useState<unknown[]>([]);
  const [auditError, setAuditError] = useState("");
  const [stage, setStage] = useState(idea.stage);
  const [reason, setReason] = useState(idea.reason);
  const [moderation, setModeration] = useState("VISIBLE");
  return (
    <form
      className={styles.decision}
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim()) save(idea.id, stage, reason.trim(), moderation);
      }}
    >
      <strong>ADMINISTRATOR - STATUS DECISION</strong>
      <label>
        Visibility
        <select
          value={moderation}
          onChange={(e) => setModeration(e.target.value)}
        >
          {["VISIBLE", "HIDDEN", "REMOVED"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value as Stage)}
        >
          {stages.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        Explanation
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          maxLength={400}
          rows={3}
        />
      </label>
      <button disabled={!reason.trim()}>SAVE DECISION</button>
      <details
        onToggle={async (event) => {
          if (event.currentTarget.open) {
            try {
              setAudit((await request("history", { id: idea.id })).data);
            } catch {
              setAudit([]);
              setAuditError("Audit unavailable. Refresh your session.");
            }
          }
        }}
      >
        <summary>PRIVATE DECISION HISTORY</summary>
        <pre>{auditError || JSON.stringify(audit, null, 2)}</pre>
      </details>
    </form>
  );
}

function ReleaseHistory({
  publish,
}: {
  publish: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [reviewed, setReviewed] = useState(false);
  return (
    <details>
      <summary>PUBLISH DEVELOPMENT HISTORY</summary>
      <form
        className={styles.decision}
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          await publish({
            improvement: data.get("improvement"),
            completedOn: data.get("completedOn"),
            explanation: data.get("explanation"),
            sanitized: reviewed,
          });
        }}
      >
        <label>
          Implemented improvement
          <input name="improvement" required maxLength={250} />
        </label>
        <label>
          Completion date
          <input name="completedOn" type="date" required />
        </label>
        <label>
          Independent factual explanation
          <textarea name="explanation" required maxLength={500} />
        </label>
        <label>
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(event) => setReviewed(event.target.checked)}
          />{" "}
          I reviewed this independent summary: no personal information,
          attribution or copied suggestion text.
        </label>
        <button disabled={!reviewed}>PUBLISH HISTORY</button>
      </form>
    </details>
  );
}
