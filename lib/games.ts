// Mini-games (docs/DEVLOG.md §1, step 7). A game makes the pet happy and a bit hungry. The cost is
// charged when a game ends (finishGame); quitting before the end costs nothing. A hungry or sleeping pet
// doesn't play. Async on purpose, like the rest of lib/*.

import { PET_RULES, baseMood, getPet, levelOf, simulatePet, updatePet, type DemoPet } from "./mocks";

export const GAME_RULES = {
  /** hunger +15 per finished game */
  hungerCost: 15,
  /** hunger ≥ 70 (the "hungry" mood) blocks a new game */
  blockedAt: PET_RULES.hungryAt,
  /** happy sprite for 60 s after a game */
  happyMs: 60000,
} as const;

export const gameIds = ["simon", "snack"] as const;
export type GameId = (typeof gameIds)[number];

export type PlayCheck = "ok" | "hungry" | "asleep";

/** Asleep first (it can't play at all), then hungry. */
export function canPlay(pet: Pick<DemoPet, "hunger" | "energy">): PlayCheck {
  if (baseMood(pet) === "sleep") return "asleep";
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
 * A game ended with `score` (a whole number ≥ 0): hunger +15, happy for 60 s, stats.games++ and the best
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
