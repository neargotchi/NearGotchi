"use client";

import Link from "next/link";

import { header } from "../lib/copy";
import { usePet } from "../lib/use-pet";

type Variant = "hero" | "header" | "burger";

/**
 * The primary CTA everywhere (hero, header, burger panel): "hatch a gotchi" → /mint, or
 * "my gotchi" → /pet once a demo pet exists (known after hydration, so the server and the first
 * paint render "hatch a gotchi"). Both labels share one grid cell, so the button keeps the wider
 * label's width and nothing shifts on the swap. All three use this one component and usePet().
 * Plain pixel button (app/hero-header.css): no pulse, no sparkles (task 074). `variant` stays as
 * a hook for per-place styling.
 */
export default function PetCta({ variant }: { variant: Variant }) {
  const { pet } = usePet();
  const hasPet = pet !== null;
  const cta = hasPet ? header.petCta : header.cta;

  return (
    <Link className="button button-primary" href={cta.href} data-variant={variant}>
      <span className="cta-labels">
        <span className={hasPet ? "cta-label is-off" : "cta-label"}>{header.cta.label}</span>
        <span className={hasPet ? "cta-label" : "cta-label is-off"}>{header.petCta.label}</span>
      </span>
      <span className="launch-arrow" aria-hidden="true" />
    </Link>
  );
}
