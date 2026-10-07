import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EMOTIONS,
  READABLE_EMOTIONS,
  pulseFromDatabase,
  pulseToDatabase,
  PULSE_LIFETIME_MS,
} from "../../src/types/emotional-pulse";
import {
  EMOTION_DEFINITIONS,
  PULSE_CATEGORIES,
} from "../../src/living-atom/pulse/emotions";
import { MockPulseService } from "../../src/services/pulses/pulse-service";
import { SupabasePulseService } from "../../src/services/supabase/services";
import { emotionalNetwork } from "../../src/graph/metrics/emotional-network";
import { NetworkEmotionResults } from "../../src/components/pulse/NetworkEmotionResults";
import { networkReach } from "../../src/graph/metrics/network-reach";
const graph = {
  nodes: [{ id: "1", publicId: "1", degree: 0, createdAt: "2026-01-01" }],
  edges: [],
};
describe("expanded Pulse contract", () => {
  it("has exactly the approved catalog, one category each and distinct material colors", () => {
    expect(EMOTIONS).toEqual([
      "joyful",
      "excited",
      "curious",
      "calm",
      "content",
      "sad",
      "anxious",
      "frustrated",
      "energized",
      "focused",
      "motivated",
      "wired",
      "tired",
      "drained",
      "restless",
      "lazy",
      "chilling",
      "hungry",
      "caffeinated",
      "tipsy",
      "pooped",
      "cozy",
      "hungover",
      "under_the_weather",
    ]);
    expect(new Set(EMOTIONS).size).toBe(24);
    expect(
      new Set(EMOTIONS.map((s) => EMOTION_DEFINITIONS[s].color)).size,
    ).toBe(24);
    for (const category of PULSE_CATEGORIES)
      expect(
        EMOTIONS.filter((s) => EMOTION_DEFINITIONS[s].category === category),
      ).toHaveLength(8);
    expect(EMOTION_DEFINITIONS.under_the_weather.label).toBe(
      "Under the Weather",
    );
  });
  it("maps JOY explicitly, reads legacy states unchanged, rejects unsupported or retired writes", async () => {
    expect(pulseToDatabase("joyful")).toBe("JOY");
    expect(pulseFromDatabase("joy")).toBe("joyful");
    const call = vi.fn().mockResolvedValue([
      {
        id: "legacy",
        atomId: "1",
        emotion: "afraid",
        createdAt: 0,
        expiresAt: PULSE_LIFETIME_MS,
      },
    ]);
    const service = new SupabasePulseService({ call });
    expect((await service.visible())[0]?.emotion).toBe("afraid");
    for (const value of ["angry", "afraid", "joy", "Other", "__proto__", null])
      expect(() => pulseToDatabase(value)).toThrow();
    for (const value of ["other", "JOY", "depressed", null])
      expect(() => pulseFromDatabase(value)).toThrow();
    await expect(service.send("angry")).rejects.toThrow();
    expect(call).toHaveBeenCalledTimes(1);
    for (const value of READABLE_EMOTIONS)
      expect(pulseFromDatabase(value)).toBe(value);
  });
  it("cross-category replacement and expiry never retain a second state; legacy ends naturally", () => {
    let now = 1000;
    const legacy = {
      id: "legacy",
      atomId: "1",
      emotion: "angry" as const,
      createdAt: 0,
      expiresAt: PULSE_LIFETIME_MS,
    };
    const service = new MockPulseService("1", [legacy], () => now);
    expect(service.visible(graph, "1")).toEqual([legacy]);
    for (const state of ["joyful", "tipsy", "focused"] as const) {
      const p = service.send(state);
      expect(service.visible(graph, "1")).toEqual([p]);
      now++;
    }
    now += PULSE_LIFETIME_MS;
    expect(service.visible(graph, "1")).toEqual([]);
    expect(() => service.send("afraid")).toThrow();
  });
  it("overview omits empty rows, including retired states", () => {
    const service = new MockPulseService("1", [], () => 1000);
    service.send("tipsy");
    const summary = emotionalNetwork(
      graph,
      "1",
      service.visible(graph, "1"),
      1000,
    );
    expect(summary.counts.tipsy).toBe(1);
    expect(summary.counts.angry).toBe(0);
    const html = renderToStaticMarkup(
      <NetworkEmotionResults
        summary={summary}
        reach={networkReach(graph, "1")}
        now={1000}
        updatedAt={1000}
        status="ready"
      />,
    );
    expect(html).not.toContain("Angry");
    expect(html).not.toContain("email");
  });
});
