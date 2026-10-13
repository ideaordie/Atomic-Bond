import { describe, expect, it } from "vitest";
import {
  almostComplete,
  createPuzzle,
  ended,
  HOUR,
  nextPuzzle,
  playerFor,
  RESERVATION,
  tick,
  transact,
  WEEK,
} from "../../src/prototypes/puzzle/model";
import { readFileSync } from "node:fs";
describe("local collaborative puzzle authority", () => {
  it("assigns unique reservations and rejects stale concurrent snapshots", () => {
    const s = createPuzzle();
    const a = transact(s, "demo-1", 0, { type: "reveal" });
    expect(a.ok).toBe(true);
    expect(transact(a.state, "demo-2", 0, { type: "reveal" }).ok).toBe(false);
    const b = transact(a.state, "demo-2", 1, { type: "reveal" });
    expect(playerFor(b.state, "demo-1").reservation?.piece).not.toBe(
      playerFor(b.state, "demo-2").reservation?.piece,
    );
    expect(playerFor(b.state, "demo-1").placeAt).toBe(0);
  });
  it("expires at five minutes and cancellation releases without consuming allowance", () => {
    const a = transact(createPuzzle(), "demo-1", 0, { type: "reveal" }).state;
    expect(
      playerFor(tick(a, RESERVATION - 1), "demo-1").reservation,
    ).toBeDefined();
    const expired = tick(a, RESERVATION);
    expect(playerFor(expired, "demo-1").reservation).toBeUndefined();
    expect(
      transact(expired, "demo-1", expired.revision, { type: "place", to: 0 })
        .ok,
    ).toBe(false);
    const cancelled = transact(a, "demo-1", a.revision, {
      type: "cancel",
    }).state;
    expect(playerFor(cancelled, "demo-1")).toEqual({
      placeAt: 0,
      moveAt: 0,
      revealAt: RESERVATION,
    });
    expect(
      transact(cancelled, "demo-1", cancelled.revision, { type: "reveal" }).ok,
    ).toBe(false);
  });
  it("locks correct placement, prevents duplicate taps and preserves independent allowances", () => {
    const a = transact(createPuzzle(), "demo-1", 0, { type: "reveal" }).state;
    const piece = playerFor(a, "demo-1").reservation!.piece;
    const b = transact(a, "demo-1", a.revision, {
      type: "place",
      to: piece,
    }).state;
    expect(b.board[piece]).toBe(piece);
    expect(playerFor(b, "demo-1")).toEqual({ placeAt: HOUR, moveAt: 0 });
    expect(
      transact(b, "demo-1", a.revision, { type: "place", to: piece }).ok,
    ).toBe(false);
    expect(
      transact(b, "demo-1", b.revision, {
        type: "move",
        from: piece,
        to: (piece + 1) % 25,
      }).ok,
    ).toBe(false);
    expect(transact(b, "demo-1", b.revision, { type: "reveal" }).ok).toBe(
      false,
    );
    const ready = tick(b, HOUR);
    expect(
      transact(ready, "demo-1", ready.revision, { type: "reveal" }).ok,
    ).toBe(true);
  });
  it("moves incorrect placements and never charges failed operations", () => {
    const a = transact(createPuzzle(), "demo-1", 0, { type: "reveal" }).state;
    const piece = playerFor(a, "demo-1").reservation!.piece;
    const wrong = (piece + 1) % 25;
    const b = transact(a, "demo-1", a.revision, {
      type: "place",
      to: wrong,
    }).state;
    const invalid = transact(b, "demo-1", b.revision, {
      type: "move",
      from: wrong,
      to: wrong,
    });
    expect(invalid.state).toEqual(b);
    const moved = transact(b, "demo-1", b.revision, {
      type: "move",
      from: wrong,
      to: piece,
    });
    expect(moved.ok).toBe(true);
    expect(moved.state.board[wrong]).toBeNull();
    expect(playerFor(moved.state, "demo-1")).toEqual({
      placeAt: HOUR,
      moveAt: HOUR,
    });
  });
  it("swaps atomically, locks both pieces, detects completion and rejects future writes", () => {
    const s = almostComplete(100);
    const r = transact(s, "demo-2", 0, { type: "move", from: 0, to: 1 });
    expect(r.ok).toBe(true);
    expect(r.state.completedAt).toBe(100);
    expect(new Set(r.state.board).size).toBe(25);
    expect(
      transact(r.state, "demo-3", r.state.revision, { type: "reveal" }).ok,
    ).toBe(false);
  });
  it("rejects locked swap targets and unauthorized actors", () => {
    const s = almostComplete(0);
    expect(
      transact(s, "demo-1", 0, { type: "move", from: 0, to: 2 }).state,
    ).toEqual(s);
    expect(
      transact(s, "anonymous", 0, { type: "move", from: 0, to: 1 }).ok,
    ).toBe(false);
  });
  it("ends exactly at the weekly boundary and starts the queued week automatically", () => {
    const s = createPuzzle();
    expect(ended(tick(s, WEEK - 1))).toBe(false);
    const expired = tick(s, WEEK);
    expect(ended(expired)).toBe(true);
    const fresh = nextPuzzle(expired);
    expect(fresh.week).toBe(2);
    expect(fresh.start).toBe(WEEK);
    expect(fresh.board.every((p) => p === null)).toBe(true);
    expect(fresh.players).toEqual({});
  });
  it("carries rolling allowances across weekly rollover", () => {
    const s = createPuzzle();
    s.players["demo-1"] = { placeAt: WEEK + HOUR, moveAt: WEEK + HOUR };
    const next = nextPuzzle(tick(s, WEEK));
    expect(playerFor(next, "demo-1").placeAt).toBe(WEEK + HOUR);
    expect(transact(next, "demo-1", 0, { type: "reveal" }).ok).toBe(false);
  });
  it("keeps the prototype inaccessible in production and never changes frozen specs", () => {
    const route = readFileSync("src/app/review/puzzle/page.tsx", "utf8");
    expect(route).toContain('process.env.NODE_ENV !== "development"');
    expect(route).toContain("notFound()");
    const ui = readFileSync("src/prototypes/puzzle/PuzzleReview.tsx", "utf8");
    expect(ui).not.toMatch(/supabase|fetch\(|localStorage|sessionStorage/);
  });
});
