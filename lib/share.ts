// "share on x" (docs/DEVLOG.md §2): a prefilled x.com intent with the token's public page.
// Copy: rarity only, never value (checked by scripts/check-drop1.mjs).

import { fill, mintPage } from "./copy";
import { tierCount, type Drop1Token } from "./drop1";
import { findPet } from "./mocks";
import { SITE_URL } from "./site";

/** Public page of a token (static /nft/[id], step 9 of the plan). */
export const tokenPageUrl = (tokenId: number) => `${SITE_URL}/nft/${tokenId}`;

export function shareText(token: Drop1Token): string {
  const profile = findPet(token.petId);
  return fill(mintPage.reveal.shareText, {
    token: token.name,
    tier: token.tier,
    species: profile?.species ?? "",
    count: String(tierCount(token.petId, token.tier)),
    pet: profile?.name ?? "",
  });
}

export function shareOnXUrl(token: Drop1Token): string {
  const params = new URLSearchParams({ text: shareText(token), url: tokenPageUrl(token.tokenId) });
  return `https://x.com/intent/tweet?${params}`;
}
