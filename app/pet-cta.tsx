"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { header } from "../lib/copy";
import { usePet } from "../lib/use-pet";

/**
 * Header + burger primary CTA: "mint your pet" → /mint, or "my pet" → /pet once a demo pet exists
 * (known only after hydration). Both labels share one grid cell, so the button keeps the width of
 * the wider label and nothing shifts when it swaps.
 */
export default function PetCta({ children }: { children?: ReactNode }) {
  const { pet } = usePet();
  const hasPet = pet !== null;
  const cta = hasPet ? header.petCta : header.cta;

  return (
    <Link className="button button-primary" href={cta.href}>
      <span className="cta-labels">
        <span className={hasPet ? "cta-label is-off" : "cta-label"}>{header.cta.label}</span>
        <span className={hasPet ? "cta-label" : "cta-label is-off"}>{header.petCta.label}</span>
      </span>
      {children}
    </Link>
  );
}
