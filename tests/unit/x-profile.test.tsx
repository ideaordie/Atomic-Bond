import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { generateMockGraph } from "../../src/data/mock/graph";
import { createMockParticipation } from "../../src/services/participation/mock-services";
import { normalizeXHandle, xProfileUrl } from "../../src/utils/x-profile";
import { PublicXProfile } from "../../src/components/profile/PublicXProfile";

const details = {
  email: "private@example.com",
  alias: "",
  locationId: "us-florida-boynton-beach",
};

describe("optional public X profile", () => {
  it.each([undefined, "", "   "])(
    "omits absent/blank input %s without making onboarding require it",
    (input) => {
      expect(normalizeXHandle(input)).toBeUndefined();
      const { atoms } = createMockParticipation(generateMockGraph());
      const atom = atoms.create({
        ...details,
        ...(input !== undefined ? { xHandle: input } : {}),
      });
      expect(atom).not.toHaveProperty("socialProfiles");
      expect(atoms.toGraphNode(atom.id)).not.toHaveProperty("socialProfiles");
    },
  );
  it.each(["username", "@username", " @username ", "  username  "])(
    "normalizes %s",
    (value) => {
      expect(normalizeXHandle(value)).toBe("username");
      expect(xProfileUrl(value)).toBe("https://x.com/username");
    },
  );
  it.each([
    "a",
    "ab",
    "abc",
    "abcd",
    "AbC_123",
    "_name_",
    "12345",
    "abcdefghijklmno",
  ])("accepts valid existing handle %s", (handle) => {
    expect(normalizeXHandle(handle)).toBe(handle);
  });
  it.each([
    "@",
    "@@username",
    "two words",
    "some-name",
    "some.name",
    "name@example.com",
    "name\nother",
    "naïve",
    "💫",
    "abcdefghijklmnop",
    "https://x.com/username",
    "http://evil.example",
    "x.com/name",
    "//evil.example",
    "javascript:alert(1)",
    "name?x=y",
    "name#fragment",
    "%75ser",
    "name/other",
    "name\\other",
  ])(
    "rejects unsafe/invalid handle %s in service and outbound URL construction",
    (xHandle) => {
      expect(() => normalizeXHandle(xHandle)).toThrow("Enter an X handle");
      expect(xProfileUrl(xHandle)).toBeUndefined();
      const { atoms } = createMockParticipation(generateMockGraph());
      expect(() => atoms.create({ ...details, xHandle })).toThrow(
        "Enter an X handle",
      );
      // Failure leaves no accepted identity or allocated public ID behind.
      expect(atoms.create(details).publicId).toBe("00001001");
    },
  );
  it("serializes only normalized public social data, independent of email verification", () => {
    const { atoms } = createMockParticipation(generateMockGraph());
    const atom = atoms.create({ ...details, xHandle: "@Example_123" });
    expect(atom.socialProfiles?.x).toEqual({
      handle: "Example_123",
      verification: { status: "unverified" },
    });
    atoms.simulateVerification(atom.id);
    expect(atoms.isVerified(atom.id)).toBe(true);
    expect(atoms.get(atom.id).socialProfiles?.x?.verification.status).toBe(
      "unverified",
    );
    const node = atoms.toGraphNode(atom.id);
    expect(node.socialProfiles).toEqual(atom.socialProfiles);
    for (const value of [atom, node]) {
      const serialized = JSON.stringify(value);
      expect(serialized).toContain('"handle":"Example_123"');
      expect(serialized).not.toContain("private@example.com");
      expect(serialized).not.toContain("email");
      expect(serialized).not.toContain("https://");
    }
    expect(xProfileUrl(node.socialProfiles?.x?.handle)).toBe(
      "https://x.com/Example_123",
    );
  });
  it("omits X markup entirely without a handle, including malformed public projections", () => {
    expect(renderToStaticMarkup(<PublicXProfile profiles={undefined} />)).toBe(
      "",
    );
    expect(renderToStaticMarkup(<PublicXProfile profiles={{}} />)).toBe("");
    expect(
      renderToStaticMarkup(
        <PublicXProfile
          profiles={{
            x: {
              handle: "https://evil.example",
              verification: { status: "unverified" },
            },
          }}
        />,
      ),
    ).toBe("");
  });
  it("renders a safe external link and an explicit ownership disclaimer", () => {
    const html = renderToStaticMarkup(
      <PublicXProfile
        profiles={{
          x: { handle: "username", verification: { status: "unverified" } },
        }}
      />,
    );
    expect(html).toContain("𝕏 @username");
    expect(html).toContain("VIEW ON X");
    expect(html).toContain('href="https://x.com/username"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('referrerPolicy="no-referrer"');
    expect(html).toContain("Ownership not verified");
  });
});
