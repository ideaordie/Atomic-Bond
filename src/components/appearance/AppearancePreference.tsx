"use client";
import { useState } from "react";
import { selectAppearance, useAppearance } from "./appearance";

export function AppearancePreference() {
  const appearance = useAppearance();
  const [message, setMessage] = useState("");
  return (
    <section
      className="appearance-preference"
      aria-labelledby="appearance-title"
    >
      <h2 id="appearance-title">APPEARANCE</h2>
      <div className="appearance-options" role="group" aria-label="Appearance">
        {(["light", "dark"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={appearance === value}
            onClick={() =>
              setMessage(
                selectAppearance(value)
                  ? `${value === "dark" ? "Dark" : "Light"} appearance saved on this browser.`
                  : "Appearance changed for this visit. Browser storage is unavailable.",
              )
            }
          >
            {value.toUpperCase()}
          </button>
        ))}
      </div>
      <p>
        Saved on this browser, including after sign-out. Other devices can
        choose their own appearance.
      </p>
      <p role="status">{message}</p>
    </section>
  );
}
