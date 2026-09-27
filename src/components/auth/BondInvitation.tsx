"use client";
import { useEffect, useRef, useState } from "react";
import { cancelOwnerInvitation } from "../../services/auth/actions";

export interface DisplayInvitation {
  id: string;
  expiresAt: string;
  url: string;
  image: string;
}
export function BondInvitation({
  invite,
  publicId,
  close,
}: {
  invite: DisplayInvitation;
  publicId: string;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const update = () =>
      setRemaining(
        Math.max(
          0,
          Math.ceil((Date.parse(invite.expiresAt) - Date.now()) / 1000),
        ),
      );
    update();
    const timer = setInterval(update, 1000);
    dialog.current?.showModal();
    return () => clearInterval(timer);
  }, [invite]);
  return (
    <dialog
      ref={dialog}
      className="bond-dialog real-bond-invitation"
      aria-labelledby="owner-invite-title"
      onCancel={close}
    >
      <p className="wordmark">ATOMIC BOND</p>
      <h2 id="owner-invite-title">CREATE BOND</h2>
      <p>ATOM #{publicId} would like to create a Bond.</p>
      <p>
        By selecting CREATE BOND, you consent to connect with the person you
        share this invitation with. They must confirm separately.
      </p>
      {remaining !== 0 ? (
        <>
          {/* Local data image only; no remote optimizer or QR service sees the URL. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="bond-qr"
            src={invite.image}
            alt="Scan this QR code with another phone to open your Bond invitation"
            width={320}
            height={320}
          />
          <p role="timer" aria-label="Invitation time remaining">
            Expires in:{" "}
            {remaining === null
              ? "…"
              : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}
          </p>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(invite.url);
                setMessage(
                  "Invitation link copied. Share it only with your intended recipient.",
                );
              } catch {
                setMessage(
                  "Copy unavailable. Ask the other person to scan the QR code.",
                );
              }
            }}
          >
            COPY LINK
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await cancelOwnerInvitation(invite.id);
                close();
              } catch {
                setMessage("Unable to cancel. Sign in again or retry.");
              } finally {
                setBusy(false);
              }
            }}
          >
            CANCEL INVITATION
          </button>
        </>
      ) : (
        <p role="status">
          Invitation expired. Close this window and select CREATE BOND for a new
          invitation.
        </p>
      )}
      <p role="status">{message}</p>
      <button onClick={close}>Close invitation</button>
    </dialog>
  );
}
