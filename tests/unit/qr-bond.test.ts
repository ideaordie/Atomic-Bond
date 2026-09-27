import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { invitationPresentation } from "../../src/services/bonds/qr-invitation";
import { bondRelationship } from "../../src/services/bonds/relationship";

describe("secure QR transport", () => {
  it("independently decodes the generated image to exactly the configured URL", async () => {
    const token = "a".repeat(64);
    const env = {
      APP_ORIGIN: "https://atomic.example",
      NODE_ENV: "production",
    };
    const qr = await invitationPresentation(token, env);
    const png = PNG.sync.read(Buffer.from(qr.image.split(",")[1]!, "base64"));
    const decoded = jsQR(
      new Uint8ClampedArray(png.data),
      png.width,
      png.height,
    );
    expect(decoded?.data).toBe(`https://atomic.example/bond/${token}`);
    expect(qr.url).toBe(decoded?.data);
    expect(await invitationPresentation(token, env)).toEqual(qr);
  });
  it("rejects malformed tokens and untrusted/missing production origin", async () => {
    for (const token of [
      "1",
      "https://other.example",
      "a".repeat(63),
      "a".repeat(64) + "\n",
    ])
      await expect(
        invitationPresentation(token, { APP_ORIGIN: "https://atomic.example" }),
      ).rejects.toThrow();
    for (const origin of [
      undefined,
      "http://atomic.example",
      "https://atomic.example/path",
      "https://user:secret@atomic.example",
    ])
      await expect(
        invitationPresentation("a".repeat(64), {
          APP_ORIGIN: origin,
          NODE_ENV: "production",
        }),
      ).rejects.toThrow();
  });
  it("distinguishes self, unrelated and either ordering of an existing Bond", () => {
    const graph = {
      nodes: [],
      edges: [{ id: "1:2", source: "1", target: "2" }],
    };
    expect(bondRelationship(graph, "1", "1")).toBe("self");
    expect(bondRelationship(graph, "1", "2")).toBe("bonded");
    expect(bondRelationship(graph, "2", "1")).toBe("bonded");
    expect(bondRelationship(graph, "3", "1")).toBe("available");
    expect(bondRelationship(graph, null, "1")).toBe("available");
  });
});
