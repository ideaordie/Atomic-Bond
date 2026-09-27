import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { dataConfiguration } from "../../src/data/supabase/config";
import {
  publicAtom,
  publicGraph,
  publicNumber,
} from "../../src/data/supabase/projections";
import {
  createSupabaseServices,
  invitationPath,
} from "../../src/services/supabase/services";
import { normalizeEmail } from "../../src/utils/email";
import { LivingAtom } from "../../src/living-atom/LivingAtom";
import { AtomContextPanel } from "../../src/living-atom/interaction/AtomContextPanel";

const row = {
  id: "private-uuid",
  publicId: "9007199254740993",
  displayName: "Alex",
  xHandle: "@alex",
  degree: 0,
  createdAt: "2026-09-26T00:00:00Z",
  metadata: { region: "Florida", countryCode: "US", centroidLatitude: 12 },
  email: "private@example.com",
  auth_user_id: "secret",
  emotion: "JOY",
  token: "secret",
  preferences: {},
};
describe("Supabase configuration and public adapters", () => {
  it("requires explicit production mode and rejects missing or administrative configuration", () => {
    expect(() => dataConfiguration({ NODE_ENV: "production" })).toThrow(
      "explicitly",
    );
    expect(dataConfiguration({ NODE_ENV: "development" })).toEqual({
      mode: "mock",
    });
    expect(
      dataConfiguration({
        NODE_ENV: "production",
        ATOMIC_BOND_DATA_MODE: "mock",
      }),
    ).toEqual({ mode: "mock" });
    const env = {
      ATOMIC_BOND_DATA_MODE: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test",
    };
    expect(dataConfiguration(env).mode).toBe("supabase");
    expect(() =>
      dataConfiguration({ ...env, NEXT_PUBLIC_SUPABASE_ANON_KEY: "" }),
    ).toThrow("requires");
    expect(() =>
      dataConfiguration({
        ...env,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_test",
      }),
    ).toThrow("administrative");
    const key = (role: string) => `test.${btoa(JSON.stringify({ role }))}.test`;
    expect(() =>
      dataConfiguration({
        ...env,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: key("service_role"),
      }),
    ).toThrow("never a service-role");
    expect(
      dataConfiguration({ ...env, NEXT_PUBLIC_SUPABASE_ANON_KEY: key("anon") })
        .mode,
    ).toBe("supabase");
    expect(() =>
      dataConfiguration({
        ...env,
        NEXT_PUBLIC_SUPABASE_URL: "http://public.example.com",
      }),
    ).toThrow("HTTPS");
  });
  it("preserves bigint decimal numbers and allowlists public identity with validated X", () => {
    expect(publicNumber(row.publicId)).toBe("9007199254740993");
    expect(() => publicNumber(9007199254740993)).toThrow();
    expect(() => publicNumber("9223372036854775808")).toThrow();
    const result = publicAtom(row);
    expect(result).toEqual({
      publicId: row.publicId,
      displayName: "Alex",
      xHandle: "alex",
      createdAt: row.createdAt,
      location: { region: "Florida", countryCode: "US" },
    });
    expect(
      JSON.stringify(publicGraph({ nodes: [row], edges: [] })),
    ).not.toMatch(/private|secret|email|emotion|preferences|centroid/);
    expect(() =>
      publicAtom({ ...row, xHandle: "https://x.com/alex" }),
    ).toThrow();
    expect(
      publicAtom({ ...row, displayName: null, xHandle: null }),
    ).not.toHaveProperty("xHandle");
  });
  it("normalizes identity case and surrounding whitespace without provider transformations", () => {
    expect(normalizeEmail("\t Person.Name+tag@EXAMPLE.com \r\n")).toBe(
      "person.name+tag@example.com",
    );
    expect(() => normalizeEmail("no address")).toThrow();
  });
  it("uses only controlled RPCs and never accepts an arbitrary owner id or verification flag", async () => {
    const call = vi
      .fn()
      .mockResolvedValue({ status: "PENDING", publicId: null });
    const services = createSupabaseServices({ call });
    await services.atoms.create({
      locationId: "location",
      alias: " Alex ",
      xHandle: "@alex",
    });
    expect(call).toHaveBeenCalledWith("begin_atom", {
      p_location_id: "location",
      p_display_name: "Alex",
      p_x_handle: "alex",
    });
    call.mockResolvedValue({
      id: "pulse",
      atomId: "1",
      emotion: "curious",
      createdAt: 0,
      expiresAt: 86_400_000,
      email: "private@example.com",
    });
    expect(await services.pulses.send("curious")).not.toHaveProperty("email");
    expect(call).toHaveBeenLastCalledWith("send_emotional_pulse", {
      p_emotion: "CURIOUS",
    });
    call.mockResolvedValue([]);
    expect(await services.pulses.visible()).toEqual([]);
    expect(call).toHaveBeenLastCalledWith("connected_emotional_pulses");
    expect(() => services.notifications.sendVerificationEmail()).toThrow(
      "Task #7",
    );
  });
  it("constructs invitation paths only from secure tokens", () => {
    expect(invitationPath("a".repeat(64))).toBe(`/bond/${"a".repeat(64)}`);
    for (const value of ["1", "https://evil.example.com", "../", ""]) {
      expect(() => invitationPath(value)).toThrow();
    }
  });
  it("does not imply a public visitor owns an Atom or can send Pulse", () => {
    const graph = publicGraph({ nodes: [row], edges: [] });
    const html = renderToStaticMarkup(
      <LivingAtom
        graph={graph}
        originalAtomId={row.publicId}
        ownerMode={false}
      />,
    );
    expect(html).toContain("Public network");
    expect(html).not.toContain("Synthetic network");
    expect(html).toContain("Starting Atom");
    expect(html).not.toContain("MY BONDS");
    expect(html).toMatch(/class="pulse-button" disabled=""/);
    const context = renderToStaticMarkup(
      <AtomContextPanel
        graph={graph}
        centerId={row.publicId}
        originalId={row.publicId}
        atomId={row.publicId}
        ownerMode={false}
        onClose={() => {}}
        onView={() => {}}
      />,
    );
    expect(context).not.toMatch(/Your Atom|Bonded to you|Connection to you/);
  });
});
