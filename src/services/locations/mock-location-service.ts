import type { Location, LocationService } from "../participation/contracts";
import { MOCK_LOCATIONS } from "../../data/mock/locations";

export class MockLocationService implements LocationService {
  search(query: string): readonly Location[] {
    const term = query.trim().toLowerCase();
    return term.length < 2
      ? []
      : MOCK_LOCATIONS.filter((location) =>
          location.displayName.toLowerCase().includes(term),
        ).slice(0, 8);
  }
  resolve(id: string) {
    return MOCK_LOCATIONS.find((location) => location.id === id);
  }
}
