"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  completeInvitedRegistration,
  recoverInvitedRegistration,
} from "../../services/auth/registration-actions";
import { useInstall } from "../pwa/PwaProvider";
import "./auth.css";
export function ConfirmRegistration() {
  const install = useInstall();
  const [link, setLink] = useState({ token: "", receipt: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const read = () => {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      setLink({
        token: fragment.get("token_hash") || "",
        receipt: fragment.get("receipt") || "",
      });
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
        className="flow-primary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            const result = link.token
              ? await completeInvitedRegistration(link.token, link.receipt)
              : await recoverInvitedRegistration();
            if ("next" in result && result.next) {
              window.history.replaceState(null, "", "/auth/register/confirm");
              if ("created" in result && result.created) install.invite();
              window.location.replace(result.next);
            } else if ("error" in result)
              setError(result.error || "Unable to verify.");
          } catch {
            setError("Unable to connect. Please try again.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Verifying…" : "VERIFY / ACCESS MY ATOM"}
      </button>
      <p role="alert">{error}</p>
      <Link href="/auth">Access my Atom or request a new email</Link>
    </section>
  );
}
