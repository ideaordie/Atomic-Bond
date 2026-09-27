"use client";
import { useState } from "react";
import { confirmOwnerBond } from "../../services/auth/actions";
export function BondConfirmation({ token }: { token: string }) {
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <>
      <p>
        Confirm that you know or choose to connect with this person. This does
        not imply agreement or trust in their other connections.
      </p>
      <button
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            const r = await confirmOwnerBond(token);
            if (r.next) window.location.assign(r.next);
            else setError(r.error || "Unable to confirm.");
          } catch {
            setError("Unable to confirm. Sign in again and retry.");
          } finally {
            setPending(false);
          }
        }}
      >
        CONFIRM BOND
      </button>
      <p role="alert">{error}</p>
    </>
  );
}
