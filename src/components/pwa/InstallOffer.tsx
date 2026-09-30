"use client";
import { useEffect, useState } from "react";
import { useInstall } from "./PwaProvider";

export function InstallOffer({
  preferences = false,
}: {
  preferences?: boolean;
}) {
  const state = useInstall();
  const [ready, setReady] = useState(preferences);
  const [guidance, setGuidance] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    // Only mounted in verified MY ATOM or owner preferences. Give the network
    // time to be experienced; never interrupt an invitation or Pulse dialog.
    const timer = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        !document.querySelector('[role="dialog"]')
      )
        setReady(true);
    }, 30_000);
    return () => clearInterval(timer);
  }, []);
  if (!state.available || !ready || (!preferences && state.suppressed))
    return null;
  return (
    <section
      className={`install-offer ${preferences ? "install-preferences" : "install-contextual"}`}
      aria-label="Install Atomic Bond"
    >
      <h2>
        {guidance
          ? "ADD ATOMIC BOND TO YOUR HOME SCREEN"
          : "KEEP ATOMIC BOND CLOSE"}
      </h2>
      {guidance ? (
        <>
          <ol>
            <li>Tap Share in your browser.</li>
            <li>Choose Add to Home Screen.</li>
            <li>Keep Open as Web App on if shown, then tap Add.</li>
          </ol>
          <p>
            If that option is unavailable, open Atomic Bond in Safari and use
            its Share menu.
          </p>
          <button
            onClick={() => {
              setGuidance(false);
              if (!preferences) state.dismiss();
            }}
          >
            DONE
          </button>
        </>
      ) : (
        <>
          <p>
            Add Atomic Bond to your Home Screen for quick access to your Atom.
          </p>
          <button
            onClick={async () => {
              if (state.ios) setGuidance(true);
              else if (!(await state.install()))
                setError(
                  "Installation is unavailable right now. Try your browser's install menu.",
                );
            }}
          >
            {state.ios ? "HOW TO ADD TO HOME SCREEN" : "ADD TO HOME SCREEN"}
          </button>
          {!preferences && (
            <button className="install-dismiss" onClick={state.dismiss}>
              NOT NOW
            </button>
          )}
        </>
      )}
      {error && <p role="status">{error}</p>}
    </section>
  );
}
