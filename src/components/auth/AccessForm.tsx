"use client";
import { useState } from "react";
import { requestAccess, finishRegistration } from "../../services/auth/actions";
import { HomeRegion } from "./HomeRegion";
import "./auth.css";
import { normalizeXHandle, X_HANDLE_ERROR } from "../../utils/x-profile";
export function AccessForm({
  next,
  verified = false,
  initialMode = "register",
}: {
  next: string;
  verified?: boolean;
  initialMode?: "register" | "access";
}) {
  const [mode, setMode] = useState(initialMode),
    [message, setMessage] = useState(""),
    [sent, setSent] = useState(false),
    [xError, setXError] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <section className="auth-panel">
      <h1>
        {verified
          ? "Complete your Atom"
          : mode === "register"
            ? "CREATE MY ATOM"
            : "ACCESS MY ATOM"}
      </h1>
      <p className="auth-intro">
        {verified
          ? "Your email is verified. Choose your home region to finish creating your Atom."
          : mode === "register"
            ? "Start with your email and home region. Your name and X handle are optional."
            : "Enter the email linked to your Atom. We'll send a secure access link — no password needed."}
      </p>
      {!verified && (
        <div className="auth-tabs">
          <button
            disabled={pending}
            onClick={() => {
              setMode("register");
              setMessage("");
              setSent(false);
            }}
            aria-pressed={mode === "register"}
            aria-label="Switch to Create my Atom"
          >
            Create my Atom
          </button>
          <button
            disabled={pending}
            onClick={() => {
              setMode("access");
              setMessage("");
              setSent(false);
            }}
            aria-pressed={mode === "access"}
            aria-label="Switch to Access my Atom"
          >
            Access my Atom
          </button>
        </div>
      )}
      <form
        className="atom-form"
        aria-busy={pending}
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending) return;
          const form = new FormData(event.currentTarget);
          if (verified || mode === "register") {
            try {
              normalizeXHandle(String(form.get("xHandle") || ""));
            } catch {
              setXError(X_HANDLE_ERROR);
              event.currentTarget
                .querySelector<HTMLInputElement>("#access-x")
                ?.focus();
              return;
            }
          }
          setPending(true);
          setMessage("");
          setSent(false);
          try {
            const result = verified
              ? await finishRegistration(form)
              : await requestAccess(form);
            if ("next" in result && result.next)
              window.location.assign(result.next);
            else {
              setSent("message" in result);
              setMessage(
                ("message" in result ? result.message : result.error) ||
                  "Please try again.",
              );
            }
          } catch {
            setMessage("Unable to connect. Please try again.");
          } finally {
            setPending(false);
          }
        }}
      >
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="next" value={next} />
        {!verified && (
          <>
            <label htmlFor="access-email">
              Email <span>(required · private)</span>
            </label>
            <input
              id="access-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              aria-describedby="email-help"
            />
            <small id="email-help">
              Used privately for verification, secure access and Atomic Bond
              notifications. Never public.
            </small>
          </>
        )}
        {(verified || mode === "register") && (
          <>
            <label htmlFor="access-alias">Name / alias (optional)</label>
            <input
              id="access-alias"
              name="alias"
              maxLength={60}
              autoComplete="nickname"
            />
            <label htmlFor="access-x">X handle (optional · public)</label>
            <input
              id="access-x"
              name="xHandle"
              placeholder="@username"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={Boolean(xError)}
              aria-describedby={xError ? "x-help x-error" : "x-help"}
              onChange={() => setXError("")}
            />
            <small id="x-help">
              Handle only, not a URL. X ownership is not verified.
            </small>
            {xError && (
              <p id="x-error" className="flow-error" role="alert">
                {xError}
              </p>
            )}
            <HomeRegion />
            <p>
              Weekly Atom Growth Updates are enabled when your new Atom is
              activated. You can turn them off anytime in Profile &amp;
              Preferences. Secure access emails remain independent.
            </p>
          </>
        )}
        <button className="flow-primary" disabled={pending}>
          {pending
            ? verified
              ? "Creating your Atom…"
              : "Sending email…"
            : verified
              ? "Complete my Atom"
              : mode === "register"
                ? "Create my Atom"
                : "Email me an access link"}
        </button>
        <div role="status" className={message ? "auth-feedback" : undefined}>
          {sent && <strong>CHECK YOUR EMAIL</strong>}
          {message && <p>{message}</p>}
          {sent && (
            <p>
              Open the secure link to continue. Check spam or junk too. You can
              leave this page; the email link brings you back.
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
