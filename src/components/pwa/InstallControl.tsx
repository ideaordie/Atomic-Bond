"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useInstall } from "./PwaProvider";

export function InstallControl({
  invitation = false,
}: {
  invitation?: boolean;
}) {
  const state = useInstall();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => {
    if (open && state.available) dialog.current?.showModal();
  }, [open, state.available]);
  if (!state.available) return null;
  const instructions = {
    ios: [
      "Open Atomic Bond in Safari on your iPhone or iPad.",
      "Tap Share, then Add to Home Screen. If it is missing, check Edit Actions.",
      "Keep Open as Web App on if shown, then tap Add.",
    ],
    android: [
      "In Chrome, open the browser menu (three dots).",
      "Choose Install app or Add to Home screen, if available, and follow the browser instructions.",
    ],
    desktop: [
      "Look for the install icon in the address bar in Chrome or Edge.",
      "You can also check the browser menu for Install Atomic Bond or an Apps / Install option.",
    ],
    safari: [
      "In Safari on a supported Mac, open File, then Add to Dock.",
      "Confirm the name and choose Add. If unavailable, use an up-to-date supported browser.",
    ],
    other: [
      "Check your browser menu for an installation or Add to Home Screen option.",
      "If your browser does not support installation, keep using Atomic Bond here or open it in a supported browser on this device.",
    ],
  }[state.platform];
  return (
    <>
      <button
        type="button"
        className={invitation ? "install-primary" : "install-navigation"}
        disabled={busy}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          try {
            if (!(await state.install())) setOpen(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {invitation ? "INSTALL ATOMIC BOND" : "INSTALL APP"}
      </button>
      {open &&
        createPortal(
          <dialog
            ref={dialog}
            className="install-offer install-dialog"
            aria-labelledby={title}
            onClose={() => setOpen(false)}
          >
            <h2 id={title}>INSTALL ATOMIC BOND</h2>
            <ol>
              {instructions.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ol>
            <p>
              Already installed? Open Atomic Bond from your device&apos;s app
              icon. Installation availability is controlled by your browser.
            </p>
            <p>
              You may need to securely sign in again when opening the app. Use
              ACCESS MY ATOM with your existing email.
            </p>
            <button type="button" onClick={() => dialog.current?.close()}>
              CLOSE INSTRUCTIONS
            </button>
          </dialog>,
          document.body,
        )}
    </>
  );
}
