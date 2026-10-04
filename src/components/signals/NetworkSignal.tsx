"use client";
import { useEffect, useRef, useState } from "react";
import { readNetworkSignal } from "../../services/signals/actions";
import {
  safeSignalUrl,
  type NetworkSignal as Signal,
} from "../../services/signals/model";
import "./signals.css";
import "../network-details.css";
export function SignalPanel({
  signal,
  available = true,
}: {
  signal: Signal | null;
  available?: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = signal?.id ?? null;
  const expanded = expandedId === id && id !== null;
  const setExpanded = (value: boolean) => setExpandedId(value ? id : null);
  const close = () => {
    setExpanded(false);
    trigger.current?.focus();
  };
  const visible = signal;
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
              : "NO CURRENT SIGNAL"}
        </span>
        {visible && <span className="signal-preview">{signal.message}</span>}
      </button>
      {expanded && visible && (
        <div
          className="signal-details network-details"
          role="region"
          aria-label="Network Signal details"
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          <header>
            <h2>NETWORK SIGNAL</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close Network Signal"
            >
              ×
            </button>
          </header>
          <div className="signal-details-content">
            <p className="signal-type">
              {signal.type === "ATOMIC_BOND" ? "ATOMIC BOND" : "COMMUNITY"}
            </p>
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
          </div>
        </div>
      )}
    </section>
  );
}
export function NetworkSignal() {
  const [result, setResult] = useState<{
    signal: Signal | null;
    available: boolean;
  }>({ signal: null, available: false });
  useEffect(() => {
    // Retire keys written by the earlier candidate; never use them for visibility.
    for (const name of ["localStorage", "sessionStorage"] as const) {
      try {
        const storage = window[name];
        for (const key of Object.keys(storage)) {
          if (key.startsWith("atomic-bond:signal:")) storage.removeItem(key);
        }
      } catch {
        // Storage may be unavailable. Signal visibility never depends on it.
      }
    }
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
