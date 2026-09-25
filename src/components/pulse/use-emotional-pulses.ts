"use client";
import { useCallback, useEffect, useState } from "react";
import type { GraphData } from "../../types/graph";
import type { PulseService } from "../../services/pulses/pulse-service";
import type { Emotion, EmotionalPulse } from "../../types/emotional-pulse";

export function useEmotionalPulses(
  service: PulseService,
  graph: GraphData,
  viewerId: string,
) {
  const [snapshot, setSnapshot] = useState<{
    pulses: readonly EmotionalPulse[];
    now: number;
  }>({ pulses: [], now: 0 });
  const refresh = useCallback(
    () =>
      setSnapshot({
        pulses: service.visible(graph, viewerId),
        now: service.now(),
      }),
    [service, graph, viewerId],
  );
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      refresh();
      clearTimeout(timer);
      const expiration = service.nextExpiration();
      // Exact expiry plus minute updates for shared-time labels; resume checks overdue timers.
      timer = setTimeout(
        update,
        Math.max(
          1,
          Math.min(
            60_000,
            (expiration ?? service.now() + 60_000) - service.now(),
          ),
        ),
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
  }, [refresh, service, snapshot.pulses.length]);
  return {
    ...snapshot,
    send: (emotion: Emotion) => {
      service.send(emotion);
      refresh();
    },
  };
}
