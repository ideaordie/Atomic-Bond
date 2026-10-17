"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  completeAccess,
  stageInvitationAccess,
  completeInvitationAccess,
  dismissInvitationAccess,
} from "../../services/auth/actions";
import "./auth.css";
import { useInstall } from "../pwa/PwaProvider";
import { InstallOffer } from "../pwa/InstallOffer";
export function ConfirmAccess() {
  const installation = useInstall();
  const [flow, setFlow] = useState<string | null>(null);
  const [link, setLink] = useState<{ token: string; next: string } | null>(
      null,
    ),
    [pending, setPending] = useState(false),
    [linkChecked, setLinkChecked] = useState(false),
    [error, setError] = useState("");
  const [result, setResult] = useState<{
    next: string;
    publicId: string | null;
    returning: boolean;
    invitationRecovery?: boolean;
  } | null>(null);
  useEffect(() => {
    let active = true;
    let generation = 0;
    const readLink = () => {
      const revision = ++generation;
      const p = new URLSearchParams(window.location.hash.slice(1));
      const token = p.get("token_hash");
      const sealed = p.get("continuation");
      if (sealed) {
        queueMicrotask(() => {
          if (active && revision === generation) {
            setFlow(null);
            setLink(null);
            setResult(null);
            setError("");
          }
        });
        void stageInvitationAccess(sealed)
          .then((r) => {
            if (!active || revision !== generation) return;
            window.history.replaceState(
              null,
              "",
              r.flow ? `/auth/confirm?flow=${r.flow}` : "/auth/confirm",
            );
            setFlow(r.flow || null);
            setLinkChecked(true);
            setError(r.error || "");
          })
          .catch(() => {
            if (!active || revision !== generation) return;
            setError("Unable to prepare access. Reopen the email link.");
            setLinkChecked(true);
          });
        return;
      }
      const savedFlow = new URLSearchParams(window.location.search).get("flow");
      if (/^[a-f0-9]{32}$/.test(savedFlow || ""))
        queueMicrotask(() => setFlow(savedFlow));
      queueMicrotask(() => setLinkChecked(true));
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
    return () => {
      active = false;
      window.removeEventListener("hashchange", readLink);
    };
  }, []);
  return (
    <section className="auth-panel">
      <h1>
        {result
          ? result.returning
            ? "WELCOME BACK"
            : "YOUR ATOM IS READY"
          : "ACCESS MY ATOM"}
      </h1>
      {result ? (
        <>
          <p>ATOM #{result.publicId}</p>
          <p>
            {result.returning
              ? "You're securely signed in on this device."
              : "Email verified. Your Atom has been created."}
          </p>
          {result.invitationRecovery && (
            <p role="status">
              You are signed in. This older access link cannot securely restore
              its invitation. Reopen the original Bond invitation to confirm it.
            </p>
          )}
          <InstallOffer />
          <Link className="explore-link" href={result.next}>
            {result.next.startsWith("/bond/")
              ? "Continue to Bond confirmation"
              : "MY ATOM"}
          </Link>
        </>
      ) : (
        <>
          <p>
            {linkChecked && !link && !flow
              ? "Open the secure link in your Atomic Bond email to continue, or request a new link below."
              : "Confirm to securely verify your email and open your Atom on this device."}
          </p>
          <button
            className="flow-primary"
            disabled={(!link && !flow) || pending}
            onClick={async () => {
              if (!link && !flow) return;
              setPending(true);
              try {
                const r = flow
                  ? await completeInvitationAccess(flow)
                  : await completeAccess(link!.token, link!.next);
                setFlow(null);
                window.history.replaceState(null, "", "/auth/confirm");
                setLink(null);
                if ("error" in r) setError(r.error);
                else {
                  // Lifecycle management must finish before optional installation.
                  if (r.publicId && !r.next.startsWith("/account/"))
                    installation.invite();
                  if (
                    r.next.startsWith("/bond/") ||
                    r.next.startsWith("/account/")
                  )
                    window.location.replace(r.next);
                  else setResult(r);
                }
              } catch {
                setError("Unable to complete access. Request a new link.");
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "Verifying…" : "VERIFY / ACCESS MY ATOM"}
          </button>
          {flow && (
            <button
              className="flow-secondary"
              disabled={pending}
              onClick={async () => {
                await dismissInvitationAccess(flow);
                window.location.replace("/explore");
              }}
            >
              NOT NOW
            </button>
          )}
          <p role="alert">{error}</p>
          <Link href="/auth">Request a new link or complete your details</Link>
        </>
      )}
    </section>
  );
}
