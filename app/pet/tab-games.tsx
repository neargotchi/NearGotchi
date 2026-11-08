"use client";

import { useState } from "react";

import { fill, petPage } from "../../lib/copy";
import { canPlay, finishGame, type GameId } from "../../lib/games";
import { findPet, petSpriteSrc, type DemoPet } from "../../lib/mocks";
import CatchSnack from "./games/catch-snack";
import type { PetTab } from "./pet-tabs";

type TabGamesProps = {
  pet: DemoPet;
  /** Hunger / energy simulated to now (decides if a new game may start). */
  shown: Pick<DemoPet, "hunger" | "energy">;
  /** The games tab is the visible one. */
  active: boolean;
  onTab: (tab: PetTab) => void;
  /** A game ended: the page shows the happy pet and the new numbers. */
  onFinished: (pet: DemoPet) => void;
};

/**
 * Games tab (docs/DEVLOG.md §2, task 049): catch the snack, then two "soon" cards (fetch,
 * hide & seek). The card has its rules and best score. A starving or sleeping pet can't start a game: the
 * reason and "feed it first" (→ feed tab) replace "play". The cost (+10 hunger) is charged when a game ends.
 */
export default function TabGames({ pet, shown, active, onTab, onFinished }: TabGamesProps) {
  const [message, setMessage] = useState<string | null>(null);
  const profile = findPet(pet.petId)!;
  const check = canPlay(shown);
  const blocked = check === "ok" ? null : fill(petPage.games.blocked[check], { name: pet.name });
  const best = (score: number) => (score > 0 ? String(score) : petPage.games.noScore);

  const end = async (gameId: GameId, score: number) => {
    const { pet: next, newBest } = await finishGame(pet.id, gameId, score);
    onFinished(next);
    const line = fill(petPage.games.finished, { name: pet.name, score: String(score) });
    setMessage(newBest && score > 0 ? `${line} ${petPage.games.newBest}` : line);
  };

  return (
    <div className="pet-games-tab">
      <div className="pet-result" role="status">
        {message ? <p>{message}</p> : null}
      </div>

      <section className="pet-card-block game-card" aria-labelledby="game-snack-title">
        <div className="game-head">
          <h2 id="game-snack-title" className="mint-subtitle">
            {petPage.games.snack.title}
          </h2>
          <p className="game-best">
            {petPage.games.best} <strong>{best(pet.stats.best.snack)}</strong>
          </p>
        </div>
        <CatchSnack
          canStart={check === "ok"}
          blockedReason={blocked}
          active={active}
          petName={pet.name}
          sprites={{
            normal: petSpriteSrc(profile, "normal"),
            happy: petSpriteSrc(profile, "happy"),
            width: profile.spriteWidth,
            height: profile.spriteHeight,
          }}
          onStart={() => setMessage(null)}
          onEnd={(score) => {
            end("snack", score);
          }}
          onStop={() => setMessage(petPage.games.stopped)}
          onFeed={() => onTab("feed")}
        >
          <p className="game-rules">{fill(petPage.games.snack.rules, { name: pet.name })}</p>
          <p className="games-cost">{petPage.games.cost}</p>
        </CatchSnack>
      </section>

      <ul className="game-soon-list">
        {petPage.games.upcoming.map((game) => (
          <li key={game.title} className="pet-card-block game-card is-soon">
            <div className="game-head">
              <h2 className="mint-subtitle">{game.title}</h2>
              <p className="game-best">{petPage.games.soon}</p>
            </div>
            <p className="game-rules">{fill(game.rules, { name: pet.name })}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
