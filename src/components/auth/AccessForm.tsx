"use client";
import { useState } from "react";
import { requestAccess, finishRegistration } from "../../services/auth/actions";
import type { Location } from "../../services/participation/contracts";
import "./auth.css";
export function AccessForm({
  locations,
  next,
  verified = false,
}: {
  locations: readonly Location[];
  next: string;
  verified?: boolean;
}) {
  const [mode, setMode] = useState("register"),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <section className="auth-panel">
      <h1>
        {verified
          ? "Complete your Atom"
          : mode === "register"
            ? "CREATE YOUR ATOM"
            : "Access your Atom"}
      </h1>
      {!verified && (
        <div className="auth-tabs">
          <button
            onClick={() => setMode("register")}
            aria-pressed={mode === "register"}
          >
            New Atom
          </button>
          <button
            onClick={() => setMode("access")}
            aria-pressed={mode === "access"}
          >
            I already have an Atom
          </button>
        </div>
      )}
      <form
        className="atom-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setMessage("");
          try {
            const form = new FormData(event.currentTarget);
            const result = verified
              ? await finishRegistration(form)
              : await requestAccess(form);
            if ("next" in result && result.next)
              window.location.assign(result.next);
            else
              setMessage(
                ("message" in result ? result.message : result.error) ||
                  "Please try again.",
              );
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
              Email <span>Private — never public</span>
            </label>
            <input
              id="access-email"
              name="email"
              type="email"
              required
              autoComplete="email"
            />
          </>
        )}
        {(verified || mode === "register") && (
          <>
            <label htmlFor="access-alias">Name / alias (optional)</label>
            <input id="access-alias" name="alias" maxLength={60} />
            <label htmlFor="access-x">X handle (optional · public)</label>
            <input
              id="access-x"
              name="xHandle"
              placeholder="@username"
              aria-describedby="x-help"
            />
            <small id="x-help">
              Handle only, not a URL. X ownership is not verified.
            </small>
            <label htmlFor="access-region">Home region</label>
            <select
              id="access-region"
              name="locationId"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Select your city / region
              </option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.displayName}
                </option>
              ))}
            </select>
            <small>
              Initial location coverage is limited. Select only your actual home
              region.
            </small>
          </>
        )}
        <button className="flow-primary" disabled={pending}>
          {pending
            ? "Please wait…"
            : verified
              ? "Complete my Atom"
              : mode === "register"
                ? "Create my Atom"
                : "Email me an access link"}
        </button>
        <p role="status">{message}</p>
      </form>
    </section>
  );
}
