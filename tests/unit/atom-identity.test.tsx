import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AtomContextPanel } from "../../src/living-atom/interaction/AtomContextPanel";
import type { GraphData } from "../../src/types/graph";

const base: GraphData = {
  nodes: ["you", "friend", "alex"].map((id, index) => ({
    id,
    publicId: String(index + 1),
    degree: index === 1 ? 2 : 1,
    metadata: {
      city: "Example City",
      region: "Example Region",
      countryCode: "US",
    },
  })),
  edges: [
    { id: "a", source: "you", target: "friend" },
    { id: "b", source: "friend", target: "alex" },
  ],
};
function render(graph = base, atomId = "alex", centerId = "you") {
  return renderToStaticMarkup(
    <AtomContextPanel
      graph={graph}
      atomId={atomId}
      centerId={centerId}
      originalId="you"
      onView={() => {}}
      onClose={() => {}}
    />,
  );
}
describe("public Atom identity context", () => {
  it.each([
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ])("alias=%s X=%s", (alias, x) => {
    const graph: GraphData = {
      ...base,
      nodes: base.nodes.map((node) =>
        node.id !== "alex"
          ? node
          : {
              ...node,
              ...(alias ? { displayName: "ALEX" } : {}),
              ...(x
                ? {
                    socialProfiles: {
                      x: {
                        handle: "@example_user",
                        verification: { status: "unverified" as const },
                      },
                    },
                  }
                : {}),
            },
      ),
    };
    const html = render(graph);
    expect(html).toContain("ATOM #3");
    expect(html.includes('data-testid="atom-alias"')).toBe(alias);
    expect(html.includes("𝕏 @example_user")).toBe(x);
    expect(html).not.toMatch(/Anonymous|No alias|Not provided/);
    if (x) {
      expect(html).toContain('href="https://x.com/example_user"');
      expect(html).toContain("Ownership not verified");
    }
    expect(html).toContain("View their network");
  });
  it("keeps direct and indirect context anchored to you after changing perspective", () => {
    expect(render(base, "friend")).toContain("Directly Bonded to you");
    const html = render(base, "alex", "friend");
    expect(html).toContain("2 Bonds from you");
    expect(html).toContain("YOU → ● → ATOM #3");
    expect(html).toContain("Relationship path: YOU to ATOM #2 to ATOM #3");
    expect(html).toContain("1 known city");
  });
  it("does not render extra private data or arbitrary profile URLs", () => {
    const graph = {
      ...base,
      nodes: base.nodes.map((node) => ({
        ...node,
        email: "private@example.com",
        authentication: "secret-token",
        notificationPreferences: "private-settings",
        privateIdentifier: "private-id",
        preciseLocation: "private-address",
        socialProfiles: {
          x: {
            handle: "https://evil.example",
            url: "https://evil.example",
            verification: { status: "unverified" as const },
          },
        },
      })),
    };
    const html = render(graph);
    expect(html).not.toMatch(
      /private@example|secret-token|private-settings|private-id|private-address|evil\.example|VIEW ON X/,
    );
  });
});
