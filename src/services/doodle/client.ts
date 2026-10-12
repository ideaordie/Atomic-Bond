export type DoodleItem = {
  id: string;
  atomNumber: string;
  bitmap: string;
  publishedAt: string;
  expiresAt: string;
  score: number;
  appreciated: boolean;
  own: boolean;
};
export type DoodleFeed = {
  serverTime: string;
  submissionsPaused: boolean;
  items: DoodleItem[];
  hall: DoodleItem[];
  refreshed: DoodleItem[];
  nextCursor: [string, string] | null;
  nextEligibleAt: string | null;
};
export type DoodleRequest = <T>(
  action: string,
  args?: unknown[],
  signal?: AbortSignal,
) => Promise<T>;
export const requestDoodle: DoodleRequest = async (
  action,
  args = [],
  signal,
) => {
  const response = await fetch("/api/doodle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, args }),
    cache: "no-store",
    signal: signal ?? null,
  });
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(result.error ?? "Doodle unavailable"), {
      status: response.status,
    });
  return result.data;
};
