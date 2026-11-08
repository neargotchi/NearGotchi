import Image from "next/image";

import TierBadge from "../../components/TierBadge";
import { fill, itemLabels, petPage } from "../../lib/copy";
import { DROP1_TOTAL, backgroundLabel, findToken, tierCount } from "../../lib/drop1";
import type { PetToken, PetProfile } from "../../lib/mocks";

/**
 * /pet: the drop-1 token this pet hatched as (docs/DEVLOG.md §3): the rendered NFT
 * (background + dressed pet), tier badge, number and traits. The mood sprites on the device stay
 * undressed, so the item shows here only. Copy: rarity only.
 */
export default function TokenCard({ token, profile }: { token: PetToken; profile: PetProfile }) {
  const known = findToken(token.tokenId);
  if (!known) return null;
  const id = String(known.tokenId).padStart(3, "0");
  const background = backgroundLabel(known.background);
  const item = itemLabels[known.accessory] ?? known.accessory;

  return (
    <section className="token-card" aria-labelledby="token-card-title">
      <div className={`token-card-art is-${known.tier}`}>
        <Image
          src={known.image}
          alt={fill(petPage.token.alt, { token: known.name, tier: known.tier, species: profile.species, background, item })}
          width={512}
          height={512}
          unoptimized
          priority
        />
      </div>
      <div className="token-card-info">
        <div className="token-card-top">
          <TierBadge tier={known.tier} />
          <span className="token-card-demo">{petPage.token.demo}</span>
        </div>
        <h2 id="token-card-title" className="token-card-name">
          {fill(petPage.token.title, { token: known.name })}
        </h2>
        <p className="token-card-rarity">
          <span>{fill(petPage.token.number, { id, total: String(DROP1_TOTAL) })}</span>
          <span>
            {fill(petPage.token.rarity, {
              count: String(tierCount(known.petId, known.tier)),
              tier: known.tier,
              pet: profile.name,
            })}
          </span>
        </p>
        <dl className="token-card-traits">
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
    </section>
  );
}
