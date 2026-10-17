"use client";
import { useEffect, useRef, useState } from "react";
import { confirmOwnerBond } from "../../services/auth/actions";
import { dismissRegistrationInvitation } from "../../services/auth/registration-actions";
import Link from "next/link";
import { OwnerExperience } from "./OwnerExperience";
import type { ReactNode } from "react";
import { FIRST_BOND_NOTICE_MS } from "../../living-atom/animation/first-bond";
import "../../app/explore/explore.css";
import "../participation/participation.css";

async function confirmRegisteredBond(): Promise<
  Awaited<ReturnType<typeof confirmOwnerBond>>
> {
  const response = await fetch("/auth/register/invitation/confirm", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Confirmation unavailable");
  return response.json();
}

export function BondConfirmation({
  token,
  children,
  registrationInvitation = false,
}: {
  token: string;
  children: ReactNode;
  registrationInvitation?: boolean;
}) {
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof confirmOwnerBond>
  > | null>(null);
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const confirming = useRef(false);
  useEffect(() => {
    if (!registrationInvitation || !result?.graph) return;
    const timer = setTimeout(
      () => window.location.replace("/explore"),
      FIRST_BOND_NOTICE_MS,
    );
    return () => clearTimeout(timer);
  }, [registrationInvitation, result]);
  if (result?.graph)
    return (
      <div className="explore-page">
        <nav className="explore-nav" aria-label="Main navigation">
          <Link href="/explore">MY ATOM #{result.publicId}</Link>
          <div className="auth-entry">
            <Link href="/about">ABOUT</Link>
            <Link href="/owner">Settings</Link>
          </div>
        </nav>
        <OwnerExperience
          graph={result.graph}
          publicId={result.publicId}
          initialPulses={result.pulses}
          initialArrivalId={result.arrivalId}
          initialFirstBond={result.firstBond}
          activeOwner={result.activeOwner}
          showInstallOffer={!registrationInvitation}
        />
      </div>
    );
  return (
    <section className="auth-panel">
      {children}
      <p>
        Confirm that you know or choose to connect with this person. This does
        not imply agreement or trust in their other connections.
      </p>
      <button
        className="flow-primary"
        disabled={pending}
        onClick={async () => {
          if (confirming.current) return;
          confirming.current = true;
          setPending(true);
          try {
            const r = registrationInvitation
              ? await confirmRegisteredBond()
              : await confirmOwnerBond(token);
            if (r.next) {
              window.history.replaceState(null, "", "/explore");
              setResult(r);
            } else setError(r.error || "Unable to confirm.");
          } catch {
            setError("Unable to confirm. Sign in again and retry.");
          } finally {
            confirming.current = false;
            setPending(false);
          }
        }}
      >
        {pending
          ? "Confirming Bond…"
          : registrationInvitation
            ? "ACCEPT BOND"
            : "CONFIRM BOND"}
      </button>
      {registrationInvitation ? (
        <button
          className="decline-bond"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              const result = await dismissRegistrationInvitation();
              window.location.replace(result.next);
            } catch {
              setError("Unable to dismiss. Please try again.");
              setPending(false);
            }
          }}
        >
          NOT NOW
        </button>
      ) : (
        <Link className="decline-bond" href="/explore" replace>
          DECLINE
        </Link>
      )}
      <p>
        Declining creates no Bond and does not notify or penalize either person.
      </p>
      <p role="alert">{error}</p>
    </section>
  );
}
