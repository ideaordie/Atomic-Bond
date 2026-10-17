"use client";
import { useEffect, useRef, useState } from "react";
import {
  invitationTimeRemaining,
  isDayInvitation,
} from "../../utils/invitation-time";
import { cancelOwnerInvitation } from "../../services/auth/actions";

export interface DisplayInvitation {
  id: string;
  expiresAt: string;
  createdAt?: string | undefined;
  url: string;
  image: string;
}
export function BondInvitation({
  invite,
  publicId,
  close,
  create,
  creating = false,
  firstBond = false,
  cancel = cancelOwnerInvitation,
}: {
  invite: DisplayInvitation | null;
  publicId: string;
  close: () => void;
  create: () => Promise<void>;
  creating?: boolean;
  firstBond?: boolean;
  cancel?: (id: string) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [path, setPath] = useState<"person" | "remote" | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  const [busy, setBusy] = useState(false);
  const actionPending = useRef(false);
  const timeLeft = () =>
    invite
      ? Math.max(
          0,
          Math.ceil((Date.parse(invite.expiresAt) - Date.now()) / 1000),
        )
      : null;
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const update = () =>
      setRemaining(
        invite
          ? Math.max(
              0,
              Math.ceil((Date.parse(invite.expiresAt) - Date.now()) / 1000),
            )
          : null,
      );
    update();
    const timer = setInterval(update, 1000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [invite]);
  useEffect(() => {
    if (path && invite) {
      content.current?.focus({ preventScroll: true });
      if (dialog.current) dialog.current.scrollTop = 0;
    }
  }, [path, invite]);
  const expired = Boolean(invite && remaining === 0);
  const locked = busy || creating;
  async function choose(value: "person" | "remote") {
    if (actionPending.current || creating) return;
    actionPending.current = true;
    setPath(value);
    setMessage("");
    setManualCopy(false);
    try {
      await create();
    } catch {
      setPath(null);
      setMessage("Unable to prepare an invitation. Sign in again or retry.");
    } finally {
      actionPending.current = false;
    }
  }
  async function deliver(method: "share" | "copy") {
    if (!invite || actionPending.current || creating) return;
    if (timeLeft() === 0) {
      setRemaining(0);
      return;
    }
    actionPending.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (method === "share") {
        if (typeof navigator.share !== "function") {
          setMessage(
            "Sharing is unavailable in this browser. Use COPY LINK, then paste it into a message.",
          );
          return;
        }
        // Invoke directly from the click, with no awaited server request before it.
        await navigator.share({
          title: "Connect on Atomic Bond",
          text: `Let’s connect on Atomic Bond! Open this invitation, create or access your Atom, then confirm our Bond before ${new Date(invite.expiresAt).toISOString().replace("T", " ").replace("Z", " UTC")}.`,
          url: invite.url,
        });
        setMessage(
          "Share action finished. Delivery is not confirmed; the other person still needs to confirm your Bond.",
        );
      } else {
        await navigator.clipboard.writeText(invite.url);
        setMessage(
          "Invitation link copied. Paste it into a message to your intended recipient. Nothing has been sent automatically.",
        );
      }
    } catch (error) {
      if (method === "share")
        setMessage(
          error instanceof DOMException && error.name === "AbortError"
            ? "Sharing cancelled or unavailable. Nothing was confirmed. You can try again or copy the link."
            : "Unable to open sharing. Use COPY LINK instead.",
        );
      else {
        setManualCopy(true);
        setMessage(
          "Automatic copying is unavailable. Select and copy the invitation link below, then paste it into your message.",
        );
      }
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="bond-dialog real-bond-invitation"
      aria-labelledby="owner-invite-title"
      onCancel={close}
    >
      <div className="bond-dialog-top">
        <span className="wordmark">ATOMIC BOND</span>
        <button type="button" aria-label="Close invitation" onClick={close}>
          ×
        </button>
      </div>
      <h2 id="owner-invite-title">
        {firstBond ? "CREATE YOUR FIRST BOND" : "CREATE BOND"}
      </h2>
      {!path ? (
        <>
          <p>
            A Bond is a real connection confirmed by two people. Invite someone
            you know.
          </p>
          <div className="invitation-paths">
            <button
              type="button"
              disabled={locked}
              onClick={() => void choose("person")}
            >
              TOGETHER IN PERSON
              <span>Show a QR code for their phone to scan.</span>
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => void choose("remote")}
            >
              SEND TO SOMEONE<span>Prepare a link to share in a message.</span>
            </button>
          </div>
          <p className="invite-consent">
            Choose when they’re ready: preparing a new invitation starts its
            24-hour clock. Nothing is sent automatically. An existing invitation
            keeps its original deadline.
          </p>
          <p className="invite-consent">
            Choosing either path gives your consent as ATOM #{publicId} to
            connect. The other person must confirm separately.
          </p>
        </>
      ) : creating ? (
        <p role="status">Preparing your invitation…</p>
      ) : invite ? (
        <div ref={content} tabIndex={-1} className="invitation-content">
          {expired ? (
            <div className="invite-expired" role="status">
              <h3>THIS BOND INVITATION HAS EXPIRED</h3>
              <p>
                Ask the other person to be ready, then prepare a new invitation.
                Old links cannot be used.
              </p>
              <button
                onClick={() => {
                  setPath(null);
                  setManualCopy(false);
                  setMessage("");
                }}
              >
                Back to CREATE BOND
              </button>
            </div>
          ) : (
            <>
              <h3>
                {path === "person" ? "TOGETHER IN PERSON" : "SEND TO SOMEONE"}
              </h3>
              <p className="invite-instruction">
                {path === "person"
                  ? "Ask someone you're with to scan this QR code."
                  : "Your invitation is ready. Preparing it does not send it. Share it privately with someone you know."}
              </p>
              {path === "remote" && (
                <div className="invitation-share-actions">
                  <button
                    className="flow-primary"
                    disabled={locked}
                    onClick={() => void deliver("share")}
                  >
                    SEND INVITATION
                  </button>
                  <button
                    disabled={locked}
                    onClick={() => void deliver("copy")}
                  >
                    COPY LINK
                  </button>
                </div>
              )}
              {path === "person" && (
                <div className="invite-layout">
                  {/* Local data image only. No third-party QR provider receives the capability. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="bond-qr"
                    src={invite.image}
                    alt="Scan this QR code with another phone to open your Bond invitation"
                    width={320}
                    height={320}
                  />
                </div>
              )}
              <p>
                They’ll create or access their own Atom, then confirm your Bond
                to connect your two Atoms.
              </p>
              <p>
                {isDayInvitation(invite.createdAt, invite.expiresAt)
                  ? "INVITATION VALID FOR 24 HOURS"
                  : "ORIGINAL INVITATION DEADLINE"}
              </p>
              <p role="timer" aria-label="Invitation time remaining">
                Invitation expires in:{" "}
                {remaining === null ? "…" : invitationTimeRemaining(remaining)}
              </p>
              <p className="invite-consent">
                They must confirm before this deadline, including email
                verification if needed. Sharing, copying or reopening does not
                extend it.
              </p>
              <p role="status">
                {message ||
                  "Waiting for their confirmation. No Bond has been created yet."}
              </p>
              {manualCopy && (
                <label className="invitation-manual-copy">
                  Private invitation link
                  <textarea
                    readOnly
                    spellCheck={false}
                    autoComplete="off"
                    autoCapitalize="none"
                    value={invite.url}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </label>
              )}
              <div className="invitation-secondary-actions">
                <button
                  disabled={locked}
                  onClick={() => {
                    setPath(path === "person" ? "remote" : "person");
                    setManualCopy(false);
                    setMessage("");
                  }}
                >
                  {path === "person" ? "SEND TO SOMEONE" : "SHOW QR CODE"}
                </button>
                <button
                  disabled={locked}
                  onClick={async () => {
                    if (actionPending.current) return;
                    actionPending.current = true;
                    setBusy(true);
                    try {
                      await cancel(invite.id);
                      close();
                    } catch {
                      setMessage("Unable to cancel. Sign in again or retry.");
                    } finally {
                      actionPending.current = false;
                      setBusy(false);
                    }
                  }}
                >
                  CANCEL INVITATION
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
      {!path && <p role="alert">{message}</p>}
    </dialog>
  );
}
