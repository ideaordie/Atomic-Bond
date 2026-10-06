"use client";
import { useState } from "react";
import { manageSignal, signalHistory } from "../../services/signals/actions";
import {
  validateSignal,
  type AdminSignal,
  type SignalDraft,
} from "../../services/signals/model";
import { SignalPanel } from "./NetworkSignal";
import { AdminNavigation } from "../admin/AdminNavigation";
const blank: SignalDraft = {
  type: "ATOMIC_BOND",
  title: "",
  message: "",
  linkLabel: null,
  linkUrl: null,
  startsAt: null,
  endsAt: null,
};
export function SignalAdmin({ initial }: { initial: AdminSignal[] }) {
  const [history, setHistory] = useState(initial),
    [draft, setDraft] = useState(blank),
    [id, setId] = useState<string | null>(null),
    [preview, setPreview] = useState(false),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [replace, setReplace] = useState(false),
    [saved, setSaved] = useState("");
  const active = history.find((s) => s.state === "ACTIVE");
  const change = (patch: Partial<SignalDraft>) => {
    setDraft({ ...draft, ...patch });
    setPreview(false);
  };
  const run = async (action: "save" | "publish" | "end", target = id) => {
    setBusy(true);
    try {
      const result = await manageSignal(
        action,
        target,
        action === "save" ? draft : null,
        action === "publish" && replace ? (active?.id ?? null) : null,
      );
      if (result.error) {
        setNotice(result.error);
        return;
      }
      if (action === "save") {
        setId(result.id ?? null);
        setSaved(JSON.stringify(draft));
      }
      setHistory(await signalHistory());
      setNotice(
        action === "save"
          ? "DRAFT SAVED — not visible to participants."
          : "Signal updated.",
      );
      setReplace(false);
    } catch {
      setNotice(
        "Unable to refresh administrator access. Reload before trying again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="signal-admin">
      <AdminNavigation />
      <h1>NETWORK SIGNAL ADMINISTRATION</h1>
      <p>
        Global beta announcements. No targeting, sponsorship or outbound
        notifications.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            validateSignal(draft);
            setPreview(true);
            setNotice("");
          } catch (err) {
            setNotice((err as Error).message);
          }
        }}
      >
        <label>
          TYPE
          <select
            value={draft.type}
            onChange={(e) =>
              change({ type: e.target.value as SignalDraft["type"] })
            }
          >
            <option>ATOMIC_BOND</option>
            <option>COMMUNITY</option>
          </select>
        </label>
        <label>
          TITLE
          <input
            required
            maxLength={80}
            value={draft.title}
            onChange={(e) => change({ title: e.target.value })}
          />
        </label>
        <label>
          MESSAGE
          <textarea
            required
            maxLength={500}
            value={draft.message}
            onChange={(e) => change({ message: e.target.value })}
          />
        </label>
        <label>
          LINK LABEL (optional)
          <input
            maxLength={40}
            value={draft.linkLabel ?? ""}
            onChange={(e) => change({ linkLabel: e.target.value || null })}
          />
        </label>
        <label>
          HTTPS LINK (optional)
          <input
            type="url"
            maxLength={2048}
            value={draft.linkUrl ?? ""}
            onChange={(e) => change({ linkUrl: e.target.value || null })}
          />
        </label>
        <p>Times use UTC. Leave start empty to publish immediately.</p>
        <label>
          START (UTC)
          <input
            type="datetime-local"
            value={draft.startsAt?.slice(0, 16) ?? ""}
            onChange={(e) =>
              change({
                startsAt: e.target.value
                  ? new Date(e.target.value + "Z").toISOString()
                  : null,
              })
            }
          />
        </label>
        <label>
          END (UTC)
          <input
            type="datetime-local"
            value={draft.endsAt?.slice(0, 16) ?? ""}
            onChange={(e) =>
              change({
                endsAt: e.target.value
                  ? new Date(e.target.value + "Z").toISOString()
                  : null,
              })
            }
          />
        </label>
        <div>
          <button disabled={busy} type="submit">
            PREVIEW
          </button>
          <button
            disabled={busy}
            type="button"
            onClick={() => void run("save")}
          >
            SAVE DRAFT
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setId(null);
              setDraft(blank);
              setPreview(false);
            }}
          >
            NEW DRAFT
          </button>
        </div>
      </form>
      <p role="status">{notice}</p>
      {preview && (
        <section aria-label="Signal preview">
          <h2>PREVIEW</h2>
          <SignalPanel
            signal={{ ...draft, id: id ?? "preview", publishedAt: null }}
          />
          <p>
            Save this draft before publication. Publication uses its saved
            contents.
          </p>
          {active && (
            <label>
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
              />
              Explicitly end and replace “{active.title}” now
            </label>
          )}
          <button
            disabled={busy || !id || saved !== JSON.stringify(draft)}
            onClick={() => void run("publish")}
          >
            PUBLISH SAVED DRAFT
          </button>
        </section>
      )}
      <h2>CURRENT SIGNAL & HISTORY</h2>
      {history.length === 0 && <p>No Signals yet.</p>}
      {history.map((s) => (
        <article key={s.id}>
          <h3>{s.title}</h3>
          <p>
            {s.state} · {s.type}
          </p>
          <p>{s.message}</p>
          {s.state === "DRAFT" && (
            <button
              disabled={busy}
              onClick={() => {
                setId(s.id);
                setDraft(s);
                setSaved(JSON.stringify(s));
                setPreview(false);
              }}
            >
              EDIT / PREVIEW
            </button>
          )}
          {["ACTIVE", "SCHEDULED"].includes(s.state) && (
            <button
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "End this Signal? It will no longer be available to participants.",
                  )
                )
                  void run("end", s.id);
              }}
            >
              END / UNPUBLISH
            </button>
          )}
        </article>
      ))}
    </main>
  );
}
