"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  completeAccess,
  stageInvitationAccess,
  completeInvitationAccess,
  recoverAuthenticatedAccess,
} from "../../services/auth/actions";
import "./auth.css";
import { useInstall } from "../pwa/PwaProvider";
import { InstallOffer } from "../pwa/InstallOffer";
export function ConfirmAccess() {
  const installation = useInstall();
  const [hasInvitation, setHasInvitation] = useState(false);
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
      const access = p.get("access");
      if (
        sealed ||
        access ||
        (token && /^(?:pkce_)?[a-fA-F0-9]{32,128}$/.test(token))
      ) {
        queueMicrotask(() => {
          if (active && revision === generation) {
            setFlow(null);
            setLink(null);
            setResult(null);
            setError("");
          }
        });
        void stageInvitationAccess(
          sealed || "",
          token || undefined,
          p.get("next") || "/explore",
          access || undefined,
        )
          .then((r) => {
            if (!active || revision !== generation) return;
            window.history.replaceState(
              null,
              "",
              r.flow ? `/auth/confirm?flow=${r.flow}` : "/auth/confirm",
            );
            setFlow(r.flow || null);
            setHasInvitation(Boolean(sealed));
            setLinkChecked(true);
            setError(r.error || "");
            if (r.error && token) setLink({ token, next: "/explore" });
            if (r.error && !token)
              void recoverAuthenticatedAccess().then((owner) => {
                if (active && revision === generation && owner)
                  setResult(owner);
              });
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
      if (!token) {
        if (!/^[a-f0-9]{32}$/.test(savedFlow || ""))
          void recoverAuthenticatedAccess().then((owner) => {
            if (active && revision === generation && owner) setResult(owner);
          });
        return;
      }
      window.history.replaceState(null, "", "/auth/confirm");
      queueMicrotask(() => {
        setError("");
        setResult(null);
        setLink({ token, next: p.get("next") || "/explore" });
      });
    };
    readLink();
    // Email apps can reuse this exact document with a new fragment. A fresh
    // document prevents the previous account/result and in-flight RSC action
    // from winning over the newly supplied credential. The fragment is retained
    // by reload and is never part of the HTTP request.
    const replaceEmail = () => {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      if (
        ["token_hash", "continuation", "access"].some((key) =>
          fragment.has(key),
        )
      )
        window.location.reload();
      else readLink();
    };
    window.addEventListener("hashchange", replaceEmail);
    return () => {
      active = false;
      window.removeEventListener("hashchange", replaceEmail);
    };
  }, []);
  async function verify(skipInvitation: boolean) {
    if ((!link && !flow) || pending) return;
    setPending(true);
    setError("");
    try {
      const r = flow
        ? await completeInvitationAccess(flow, skipInvitation)
        : await completeAccess(link!.token, link!.next);
      setFlow(null);
      setLink(null);
      window.history.replaceState(null, "", "/auth/confirm");
      if ("error" in r) {
        setError(r.error);
        const owner = await recoverAuthenticatedAccess();
        if (owner) setResult(owner);
      } else {
        if (r.publicId && !r.next.startsWith("/account/"))
          installation.invite();
        if (r.next.startsWith("/bond/") || r.next.startsWith("/account/"))
          window.location.replace(r.next);
        else setResult(r);
      }
    } catch {
      setError(
        "Unable to complete access. Reopen the email link or request a new link.",
      );
      const owner = await recoverAuthenticatedAccess();
      if (owner) setResult(owner);
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="auth-panel">
      <h1>
        {result
          ? !result.publicId
            ? "COMPLETE YOUR ATOM"
            : result.returning
              ? "WELCOME BACK"
              : "YOUR ATOM IS READY"
          : "ACCESS MY ATOM"}
      </h1>
      {result ? (
        <>
          {result.publicId && <p>ATOM #{result.publicId}</p>}
          {error && <p role="alert">{error}</p>}
          <p>
            {!result.publicId
              ? "Your email is verified. Continue to finish the required account steps."
              : result.returning
                ? "You're securely signed in on this device."
                : "Email verified. Your Atom has been created."}
          </p>
          {result.invitationRecovery && (
            <p role="status">
              You are signed in. This access link cannot securely restore its
              invitation. Reopen the original Bond invitation to confirm it.
            </p>
          )}
          <InstallOffer />
          <Link className="explore-link" href={result.next}>
            {result.next.startsWith("/bond/")
              ? "Continue to Bond confirmation"
              : result.publicId
                ? "MY ATOM"
                : "COMPLETE MY ATOM"}
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
            onClick={() => void verify(false)}
          >
            {pending ? "Verifying…" : "VERIFY / ACCESS MY ATOM"}
          </button>
          {flow && hasInvitation && (
            <button
              title="Verify your email and continue without the Bond invitation"
              className="flow-secondary"
              disabled={pending}
              onClick={() => void verify(true)}
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
