"use client";
import { useState } from "react";
import { selectMotion, useAtomMotion } from "./motion";
import { useReducedMotion } from "../../living-atom/interaction/use-reduced-motion";

export function MotionPreference() {
  const enabled = useAtomMotion(),
    reduced = useReducedMotion();
  const [message, setMessage] = useState("");
  return (
    <section className="appearance-preference" aria-labelledby="motion-title">
      <h2 id="motion-title">ATOM MOTION</h2>
      <div className="appearance-options" role="group" aria-label="Atom motion">
        {[true, false].map((value) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={enabled === value}
            onClick={() =>
              setMessage(
                selectMotion(value)
                  ? "Motion preference saved on this browser."
                  : "Motion changed for this visit. Browser storage is unavailable.",
              )
            }
          >
            {value ? "ON" : "OFF"}
          </button>
        ))}
      </div>
      <p>
        Controls continuous orbital motion. Map, selection and zoom remain
        available. Saved on this browser, including after sign-out.
      </p>
      {reduced && <p>Your device’s reduced-motion setting takes precedence.</p>}
      <p role="status">{message}</p>
    </section>
  );
}
