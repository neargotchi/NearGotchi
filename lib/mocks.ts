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

export const slots = ["head", "eyes", "neck", "body", "back"] as const;
export type Slot = (typeof slots)[number];

export type Item = {
  id: string;
  slot: Slot;
  src: string;
  width: number;
  height: number;
};

/** The 14 wardrobe items, one transparent PNG per item under /public/items/<slot>/. */
export const items: Item[] = [
  { id: "beanie", slot: "head", src: "/items/head/beanie.png", width: 255, height: 287 },
  { id: "cap", slot: "head", src: "/items/head/cap.png", width: 274, height: 210 },
  { id: "crown", slot: "head", src: "/items/head/crown.png", width: 224, height: 167 },
  { id: "halo", slot: "head", src: "/items/head/halo.png", width: 264, height: 191 },
  { id: "headphones", slot: "head", src: "/items/head/headphones.png", width: 301, height: 277 },
  { id: "keffiyeh", slot: "head", src: "/items/head/keffiyeh.png", width: 290, height: 281 },
  { id: "tophat", slot: "head", src: "/items/head/tophat.png", width: 279, height: 240 },
  { id: "mask", slot: "eyes", src: "/items/eyes/mask.png", width: 231, height: 115 },
  { id: "nerd", slot: "eyes", src: "/items/eyes/nerd.png", width: 223, height: 108 },
  { id: "pixel", slot: "eyes", src: "/items/eyes/pixel.png", width: 233, height: 70 },
  { id: "sunglasses", slot: "eyes", src: "/items/eyes/sunglasses.png", width: 220, height: 94 },
  { id: "chain", slot: "neck", src: "/items/neck/chain.png", width: 205, height: 208 },
  { id: "tshirt", slot: "body", src: "/items/body/tshirt.png", width: 228, height: 191 },
  { id: "cape", slot: "back", src: "/items/back/cape.png", width: 280, height: 256 },
];
