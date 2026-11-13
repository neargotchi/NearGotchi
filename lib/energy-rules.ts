// Energy = NEAR AI credits (task 081). One place for the numbers the server ledger and the client share.
// Safe to import on both sides: no secrets, no env reads beyond NEXT_PUBLIC_*.

/** Energy of a token the first time the ledger sees it (same as a freshly hatched pet, lib/mocks.ts). */
export const ENERGY_START = 100;
/** One chat message (PET_RULES.chatEnergy). */
export const CHAT_COST = 4;
/** One energy pack (ENERGY_PACK.energy in lib/shop.ts). */
export const PACK_ENERGY = 50;
/** Energy pack price in NEAR (NEAR_PRICES.energy in lib/shop.ts) and in yoctoNEAR. */
export const PACK_PRICE_NEAR = "0.4";
export const PACK_PRICE_YOCTO = "400000000000000000000000";

/** NEP-413 sign-in: what the wallet shows and signs (no transaction, no cost). */
export const SIGN_IN_MESSAGE = "sign in to neargotchi. this proves you own the account: no transaction, no cost.";
export const SIGN_IN_RECIPIENT = "neargotchi";
