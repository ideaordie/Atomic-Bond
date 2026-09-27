"use client";
import { useEffect, useState } from "react";
import type { EmotionalPulse } from "../../types/emotional-pulse";
/** Minute age labels and exact local expiry; never a per-second graph rebuild. */
export function usePulseClock(pulses: readonly EmotionalPulse[]) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const time = Date.now();
      setNow(time);
      clearTimeout(timer);
      const deadlines = pulses
        .flatMap((p) => [p.createdAt, p.expiresAt])
        .filter((t) => t > time);
      timer = setTimeout(
        update,
        Math.min(60_000, ...deadlines.map((t) => t - time)),
      );
    };
    timer = setTimeout(update, 0);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [pulses]);
  return now;
}
