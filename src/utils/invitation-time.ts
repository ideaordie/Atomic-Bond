/** Presentation only: PostgreSQL remains the expiration authority. */
export const INVITATION_LIFETIME_MS = 86_400_000;
export function invitationTimeRemaining(seconds: number) {
  const value = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(value % 60).padStart(2, "0")}s`;
}
export function isDayInvitation(
  createdAt: string | undefined,
  expiresAt: string,
) {
  return Boolean(
    createdAt &&
    Date.parse(expiresAt) - Date.parse(createdAt) === INVITATION_LIFETIME_MS,
  );
}
