"use client";

import Image from "next/image";
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

function LockedCard() {
  return (
    <article className="pet-card pet-card-locked" aria-label="locked pet, soon">
      <div className="pet-sprite-wrap locked-sprite" aria-hidden="true">
        <span>?</span>
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
          <h2 id="pets-title">pick your gotchi</h2>
          <p>6 pets. 4 moods each. one of them is a real dog.</p>
        </header>
        <div className="pets-list">
          {pets.map((pet) => (
            <PetCard key={pet.id} pet={pet} />
          ))}
          {PETS_4_6_ENABLED
            ? upcomingPets.map((pet) => <PetCard key={pet.id} pet={pet} />)
            : upcomingPetSlots.map((slot) => <LockedCard key={slot} />)}
        </div>
      </div>
    </section>
  );
}
