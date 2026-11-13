// "share on x": a prefilled x.com intent with the token's public page. The intent cannot attach a picture;
// the picture appears as the card (og:image / twitter:image) of the linked /nft/{id} page.

import { mintPage } from "./copy";
import type { Drop1Token } from "./drop1";
import { SITE_URL } from "./site";

/** Public page of a token (static /nft/[id], step 9 of the plan). */
export const tokenPageUrl = (tokenId: number) => `${SITE_URL}/nft/${tokenId}`;

export function shareText(): string {
  return mintPage.reveal.shareText;
}

export function shareOnXUrl(token: Drop1Token): string {
  const params = new URLSearchParams({ text: shareText(), url: tokenPageUrl(token.tokenId) });
  return `https://x.com/intent/tweet?${params}`;
}
