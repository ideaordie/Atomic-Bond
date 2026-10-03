"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import "./auth.css";
export function Unsubscribe() {
  const [token, setToken] = useState(""),
    [state, setState] = useState("ready");
  useEffect(() => {
    const value = window.location.hash.slice(1);
    window.history.replaceState(null, "", window.location.pathname);
    if (/^[a-f0-9]{64}$/.test(value)) queueMicrotask(() => setToken(value));
  }, []);
  return (
    <section className="auth-panel">
      <h1>
        {state === "done"
          ? "WEEKLY UPDATES TURNED OFF"
          : "WEEKLY ATOM GROWTH UPDATES"}
      </h1>
      {state === "done" ? (
        <p>
          You will no longer receive Weekly Atom Growth Updates. Secure access
          emails remain enabled.
        </p>
      ) : (
        <>
          <p>Turn off weekly growth emails. You do not need to sign in.</p>
          <button
            disabled={!token || state === "pending"}
            onClick={async () => {
              setState("pending");
              try {
                const r = await fetch("/api/growth/unsubscribe", {
                  method: "POST",
                  body: token,
                  credentials: "omit",
                  cache: "no-store",
                  headers: { "Content-Type": "text/plain" },
                });
                if (!r.ok) throw new Error();
                setState("done");
                setToken("");
              } catch {
                setState("error");
              }
            }}
          >
            {state === "pending" ? "Turning off…" : "TURN OFF WEEKLY UPDATES"}
          </button>
          {!token && <p>Open the unsubscribe link from your growth email.</p>}
          {state === "error" && (
            <p role="alert">
              Unable to unsubscribe. Check your connection and try again.
            </p>
          )}
        </>
      )}
      <p>
        <Link href="/">RETURN TO ATOMIC BOND</Link>
      </p>
      <p>
        <Link href="/owner">MANAGE EMAIL PREFERENCES</Link>
      </p>
    </section>
  );
}
