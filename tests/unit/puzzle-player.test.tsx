import { it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ApplicationNavigation } from "../../src/components/navigation/ApplicationNavigation";
import {
  PuzzlePlayer,
  type PuzzleRead,
} from "../../src/components/puzzle/PuzzlePlayer";
vi.mock("next/navigation", () => ({ usePathname: () => "/partici-puzzle" }));
it("hides puzzle navigation by default and from non-owners", () => {
  expect(
    renderToStaticMarkup(<ApplicationNavigation owner doodle />),
  ).not.toContain("PARTICIPUZZLE");
  expect(renderToStaticMarkup(<ApplicationNavigation puzzle />)).not.toContain(
    "PARTICIPUZZLE",
  );
  expect(
    renderToStaticMarkup(<ApplicationNavigation owner doodle puzzle />),
  ).toContain('href="/partici-puzzle"');
});
it("does not request full art, unrevealed tiles or an expired reservation", () => {
  const data: PuzzleRead = {
    serverTime: "2026-10-13T12:00:00Z",
    puzzle: {
      id: "p",
      revision: 1,
      status: "ACTIVE",
      endsAt: "2026-10-20T12:00:00Z",
      board: [],
      reservation: { piece: "expired", expiresAt: "2026-10-13T11:59:59Z" },
    },
  };
  const html = renderToStaticMarkup(<PuzzlePlayer initial={data} />);
  expect(html).not.toContain("<img");
  expect(html).not.toContain("piece=expired");
  expect(html).not.toContain("REVEAL MY PIECE");
  expect(html).toContain("Next piece available");
});
