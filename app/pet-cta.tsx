"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import Sparkles, { type SparkleZone } from "../components/Sparkles";
import { header } from "../lib/copy";
import { usePet } from "../lib/use-pet";

type Variant = "hero" | "header" | "burger";

/** "burns." sparkles around the button edges (outside the box, so never over the label). */
const BURN_SPARKLES: Record<Exclude<Variant, "burger">, { zones: SparkleZone[]; size: number }> = {
  hero: {
    size: 20,
    zones: [
      { x: [-9, -4], y: [-52, -30] },
      { x: [38, 56], y: [-62, -44] },
      { x: [100, 104], y: [-44, -24] },
      { x: [102, 106], y: [64, 88] },
      { x: [16, 34], y: [118, 132] },
    ],
  },
  header: {
    size: 10,
    zones: [
      { x: [-8, -4], y: [-36, -20] },
      { x: [44, 60], y: [-42, -28] },
      { x: [101, 104], y: [-30, -14] },
      { x: [20, 36], y: [112, 122] },
    ],
  },
};

/**
 * The primary CTA everywhere (hero, header, burger panel): "hatch a gotchi" → /mint, or
 * "my gotchi" → /pet once a demo pet exists (known after hydration, so the server and the first
 * paint render "hatch a gotchi"). Both labels share one grid cell, so the button keeps the wider
 * label's width and nothing shifts on the swap. All three use this one component and usePet().
 * The green block pulses like "burns."; hero + header also get the "burns." sparkles.
 */
export default function PetCta({ variant, children }: { variant: Variant; children?: ReactNode }) {
  const { pet } = usePet();
  const hasPet = pet !== null;
  const cta = hasPet ? header.petCta : header.cta;
  const burn = variant === "burger" ? null : BURN_SPARKLES[variant];

  return (
    <Link className="button button-primary cta-burn" href={cta.href}>
      <span className="cta-labels">
        <span className={hasPet ? "cta-label is-off" : "cta-label"}>{header.cta.label}</span>
        <span className={hasPet ? "cta-label" : "cta-label is-off"}>{header.petCta.label}</span>
      </span>
      <span className="launch-arrow" aria-hidden="true" />
      {children}
      {burn ? (
        <Sparkles
          count={burn.zones.length}
          colors={["var(--green)", "var(--sparkle-alt)"]}
          area={burn.zones}
          seed={`cta-burn-${variant}`}
          size={burn.size}
          duration={[2, 3]}
          className="cta-sparkles"
        />
      ) : null}
    </Link>
  );
}
