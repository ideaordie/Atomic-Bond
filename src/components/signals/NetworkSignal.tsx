"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { readNetworkSignal } from "../../services/signals/actions";
import {
  safeSignalUrl,
  type NetworkSignal as Signal,
} from "../../services/signals/model";
import "./signals.css";
function subscribeDismissal(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("signal-dismissed", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("signal-dismissed", callback);
  };
}
export function SignalPanel({
  signal,
  available = true,
  preview = false,
}: {
  signal: Signal | null;
  available?: boolean;
  preview?: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [localDismissed, setLocalDismissed] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = signal?.id ?? null;
  const storedDismissed = useSyncExternalStore(
    subscribeDismissal,
    () => {
      try {
        return (
          !!id &&
          localStorage.getItem(`atomic-bond:signal:${id}`) === "dismissed"
        );
      } catch {
        return false;
      }
    },
    () => false,
  );
  const dismissed =
    !preview && (storedDismissed || (localDismissed === id && id !== null));
  const expanded = expandedId === id && id !== null;
  const setExpanded = (value: boolean) => setExpandedId(value ? id : null);
  const close = () => {
    setExpanded(false);
    trigger.current?.focus();
  };
  const dismiss = () => {
    if (signal && !preview) {
      try {
        localStorage.setItem(`atomic-bond:signal:${signal.id}`, "dismissed");
      } catch {}
      setLocalDismissed(signal.id);
      window.dispatchEvent(new Event("signal-dismissed"));
      close();
    }
  };
  const visible = signal && !dismissed;
  return (
    <section className="signal-panel" aria-label="Network Signal">
      <button
        ref={trigger}
        type="button"
        className="network-now-toggle"
        aria-expanded={expanded}
        disabled={!visible}
        onClick={() => setExpanded(!expanded)}
      >
        <strong>NETWORK SIGNAL</strong>
        <span>
          {!available
            ? "SIGNAL UNAVAILABLE"
            : visible
              ? signal.title
              : dismissed
                ? "SIGNAL DISMISSED"
                : "NO CURRENT SIGNAL"}
        </span>
        {visible && <span className="signal-preview">{signal.message}</span>}
      </button>
      {expanded && visible && (
        <div
          className="signal-details"
          role="region"
          aria-label="Network Signal details"
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          <header>
            <h2>NETWORK SIGNAL</h2>
            <button onClick={close} aria-label="Close Network Signal">
              ×
            </button>
          </header>
          <p>{signal.type === "ATOMIC_BOND" ? "ATOMIC BOND" : "COMMUNITY"}</p>
          <h3>{signal.title}</h3>
          <p>{signal.message}</p>
          {signal.publishedAt && (
            <time dateTime={signal.publishedAt}>
              {new Date(signal.publishedAt).toLocaleString()}
            </time>
          )}
          {signal.linkUrl && safeSignalUrl(signal.linkUrl) && (
            <p>
              <a
                href={signal.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {signal.linkLabel} ↗
              </a>
            </p>
          )}
          {!preview && <button onClick={dismiss}>DISMISS THIS SIGNAL</button>}
        </div>
      )}
    </section>
  );
}
export function NetworkSignal() {
  const [result, setResult] = useState<{
    signal: Signal | null;
    available: boolean;
  }>({ signal: null, available: true });
  useEffect(() => {
    let cancelled = false;
    let busy = false;
    const refresh = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const r = await readNetworkSignal();
        if (!cancelled) setResult(r);
      } catch {
        if (!cancelled) setResult({ signal: null, available: false });
      } finally {
        busy = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return <SignalPanel {...result} />;
}
