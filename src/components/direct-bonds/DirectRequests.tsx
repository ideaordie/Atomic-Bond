"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { directRequest } from "../../services/direct-bonds/actions";
import type {
  DirectTransport,
  DirectItem,
  DirectOperation,
  DirectResult,
} from "../../services/direct-bonds/types";
import "./direct-bonds.css";
export function RequestAction({
  target,
  transport = directRequest,
  onChanged = () => {},
}: {
  target: string;
  transport?: DirectTransport;
  onChanged?: () => void;
}) {
  const [state, setState] = useState<DirectResult>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const guard = useRef(false);
  useEffect(() => {
    let live = true;
    transport("eligibility", { target })
      .then((r) => {
        if (live) setState(r);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [target, transport]);
  if (!state.eligible) return null;
  async function act() {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      await transport(
        state.pending ? "cancel" : "create",
        state.pending ? { id: state.id } : { target },
      );
      setState(await transport("eligibility", { target }));
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="direct-action">
      <p className="direct-action-status" role="status">
        {state.pending ? "REQUEST PENDING" : ""}
      </p>
      <button
        className="view-network"
        disabled={busy}
        onClick={() => void act()}
      >
        {busy
          ? "PLEASE WAIT…"
          : state.pending
            ? "CANCEL REQUEST"
            : "REQUEST DIRECT BOND"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export function DirectRequests({
  enabled = true,
  blocked = false,
  children,
  transport = directRequest,
  onAccepted = async () => {},
  onReady = () => {},
  onDialog = () => {},
}: {
  enabled?: boolean;
  blocked?: boolean;
  children?: ReactNode;
  transport?: DirectTransport;
  onAccepted?: () => Promise<void>;
  onReady?: () => void;
  onDialog?: (open: boolean) => void;
}) {
  const [items, setItems] = useState<DirectItem[]>([]);
  const [open, setOpen] = useState(false);
  const [notification, setNotification] = useState<DirectItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const guard = useRef(false);
  const initial = useRef(false);
  const callbacks = useRef({ onAccepted, onReady, onDialog });
  useEffect(() => {
    callbacks.current = { onAccepted, onReady, onDialog };
  }, [onAccepted, onReady, onDialog]);
  async function load() {
    const r = await transport("list");
    setItems(r.items ?? []);
    setMore(r.items?.length === 50);
  }
  useEffect(() => {
    if (!enabled || initial.current) return;
    initial.current = true;
    transport("notice")
      .then((r) => {
        setItems(r.items ?? []);
        setMore(r.items?.length === 50);
        if (r.noticeItem) {
          setNotification(r.noticeItem);
          callbacks.current.onDialog(true);
          setOpen(true);
        }
      })
      .catch(() => setError("Requests could not be loaded. Please retry."))
      .finally(() => callbacks.current.onReady());
  }, [transport, enabled]);
  useEffect(() => {
    if (open && !blocked) dialog.current?.showModal();
    else dialog.current?.close();
    callbacks.current.onDialog(open);
  }, [open, blocked]);
  async function act(op: DirectOperation, id: string) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      await transport(op, { id });
      if (op === "accept") {
        try {
          await callbacks.current.onAccepted();
          setOpen(false);
        } catch {
          setError(
            "Bond confirmed. Refresh MY ATOM to see your updated network.",
          );
        }
      } else if (op === "dismiss") setOpen(false);
      setNotification(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  if (!enabled) return <>{children}</>;
  const controls = (
    <button
      className="secondary-button"
      onClick={() => {
        setNotification(null);
        setOpen(true);
        void load().catch(() => setError("Requests could not be loaded."));
      }}
    >
      BOND REQUESTS{items.length ? ` (${items.length}${more ? "+" : ""})` : ""}
    </button>
  );
  return (
    <>
      {children}
      {controls}
      <dialog
        ref={dialog}
        className="bond-dialog direct-dialog"
        aria-labelledby="direct-title"
        onCancel={() => setOpen(false)}
      >
        <h2 id="direct-title">DIRECT BOND REQUESTS</h2>
        {error && <p role="alert">{error}</p>}
        {items.length === 0 && <p>No pending requests.</p>}
        {(notification ? [notification] : items).map((item) => (
          <section key={item.id}>
            <h3>{item.incoming ? "DIRECT BOND REQUEST" : "REQUEST PENDING"}</h3>
            <p>
              {item.incoming
                ? `Atom #${item.number} would like to form a direct Bond with you.`
                : `Sent to Atom #${item.number}.`}
            </p>
            <p>Expires {new Date(item.expiresAt).toLocaleString()}</p>
            <div className="direct-buttons">
              {item.incoming ? (
                <>
                  <button
                    disabled={busy}
                    onClick={() => void act("accept", item.id)}
                  >
                    ACCEPT BOND
                  </button>
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => void act("dismiss", item.id)}
                  >
                    NOT NOW
                  </button>
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => void act("decline", item.id)}
                  >
                    DECLINE
                  </button>
                </>
              ) : (
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => void act("cancel", item.id)}
                >
                  CANCEL REQUEST
                </button>
              )}
            </div>
          </section>
        ))}
        {more && !notification && (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const last = items.at(-1);
                const r = await transport("list", {
                  after: { id: last?.id, createdAt: last?.createdAt },
                });
                setItems((old) => [...old, ...(r.items ?? [])]);
                setMore(r.items?.length === 50);
              } catch {
                setError("Could not load more requests.");
              } finally {
                setBusy(false);
              }
            }}
          >
            MORE REQUESTS
          </button>
        )}
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          CLOSE
        </button>
      </dialog>
    </>
  );
}
export function DirectPreference({
  transport = directRequest,
}: {
  transport?: DirectTransport;
}) {
  const [receiving, setReceiving] = useState<boolean>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    transport("preferences")
      .then((r) => setReceiving(r.receiving))
      .catch(() => setError("Request preference unavailable."));
  }, [transport]);
  return (
    <section>
      <h2>DIRECT BOND REQUESTS</h2>
      <p>
        Allow requests from indirectly connected active Atoms. Turning this off
        cancels pending incoming requests.
      </p>
      <label>
        <input
          type="checkbox"
          checked={receiving ?? false}
          disabled={busy || receiving === undefined}
          onChange={async (e) => {
            setBusy(true);
            setError("");
            try {
              const r = await transport("set_preference", {
                receiving: e.target.checked,
              });
              setReceiving(r.receiving);
            } catch {
              setError("Could not save this preference.");
            } finally {
              setBusy(false);
            }
          }}
        />{" "}
        Receive direct Bond requests
      </label>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
