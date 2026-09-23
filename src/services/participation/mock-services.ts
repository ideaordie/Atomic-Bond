import type { GraphData } from "../../types/graph";
import type { ParticipationServices } from "./contracts";
import { MockLocationService } from "../locations/mock-location-service";
import { MockAtomService } from "../atoms/mock-atom-service";
import { MockBondService } from "../bonds/mock-bond-service";
import { MockNotificationService } from "../notifications/mock-notification-service";

export function createMockParticipation(
  graph: GraphData,
  now: () => number = Date.now,
): ParticipationServices {
  const locations = new MockLocationService();
  const notifications = new MockNotificationService();
  const atoms = new MockAtomService(graph, locations, notifications);
  return {
    locations,
    atoms,
    bonds: new MockBondService(graph, atoms, notifications, now),
  };
}
