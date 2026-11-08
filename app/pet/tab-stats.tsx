"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { fill, mintPage, petPage, petTraits } from "../../lib/copy";
import {
  MintError,
  PET_NAME_MAX,
  findPet,
  normalizePetName,
  releasePet,
  renamePet,
  validatePetName,
  type DemoPet,
  type NameError,
} from "../../lib/mocks";
import StatBars from "./stat-bars";
import TokenCard from "./token-card";

const DAY_MS = 86400000;

/** "hatched today" / "1 day old" / "{n} days old". */
export function ageLabel(mintedAt: string, now: number) {
  const days = Math.floor((now - Date.parse(mintedAt)) / DAY_MS);
  if (!Number.isFinite(days) || days < 1) return petPage.stats.ageToday;
  return days === 1 ? petPage.stats.ageDay : fill(petPage.stats.ageDays, { n: String(days) });
}

type TabStatsProps = {
  /** The stored pet (name, token, stats). */
  pet: DemoPet;
  /** Hunger / energy simulated to now, for the bars. */
  shown: Pick<DemoPet, "hunger" | "energy">;
  balance: number;
  now: number;
  /** After "release": the page moves focus to what replaces this pet. */
  onReleased: () => void;
};

/**
 * Stats tab (docs/DEVLOG.md §2): token card, species + character (3 traits), age, bars, counters,
 * best scores, then rename and "release {name}" with a confirm. Keyed by pet id, so switching resets it.
 */
export default function TabStats({ pet, shown, balance, now, onReleased }: TabStatsProps) {
  const profile = findPet(pet.petId)!;
  const traits = petTraits[pet.petId] ?? [];
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<NameError | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef<HTMLParagraphElement>(null);
  const releaseRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
    else if (cancelled.current) {
      cancelled.current = false;
      releaseRef.current?.focus();
    }
  }, [confirming]);

  const check = (value: string) => {
    if (!normalizePetName(value)) return null;
    const result = validatePetName(value, pet.petId);
    return result.ok ? null : result.error;
  };

  const rename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const next = await renamePet(name, pet.id);
      setName("");
      setNameError(null);
      setSaved(fill(petPage.stats.renamed, { name: next.name }));
    } catch (error) {
      if (error instanceof MintError) setNameError(error.code === "no_wallet" ? "no_pet" : error.code);
      setSaved(null);
      inputRef.current?.focus();
    }
  };

  const best = (score: number) => (score > 0 ? String(score) : petPage.stats.noScore);

  return (
    <div className="pet-stats-tab">
      {pet.token ? <TokenCard tokenId={pet.token.tokenId} /> : null}

      <section className="pet-card-block" aria-labelledby="pet-character-title">
        <h2 id="pet-character-title" className="mint-subtitle">
          {petPage.stats.character}
        </h2>
        <p className="pet-character-about">{profile.description}</p>
        <ul className="pet-traits">
          {traits.map((trait) => (
            <li key={trait}>{trait}</li>
          ))}
        </ul>
        <dl className="pet-facts">
          <div>
            <dt>{petPage.stats.age}</dt>
            <dd>{ageLabel(pet.mintedAt, now)}</dd>
          </div>
        </dl>
      </section>

      <StatBars hunger={shown.hunger} energy={shown.energy} balance={balance} />

      <section className="pet-card-block" aria-labelledby="pet-counters-title">
        <h2 id="pet-counters-title" className="mint-subtitle">
          {petPage.stats.counters}
        </h2>
        <dl className="pet-facts pet-counters">
          <div>
            <dt>{petPage.stats.games}</dt>
            <dd>{pet.stats.games}</dd>
          </div>
          <div>
            <dt>{petPage.stats.snacks}</dt>
            <dd>{pet.stats.snacks}</dd>
          </div>
          <div>
            <dt>{petPage.stats.messages}</dt>
            <dd>{pet.stats.messages}</dd>
          </div>
        </dl>
        <h3 className="pet-facts-title">{petPage.stats.best}</h3>
        <dl className="pet-facts pet-counters">
          <div>
            <dt>{petPage.stats.snack}</dt>
            <dd>{best(pet.stats.best.snack)}</dd>
          </div>
        </dl>
      </section>

      <form className="pet-rename" noValidate onSubmit={rename}>
        <label className="mint-legend" htmlFor="pet-rename">
          {petPage.stats.renameLabel}
        </label>
        <div className="pet-rename-row">
          <input
            ref={inputRef}
            id="pet-rename"
            className="mint-input"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={PET_NAME_MAX * 2}
            placeholder={pet.name}
            value={name}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "pet-rename-hint pet-rename-error" : "pet-rename-hint"}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(null);
              if (nameError && !check(event.target.value)) setNameError(null);
            }}
            onBlur={() => {
              const normalized = normalizePetName(name);
              setName(normalized);
              setNameError(check(normalized));
            }}
          />
          <button type="submit" className="button button-secondary">
            {petPage.stats.renameSave}
          </button>
        </div>
        <p id="pet-rename-hint" className="mint-hint">
          {fill(mintPage.nameHint, { pet: profile.name })}
        </p>
        {nameError ? (
          <p id="pet-rename-error" className="mint-error" role="alert">
            {mintPage.errors[nameError]}
          </p>
        ) : null}
        <p className="pet-rename-done" role="status">
          {saved}
        </p>
      </form>

      <div className="pet-reset">
        {confirming ? (
          <div className="mint-confirm" role="group" aria-labelledby="pet-confirm-text">
            <p id="pet-confirm-text" ref={confirmRef} tabIndex={-1}>
              {fill(petPage.release.text, { name: pet.name })}
            </p>
            <div className="mint-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={async () => {
                  onReleased();
                  await releasePet(pet.id);
                }}
              >
                {petPage.release.yes}
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  cancelled.current = true;
                  setConfirming(false);
                }}
              >
                {fill(petPage.release.keep, { name: pet.name })}
              </button>
            </div>
          </div>
        ) : (
          <button ref={releaseRef} type="button" className="button button-secondary" onClick={() => setConfirming(true)}>
            {fill(petPage.release.button, { name: pet.name })}
          </button>
        )}
      </div>
    </div>
  );
}
