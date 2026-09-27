/** Bounded reconciliation policy. No global subscriptions or browser database access. */
export const PULSE_REFRESH_MS = 30_000;
export const TOPOLOGY_REFRESH_MS = 60_000;
export const INVITATION_REFRESH_MS = 10_000;
export function createNetworkReconciler({
  clock,
  visible,
  invitationPending,
  refresh,
}: {
  clock: () => number;
  visible: () => boolean;
  invitationPending: () => boolean;
  refresh: (topology: boolean) => Promise<void>;
}) {
  let lastPulse = clock(),
    lastGraph = clock(),
    lastAttempt = -Infinity;
  let loading = false,
    disposed = false;
  let pendingResume = false;
  return {
    async tick(resume = false) {
      pendingResume ||= resume;
      const now = clock();
      if (disposed || loading || !visible() || now - lastAttempt < 5_000)
        return;
      const topology =
        pendingResume ||
        now - lastGraph >=
          (invitationPending() ? INVITATION_REFRESH_MS : TOPOLOGY_REFRESH_MS);
      if (!topology && now - lastPulse < PULSE_REFRESH_MS) return;
      loading = true;
      pendingResume = false;
      lastAttempt = now;
      // Bound failures too; a failed request must not cause a rapid retry loop.
      lastPulse = now;
      if (topology) lastGraph = now;
      try {
        await refresh(topology);
      } finally {
        loading = false;
      }
    },
    dispose() {
      disposed = true;
    },
  };
}
