"use client";
import { useSyncExternalStore } from "react";

export const MOTION_KEY = "atomic-bond-motion";
const eventName = "atomic-bond-motion-change";
let temporary: boolean | undefined;
export function motionSnapshot() {
  if (temporary !== undefined) return temporary;
  try {
    return localStorage.getItem(MOTION_KEY) !== "off";
  } catch {
    return temporary ?? true;
  }
}
export function selectMotion(enabled: boolean) {
  temporary = enabled;
  let saved = true;
  try {
    localStorage.setItem(MOTION_KEY, enabled ? "on" : "off");
    temporary = undefined;
  } catch {
    saved = false;
  }
  window.dispatchEvent(new Event(eventName));
  return saved;
}
function subscribe(listener: () => void) {
  const storage = (e: StorageEvent) => {
    if (e.key === MOTION_KEY || e.key === null) {
      temporary = undefined;
      listener();
    }
  };
  window.addEventListener(eventName, listener);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(eventName, listener);
    window.removeEventListener("storage", storage);
  };
}
export const useAtomMotion = () =>
  useSyncExternalStore(subscribe, motionSnapshot, () => true);
