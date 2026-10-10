"use client";
import { InstallOffer } from "../pwa/InstallOffer";
import { AppearancePreference } from "../appearance/AppearancePreference";
import { MotionPreference } from "../appearance/MotionPreference";
import { AccountDeletion } from "./AccountDeletion";
import { AccountDeactivation } from "./AccountDeactivation";
import { WeeklyGrowthPreference } from "./WeeklyGrowthPreference";
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
      <nav aria-label="Profile navigation">
        <Link href="/explore" className="profile-return">
          <span aria-hidden="true">←</span> RETURN TO MY ATOM
        </Link>
      </nav>
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
        <button disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <p role="status">{message}</p>
      </form>
      <WeeklyGrowthPreference enabled={preferences.growthDigest === "weekly"} />
      <AppearancePreference />
      <MotionPreference />
      <InstallOffer preferences />
      <form action={signOut}>
        <SignOutButton />
      </form>
      <section className="account-management" aria-label="Account management">
        <h2>ACCOUNT</h2>
        <AccountDeactivation />
        <AccountDeletion />
      </section>
    </section>
  );
}
