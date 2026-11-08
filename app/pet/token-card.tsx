import Image from "next/image";
import type { Ref } from "react";

import TierBadge from "../../components/TierBadge";
import { fill, itemLabels, petPage } from "../../lib/copy";
import { DROP1_TOTAL, backgroundLabel, findToken, tierCount, type Drop1Token } from "../../lib/drop1";
import { findPet } from "../../lib/mocks";

type Heading = "h2" | "h3";

/** Labels shared by the art's alt text and the info block. */
function describe(token: Drop1Token) {
  const profile = findPet(token.petId)!;
  return {
    profile,
    id: String(token.tokenId).padStart(3, "0"),
    background: backgroundLabel(token.background),
    item: itemLabels[token.accessory] ?? token.accessory,
  };
}

/** The rendered NFT (background + dressed pet), 512² webp shown pixelated. */
export function TokenArt({ token, priority = false }: { token: Drop1Token; priority?: boolean }) {
  const { profile, background, item } = describe(token);
  return (
    <div className="token-art">
      <Image
        src={token.image}
        alt={fill(petPage.token.alt, { token: token.name, tier: token.tier, species: profile.species, background, item })}
        width={512}
        height={512}
        unoptimized
        priority={priority}
      />
    </div>
  );
}

/**
 * Badge, name, number, rarity line and traits. Used by the /pet card, the /mint reveal and the
 * /mint "already have a gotchi" card. Copy: rarity only.
 */
export function TokenInfo({
  token,
  heading = "h2",
  headingId,
  headingText,
  headingRef,
}: {
  token: Drop1Token;
  heading?: Heading;
  headingId?: string;
  /** Overrides the token name as the heading (the reveal says "{token} hatched."). */
  headingText?: string;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const { profile, id, background, item } = describe(token);
  const Title = heading;
  return (
    <div className="token-info">
      <div className="token-info-top">
        <TierBadge tier={token.tier} />
        <span className="token-info-demo">{petPage.token.demo}</span>
      </div>
      <Title id={headingId} ref={headingRef} className="token-info-name" tabIndex={headingRef ? -1 : undefined}>
        {headingText ?? fill(petPage.token.title, { token: token.name })}
      </Title>
      <p className="token-info-rarity">
        <span>{fill(petPage.token.number, { id, total: String(DROP1_TOTAL) })}</span>
        <span>
          {fill(petPage.token.rarity, { count: String(tierCount(token.petId, token.tier)), tier: token.tier, pet: profile.name })}
        </span>
      </p>
      <dl className="token-info-traits">
        <div>
          <dt>{petPage.token.pet}</dt>
          <dd>{profile.species}</dd>
        </div>
        <div>
          <dt>{petPage.token.background}</dt>
          <dd>{background}</dd>
        </div>
        <div>
          <dt>{petPage.token.item}</dt>
          <dd>{item}</dd>
        </div>
      </dl>
    </div>
  );
}

/** /pet (docs/DEVLOG.md §3): the token this pet hatched as. The device's mood sprites stay undressed. */
export default function TokenCard({ tokenId, heading = "h2" }: { tokenId: number; heading?: Heading }) {
  const token = findToken(tokenId);
  if (!token) return null;
  const headingId = `token-card-${token.tokenId}`;
  return (
    <section className="token-card" aria-labelledby={headingId}>
      <TokenArt token={token} priority />
      <TokenInfo token={token} heading={heading} headingId={headingId} />
    </section>
  );
}
