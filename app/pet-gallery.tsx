"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import Mascot from "../components/Mascot";
import Sparkles from "../components/Sparkles";
import TierBadge from "../components/TierBadge";
import TitleSparkles from "../components/TitleSparkles";
import { fill, mascots, petGallery, petTraits } from "../lib/copy";
import { tierSample, tiers } from "../lib/drop1";
import { PETS_4_6_ENABLED } from "../lib/features";
import {
  moods,
  petSpriteSrc,
  pets,
  upcomingPets,
  upcomingPetSlots,
  type Mood,
  type PetProfile,
} from "../lib/mocks";

/**
 * One drop-1 pet: mood switcher, description, its 3 traits and a mini row of 4 of its NFTs (common →
 * legendary, each with its tier badge, linking to /nft/[id]). No per-pet mint link: the egg picks the pet.
 */
function PetCard({ pet }: { pet: PetProfile }) {
  const { name, description } = pet;
  const [mood, setMood] = useState<Mood>("normal");
  const traits = petTraits[pet.id] ?? [];

  return (
    <article className="pet-card is-drop">
      <div className="pet-sprite-wrap">
        <Image
          className="pet-sprite"
          src={petSpriteSrc(pet, mood)}
          alt={`${name} in a ${mood} mood`}
          width={pet.spriteWidth}
          height={pet.spriteHeight}
        />
      </div>
      <h3>{name}</h3>
      <p>{description}</p>
      <ul className="pet-traits pet-card-traits">
        {traits.map((trait) => (
          <li key={trait}>{trait}</li>
        ))}
      </ul>
      <div className="pet-moods" aria-label={`${name} mood`}>
        {moods.map((item) => (
          <button
            className={mood === item ? "pet-mood is-active" : "pet-mood"}
            key={item}
            type="button"
            aria-pressed={mood === item}
            onClick={() => setMood(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <ul className="pet-tier-row" aria-label={fill(petGallery.tiersLabel, { name })}>
        {tiers.map((tier) => {
          const token = tierSample(pet.id, tier);
          if (!token) return null;
          return (
            <li key={tier}>
              <Link
                className="pet-tier-link"
                href={`/nft/${token.tokenId}`}
                aria-label={fill(petGallery.tierLink, { token: token.name, tier })}
              >
                <span className="pet-tier-art">
                  <Image src={token.image} alt="" width={512} height={512} unoptimized />
                </span>
                <TierBadge tier={tier} />
              </Link>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

/** `title="p"` where the page has no h2 above the cards, so the heading order stays valid. */
export function LockedCard({ slot, title = "h3" }: { slot: string; title?: "h3" | "p" }) {
  const Title = title;
  return (
    <article className="pet-card pet-card-locked" aria-label="locked pet, soon">
      <div className="pet-sprite-wrap locked-sprite" aria-hidden="true">
        <span className="locked-mark">?</span>
        <Sparkles
          count={3}
          colors={["var(--green)", "#ffffff"]}
          area={[
            { x: [8, 26], y: [10, 40] },
            { x: [72, 90], y: [14, 44] },
            { x: [60, 86], y: [66, 86] },
          ]}
          seed={`locked-${slot}`}
          size={12}
          duration={[3, 4.5]}
        />
      </div>
      <Title className="locked-title">soon</Title>
    </article>
  );
}

export default function PetGallery() {
  return (
    <section id="pets" className="pets-section" aria-labelledby="pets-title">
      <div className="pets-content">
        <header className="pets-heading">
          <h2 id="pets-title" className="section-title-host">
            {petGallery.header}
            <TitleSparkles seed="title-pets" belowRight />
          </h2>
          <p>{petGallery.sub}</p>
          <Mascot {...mascots.pets} />
        </header>
        <div className="pets-list pets-list-drop">
          {pets.map((pet) => (
            <PetCard key={pet.id} pet={pet} />
          ))}
          {PETS_4_6_ENABLED ? upcomingPets.map((pet) => <PetCard key={pet.id} pet={pet} />) : null}
        </div>
        {PETS_4_6_ENABLED ? null : (
          <div className="pets-soon">
            <h3 className="pets-soon-title">{petGallery.soon}</h3>
            <div className="pets-soon-list">
              {upcomingPetSlots.map((slot) => (
                <LockedCard key={slot} slot={slot} title="p" />
              ))}
            </div>
          </div>
        )}
        <div className="section-cta">
          <Link className="button button-primary" href="/mint">
            {petGallery.cta}
          </Link>
        </div>
      </div>
    </section>
  );
}
