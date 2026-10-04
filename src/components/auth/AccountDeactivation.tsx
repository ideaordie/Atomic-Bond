"use client";
import { useEffect, useRef, useState } from "react";
import { changeAccountLifecycle } from "../../services/auth/lifecycle-actions";

export function AccountDeactivation({
  reactivate = false,
  next = "/explore",
  publicId,
}: {
  reactivate?: boolean;
  next?: string;
  publicId?: string;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (confirm) heading.current?.focus();
  }, [confirm]);
  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await changeAccountLifecycle(
        reactivate ? "reactivate" : "deactivate",
      );
      if (result.error) setError(result.error);
      else if (reactivate) setDone(true);
      else window.location.replace(result.next!);
    } catch {
      setError(
        "Connection interrupted. Securely access your account to check its state.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <section aria-live="polite">
        <h1>ATOM REACTIVATED</h1>
        <p>Welcome back. Your Atom and existing Bonds are active again.</p>
        <a className="explore-link" href={next}>
          {next.startsWith("/bond/")
            ? "CONTINUE TO BOND CONFIRMATION"
            : "VIEW MY ATOM"}
        </a>
      </section>
    );
  if (reactivate)
    return (
      <>
        <h1>WELCOME BACK</h1>
        <p>ATOM #{publicId} is currently deactivated.</p>
        <p>
          Reactivate your Atom to return to your network. Your account, profile
          and existing Bonds have been preserved.
        </p>
        <button disabled={busy} onClick={submit}>
          {busy ? "Reactivating…" : "REACTIVATE MY ATOM"}
        </button>
        <p role="alert">{error}</p>
      </>
    );
  return (
    <section
      className="account-deactivation"
      aria-labelledby="deactivate-heading"
    >
      <h2 id="deactivate-heading">DEACTIVATE ACCOUNT</h2>
      <p>
        Temporarily step away from Atomic Bond. Your account, Atom number,
        profile and existing Bonds are preserved so you can return later.
      </p>
      {!confirm ? (
        <button className="secondary-button" onClick={() => setConfirm(true)}>
          DEACTIVATE ACCOUNT
        </button>
      ) : (
        <>
          <h3 ref={heading} tabIndex={-1}>
            DEACTIVATE YOUR ACCOUNT?
          </h3>
          <p>
            Your Atom will no longer appear as an active participant. Your
            public profile will be hidden and your current Pulse removed.
          </p>
          <p>
            Your account, Atom number, profile and existing Bonds will be
            preserved. Weekly Atom Growth Updates stop while deactivated; your
            preference is kept.
          </p>
          <p>
            You can return by securely verifying your email and choosing to
            reactivate.
          </p>
          <div className="account-confirm-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => {
                setConfirm(false);
                setError("");
              }}
            >
              CANCEL
            </button>
            <button disabled={busy} onClick={submit}>
              {busy ? "Deactivating…" : "CONFIRM DEACTIVATION"}
            </button>
          </div>
          <p role="alert">{error}</p>
        </>
      )}
    </section>
  );
}
