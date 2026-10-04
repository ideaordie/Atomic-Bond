"use client";
import { useEffect, useRef, useState } from "react";
import {
  deleteAccount,
  requestDeletionAccess,
} from "../../services/auth/deletion-actions";

export function AccountDeletion({
  initialPending = false,
}: {
  initialPending?: boolean;
}) {
  const [step, setStep] = useState(initialPending ? 2 : 0);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reauth, setReauth] = useState(false);
  const [cleanupPending, setCleanupPending] = useState(initialPending);
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (step === 1) heading.current?.focus();
    if (step === 2 && !cleanupPending) input.current?.focus();
  }, [step, cleanupPending]);
  return (
    <section className="account-danger" aria-labelledby="account-heading">
      <h2 id="account-heading">DELETE ACCOUNT &amp; DATA</h2>
      {step === 0 && (
        <p>
          Permanently remove your personal account information. This cannot be
          undone.
        </p>
      )}
      {step === 0 ? (
        <button className="delete-account-button" onClick={() => setStep(1)}>
          DELETE ACCOUNT
        </button>
      ) : (
        <>
          <h3 ref={heading} tabIndex={-1}>
            {cleanupPending ? "FINISH ACCOUNT REMOVAL" : "DELETE YOUR ACCOUNT?"}
          </h3>
          <p>
            This permanently removes your personal account information, Home
            Region and access to your Atom. Your optional alias and X handle,
            active Pulse and weekly updates will be removed.
          </p>
          <p>
            Your Atom number will never be reassigned. An anonymized structural
            record and existing confirmed Bonds remain to preserve network
            connections.
          </p>
          <p>
            <strong>This cannot be undone.</strong>
          </p>
          {step === 1 ? (
            <div className="account-confirm-actions">
              <button className="secondary-button" onClick={() => setStep(0)}>
                CANCEL
              </button>
              <button onClick={() => setStep(2)}>CONTINUE</button>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (busy) return;
                setBusy(true);
                try {
                  const result = await deleteAccount(
                    cleanupPending ? "DELETE" : confirmation,
                  );
                  setMessage(result.message);
                  setReauth(result.state === "reauthenticate");
                  if (result.state === "pending") setCleanupPending(true);
                  if (result.state === "pending")
                    window.location.replace("/account/delete");
                  if (result.state === "deleted")
                    window.location.replace("/account/deleted");
                } catch {
                  setMessage(
                    "The connection was interrupted. Reconnect and retry safely to confirm completion.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {!cleanupPending && (
                <>
                  <label htmlFor="delete-confirmation">
                    Type DELETE to confirm permanently
                  </label>
                  <input
                    ref={input}
                    id="delete-confirmation"
                    autoComplete="off"
                    spellCheck={false}
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                  />
                </>
              )}
              <div className="account-confirm-actions">
                {!cleanupPending && (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => {
                      setStep(0);
                      setConfirmation("");
                      setMessage("");
                      setReauth(false);
                    }}
                  >
                    CANCEL
                  </button>
                )}
                <button
                  className="delete-account-button"
                  disabled={
                    busy || (!cleanupPending && confirmation !== "DELETE")
                  }
                >
                  {busy
                    ? "Removing account…"
                    : cleanupPending
                      ? "RETRY SECURE CLEANUP"
                      : "PERMANENTLY DELETE ACCOUNT"}
                </button>
              </div>
            </form>
          )}
          {reauth && (
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await requestDeletionAccess();
                  setMessage(result.error || result.message || "");
                } catch {
                  setMessage(
                    "Unable to request verification. Reconnect before retrying.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              EMAIL ME A SECURE CONFIRMATION
            </button>
          )}
          <p role="status">{message}</p>
        </>
      )}
    </section>
  );
}
