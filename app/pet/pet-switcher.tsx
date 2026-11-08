"use client";

import Image from "next/image";
import type { MouseEvent } from "react";

import { fill, petPage } from "../../lib/copy";
import { findToken } from "../../lib/drop1";
import { findPet, petSpriteSrc, type DemoPet } from "../../lib/mocks";

type PetSwitcherProps = {
  pets: DemoPet[];
  activeId: string;
  /** /pet?id=…&tab=… of a pet (real links: open in a new tab works). */
  hrefOf: (pet: DemoPet) => string;
  onSelect: (pet: DemoPet) => void;
};

/**
 * The account's pets as a row of NFT thumbnails with names (docs/DEVLOG.md §2). The active one is
 * aria-current; on mobile the row scrolls sideways. Fixed 64px art, so switching never shifts the page.
 */
export default function PetSwitcher({ pets, activeId, hrefOf, onSelect }: PetSwitcherProps) {
  const choose = (event: MouseEvent<HTMLAnchorElement>, pet: DemoPet) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelect(pet);
  };

  return (
    <nav className="pet-switcher" aria-label={petPage.switcher.label}>
      <ul>
        {pets.map((pet) => {
          const token = pet.token ? findToken(pet.token.tokenId) : null;
          const profile = findPet(pet.petId)!;
          const active = pet.id === activeId;
          return (
            <li key={pet.id}>
              <a
                className={active ? "pet-thumb is-active" : "pet-thumb"}
                href={hrefOf(pet)}
                aria-current={active ? "true" : undefined}
                aria-label={token ? fill(petPage.switcher.item, { name: pet.name, token: token.name }) : pet.name}
                onClick={(event) => choose(event, pet)}
              >
                <span className="pet-thumb-art">
                  <Image
                    src={token ? token.image : petSpriteSrc(profile, "normal")}
                    alt=""
                    width={token ? 512 : profile.spriteWidth}
                    height={token ? 512 : profile.spriteHeight}
                    unoptimized={!!token}
                  />
                </span>
                <span className="pet-thumb-name">{pet.name}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
