"use client";
import { useInstall } from "./PwaProvider";
import { InstallControl } from "./InstallControl";

export function InstallOffer({
  preferences = false,
}: {
  preferences?: boolean;
}) {
  const state = useInstall();
  if (
    !state.available ||
    (!preferences && (!state.invitation || state.suppressed))
  )
    return null;
  return (
    <section
      className="install-offer install-preferences"
      aria-label="Install Atomic Bond"
    >
      <h2>{preferences ? "INSTALL ATOMIC BOND" : "TAKE YOUR ATOM WITH YOU"}</h2>
      <p>
        Add Atomic Bond to your device for quick access and an app-like
        experience.
      </p>
      <InstallControl invitation />
      {!preferences && (
        <button
          type="button"
          className="install-dismiss"
          onClick={state.dismiss}
        >
          MAYBE LATER
        </button>
      )}
    </section>
  );
}
