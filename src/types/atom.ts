export type AtomStatus = "PENDING" | "ACTIVE" | "DORMANT" | "DELETED";
/** Public numbers travel as decimal strings, avoiding JavaScript bigint precision loss. */
export interface PublicAtomProfile {
  readonly status?: "ACTIVE" | "DORMANT" | "DELETED";
  readonly publicId: string;
  readonly displayName?: string;
  readonly xHandle?: string;
  readonly location?: {
    readonly region: string;
    readonly countryCode: string;
    readonly countryName?: string;
    readonly subdivisionCode?: string;
  };
  readonly createdAt: string;
}
export interface NotificationPreferences {
  readonly transactionalAccess: true;
  readonly growthDigest: "weekly" | "monthly" | "disabled";
  readonly pulseNotifications: boolean;
}
