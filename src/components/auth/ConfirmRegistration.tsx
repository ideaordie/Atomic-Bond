"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  completeInvitedRegistration,
  recoverInvitedRegistration,
} from "../../services/auth/registration-actions";
import { useInstall } from "../pwa/PwaProvider";
import "./auth.css";
export function ConfirmRegistration() {
  const install = useInstall();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  useEffect(() => {
    const read = () => {
      setError("");
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return (
    <section className="auth-panel">
      <h1>VERIFY YOUR EMAIL</h1>
      <p>
        Complete verification to create your Atom. Any Bond invitation will
        still require your explicit confirmation.
      </p>
      <button
        type="button"
        className="flow-primary"
        disabled={pending}
        onClick={async () => {
          if (inFlight.current) return;
          inFlight.current = true;
          setPending(true);
          setError("");
          try {
            // Read the current email fragment at the deliberate click, even if
            // hydration or a replacement email's hash effect has not committed.
            const fragment = new URLSearchParams(window.location.hash.slice(1));
            const token = fragment.get("token_hash") || "";
            const receipt = fragment.get("receipt") || "";
            const result = token
              ? await completeInvitedRegistration(token, receipt)
              : await recoverInvitedRegistration();
            if ("next" in result && result.next) {
              if ("created" in result && result.created) install.invite();
              // One navigation also replaces the sensitive fragment. Do not
              // enqueue a Next history restore or re-enable during page loading.
              window.location.replace(result.next);
              return;
            } else if ("error" in result)
              setError(result.error || "Unable to verify.");
            else setError("Unable to continue. Please try again.");
          } catch {
            setError("Unable to connect. Please try again.");
          }
          inFlight.current = false;
          setPending(false);
        }}
      >
        {pending ? "Verifying…" : "VERIFY / ACCESS MY ATOM"}
      </button>
      <p role="alert">{error}</p>
      <Link href="/auth">Access my Atom or request a new email</Link>
    </section>
  );
}
