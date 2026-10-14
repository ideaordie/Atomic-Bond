"use client";
import { useSyncExternalStore, useEffect, useState } from "react";
import {
  DISMISS_KEY,
  DISMISS_MS,
  installPlatform,
  INVITATION_KEY,
  type InstallPlatform,
  isStandalone,
  isSuppressed,
} from "./install-policy";
import "./pwa.css";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
interface InstallState {
  available: boolean;
  platform: InstallPlatform;
  invitation: boolean;
  invite(): void;
  suppressed: boolean;
  dismiss(): void;
  install(): Promise<boolean>;
}
const initialState: InstallState = {
  available: false,
  platform: "other",
  invitation: false,
  invite() {},
  suppressed: true,
  dismiss() {},
  async install() {
    return false;
  },
};
let snapshot = initialState;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const useInstall = () =>
  useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => initialState,
  );

export function PwaProvider() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(true);
  const [platform, setPlatform] = useState<InstallPlatform>("other");
  const [invitation, setInvitation] = useState(false);
  const [suppressed, setSuppressed] = useState(true);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const media = matchMedia("(display-mode: standalone)");
    const sync = () => {
      setInstalled(
        isStandalone(
          media.matches,
          (navigator as Navigator & { standalone?: boolean }).standalone,
        ),
      );
      setPlatform(
        installPlatform(
          navigator.userAgent,
          navigator.platform,
          navigator.maxTouchPoints,
        ),
      );
      setOffline(!navigator.onLine);
      try {
        setInvitation(sessionStorage.getItem(INVITATION_KEY) === "pending");
        setSuppressed(
          isSuppressed(localStorage.getItem(DISMISS_KEY), Date.now()),
        );
      } catch {
        setSuppressed(true);
      }
    };
    const initial = setTimeout(sync, 0);
    const before = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const complete = () => {
      setInstalled(true);
      setEvent(null);
      setInvitation(false);
      try {
        sessionStorage.removeItem(INVITATION_KEY);
      } catch {
        /* Optional UI state only. */
      }
    };
    const disconnected = () => setOffline(true);
    // Keep stale content concealed until a fresh server navigation succeeds.
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", complete);
    window.addEventListener("offline", disconnected);
    media.addEventListener("change", sync);
    let registration: ServiceWorkerRegistration | undefined;
    const update = () => {
      if (navigator.onLine) void registration?.update().catch(() => {});
    };
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((value) => {
          registration = value;
          update();
        })
        .catch(() => {});
    }
    window.addEventListener("focus", update);
    const updates = setInterval(update, 60 * 60 * 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(updates);
      window.removeEventListener("beforeinstallprompt", before);
      window.removeEventListener("appinstalled", complete);
      window.removeEventListener("offline", disconnected);
      window.removeEventListener("focus", update);
      media.removeEventListener("change", sync);
    };
  }, []);
  useEffect(() => {
    const dismiss = () => {
      setSuppressed(true);
      setInvitation(false);
      try {
        sessionStorage.removeItem(INVITATION_KEY);
        localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
      } catch {
        /* Quiet for this session. */
      }
    };
    snapshot = {
      available: !installed,
      platform,
      invitation,
      invite: () => {
        setInvitation(true);
        try {
          sessionStorage.setItem(INVITATION_KEY, "pending");
        } catch {
          /* In-memory invitation still works. */
        }
      },
      suppressed,
      dismiss,
      install: async () => {
        if (!event) return false;
        setEvent(null);
        try {
          await event.prompt();
          const choice = await event.userChoice;
          if (choice.outcome === "accepted") {
            setInstalled(true);
            dismiss();
          } else dismiss();
          return true;
        } catch {
          return false;
        }
      },
    };
    for (const listener of listeners) listener();
  }, [installed, platform, event, suppressed, invitation]);
  return (
    <>
      {offline && (
        <main className="pwa-offline">
          <p className="wordmark">ATOMIC BOND</p>
          <h1>You&apos;re offline.</h1>
          <p>Reconnect to view your current network.</p>
          <button onClick={() => location.reload()}>TRY AGAIN</button>
        </main>
      )}
    </>
  );
}
