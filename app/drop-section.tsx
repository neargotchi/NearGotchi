import Image from "next/image";
import Link from "next/link";

import DropProgress from "../components/DropProgress";
import Mascot from "../components/Mascot";
import { TierText } from "../components/TierBadge";
import TitleSparkles from "../components/TitleSparkles";
import { dropSection, fill, itemLabels, mascots } from "../lib/copy";
import { backgroundLabel, dropBackgrounds, tierCount, tierSample, tiers } from "../lib/drop1";
import { items, pets } from "../lib/mocks";

/** One sample NFT per tier card, from a different pet each time. */
const SAMPLE_PET: Record<(typeof tiers)[number], string> = { common: "pet1", rare: "pet3", epic: "pet2", legendary: "pet1" };

/**
 * "drop 1" (docs/DEVLOG.md §3, replaces the wardrobe): the 4 tiers with their counts and animated
 * tier colours, the 13 items (one per gotchi, baked into the NFT), the 12 backgrounds, the drop progress
 * bar and "hatch your gotchi". Rarity only, never value.
 */
export default function DropSection() {
  const dropItems = items.filter((item) => item.id in itemLabels);
  const backgrounds = dropBackgrounds();

  return (
    <section id="drop-1" className="wardrobe-section drop-section" aria-labelledby="drop-title">
      <div className="pets-content">
        <div className="section-head">
          <h2 id="drop-title" className="steps-title section-title-host">
            {dropSection.header}
            <TitleSparkles seed="title-drop" below />
          </h2>
          <Mascot {...mascots.drop} />
        </div>
        <p className="section-sub">{dropSection.sub}</p>
        <div className="drop-actions pixel-ui">
          <Link className="button button-primary" href="/mint">
            {dropSection.cta}
            <span className="launch-arrow" aria-hidden="true" />
          </Link>
          <DropProgress />
        </div>

        <h3 className="drop-subtitle">{dropSection.tiersTitle}</h3>
        <ul className="drop-tiers">
          {tiers.map((tier) => {
            const sample = tierSample(SAMPLE_PET[tier], tier);
            const perPet = tierCount(pets[0].id, tier);
            return (
              <li key={tier} className="drop-tier">
                {sample ? (
                  <Link className="drop-tier-art" href={`/nft/${sample.tokenId}`} aria-label={sample.name}>
                    <Image src={sample.image} alt="" width={512} height={512} sizes="112px" />
                  </Link>
                ) : null}
                <p className="drop-tier-name">
                  <TierText tier={tier} />
                </p>
                <p className="drop-tier-count">{fill(dropSection.tierCount, { n: String(perPet) })}</p>
                <p className="drop-tier-total">{fill(dropSection.tierTotal, { n: String(perPet * pets.length) })}</p>
              </li>
            );
          })}
        </ul>

        <h3 className="drop-subtitle">{dropSection.itemsTitle}</h3>
        <ul className="drop-items">
          {dropItems.map((item) => (
            <li key={item.id} className="item-card">
              <div className="item-sprite-wrap">
                <Image className="item-sprite" src={item.src} alt="" width={item.width} height={item.height} sizes="96px" />
              </div>
              <p className="drop-item-name">{itemLabels[item.id]}</p>
            </li>
          ))}
        </ul>

        <h3 className="drop-subtitle">{dropSection.backgroundsTitle}</h3>
        <ul className="drop-backgrounds">
          {backgrounds.map(({ id, tier }) => (
            <li key={id} className={`drop-bg is-${tier}`}>
              {backgroundLabel(id)}
              <span className="drop-bg-tier">
                <TierText tier={tier} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
