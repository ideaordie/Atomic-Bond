// Controlled diagnostics: never return URLs, headers containing credentials, or bodies.
export type StorageObservation = {
  status: number;
  cache: string | null;
  age: string | null;
  cacheControl: string | null;
  date: string | null;
};
export function observeStorageFetch(
  observations: StorageObservation[],
  fresh: boolean,
  transport: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const storage = url.pathname.startsWith("/storage/v1/object/");
    if (storage && fresh)
      url.searchParams.set("cacheNonce", crypto.randomUUID());
    const response = await transport(storage && fresh ? url : input, init);
    if (storage) {
      const safe = (key: string) =>
        response.headers.get(key)?.slice(0, 120) ?? null;
      observations.push({
        status: response.status,
        cache: safe("cf-cache-status"),
        age: safe("age"),
        cacheControl: safe("cache-control"),
        date: safe("date"),
      });
    }
    return response;
  };
}
