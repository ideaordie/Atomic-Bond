import { expect, it } from "vitest";
import {
  invitationTimeRemaining,
  isDayInvitation,
} from "../../src/utils/invitation-time";
it("formats full-day and legacy countdowns without negative expiry", () => {
  expect(invitationTimeRemaining(86400)).toBe("24h 00m 00s");
  expect(invitationTimeRemaining(86399)).toBe("23h 59m 59s");
  expect(invitationTimeRemaining(299)).toBe("0h 04m 59s");
  expect(invitationTimeRemaining(-1)).toBe("0h 00m 00s");
});
it("labels only known full-day invitations as 24-hour invitations", () => {
  const created = "2026-10-16T00:00:00.000Z";
  expect(isDayInvitation(created, "2026-10-17T00:00:00.000Z")).toBe(true);
  expect(isDayInvitation(created, "2026-10-16T00:05:00.000Z")).toBe(false);
  expect(isDayInvitation(undefined, "2026-10-17T00:00:00.000Z")).toBe(false);
  expect(isDayInvitation("invalid", "invalid")).toBe(false);
});
