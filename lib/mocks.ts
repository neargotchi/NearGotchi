// Single mocks module (PLAN.md §4): the only place for demo pets, items, balances,
// chat replies and simulation rules. All values here are demonstration data.

export const moods = ["normal", "hungry", "happy", "sleep"] as const;
export type Mood = (typeof moods)[number];

export type PetProfile = {
  id: string;
  species: string;
  name: string;
  description: string;
  /** Folder under /public/pets with one PNG per mood. */
  spriteFolder: string;
  spriteWidth: number;
  spriteHeight: number;
};

/** Approved pets (copy v1). */
export const pets: PetProfile[] = [
  {
    id: "pet1",
    species: "corgi",
    name: "batman",
    description: "the corgi of near's co-founder. chunky. legendary. always hungry.",
    spriteFolder: "pet1",
    spriteWidth: 489,
    spriteHeight: 431,
  },
  {
    id: "pet2",
    species: "dragon",
    name: "nightshade",
    description: "small dragon. big shards.",
    spriteFolder: "pet2",
    spriteWidth: 489,
    spriteHeight: 431,
  },
  {
    id: "pet3",
    species: "meerkat",
    name: "merk",
    description: "always on watch. never misses a block.",
    spriteFolder: "pet3",
    spriteWidth: 489,
    spriteHeight: 431,
  },
];

/** PET 4–6: rendered only when PETS_4_6_ENABLED is true. Empty until names and copy are approved. */
export const upcomingPets: PetProfile[] = [];

export const petSpriteSrc = (pet: PetProfile, mood: Mood) =>
  `/pets/${pet.spriteFolder}/${mood}.png`;
