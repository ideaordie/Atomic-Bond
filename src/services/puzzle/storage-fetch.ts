/** Use Storage's explicit authenticated route, retaining the SDK's owner JWT.
 * All non-tile requests retain their original URL and options. No credentials
 * are created, persisted or logged here; Storage still independently enforces RLS.
 */
export function authenticatedTileFetch(transport: typeof fetch): typeof fetch {
  return (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method =
      init?.method ?? (input instanceof Request ? input.method : "GET");
    const prefix = "/storage/v1/object/puzzle-tiles/";
    if (method.toUpperCase() === "GET" && url.pathname.startsWith(prefix)) {
      url.pathname = url.pathname.replace(
        prefix,
        "/storage/v1/object/authenticated/puzzle-tiles/",
      );
      return transport(
        input instanceof Request ? new Request(url, input) : url,
        init,
      );
    }
    return transport(input, init);
  };
}
