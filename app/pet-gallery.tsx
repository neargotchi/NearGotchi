"use client";

import Image from "next/image";
import Mascot from "../components/Mascot";
import TitleSparkles from "../components/TitleSparkles";
import Sparkles from "../components/Sparkles";
import { mascots } from "../lib/copy";
import { useState } from "react";

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

function PetCard({ pet }: { pet: PetProfile }) {
  const { name, description } = pet;
  const [mood, setMood] = useState<Mood>("normal");

  return (
    <article className="pet-card">
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
    </article>
  );
}

function LockedCard({ slot }: { slot: string }) {
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
      <h3>soon</h3>
    </article>
  );
}

export default function PetGallery() {
  return (
    <section id="pets" className="pets-section" aria-labelledby="pets-title">
      <div className="pets-grid" aria-hidden="true" />
      <div className="pets-content">
        <header className="pets-heading">
          <h2 id="pets-title" className="section-title-host">
            pick your gotchi
            <TitleSparkles seed="title-pets" belowRight />
          </h2>
          <p>6 pets. 4 moods each. one of them is a real dog.</p>
          <Mascot {...mascots.pets} />
        </header>
        <div className="pets-list">
          {pets.map((pet) => (
            <PetCard key={pet.id} pet={pet} />
          ))}
          {PETS_4_6_ENABLED
            ? upcomingPets.map((pet) => <PetCard key={pet.id} pet={pet} />)
            : upcomingPetSlots.map((slot) => <LockedCard key={slot} slot={slot} />)}
        </div>
      </div>
    </section>
  );
}
