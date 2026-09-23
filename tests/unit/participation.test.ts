import { MockAtomService } from "../../src/services/atoms/mock-atom-service";
import { MockNotificationService } from "../../src/services/notifications/mock-notification-service";
import { MockLocationService } from "../../src/services/locations/mock-location-service";
import { describe, expect, it, vi } from "vitest";
import { generateMockGraph, mockAtomId } from "../../src/data/mock/graph";
import { MOCK_LOCATIONS } from "../../src/data/mock/locations";
import { createMockParticipation } from "../../src/services/participation/mock-services";
import { validEmail } from "../../src/services/participation/contracts";
import { networkReach } from "../../src/graph/metrics/network-reach";
import { createScene } from "../../src/living-atom/layout/scene";
import { createSpatialScene } from "../../src/living-atom/layout/spatial";
import { atomContext } from "../../src/living-atom/interaction/atom-context";
import { arrivalVisibility } from "../../src/living-atom/animation/bond-arrival";

const graph = generateMockGraph();
const root = mockAtomId(0);
const details = {
  email: "person@example.com",
  alias: "",
  locationId: "us-florida-boynton-beach",
};
function setup() {
  let time = Date.parse("2026-09-22T12:00:00Z");
  const services = createMockParticipation(graph, () => time);
  const invite = services.bonds.createInvitation(root);
  return {
    ...services,
    invite,
    advance: (ms: number) => {
      time += ms;
    },
  };
}
function pending() {
  const session = setup();
  session.bonds.open(session.invite.code);
  session.bonds.startNew(session.invite.code);
  const invite = session.bonds.createAtom(session.invite.code, details);
  return { ...session, invite };
}
describe("canonical home regions and private onboarding", () => {
  it("provides deterministic canonical results, hierarchy, and ambiguous cities", () => {
    const locations = new MockLocationService();
    expect(MOCK_LOCATIONS.length).toBeGreaterThanOrEqual(36);
    expect(new Set(MOCK_LOCATIONS.map((l) => l.id)).size).toBe(
      MOCK_LOCATIONS.length,
    );
    expect(locations.search("Boynton")).toEqual(locations.search(" BOYNTON "));
    expect(locations.search("Boynton")[0]).toMatchObject({
      city: "Boynton Beach",
      region: "Florida",
      country: "United States",
      countryCode: "US",
    });
    expect(locations.search("Portland").map((l) => l.region)).toEqual([
      "Oregon",
      "Maine",
    ]);
    expect(locations.search("x")).toEqual([]);
    expect(locations.search("unknownland")).toEqual([]);
    expect(
      new Set(MOCK_LOCATIONS.map((l) => l.countryCode)).size,
    ).toBeGreaterThan(15);
  });
  it("does not collect or fabricate exact coordinates or city centroids", () => {
    for (const location of MOCK_LOCATIONS) {
      expect(location.centroidLatitude).toBeUndefined();
      expect(location.centroidLongitude).toBeUndefined();
      expect(location.displayName).toBe(
        `${location.city}, ${location.region}, ${location.country}`,
      );
    }
  });
  it.each([
    "broken",
    "a@b",
    "a@@example.com",
    "a b@example.com",
    "a@.com",
    "a@b..com",
    "",
  ])("rejects invalid email %s in both validators", (email) => {
    expect(validEmail(email)).toBe(false);
    expect(() => setup().atoms.create({ ...details, email })).toThrow(
      "valid email",
    );
  });
  it("validates location independently, accepts optional alias, and keeps private identity behind delivery boundary", () => {
    const notifications = new MockNotificationService();
    const delivery = vi.spyOn(notifications, "sendVerificationEmail");
    const atoms = new MockAtomService(
      graph,
      new MockLocationService(),
      notifications,
    );
    expect(() => atoms.create({ ...details, locationId: "" })).toThrow(
      "Select a home region",
    );
    expect(() =>
      atoms.create({ ...details, locationId: "Boynton Beach" }),
    ).toThrow("Select a home region");
    const atom = atoms.create(details);
    expect(atom.alias).toBeUndefined();
    expect(atom.homeRegion?.city).toBe("Boynton Beach");
    expect(JSON.stringify(atom)).not.toContain("email");
    expect(JSON.stringify(atoms.toGraphNode(atom.id))).not.toContain(
      details.email,
    );
    expect(delivery).toHaveBeenCalledWith({
      email: details.email,
      verificationStatus: "pending",
      notificationPreferences: {
        transactionalAccess: true,
        growthDigest: "disabled",
      },
    });
    expect(atoms.verificationLabel(atom.id)).toBe("p•••@example.com");
    expect(atoms.isVerified(atom.id)).toBe(false);
    atoms.simulateVerification(atom.id);
    expect(atoms.isVerified(atom.id)).toBe(true);
    expect(() => atoms.create(details)).toThrow("already uses this email");
  });
});
describe("mutually confirmed local Bond state machine", () => {
  it("derives the same committed graph and impact for identical sessions", () => {
    const first = pending();
    const second = pending();
    first.bonds.verify(first.invite.code);
    second.bonds.verify(second.invite.code);
    expect(first.bonds.confirm(first.invite.code)).toEqual(
      second.bonds.confirm(second.invite.code),
    );
  });
  it("rechecks verification at confirmation and does not grow already reachable geography", () => {
    const session = setup();
    session.bonds.open(session.invite.code);
    session.bonds.identifyExisting(session.invite.code, mockAtomId(10));
    const verified = vi
      .spyOn(session.atoms, "isVerified")
      .mockReturnValue(false);
    expect(() => session.bonds.confirm(session.invite.code)).toThrow(
      "Verify your email",
    );
    expect(session.bonds.graph()).toBe(graph);
    verified.mockRestore();
    const result = session.bonds.confirm(session.invite.code);
    expect(result.after.direct).toBe(13);
    expect(result.after.people).toBe(result.before.people);
    expect(result.after.cities).toEqual(result.before.cities);
    expect(result.after.countries).toEqual(result.before.countries);
  });
  it("reveals nearby members before distant members and reaches full visibility", () => {
    expect(arrivalVisibility(0, 2)).toBe(0);
    expect(arrivalVisibility(0.65, 2)).toBeGreaterThan(0);
    expect(arrivalVisibility(0.65, 5)).toBe(0);
    expect(arrivalVisibility(1, 2)).toBe(1);
    expect(arrivalVisibility(1, 8)).toBe(1);
  });
  it("creates a five-minute invitation and leaves the graph unchanged before confirmation", () => {
    const session = pending();
    expect(session.invite.state).toBe("EMAIL_VERIFICATION_PENDING");
    expect(session.invite.history).toEqual([
      "INVITE_CREATED",
      "INVITE_OPENED",
      "NEW_ATOM_REQUIRED",
      "ATOM_DETAILS_ENTERED",
      "EMAIL_VERIFICATION_PENDING",
    ]);
    expect(session.bonds.graph()).toBe(graph);
    expect(session.bonds.graph().nodes).toHaveLength(1000);
    expect(() => session.bonds.confirm(session.invite.code)).toThrow();
    expect(() =>
      session.bonds.identifyExisting(
        session.bonds.open(session.bonds.createInvitation(root).code).code,
        session.invite.recipientId!,
      ),
    ).toThrow("Verify your email");
    session.advance(299_999);
    expect(session.bonds.read(session.invite.code).state).toBe(
      "EMAIL_VERIFICATION_PENDING",
    );
    session.advance(1);
    expect(session.bonds.read(session.invite.code).state).toBe("EXPIRED");
    expect(() => session.bonds.verify(session.invite.code)).toThrow("expired");
  });
  it("verifies, confirms once, and derives exact graph and geographic impact without exposing identity", () => {
    const session = pending();
    const verified = session.bonds.verify(session.invite.code);
    expect(verified.history.slice(-2)).toEqual([
      "EMAIL_VERIFIED",
      "BOND_CONFIRMATION_PENDING",
    ]);
    expect(session.bonds.graph()).toBe(graph);
    const result = session.bonds.confirm(session.invite.code);
    expect(session.bonds.read(session.invite.code).history.slice(-2)).toEqual([
      "RECIPIENT_CONFIRMED",
      "BOND_CONFIRMED",
    ]);
    expect(result.before).toMatchObject({
      direct: 12,
      people: 640,
      cities: [],
    });
    expect(result.after).toMatchObject({
      direct: 13,
      people: 641,
      cities: ["Boynton Beach, Florida, US"],
    });
    expect(result.after.countries).toEqual(["CA", "GB", "JP", "US"]);
    expect(result.graph.nodes).toHaveLength(1001);
    expect(result.graph.edges).toHaveLength(graph.edges.length + 1);
    expect(result.graph.nodes.find((n) => n.id === root)?.degree).toBe(13);
    expect(
      result.graph.nodes.find((n) => n.id === result.recipient.id)?.degree,
    ).toBe(1);
    expect(JSON.stringify(result)).not.toContain(details.email);
    expect(JSON.stringify(result)).not.toContain("verificationStatus");
    expect(() => session.bonds.confirm(session.invite.code)).toThrow();
    expect(graph.nodes).toHaveLength(1000);
    expect(networkReach(graph, root).direct).toBe(12);
  });
  it("connects an existing disconnected component without onboarding or invented city counts", () => {
    const session = setup();
    session.bonds.open(session.invite.code);
    session.bonds.identifyExisting(session.invite.code, mockAtomId(540));
    const result = session.bonds.confirm(session.invite.code);
    expect(result.graph.nodes).toHaveLength(1000);
    expect(result.after).toMatchObject({ direct: 13, people: 820, cities: [] });
    expect(result.after.countries).toEqual(["CA", "GB", "JP", "ZA"]);
  });
  it("blocks active pairs, reverse pairs, confirmed pairs, self Bonds, and expired confirmation", () => {
    const session = setup();
    const code = session.invite.code;
    session.bonds.open(code);
    expect(() => session.bonds.identifyExisting(code, root)).toThrow(
      "another Atom",
    );
    expect(() => session.bonds.identifyExisting(code, mockAtomId(1))).toThrow(
      "ALREADY BONDED",
    );
    session.bonds.identifyExisting(code, mockAtomId(540));
    const reverse = session.bonds.createInvitation(mockAtomId(540));
    session.bonds.open(reverse.code);
    expect(() => session.bonds.identifyExisting(reverse.code, root)).toThrow(
      "already pending",
    );
    session.advance(300_000);
    expect(() => session.bonds.confirm(code)).toThrow("expired");
    expect(session.bonds.graph()).toBe(graph);
    const fresh = session.bonds.createInvitation(root);
    session.bonds.open(fresh.code);
    session.bonds.identifyExisting(fresh.code, mockAtomId(540));
    session.bonds.confirm(fresh.code);
    const duplicate = session.bonds.createInvitation(root);
    session.bonds.open(duplicate.code);
    expect(() =>
      session.bonds.identifyExisting(duplicate.code, mockAtomId(540)),
    ).toThrow("ALREADY BONDED");
  });
  it("declines privately, releases pair reservation, and forbids replay", () => {
    const session = setup();
    session.bonds.open(session.invite.code);
    session.bonds.identifyExisting(session.invite.code, mockAtomId(540));
    expect(session.bonds.decline(session.invite.code).state).toBe("DECLINED");
    expect(session.bonds.graph()).toBe(graph);
    expect(() => session.bonds.confirm(session.invite.code)).toThrow();
    const fresh = session.bonds.createInvitation(root);
    session.bonds.open(fresh.code);
    expect(
      session.bonds.identifyExisting(fresh.code, mockAtomId(540)).state,
    ).toBe("BOND_CONFIRMATION_PENDING");
  });
  it("keeps the new direct Atom selectable and preserves contextual network calculations", () => {
    const session = pending();
    session.bonds.verify(session.invite.code);
    const result = session.bonds.confirm(session.invite.code);
    const scene = createSpatialScene(
      createScene(result.graph, root),
      result.graph,
      "networks",
    );
    expect(
      scene.nodes.find((n) => n.members[0] === result.recipient.id),
    ).toMatchObject({ kind: "atom", distance: 1 });
    expect(scene.regionCount).toBe(4);
    const context = atomContext(result.graph, root, result.recipient.id);
    expect(context).toMatchObject({
      distance: 1,
      reachableCount: 641,
      regionCount: 4,
      countryCount: 4,
    });
    expect(context.selected.metadata?.homeRegion).toBe(
      "Boynton Beach, Florida, United States",
    );
    expect(networkReach(result.graph, result.recipient.id).direct).toBe(1);
  });
});
