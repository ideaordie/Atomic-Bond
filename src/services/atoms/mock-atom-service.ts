import type { GraphData } from "../../types/graph";
import { normalizeXHandle } from "../../utils/x-profile";
import {
  validEmail,
  type AtomService,
  type AtomDetails,
  type LocationService,
  type NotificationService,
  type PrivateIdentity,
  type PublicAtom,
} from "../participation/contracts";

export class MockAtomService implements AtomService {
  private readonly identities = new Map<string, PrivateIdentity>();
  private readonly atoms = new Map<string, PublicAtom>();
  private readonly verifiedFixture = new Set<string>();
  private sequence: number;
  constructor(
    private readonly initial: GraphData,
    private readonly locations: LocationService,
    private readonly notifications: NotificationService,
  ) {
    this.sequence = initial.nodes.length;
    for (const node of initial.nodes) {
      this.atoms.set(
        node.id,
        Object.freeze({
          id: node.id,
          publicId: node.publicId,
          ...(node.displayName ? { alias: node.displayName } : {}),
          ...(node.socialProfiles
            ? { socialProfiles: node.socialProfiles }
            : {}),
        }),
      );
      this.verifiedFixture.add(node.id);
    }
  }
  create(details: AtomDetails): PublicAtom {
    const xHandle = normalizeXHandle(details.xHandle);
    if (!validEmail(details.email))
      throw new Error("Enter a valid email address.");
    const location = this.locations.resolve(details.locationId);
    if (!location)
      throw new Error("Select a home region from the location results.");
    if (details.alias.trim().length > 60)
      throw new Error("Keep your alias to 60 characters or fewer.");
    const email = details.email.trim().toLowerCase();
    if (
      [...this.identities.values()].some((identity) => identity.email === email)
    )
      throw new Error(
        "An Atom already uses this email in this session. Use the existing Atom path.",
      );
    const number = ++this.sequence;
    const atom: PublicAtom = Object.freeze({
      id: `session-atom-${number}`,
      publicId: String(number).padStart(8, "0"),
      ...(details.alias.trim() ? { alias: details.alias.trim() } : {}),
      homeRegion: location,
      ...(xHandle
        ? {
            socialProfiles: Object.freeze({
              x: Object.freeze({
                handle: xHandle,
                verification: Object.freeze({ status: "unverified" as const }),
              }),
            }),
          }
        : {}),
    });
    const identity: PrivateIdentity = Object.freeze({
      email,
      verificationStatus: "pending",
      notificationPreferences: Object.freeze({
        transactionalAccess: true,
        growthDigest: "disabled",
      }),
    });
    this.atoms.set(atom.id, atom);
    this.identities.set(atom.id, identity);
    this.notifications.sendVerificationEmail(identity);
    return atom;
  }
  get(id: string): PublicAtom {
    const atom = this.atoms.get(id);
    if (!atom) throw new Error("Atom not found.");
    return atom;
  }
  isVerified(id: string) {
    return (
      this.verifiedFixture.has(id) ||
      this.identities.get(id)?.verificationStatus === "verified"
    );
  }
  verificationLabel(id: string) {
    const identity = this.identities.get(id);
    if (!identity) throw new Error("No pending identity.");
    const [name, domain] = identity.email.split("@");
    return `${name!.slice(0, 1)}•••@${domain}`;
  }
  simulateVerification(id: string) {
    const identity = this.identities.get(id);
    if (!identity) throw new Error("No pending identity.");
    this.identities.set(
      id,
      Object.freeze({ ...identity, verificationStatus: "verified" }),
    );
  }
  existingChoices() {
    // Disconnected networks and an already-Bonded neighbor exercise distinct scenarios.
    const fixtures = [540, 720, 1]
      .map((index) => this.initial.nodes[index])
      .filter((node) => !!node)
      .map((node) => this.get(node.id));
    return [
      ...fixtures,
      ...[...this.identities.keys()]
        .filter((id) => this.isVerified(id))
        .map((id) => this.get(id)),
    ];
  }
  toGraphNode(id: string) {
    const atom = this.get(id);
    const location = atom.homeRegion;
    return {
      id: atom.id,
      publicId: atom.publicId,
      degree: 0,
      ...(atom.alias ? { displayName: atom.alias } : {}),
      ...(atom.socialProfiles ? { socialProfiles: atom.socialProfiles } : {}),
      metadata: {
        synthetic: true,
        ...(location
          ? {
              city: location.city,
              region: location.region,
              countryCode: location.countryCode,
              locationId: location.id,
              homeRegion: location.displayName,
            }
          : {}),
      },
    };
  }
}
