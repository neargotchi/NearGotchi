// Mini-games (docs/DEVLOG.md §1, step 7). A game makes the pet happy and a bit hungry. The cost is
// charged when a game ends (finishGame); quitting before the end costs nothing. A starving pet
// doesn't play. Async on purpose, like the rest of lib/*.

import { baseMood, getPet, levelOf, simulatePet, updatePet, type DemoPet } from "./mocks";

export const GAME_RULES = {
  /** hunger +10 per finished game (task 049: was 15) */
  hungerCost: 10,
  /** only a starving pet (hunger ≥ 90) can't start a game (task 049: was the "hungry" mood at 70) */
  blockedAt: 90,
  /** happy sprite for 60 s after a game */
  happyMs: 60000,
} as const;

export const gameIds = ["snack", "fetch", "hideseek"] as const;
export type GameId = (typeof gameIds)[number];

export type PlayCheck = "ok" | "hungry";

/** Only hunger blocks a game; energy never does (task 059). */
export function canPlay(pet: Pick<DemoPet, "hunger" | "energy">): PlayCheck {
  if (levelOf(pet.hunger) >= GAME_RULES.blockedAt) return "hungry";
  return "ok";
}

export class GameError extends Error {
  constructor(public readonly code: "no_pet" | "unknown_game" | "bad_score") {
    super(code);
    this.name = "GameError";
  }
}

/**
 * A game ended with `score` (a whole number ≥ 0): hunger +10, happy for 60 s, stats.games++ and the best
 * score of that game. Returns the saved pet and whether the score is a new best.
 */
export async function finishGame(
  petId: string,
  gameId: GameId,
  score: number,
): Promise<{ pet: DemoPet; newBest: boolean }> {
  if (!gameIds.includes(gameId)) throw new GameError("unknown_game");
  if (!Number.isInteger(score) || score < 0) throw new GameError("bad_score");
  const current = await getPet(petId);
  if (!current) throw new GameError("no_pet");
  const now = Date.now();
  const pet = simulatePet(current, now);
  const previous = pet.stats.best[gameId];
  const hunger = Math.round(Math.min(100, pet.hunger + GAME_RULES.hungerCost) * 100) / 100;
  const next = {
    ...pet,
    hunger,
    happyUntil: new Date(now + GAME_RULES.happyMs).toISOString(),
    stats: { ...pet.stats, games: pet.stats.games + 1, best: { ...pet.stats.best, [gameId]: Math.max(previous, score) } },
  };
  const saved = await updatePet({ ...next, mood: baseMood(next) }, pet.id);
  return { pet: saved, newBest: score > previous };
}
