"use client";
import { useSyncExternalStore } from "react";

export type Appearance = "light" | "dark";
export const APPEARANCE_KEY = "atomic-bond-appearance";
export const parseAppearance = (value: unknown): Appearance =>
  value === "dark" ? "dark" : "light";
const eventName = "atomic-bond-appearance-change";
const snapshot = () =>
  parseAppearance(document.documentElement.dataset.appearance);
function apply(value: Appearance) {
  document.documentElement.dataset.appearance = value;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", value === "dark" ? "#101010" : "#ffffff");
  window.dispatchEvent(new Event(eventName));
}
export function selectAppearance(value: Appearance): boolean {
  const appearance = parseAppearance(value);
  apply(appearance);
  try {
    localStorage.setItem(APPEARANCE_KEY, appearance);
    return true;
  } catch {
    return false;
  }
}
function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === APPEARANCE_KEY || event.key === null)
      apply(parseAppearance(event.key === null ? null : event.newValue));
  };
  window.addEventListener(eventName, listener);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(eventName, listener);
    window.removeEventListener("storage", storage);
  };
}
export const useAppearance = () =>
  useSyncExternalStore(subscribe, snapshot, () => "light" as const);

/** Keeps cross-tab changes synchronized even on pages without a Canvas/control. */
export function AppearanceSync() {
  useAppearance();
  return null;
}
