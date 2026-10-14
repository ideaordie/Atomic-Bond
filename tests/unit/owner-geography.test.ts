import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  owner: vi.fn(),
  context: vi.fn(),
  graph: vi.fn(),
}));
vi.mock("../../src/services/auth/server", () => ({
  requireOwner: mocks.owner,
  ownerContext: mocks.context,
}));
import {
  ownerGeographicNetwork,
  refreshOwnerNetwork,
} from "../../src/services/auth/actions";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owner.mockResolvedValue({
    atom: { publicId: "5" },
    services: { bonds: { graph: mocks.graph } },
  });
  mocks.graph.mockResolvedValue({ nodes: [], edges: [] });
});
it.each(["DORMANT", "DEACTIVATED", "DELETED"])(
  "clears a stale owner snapshot after %s without exposing a graph",
  async (status) => {
    mocks.context.mockResolvedValue({
      user: { email_confirmed_at: "verified" },
      atom: { publicId: "5", status },
      services: { bonds: { graph: mocks.graph } },
    });
    expect(await refreshOwnerNetwork()).toEqual({
      graph: { nodes: [], edges: [] },
      pulses: [],
    });
    expect(mocks.graph).not.toHaveBeenCalled();
  },
);
it("derives the root solely from verified server ownership", async () => {
  expect(await ownerGeographicNetwork()).toEqual({
    ownerId: "5",
    graph: { nodes: [], edges: [] },
  });
  expect(mocks.graph).toHaveBeenCalledWith("5");
});
it("fails closed for absent/deactivated/deleted ownership before reading a graph", async () => {
  mocks.owner.mockRejectedValue(new Error("Verified Atom ownership required"));
  await expect(ownerGeographicNetwork()).rejects.toThrow();
  expect(mocks.graph).not.toHaveBeenCalled();
});
