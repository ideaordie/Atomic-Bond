"use client";
import { useState } from "react";
import Link from "next/link";
import { signOut, updateOwner } from "../../services/auth/actions";
import type { NotificationPreferences } from "../../types/atom";
import "./auth.css";
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
    [pending, setPending] = useState(false);
  return (
    <section className="auth-panel">
      <h1>ATOM #{publicId}</h1>
      <Link href="/explore">MY ATOM</Link>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          try {
            const r = await updateOwner(new FormData(e.currentTarget));
            setMessage(r.error || r.message || "");
          } catch {
            setMessage("Unable to save.");
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
        />
        <label htmlFor="owner-x">X handle (optional · public)</label>
        <input id="owner-x" name="xHandle" defaultValue={xHandle || ""} />
        <small>X ownership is not verified.</small>
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
        <button disabled={pending}>Save</button>
        <p role="status">{message}</p>
      </form>
      <form action={signOut}>
        <button>Sign out on this device</button>
      </form>
    </section>
  );
}
