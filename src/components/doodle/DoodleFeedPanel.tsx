"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { DoodleBitmap } from "./DoodleBitmap";
import {
  requestDoodle,
  type DoodleItem,
  type DoodleFeed,
  type DoodleRequest,
} from "../../services/doodle/client";
import "./doodle-feed.css";
export function DoodleFeedPanel({
  request = requestDoodle,
  createHref = "/doodle",
}: {
  request?: DoodleRequest;
  createHref?: string;
}) {
  const root = useRef<HTMLElement>(null),
    viewport = useRef<HTMLDivElement>(null),
    sentinel = useRef<HTMLDivElement>(null);
  const rows = useRef<DoodleItem[]>([]),
    cursor = useRef<[string, string] | null>(null),
    controller = useRef<AbortController | null>(null),
    inflight = useRef(false),
    visible = useRef(false),
    failures = useRef(0),
    stopped = useRef(false);
  const [items, setItems] = useState<DoodleItem[]>([]),
    [hall, setHall] = useState<DoodleItem[]>([]),
    [showHall, setShowHall] = useState(false),
    [hasMore, setHasMore] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [newItems, setNewItems] = useState<DoodleItem[]>([]),
    [serverNow, setServerNow] = useState(0);
  const scrollAnchor = useRef<{ id: string; top: number } | null>(null),
    headCursor = useRef<[string, string] | null>(null);
  useLayoutEffect(() => {
    const saved = scrollAnchor.current,
      node = viewport.current;
    if (saved && node) {
      const target = [
        ...node.querySelectorAll<HTMLElement>("[data-doodle-id]"),
      ].find((x) => x.dataset.doodleId === saved.id);
      if (target)
        node.scrollTop += target.getBoundingClientRect().top - saved.top;
    }
    scrollAnchor.current = null;
  }, [items]);
  const anchor = useRef({ server: 0, local: 0 });
  const replace = useCallback((next: DoodleItem[]) => {
    rows.current = next;
    setItems(next);
  }, []);
  const load = useCallback(
    async (older = false) => {
      if (
        inflight.current ||
        stopped.current ||
        document.hidden ||
        !visible.current ||
        (older && !cursor.current)
      )
        return;
      inflight.current = true;
      setBusy(true);
      controller.current = new AbortController();
      try {
        const node = viewport.current;
        const first =
          node &&
          [...node.querySelectorAll<HTMLElement>("[data-doodle-id]")].find(
            (x) =>
              x.getBoundingClientRect().bottom >
              node.getBoundingClientRect().top,
          );
        if (first)
          scrollAnchor.current = {
            id: first.dataset.doodleId!,
            top: first.getBoundingClientRect().top,
          };
        const data = await request<DoodleFeed>(
          "read",
          [
            ...(older ? cursor.current! : [null, null]),
            rows.current.map((x) => x.id),
          ],
          controller.current.signal,
        );
        anchor.current = {
          server: Date.parse(data.serverTime),
          local: performance.now(),
        };
        setServerNow(anchor.current.server);
        if (!older) headCursor.current = data.nextCursor;
        const refreshed = new Map((data.refreshed ?? []).map((x) => [x.id, x]));
        const retained = rows.current.flatMap((x) =>
          refreshed.has(x.id) ? [refreshed.get(x.id)!] : [],
        );
        setHall(data.hall);
        failures.current = 0;
        setMessage("");
        if (!older && viewport.current && viewport.current.scrollTop > 24) {
          const existing = new Set(rows.current.map((x) => x.id));
          setNewItems(
            data.items.some((x) => !existing.has(x.id)) ? data.items : [],
          );
          replace(retained);
        } else {
          replace(
            older
              ? [
                  ...new Map(
                    [...retained, ...data.items].map((x) => [x.id, x]),
                  ).values(),
                ]
                  .sort(
                    (a, b) =>
                      b.publishedAt.localeCompare(a.publishedAt) ||
                      b.id.localeCompare(a.id),
                  )
                  .slice(-100)
              : data.items,
          );
          {
            cursor.current = data.nextCursor;
            setHasMore(Boolean(data.nextCursor));
          }
          if (!older) setNewItems([]);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          if (
            error instanceof Error &&
            "status" in error &&
            (error.status === 401 || error.status === 403)
          ) {
            stopped.current = true;
            replace([]);
            setHall([]);
            setNewItems([]);
          }
          failures.current++;
          setMessage("Feed unavailable. Retrying shortly.");
        }
      } finally {
        inflight.current = false;
        setBusy(false);
      }
    },
    [request, replace],
  );
  useEffect(() => {
    stopped.current = false;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        async () => {
          await load();
          schedule();
        },
        Math.min(300000, 30000 * 2 ** failures.current),
      );
    };
    const observer = new IntersectionObserver((entries) => {
      visible.current = Boolean(entries[0]?.isIntersecting);
      if (visible.current) void load();
      else controller.current?.abort();
    });
    observer.observe(root.current!);
    const visibility = () => {
      if (document.hidden) {
        controller.current?.abort();
      } else void load();
    };
    const stop = () => {
      stopped.current = true;
      controller.current?.abort();
      replace([]);
      setHall([]);
    };
    document.addEventListener("visibilitychange", visibility);
    const resume = () => {
      stopped.current = false;
      void load();
    };
    window.addEventListener("pageshow", resume);
    window.addEventListener("pagehide", stop);
    schedule();
    return () => {
      stopped.current = true;
      clearTimeout(timer);
      controller.current?.abort();
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("pagehide", stop);
    };
  }, [load, replace]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (Boolean(entries[0]?.isIntersecting)) void load(true);
      },
      { root: viewport.current, rootMargin: "120px" },
    );
    if (sentinel.current) observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [load, hasMore]);
  useEffect(() => {
    if (!items.length) return;
    const deadline = Math.min(...items.map((x) => Date.parse(x.expiresAt)));
    const now =
      anchor.current.server + performance.now() - anchor.current.local;
    const timer = setTimeout(
      () => {
        setServerNow(deadline);
        replace(rows.current.filter((x) => Date.parse(x.expiresAt) > deadline));
      },
      Math.max(0, deadline - now),
    );
    return () => clearTimeout(timer);
  }, [items, replace]);
  const action = async (kind: string, item: DoodleItem, category?: string) => {
    try {
      await request(kind, kind === "report" ? [item.id, category] : [item.id]);
      await load();
      setMessage(
        kind === "report" ? "Report received." : "Appreciation recorded.",
      );
    } catch {
      setMessage("Action unavailable. Check access or try again.");
    }
  };
  return (
    <aside ref={root} className="global-doodle-feed" aria-label="Global Doodle">
      <header>
        <h2>GLOBAL DOODLE</h2>
        <a className="doodle-create" href={createHref}>
          CREATE DOODLE
        </a>
      </header>
      <div className="doodle-feed-tabs">
        <button aria-pressed={!showHall} onClick={() => setShowHall(false)}>
          LIVE
        </button>
        <button aria-pressed={showHall} onClick={() => setShowHall(true)}>
          HALL OF FAME
        </button>
      </div>
      {!!newItems.length && !showHall && (
        <button
          onClick={() => {
            replace(
              newItems.filter(
                (x) =>
                  Date.parse(x.expiresAt) >
                  anchor.current.server +
                    performance.now() -
                    anchor.current.local,
              ),
            );
            cursor.current = headCursor.current;
            setHasMore(Boolean(headCursor.current));
            setNewItems([]);
            viewport.current?.scrollTo({ top: 0 });
          }}
        >
          SHOW NEW DRAWINGS
        </button>
      )}
      <p role="status">{message}</p>
      <div
        ref={viewport}
        className="doodle-feed-scroll"
        tabIndex={0}
        aria-label={showHall ? "Hall of Fame drawings" : "Live drawings"}
      >
        {(showHall ? hall : items).map((item) => (
          <article key={item.id} data-doodle-id={item.id}>
            <DoodleBitmap
              bitmap={item.bitmap}
              label={`Drawing by Atom #${item.atomNumber}`}
            />
            <p>
              ATOM #{item.atomNumber} ·{" "}
              {showHall
                ? "HALL OF FAME"
                : `${Math.max(0, Math.floor((serverNow - Date.parse(item.publishedAt)) / 60000))}m ago`}
            </p>
            <div className="doodle-feed-actions">
              {!showHall ? (
                <button
                  disabled={item.own || item.appreciated}
                  onClick={() => void action("vote", item)}
                >
                  APPRECIATE · {item.score}
                </button>
              ) : (
                <p>{item.score} appreciations</p>
              )}
              <details>
                <summary>REPORT</summary>
                <select
                  aria-label={`Report category for Atom ${item.atomNumber}`}
                  defaultValue="OTHER"
                  id={`report-${item.id}`}
                >
                  <option value="ABUSE">Abuse</option>
                  <option value="PERSONAL_INFORMATION">
                    Personal information
                  </option>
                  <option value="SEXUAL">Sexual content</option>
                  <option value="OTHER">Other</option>
                </select>
                <button
                  onClick={(event) => {
                    const select =
                      event.currentTarget.parentElement?.querySelector(
                        "select",
                      );
                    void action("report", item, select?.value);
                  }}
                >
                  SEND REPORT
                </button>
              </details>
            </div>
          </article>
        ))}
        {!items.length && !showHall && !busy && <p>No live drawings.</p>}
        {!hall.length && showHall && <p>No Hall of Fame entries.</p>}
        {!showHall && (
          <div ref={sentinel}>
            <button disabled={!hasMore || busy} onClick={() => void load(true)}>
              {busy ? "LOADING…" : hasMore ? "LOAD OLDER" : "END OF FEED"}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
