"use client";

import Image from "next/image";
import { useState, type MouseEvent } from "react";

import { TierText } from "../components/TierBadge";
import type { Drop1Token, Tier } from "../lib/drop1";
import NftLightbox from "./nft-lightbox";

export type TierCard = {
  tier: Tier;
  /** The sample NFT shown on the card (enlarged on click), or null if the drop has none. */
  sample: Drop1Token | null;
  count: string;
  total: string;
};

/**
 * Drop 1 "4 tiers" (task 094): a click anywhere on a card opens its sample NFT enlarged on this page, in the
 * same lightbox as "meet the pets" but without the /nft link — the address never changes. The thumbnail is
 * the card's one button (keyboard: Tab, Enter / Space); a click on the text focuses it first, so closing
 * the lightbox (Esc / ✕ / backdrop) returns focus to the card.
 */
export default function DropTiers({ cards }: { cards: TierCard[] }) {
  const [enlarged, setEnlarged] = useState<Drop1Token | null>(null);

  const openFromCard = (event: MouseEvent<HTMLLIElement>, sample: Drop1Token) => {
    event.currentTarget.querySelector<HTMLButtonElement>(".drop-tier-art")?.focus();
    setEnlarged(sample);
  };

  return (
    <>
      <ul className="drop-tiers">
        {cards.map(({ tier, sample, count, total }) => (
          <li
            key={tier}
            className={sample ? "drop-tier is-clickable" : "drop-tier"}
            onClick={sample ? (event) => openFromCard(event, sample) : undefined}
          >
            {sample ? (
              <button
                type="button"
                className="drop-tier-art"
                aria-label={sample.name}
                aria-haspopup="dialog"
                onClick={(event) => {
                  event.stopPropagation();
                  setEnlarged(sample);
                }}
              >
                <Image src={sample.image} alt="" width={512} height={512} sizes="112px" />
              </button>
            ) : null}
            <p className="drop-tier-name">
              <TierText tier={tier} />
            </p>
            <p className="drop-tier-count">{count}</p>
            <p className="drop-tier-total">{total}</p>
          </li>
        ))}
      </ul>
      <NftLightbox token={enlarged} onClose={() => setEnlarged(null)} showLink={false} />
    </>
  );
}
