"use client";
import { useState } from "react";
import { updateWeeklyGrowth } from "../../services/auth/actions";
export function WeeklyGrowthPreference({ enabled }: { enabled: boolean }) {
  const [value, setValue] = useState(enabled),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  return (
    <section aria-labelledby="weekly-growth-title">
      <h2 id="weekly-growth-title">WEEKLY ATOM GROWTH UPDATES</h2>
      <p>
        Receive an email when your connected network has meaningfully grown.
      </p>
      <label htmlFor="weekly-growth">Weekly updates</label>
      <select
        id="weekly-growth"
        value={value ? "on" : "off"}
        disabled={pending}
        onChange={async (e) => {
          const next = e.target.value === "on";
          setPending(true);
          setMessage("");
          try {
            const result = await updateWeeklyGrowth(next);
            if (!result.saved) throw new Error();
            setValue(next);
            setMessage(
              next ? "Weekly updates are ON." : "Weekly updates are OFF.",
            );
          } catch {
            setMessage("Unable to save. Please try again.");
          } finally {
            setPending(false);
          }
        }}
      >
        <option value="on">ON</option>
        <option value="off">OFF</option>
      </select>
      <p>Secure access and essential account emails remain enabled.</p>
      <p role="status">{pending ? "Saving…" : message}</p>
    </section>
  );
}
