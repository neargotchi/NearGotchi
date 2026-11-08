import { tierLabels } from "../lib/copy";
import type { Tier } from "../lib/drop1";

/**
 * Drop-1 rarity badge (docs/DEVLOG.md). Fill colours follow the tier backgrounds
 * (common: cream/sky, rare: night blue, epic: cosmic purple, legendary: glow gold) and keep
 * ink text in both themes, so they read the same on light and dark pages.
 */
export default function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  return <span className={["tier-badge", `is-${tier}`, className].filter(Boolean).join(" ")}>{tierLabels[tier]}</span>;
}
