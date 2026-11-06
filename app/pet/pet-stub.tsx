"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { fill, mintPage, petPage } from "../../lib/copy";
import { findPet, petSpriteSrc, resetPet } from "../../lib/mocks";
import { usePet } from "../../lib/use-pet";

export default function PetStub() {
  const { ready, pet } = usePet();
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef<HTMLParagraphElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [focusTitle, setFocusTitle] = useState(false);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  useEffect(() => {
    if (focusTitle && ready) {
      titleRef.current?.focus();
      setFocusTitle(false);
    }
  }, [focusTitle, ready, pet]);

  if (!ready) return <div className="mint-loading" aria-busy="true" />;

  if (!pet) {
    return (
      <div className="pet-stub">
        <h1 id="pet-title" ref={titleRef} className="mint-title" tabIndex={-1}>
          {petPage.empty}
        </h1>
        <div className="mint-actions">
          <Link className="button button-primary" href="/mint">
            {petPage.emptyLink}
          </Link>
        </div>
      </div>
    );
  }

  const profile = findPet(pet.petId)!;

  return (
    <div className="pet-stub">
      <header className="mint-head">
        <div className="section-head">
          <h1 id="pet-title" className="mint-title">
            {pet.name}
          </h1>
        </div>
        <p className="mint-demo">{mintPage.demo}</p>
      </header>
      <div className="mint-existing-body">
        <div className="pet-card mint-existing-card">
          <div className="pet-sprite-wrap">
            <Image
              className="pet-sprite"
              src={petSpriteSrc(profile, "happy")}
              alt={`${pet.name}, happy`}
              width={profile.spriteWidth}
              height={profile.spriteHeight}
              priority
            />
          </div>
        </div>
        {confirming ? (
          <div className="mint-confirm" role="group" aria-labelledby="pet-confirm-text">
            <p id="pet-confirm-text" ref={confirmRef} tabIndex={-1}>
              {fill(mintPage.confirm.text, { name: pet.name })}
            </p>
            <div className="mint-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={async () => {
                  await resetPet();
                  setConfirming(false);
                  setFocusTitle(true);
                }}
              >
                {mintPage.confirm.yes}
              </button>
              <button type="button" className="button button-primary" onClick={() => setConfirming(false)}>
                {fill(mintPage.confirm.keep, { name: pet.name })}
              </button>
            </div>
          </div>
        ) : (
          <div className="mint-actions">
            <button type="button" className="button button-secondary" onClick={() => setConfirming(true)}>
              {mintPage.existing.startOver}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
