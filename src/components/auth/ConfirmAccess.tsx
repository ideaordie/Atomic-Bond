"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { completeAccess } from "../../services/auth/actions";
import "./auth.css";
export function ConfirmAccess() {
  const [link, setLink] = useState<{ token: string; next: string } | null>(
      null,
    ),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [result, setResult] = useState<{
    next: string;
    publicId: string | null;
    returning: boolean;
  } | null>(null);
  useEffect(() => {
    const readLink = () => {
      const p = new URLSearchParams(window.location.hash.slice(1));
      const token = p.get("token_hash");
      if (!token) return;
      window.history.replaceState(null, "", "/auth/confirm");
      queueMicrotask(() => {
        setError("");
        setResult(null);
        setLink({ token, next: p.get("next") || "/explore" });
      });
    };
    readLink();
    window.addEventListener("hashchange", readLink);
    return () => window.removeEventListener("hashchange", readLink);
  }, []);
  return (
    <section className="auth-panel">
      <h1>
        {result
          ? result.returning
            ? "WELCOME BACK"
            : "YOUR ATOM IS READY"
          : "Access your Atom"}
      </h1>
      {result ? (
        <>
          <p>ATOM #{result.publicId}</p>
          <Link className="explore-link" href={result.next}>
            {result.next.startsWith("/bond/")
              ? "Continue to Bond confirmation"
              : "MY ATOM"}
          </Link>
        </>
      ) : (
        <>
          <p>
            Confirm to securely verify your email and open your Atom on this
            device.
          </p>
          <button
            className="flow-primary"
            disabled={!link || pending}
            onClick={async () => {
              if (!link) return;
              setPending(true);
              try {
                const r = await completeAccess(link.token, link.next);
                setLink(null);
                if ("error" in r) setError(r.error);
                else setResult(r);
              } catch {
                setError("Unable to complete access. Request a new link.");
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "Verifying…" : "VERIFY / ACCESS MY ATOM"}
          </button>
          <p role="alert">{error}</p>
          <Link href="/auth">Request a new link or complete your details</Link>
        </>
      )}
    </section>
  );
}
