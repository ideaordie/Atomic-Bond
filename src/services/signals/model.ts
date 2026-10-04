export interface NetworkSignal {
  id: string;
  type: "COMMUNITY" | "ATOMIC_BOND";
  title: string;
  message: string;
  linkLabel: string | null;
  linkUrl: string | null;
  publishedAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
}
export type SignalDraft = Omit<NetworkSignal, "id" | "publishedAt">;
export type AdminSignal = NetworkSignal & { state: string };
export function safeSignalUrl(value: string): boolean {
  if (
    !/^https:\/\/[A-Za-z0-9][A-Za-z0-9.-]*(?::[0-9]{1,5})?(?:\/[^\s\\]*)?$/.test(
      value,
    )
  )
    return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !/[\u0000-\u0020\u007f]/.test(value)
    );
  } catch {
    return false;
  }
}
export function validateSignal(d: SignalDraft) {
  if (
    !["COMMUNITY", "ATOMIC_BOND"].includes(d.type) ||
    !d.title.trim() ||
    d.title.length > 80 ||
    !d.message.trim() ||
    d.message.length > 500
  )
    throw new Error(
      "Use an enabled type, a title up to 80 characters and a message up to 500 characters.",
    );
  if (
    Boolean(d.linkLabel) !== Boolean(d.linkUrl) ||
    (d.linkLabel && d.linkLabel.length > 40) ||
    (d.linkUrl && (d.linkUrl.length > 2048 || !safeSignalUrl(d.linkUrl)))
  )
    throw new Error(
      "Provide both a short link label and a valid HTTPS URL, or neither.",
    );
  for (const time of [d.startsAt, d.endsAt])
    if (time && !Number.isFinite(Date.parse(time)))
      throw new Error("Invalid date.");
  if (d.startsAt && d.endsAt && Date.parse(d.endsAt) <= Date.parse(d.startsAt))
    throw new Error("End must follow start.");
}
