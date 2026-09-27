"use client";

import { useEffect, useRef, useState } from "react";
import type { GraphData } from "../../types/graph";
import type { EmotionalPulse, Emotion } from "../../types/emotional-pulse";
import { LivingAtom } from "../../living-atom/LivingAtom";
import {
  createOwnerInvitation,
  sendOwnerPulse,
  visibleOwnerPulses,
} from "../../services/auth/actions";
import "./auth.css";
export function OwnerExperience({
  graph,
  publicId,
  initialPulses,
}: {
  graph: GraphData;
  publicId: string;
  initialPulses: readonly EmotionalPulse[];
}) {
  const [pulses, setPulses] = useState(initialPulses),
    [now, setNow] = useState(0),
    [invite, setInvite] = useState<{ token: string; expiresAt: string } | null>(
      null,
    ),
    [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const p = await visibleOwnerPulses();
        if (!cancelled) setPulses(p);
      } catch {
        if (!cancelled) setPulses([]);
      }
    };
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    const poll = setInterval(() => void refresh(), 30000);
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      clearInterval(poll);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    if (invite) dialog.current?.showModal();
  }, [invite]);
  async function send(emotion: Emotion) {
    const pulse = await sendOwnerPulse(emotion);
    setPulses((p) => [...p.filter((x) => x.atomId !== publicId), pulse]);
    setNow(Date.now());
  }
  return (
    <>
      <LivingAtom
        graph={graph}
        originalAtomId={publicId}
        synthetic={false}
        emotional={{ pulses, now, send }}
        onCreateBond={() => {
          setError("");
          void createOwnerInvitation()
            .then(setInvite)
            .catch(() =>
              setError(
                "Unable to create an invitation. Sign in again or retry.",
              ),
            );
        }}
      />
      {error && <p role="alert">{error}</p>}
      {invite && (
        <dialog
          ref={dialog}
          className="bond-dialog"
          aria-labelledby="owner-invite-title"
          onCancel={() => setInvite(null)}
        >
          <h2 id="owner-invite-title">CREATE BOND</h2>
          <p>
            Share this single-use invitation with the person you want to connect
            with.
          </p>
          <a className="invitation-url" href={`/bond/${invite.token}`}>
            {typeof window !== "undefined" ? window.location.origin : ""}/bond/
            {invite.token}
          </a>
          <p>Expires at {new Date(invite.expiresAt).toLocaleTimeString()}.</p>
          <button
            onClick={() => {
              dialog.current?.close();
              setInvite(null);
            }}
          >
            Close invitation
          </button>
        </dialog>
      )}
    </>
  );
}
