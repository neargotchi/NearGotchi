import { tierLabels } from "../lib/copy";
import type { Tier } from "../lib/drop1";

/**
 * The tier name in its colour (app/globals.css .tier-text): common grey, rare orange-gold, epic purple,
 * legendary an animated rainbow (static with reduced motion). Theme tokens keep ≥ 4.5:1 in light and dark.
 */
export function TierText({ tier }: { tier: Tier }) {
  return <span className={`tier-text is-${tier}`}>{tierLabels[tier]}</span>;
}

/** Drop-1 rarity badge (docs/DEVLOG.md): a pixel tag on the surface with the coloured tier name. */
export default function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <span className={["tier-badge", `is-${tier}`, className].filter(Boolean).join(" ")}>
      <TierText tier={tier} />
    </span>
  );
}
