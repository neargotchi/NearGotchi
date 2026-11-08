"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import Mascot from "../components/Mascot";
import TierBadge from "../components/TierBadge";
import TitleSparkles from "../components/TitleSparkles";
import { fill, mascots, petGallery, petTraits } from "../lib/copy";
import NftLightbox from "./nft-lightbox";
import { tierSample, tiers, type Drop1Token } from "../lib/drop1";
import { PETS_4_6_ENABLED } from "../lib/features";
import {
  moods,
  petSpriteSrc,
  pets,
  upcomingPets,
  type Mood,
  type PetProfile,
} from "../lib/mocks";

/**
 * One drop-1 pet: mood switcher, description, its 3 traits and a mini row of 4 of its NFTs (common →
 * legendary, each with its tier badge). A thumbnail opens it enlarged in the lightbox (task 049), which
 * links on to /nft/[id]. No per-pet mint link: the egg picks the pet.
 */
function PetCard({ pet, onEnlarge }: { pet: PetProfile; onEnlarge: (token: Drop1Token) => void }) {
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
          sizes="(max-width: 1023px) 300px, 260px"
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
              <button
                type="button"
                className="pet-tier-link"
                aria-haspopup="dialog"
                aria-label={fill(petGallery.tierLink, { token: token.name, tier })}
                onClick={() => onEnlarge(token)}
              >
                <span className="pet-tier-art">
                  {/* small thumbnail: optimised down from the 512 webp (Lighthouse: ~240 KB saved) */}
                  <Image src={token.image} alt="" width={512} height={512} sizes="(max-width: 1023px) 160px, 120px" />
                </span>
                <TierBadge tier={tier} />
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export default function PetGallery() {
  const [enlarged, setEnlarged] = useState<Drop1Token | null>(null);
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
            <PetCard key={pet.id} pet={pet} onEnlarge={setEnlarged} />
          ))}
          {PETS_4_6_ENABLED ? upcomingPets.map((pet) => <PetCard key={pet.id} pet={pet} onEnlarge={setEnlarged} />) : null}
        </div>
        <NftLightbox token={enlarged} onClose={() => setEnlarged(null)} />
        <div className="section-cta">
          <Link className="button button-primary" href="/mint">
            {petGallery.cta}
          </Link>
        </div>
      </div>
    </section>
  );
}
