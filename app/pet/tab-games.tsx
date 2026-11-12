"use client";

import { useState } from "react";

import { fill, petPage } from "../../lib/copy";
import { canPlay, finishGame, type GameId } from "../../lib/games";
import { findPet, petSpriteSrc, type DemoPet } from "../../lib/mocks";
import CatchSnack from "./games/catch-snack";
import FetchGame from "./games/fetch-game";
import HideSeek from "./games/hide-seek";
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
 * Games tab (docs/DEVLOG.md §2, tasks 049–051): catch the snack, fetch and hide & seek. Each
 * card has its rules and best score. A starving or sleeping pet can't start a game: the
 * reason and "feed it first" (→ feed tab) replace "play". The cost (+10 hunger) is charged when a game ends.
 */
export default function TabGames({ pet, shown, active, onTab, onFinished }: TabGamesProps) {
  const [message, setMessage] = useState<string | null>(null);
  const profile = findPet(pet.petId)!;
  const check = canPlay(shown);
  const blocked = check === "ok" ? null : fill(petPage.games.blocked[check], { name: pet.name });
  const best = (score: number) => (score > 0 ? String(score) : petPage.games.noScore);

  // "feed it first" (task 088): switch to the feed tab, then bring the top of its panel into view
  // (html scroll-padding-top keeps it under the sticky header), also when the page was scrolled
  // further down. Two frames: the panel is unhidden by the re-render after onTab.
  const goFeed = () => {
    onTab("feed");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => document.getElementById("pet-panel-feed")?.scrollIntoView({ block: "start" })),
    );
  };

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
          onFeed={goFeed}
        >
          <p className="game-rules">{fill(petPage.games.snack.rules, { name: pet.name })}</p>
          <p className="games-cost">{petPage.games.cost}</p>
        </CatchSnack>
      </section>

      <section className="pet-card-block game-card" aria-labelledby="game-fetch-title">
        <div className="game-head">
          <h2 id="game-fetch-title" className="mint-subtitle">
            {petPage.games.fetch.title}
          </h2>
          <p className="game-best">
            {petPage.games.best} <strong>{best(pet.stats.best.fetch)}</strong>
          </p>
        </div>
        <FetchGame
          canStart={check === "ok"}
          blockedReason={blocked}
          active={active}
          petName={pet.name}
          sprites={{
            normal: petSpriteSrc(profile, "normal"),
            happy: petSpriteSrc(profile, "happy"),
            // not "hungry": that sprite has the empty food bowl drawn in (task 078)
            sad: petSpriteSrc(profile, "normal"),
            width: profile.spriteWidth,
            height: profile.spriteHeight,
          }}
          onStart={() => setMessage(null)}
          onEnd={(score) => {
            end("fetch", score);
          }}
          onStop={() => setMessage(petPage.games.stopped)}
          onFeed={goFeed}
        >
          <p className="game-rules">{petPage.games.fetch.rules}</p>
          <p className="games-cost">{petPage.games.cost}</p>
        </FetchGame>
      </section>

      <section className="pet-card-block game-card" aria-labelledby="game-hideseek-title">
        <div className="game-head">
          <h2 id="game-hideseek-title" className="mint-subtitle">
            {petPage.games.hideseek.title}
          </h2>
          <p className="game-best">
            {petPage.games.best} <strong>{best(pet.stats.best.hideseek)}</strong>
          </p>
        </div>
        <HideSeek
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
          mouth={profile.mouth}
          onStart={() => setMessage(null)}
          onEnd={(score) => {
            end("hideseek", score);
          }}
          onStop={() => setMessage(petPage.games.stopped)}
          onFeed={goFeed}
        >
          <p className="game-rules">{fill(petPage.games.hideseek.rules, { name: pet.name })}</p>
          <p className="games-cost">{petPage.games.cost}</p>
        </HideSeek>
      </section>
    </div>
  );
}
