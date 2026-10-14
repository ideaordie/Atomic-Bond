export const DISMISS_KEY = "atomic-bond-install-dismissed-until";
export const DISMISS_MS = 30 * 24 * 60 * 60 * 1000;
export function isStandalone(displayMode: boolean, iosStandalone?: boolean) {
  return displayMode || iosStandalone === true;
}
export function isIOS(
  userAgent: string,
  platform: string,
  touchPoints: number,
) {
  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === "MacIntel" && touchPoints > 1)
  );
}
export function isSuppressed(value: string | null, now: number) {
  const until = Number(value);
  return Number.isFinite(until) && until > now;
}

export const INVITATION_KEY = "atomic-bond-install-invitation";
export type InstallPlatform =
  "ios" | "android" | "desktop" | "safari" | "other";
export function installPlatform(
  ua: string,
  platform: string,
  touchPoints: number,
): InstallPlatform {
  if (isIOS(ua, platform, touchPoints)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Chrome|Edg\//.test(ua)) return "desktop";
  if (/Safari/.test(ua)) return "safari";
  return "other";
}
