import type { GraphData } from "../../types/graph";
import type {
  AtomDetails,
  AtomService,
  BondService,
  BondState,
  Invitation,
  NotificationService,
} from "../participation/contracts";
import { networkReach } from "../../graph/metrics/network-reach";

const terminal = new Set<BondState>(["BOND_CONFIRMED", "DECLINED", "EXPIRED"]);
export class MockBondService implements BondService {
  private current: GraphData;
  private readonly invitations = new Map<string, Invitation>();
  private sequence = 0;
  constructor(
    graph: GraphData,
    private readonly atoms: AtomService,
    private readonly notifications: NotificationService,
    private readonly now: () => number = Date.now,
  ) {
    this.current = graph;
  }
  graph() {
    return this.current;
  }
  private transition(
    invite: Invitation,
    state: BondState,
    recipientId = invite.recipientId,
  ): Invitation {
    const next = Object.freeze({
      ...invite,
      ...(recipientId ? { recipientId } : {}),
      state,
      history: Object.freeze([...invite.history, state]),
    });
    this.invitations.set(invite.code, next);
    return next;
  }
  read(code: string): Invitation {
    const invite = this.invitations.get(code);
    if (!invite)
      throw new Error(
        "This development invitation is unavailable in this session.",
      );
    return !terminal.has(invite.state) && this.now() >= invite.expiresAt
      ? this.transition(invite, "EXPIRED")
      : invite;
  }
  private require(code: string, allowed: readonly BondState[]) {
    const invite = this.read(code);
    if (invite.state === "EXPIRED")
      throw new Error(
        "This invitation has expired. Create another Bond invitation.",
      );
    if (!allowed.includes(invite.state))
      throw new Error(
        "This action is not available in the current invitation state.",
      );
    return invite;
  }
  createInvitation(inviterId: string) {
    if (
      !this.atoms.isVerified(inviterId) ||
      !this.current.nodes.some((n) => n.id === inviterId)
    )
      throw new Error("A verified participating Atom is required.");
    const code = `AB-${String(++this.sequence).padStart(6, "0")}`;
    const invite: Invitation = Object.freeze({
      code,
      inviterId,
      expiresAt: this.now() + 300_000,
      state: "INVITE_CREATED",
      history: Object.freeze(["INVITE_CREATED"] as BondState[]),
    });
    this.invitations.set(code, invite);
    return invite;
  }
  open(code: string) {
    return this.transition(
      this.require(code, ["INVITE_CREATED"]),
      "INVITE_OPENED",
    );
  }
  startNew(code: string) {
    return this.transition(
      this.require(code, ["INVITE_OPENED"]),
      "NEW_ATOM_REQUIRED",
    );
  }
  createAtom(code: string, details: AtomDetails) {
    const invite = this.require(code, ["NEW_ATOM_REQUIRED"]);
    const atom = this.atoms.create(details);
    return this.transition(
      this.transition(invite, "ATOM_DETAILS_ENTERED", atom.id),
      "EMAIL_VERIFICATION_PENDING",
    );
  }
  verify(code: string) {
    const invite = this.require(code, ["EMAIL_VERIFICATION_PENDING"]);
    this.atoms.simulateVerification(invite.recipientId!);
    return this.transition(
      this.transition(invite, "EMAIL_VERIFIED"),
      "BOND_CONFIRMATION_PENDING",
    );
  }
  private assertPair(invite: Invitation, recipientId: string) {
    if (recipientId === invite.inviterId)
      throw new Error("Choose another Atom to create a Bond.");
    const samePair = (a: string, b: string) =>
      (a === invite.inviterId && b === recipientId) ||
      (a === recipientId && b === invite.inviterId);
    if (this.current.edges.some((e) => samePair(e.source, e.target)))
      throw new Error("YOU ARE ALREADY BONDED");
    for (const other of this.invitations.values()) {
      if (
        other.code !== invite.code &&
        other.recipientId &&
        !terminal.has(this.read(other.code).state) &&
        samePair(other.inviterId, other.recipientId)
      )
        throw new Error(
          "A Bond confirmation is already pending for these Atoms.",
        );
    }
  }
  identifyExisting(code: string, atomId: string) {
    const invite = this.require(code, ["INVITE_OPENED"]);
    this.atoms.get(atomId);
    if (!this.atoms.isVerified(atomId))
      throw new Error("Verify your email before confirming a Bond.");
    this.assertPair(invite, atomId);
    return this.transition(invite, "BOND_CONFIRMATION_PENDING", atomId);
  }
  confirm(code: string) {
    const invite = this.require(code, ["BOND_CONFIRMATION_PENDING"]);
    const recipientId = invite.recipientId!;
    if (!this.atoms.isVerified(recipientId))
      throw new Error("Verify your email before confirming a Bond.");
    this.assertPair(invite, recipientId);
    const before = networkReach(this.current, invite.inviterId);
    const nodes = this.current.nodes.some((n) => n.id === recipientId)
      ? this.current.nodes
      : [...this.current.nodes, this.atoms.toGraphNode(recipientId)];
    const graph: GraphData = Object.freeze({
      nodes: Object.freeze(
        nodes.map((n) =>
          n.id === recipientId || n.id === invite.inviterId
            ? Object.freeze({ ...n, degree: n.degree + 1 })
            : n,
        ),
      ),
      edges: Object.freeze([
        ...this.current.edges,
        Object.freeze({
          id: `session-bond-${code}`,
          source: invite.inviterId,
          target: recipientId,
          createdAt: new Date(this.now()).toISOString(),
          metadata: Object.freeze({ synthetic: true }),
        }),
      ]),
    });
    const after = networkReach(graph, invite.inviterId);
    this.transition(
      this.transition(invite, "RECIPIENT_CONFIRMED"),
      "BOND_CONFIRMED",
    );
    this.current = graph;
    this.notifications.sendBondNotification(invite.inviterId);
    this.notifications.sendBondNotification(recipientId);
    return Object.freeze({
      graph,
      recipient: this.atoms.get(recipientId),
      before,
      after,
    });
  }
  decline(code: string) {
    return this.transition(
      this.require(code, [
        "INVITE_OPENED",
        "NEW_ATOM_REQUIRED",
        "EMAIL_VERIFICATION_PENDING",
        "BOND_CONFIRMATION_PENDING",
      ]),
      "DECLINED",
    );
  }
}
