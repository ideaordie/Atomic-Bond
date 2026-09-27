"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { normalizeXHandle, X_HANDLE_ERROR } from "../../utils/x-profile";
import Link from "next/link";
import { signOut, updateOwner } from "../../services/auth/actions";
import type { NotificationPreferences } from "../../types/atom";
import "./auth.css";
function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button className="secondary-button" disabled={pending}>
      {pending ? "Signing out…" : "Sign out on this device"}
    </button>
  );
}
export function OwnerSettings({
  publicId,
  alias,
  xHandle,
  preferences,
}: {
  publicId: string;
  alias: string | null;
  xHandle: string | null;
  preferences: NotificationPreferences;
}) {
  const [message, setMessage] = useState(""),
    [xError, setXError] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <section className="auth-panel">
      <h1>ATOM #{publicId}</h1>
      <Link href="/explore">MY ATOM</Link>
      <form
        aria-busy={pending}
        onSubmit={async (e) => {
          e.preventDefault();
          if (pending) return;
          const form = new FormData(e.currentTarget);
          try {
            normalizeXHandle(String(form.get("xHandle") || ""));
          } catch {
            setXError(X_HANDLE_ERROR);
            e.currentTarget
              .querySelector<HTMLInputElement>("#owner-x")
              ?.focus();
            return;
          }
          setPending(true);
          setMessage("");
          try {
            const r = await updateOwner(form);
            setMessage(r.error || r.message || "");
          } catch {
            setMessage(
              "We couldn't save your changes. Check your connection and try again.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <label htmlFor="owner-alias">Name / alias (optional)</label>
        <input
          id="owner-alias"
          name="alias"
          defaultValue={alias || ""}
          maxLength={60}
          autoComplete="nickname"
        />
        <label htmlFor="owner-x">X handle (optional · public)</label>
        <input
          id="owner-x"
          name="xHandle"
          defaultValue={xHandle || ""}
          placeholder="@username"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={Boolean(xError)}
          aria-describedby={
            xError ? "owner-x-help owner-x-error" : "owner-x-help"
          }
          onChange={() => setXError("")}
        />
        <small id="owner-x-help">
          Handle only, not a URL. X ownership is not verified.
        </small>
        {xError && (
          <p className="flow-error" role="alert" id="owner-x-error">
            {xError}
          </p>
        )}
        <label htmlFor="digest">Growth digest</label>
        <select
          id="digest"
          name="digest"
          defaultValue={preferences.growthDigest}
        >
          <option value="disabled">Disabled</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <label className="auth-checkbox">
          <input
            type="checkbox"
            name="pulseNotifications"
            defaultChecked={preferences.pulseNotifications}
          />{" "}
          Pulse notifications
        </label>
        <small>
          Preferences are saved now. Scheduled digests and Pulse notification
          delivery are not enabled yet.
        </small>
        <button disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <p role="status">{message}</p>
      </form>
      <form action={signOut}>
        <SignOutButton />
      </form>
    </section>
  );
}
