"use client";
import { useState } from "react";
import { confirmOwnerBond } from "../../services/auth/actions";
import Link from "next/link";
import { OwnerExperience } from "./OwnerExperience";
import type { ReactNode } from "react";
import "../../app/explore/explore.css";
import "../participation/participation.css";
export function BondConfirmation({
  token,
  children,
}: {
  token: string;
  children: ReactNode;
}) {
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof confirmOwnerBond>
  > | null>(null);
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  if (result?.graph)
    return (
      <div className="explore-page">
        <nav className="explore-nav" aria-label="Main navigation">
          <Link href="/explore">MY ATOM #{result.publicId}</Link>
          <div className="auth-entry">
            <Link href="/about">ABOUT</Link>
            <Link href="/owner">Profile &amp; preferences</Link>
          </div>
        </nav>
        <OwnerExperience
          graph={result.graph}
          publicId={result.publicId}
          initialPulses={result.pulses}
          initialArrivalId={result.arrivalId}
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
          setPending(true);
          try {
            const r = await confirmOwnerBond(token);
            if (r.next) {
              window.history.replaceState(null, "", "/explore");
              setResult(r);
            } else setError(r.error || "Unable to confirm.");
          } catch {
            setError("Unable to confirm. Sign in again and retry.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Confirming Bond…" : "CONFIRM BOND"}
      </button>
      <Link className="decline-bond" href="/explore" replace>
        DECLINE
      </Link>
      <p>
        Declining creates no Bond and does not notify or penalize either person.
      </p>
      <p role="alert">{error}</p>
    </section>
  );
}
