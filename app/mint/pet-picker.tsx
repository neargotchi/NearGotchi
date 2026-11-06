"use client";

import Image from "next/image";
import type { RefObject } from "react";

import { mintPage } from "../../lib/copy";
import { PETS_4_6_ENABLED } from "../../lib/features";
import { petSpriteSrc, pets, upcomingPetSlots } from "../../lib/mocks";
import { LockedCard } from "../pet-gallery";

type PetPickerProps = {
  selected: string | null;
  onSelect: (petId: string) => void;
  error: boolean;
  firstRadioRef: RefObject<HTMLInputElement | null>;
};

/** Step 1: native radio group styled as the "pick your gotchi" cards; locked cards are not inputs. */
export default function PetPicker({ selected, onSelect, error, firstRadioRef }: PetPickerProps) {
  return (
    <fieldset className="mint-step" aria-describedby={error ? "mint-pick-error" : undefined}>
      <legend className="mint-legend">{mintPage.pickLegend}</legend>
      <div className="pets-list mint-pets">
        {pets.map((pet, index) => {
          const isSelected = selected === pet.id;
          return (
            <label key={pet.id} className={isSelected ? "pet-card mint-card is-selected" : "pet-card mint-card"}>
              <input
                ref={index === 0 ? firstRadioRef : undefined}
                className="visually-hidden"
                type="radio"
                name="pet"
                value={pet.id}
                checked={isSelected}
                aria-label={pet.name}
                aria-describedby={`mint-desc-${pet.id}`}
                onChange={() => onSelect(pet.id)}
              />
              <span className="pet-sprite-wrap">
                <Image
                  className="pet-sprite"
                  src={petSpriteSrc(pet, isSelected ? "happy" : "normal")}
                  alt=""
                  width={pet.spriteWidth}
                  height={pet.spriteHeight}
                  priority
                />
              </span>
              <span className="mint-card-name">
                <span className="mint-card-title">{pet.name}</span>
                {isSelected ? (
                  <span className="mint-picked" aria-hidden="true">
                    <svg viewBox="0 0 7 5" aria-hidden="true">
                      <path d="M0 2h1v1H0zM1 3h1v1H1zM2 4h1v1H2zM3 3h1v1H3zM4 2h1v1H4zM5 1h1v1H5zM6 0h1v1H6z" />
                    </svg>
                    {mintPage.picked}
                  </span>
                ) : null}
              </span>
              <span id={`mint-desc-${pet.id}`} className="mint-card-text">
                {pet.description}
              </span>
            </label>
          );
        })}
        {PETS_4_6_ENABLED ? null : upcomingPetSlots.map((slot) => <LockedCard key={slot} slot={slot} title="p" />)}
      </div>
      {error ? (
        <p id="mint-pick-error" className="mint-error" role="alert">
          {mintPage.errors.no_pet}
        </p>
      ) : null}
    </fieldset>
  );
}
