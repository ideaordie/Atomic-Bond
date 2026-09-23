import type { GraphData, GraphNode, NetworkReach } from "../../types/graph";
import type { PublicSocialProfiles } from "../../types/public-profile";

export interface Location {
  readonly id: string;
  readonly city: string;
  readonly region: string;
  readonly country: string;
  readonly countryCode: string;
  readonly displayName: string;
  /** Optional approximate public city centroid; never a person's coordinates. */
  readonly centroidLatitude?: number;
  readonly centroidLongitude?: number;
}
export interface LocationService {
  search(query: string): readonly Location[];
  resolve(id: string): Location | undefined;
}
export interface PublicAtom {
  readonly id: string;
  readonly publicId: string;
  readonly alias?: string;
  readonly socialProfiles?: PublicSocialProfiles;
  readonly homeRegion?: Location;
}
export interface PrivateIdentity {
  readonly email: string;
  readonly verificationStatus: "pending" | "verified";
  readonly notificationPreferences: {
    readonly transactionalAccess: true;
    readonly growthDigest: "weekly" | "monthly" | "disabled";
  };
}
export interface AtomDetails {
  email: string;
  alias: string;
  locationId: string;
  xHandle?: string;
}
export interface AtomService {
  create(details: AtomDetails): PublicAtom;
  get(id: string): PublicAtom;
  isVerified(id: string): boolean;
  verificationLabel(id: string): string;
  simulateVerification(id: string): void;
  existingChoices(): readonly PublicAtom[];
  toGraphNode(id: string): GraphNode;
}
/** Private delivery boundary. Implementations must not return delivery payloads to public UI. */
export interface NotificationService {
  sendVerificationEmail(identity: PrivateIdentity): void;
  sendMagicAccessLink(identity: PrivateIdentity): void;
  sendBondNotification(atomId: string): void;
  sendGrowthDigest(atomId: string): void;
}
export type BondState =
  | "INVITE_CREATED"
  | "INVITE_OPENED"
  | "NEW_ATOM_REQUIRED"
  | "ATOM_DETAILS_ENTERED"
  | "EMAIL_VERIFICATION_PENDING"
  | "EMAIL_VERIFIED"
  | "BOND_CONFIRMATION_PENDING"
  | "RECIPIENT_CONFIRMED"
  | "BOND_CONFIRMED"
  | "DECLINED"
  | "EXPIRED";
export interface Invitation {
  readonly code: string;
  readonly inviterId: string;
  readonly recipientId?: string;
  readonly expiresAt: number;
  readonly state: BondState;
  readonly history: readonly BondState[];
}
export interface BondResult {
  readonly graph: GraphData;
  readonly recipient: PublicAtom;
  readonly before: NetworkReach;
  readonly after: NetworkReach;
}
export interface BondService {
  createInvitation(inviterId: string): Invitation;
  read(code: string): Invitation;
  open(code: string): Invitation;
  startNew(code: string): Invitation;
  createAtom(code: string, details: AtomDetails): Invitation;
  verify(code: string): Invitation;
  identifyExisting(code: string, atomId: string): Invitation;
  confirm(code: string): BondResult;
  decline(code: string): Invitation;
  graph(): GraphData;
}
export interface ParticipationServices {
  readonly atoms: AtomService;
  readonly bonds: BondService;
  readonly locations: LocationService;
}
export function validEmail(email: string): boolean {
  return (
    email.length <= 254 &&
    /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email.trim())
  );
}
