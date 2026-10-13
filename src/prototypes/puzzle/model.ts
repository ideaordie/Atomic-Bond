/** Local synthetic authority. Never connected to Auth, Supabase or production. */
export const HOUR = 3_600_000;
export const WEEK = 168 * HOUR;
export const RESERVATION = 5 * 60_000;
export type Reservation = { piece: number; until: number };
export type Player = {
  placeAt: number;
  moveAt: number;
  revealAt?: number;
  reservation?: Reservation;
};
export type Puzzle = {
  week: number;
  start: number;
  now: number;
  revision: number;
  seed: number;
  board: (number | null)[];
  players: Record<string, Player>;
  placements: number;
  moves: number;
  contributors: string[];
  completedAt?: number;
};
export type Action =
  | { type: "reveal" }
  | { type: "cancel" }
  | { type: "place"; to: number }
  | { type: "move"; from: number; to: number };
export function createPuzzle(start = 0, week = 1): Puzzle {
  return {
    week,
    start,
    now: start,
    revision: 0,
    seed: 130,
    board: Array(25).fill(null),
    players: {},
    placements: 0,
    moves: 0,
    contributors: [],
  };
}
export function tick(source: Puzzle, now: number): Puzzle {
  const state = structuredClone(source);
  state.now = Math.max(source.now, now);
  for (const player of Object.values(state.players)) {
    if (player.reservation && player.reservation.until <= state.now) {
      player.revealAt = Math.max(
        player.revealAt ?? 0,
        player.reservation.until + RESERVATION,
      );
      delete player.reservation;
    }
  }
  return state;
}
export const ended = (s: Puzzle) =>
  s.completedAt !== undefined || s.now >= s.start + WEEK;
export const playerFor = (s: Puzzle, actor: string): Player =>
  s.players[actor] ?? { placeAt: 0, moveAt: 0 };
export const lockedCount = (s: Puzzle) =>
  s.board.filter((piece, position) => piece === position).length;
export function nextPuzzle(s: Puzzle): Puzzle {
  if (s.now < s.start + WEEK) return s;
  const periods = Math.floor((s.now - s.start) / WEEK);
  const previous = tick(s, s.now);
  const fresh = createPuzzle(s.start + periods * WEEK, s.week + periods);
  fresh.players = previous.players;
  return tick(fresh, s.now);
}
export function transact(
  source: Puzzle,
  actor: string,
  revision: number,
  action: Action,
): { state: Puzzle; message: string; ok: boolean } {
  const fail = (message: string) => ({ state: source, message, ok: false });
  if (!/^demo-[1-6]$/.test(actor))
    return fail("An ACTIVE simulated participant is required.");
  if (revision !== source.revision)
    return fail(
      "The board changed. Review it and try again; no allowance was used.",
    );
  if (ended(source)) return fail("This puzzle has ended.");
  const state = tick(source, source.now);
  const p = (state.players[actor] ??= { placeAt: 0, moveAt: 0 });
  const valid = (n: number) => Number.isInteger(n) && n >= 0 && n < 25;
  let message = "";
  if (action.type === "reveal") {
    if (p.placeAt > state.now || (p.revealAt ?? 0) > state.now)
      return fail("Your PLACE or REVEAL allowance is cooling down.");
    if (p.reservation) return fail("You already have a reserved piece.");
    const reserved = Object.values(state.players).map(
      (v) => v.reservation?.piece,
    );
    const pool = Array.from({ length: 25 }, (_, i) => i).filter(
      (i) => !state.board.includes(i) && !reserved.includes(i),
    );
    if (!pool.length)
      return fail("All pieces are on the board or reserved. Try MOVE A PIECE.");
    state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
    p.reservation = {
      piece: pool[state.seed % pool.length]!,
      until: Math.min(state.now + RESERVATION, state.start + WEEK),
    };
    message =
      "Your piece is reserved for five minutes. Select an empty square, then PLACE MY PIECE.";
  } else if (action.type === "cancel") {
    if (!p.reservation) return fail("No active reservation.");
    delete p.reservation;
    p.revealAt = state.now + RESERVATION;
    message =
      "Piece returned. Reveal again in five minutes; PLACE remains unused.";
  } else if (action.type === "place") {
    if (p.placeAt > state.now || !p.reservation)
      return fail(
        "No valid reservation or PLACE allowance. Reveal a piece first.",
      );
    if (!valid(action.to) || state.board[action.to] !== null)
      return fail("Choose an empty square. No allowance used.");
    state.board[action.to] = p.reservation.piece;
    message =
      action.to === p.reservation.piece
        ? "Correct! This piece is now locked."
        : "Placed and unlocked. Someone can help find its place.";
    delete p.reservation;
    p.placeAt = state.now + HOUR;
    state.placements++;
  } else {
    if (p.moveAt > state.now)
      return fail("Your MOVE allowance is cooling down.");
    if (!valid(action.from) || !valid(action.to) || action.from === action.to)
      return fail("Choose a different destination.");
    if (
      state.board[action.from] === null ||
      state.board[action.from] === action.from ||
      state.board[action.to] === action.to
    )
      return fail(
        "Locked pieces cannot move or swap. Select an unlocked piece.",
      );
    [state.board[action.from], state.board[action.to]] = [
      state.board[action.to]!,
      state.board[action.from]!,
    ];
    p.moveAt = state.now + HOUR;
    state.moves++;
    message = "Move committed. Any correctly positioned pieces are now locked.";
  }
  if (action.type === "place" || action.type === "move") {
    if (!state.contributors.includes(actor)) state.contributors.push(actor);
    if (lockedCount(state) === 25) {
      state.completedAt = state.now;
      message = "PUZZLE COMPLETE! We made the big picture together.";
    }
  }
  state.revision++;
  return { state, message, ok: true };
}
/** Explicit review fixture, not a player action. Two unlocked tiles finish with one swap. */
export function almostComplete(now: number): Puzzle {
  const s = createPuzzle(now);
  s.board = Array.from({ length: 25 }, (_, i) => i);
  [s.board[0], s.board[1]] = [1, 0];
  s.placements = 25;
  s.contributors = ["demo-2", "demo-3"];
  return s;
}
