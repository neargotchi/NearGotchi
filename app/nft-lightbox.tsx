"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, type MouseEvent } from "react";

import TierBadge from "../components/TierBadge";
import { fill, petGallery } from "../lib/copy";
import type { Drop1Token } from "../lib/drop1";

type NftLightboxProps = {
  /** The token shown, or null when closed. */
  token: Drop1Token | null;
  onClose: () => void;
};

/**
 * "meet the pets" tier thumbnails, enlarged (task 049): the 512 webp unscaled-by-server (crisp pixels),
 * TierBadge, name and a link to /nft/{id}. A native modal <dialog>: the page behind is inert (focus stays
 * inside), Esc / ✕ / a click on the backdrop close it, and focus returns to the thumbnail that opened it.
 * The pop-in is CSS only and skipped under reduced motion.
 */
export default function NftLightbox({ token, onClose }: NftLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (token && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!token && dialog.open) {
      dialog.close();
    }
  }, [token]);

  const restoreFocus = () => {
    opener.current?.focus();
    opener.current = null;
  };

  // A click whose target is the <dialog> itself landed on the backdrop (the content box fills the rest).
  const onBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="nft-lightbox"
      aria-labelledby="nft-lightbox-title"
      onClose={() => {
        onClose();
        restoreFocus();
      }}
      onClick={onBackdrop}
    >
      {token ? (
        <div className="nft-lightbox-box">
          <button type="button" className="nft-lightbox-close" aria-label={petGallery.lightbox.close} onClick={onClose}>
            <span aria-hidden="true">✕</span>
          </button>
          <span className="nft-lightbox-art">
            <Image src={token.image} alt="" width={512} height={512} unoptimized />
          </span>
          <div className="nft-lightbox-info">
            <TierBadge tier={token.tier} />
            <h3 id="nft-lightbox-title" className="nft-lightbox-name">
              {token.name}
            </h3>
          </div>
          <Link className="button button-secondary nft-lightbox-link" href={`/nft/${token.tokenId}`}>
            {fill(petGallery.lightbox.open, { token: token.name })}
          </Link>
        </div>
      ) : null}
    </dialog>
  );
}
