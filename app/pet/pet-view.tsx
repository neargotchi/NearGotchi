"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { fill, mintPage, petPage } from "../../lib/copy";
import {
  PET_RULES,
  feedPet,
  findPet,
  isPersistent,
  moodOf,
  refillBalance,
  resetPet,
  simulatePet,
  subscribePet,
  tickPet,
  type DemoPet,
} from "../../lib/mocks";
import PetChat from "./pet-chat";
import PetDevice from "./pet-device";
import StatBars from "./stat-bars";

const SAVE_EVERY_MS = 15000;

/**
 * /pet: loads the demo pet, re-simulates every second for display, saves on actions, every 15s
 * while visible and when the tab is hidden (docs/DEVLOG.md §2).
 */
export default function PetView() {
  const [ready, setReady] = useState(false);
  const [pet, setPet] = useState<DemoPet | null>(null);
  const [now, setNow] = useState(0);
  const [happyUntil, setHappyUntil] = useState(0);
  const [hop, setHop] = useState(0);
  const [burst, setBurst] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [broke, setBroke] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const [focusEmpty, setFocusEmpty] = useState(false);
  const refillRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLParagraphElement>(null);
  const emptyRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let live = true;
    setPersistent(isPersistent());
    setNow(Date.now());
    tickPet().then((saved) => {
      if (!live) return;
      setPet(saved);
      setReady(true);
    });
    const unsubscribe = subscribePet((saved) => live && setPet(saved));
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const saver = setInterval(() => document.visibilityState === "visible" && tickPet(), SAVE_EVERY_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") tickPet();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      live = false;
      unsubscribe();
      clearInterval(clock);
      clearInterval(saver);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  // "open wardrobe" on the home page links to /pet#wardrobe; the target only exists after load.
  useEffect(() => {
    if (ready && pet && window.location.hash === "#wardrobe") {
      document.getElementById("wardrobe")?.scrollIntoView({ block: "start" });
    }
    // Runs once when the page becomes ready; later pet updates must not scroll again.
  }, [ready]);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  useEffect(() => {
    if (focusEmpty && ready && !pet) {
      emptyRef.current?.focus();
      setFocusEmpty(false);
    }
  }, [focusEmpty, ready, pet]);

  useEffect(() => {
    if (broke) refillRef.current?.focus();
  }, [broke]);

  if (!ready) return <div className="mint-loading" aria-busy="true" />;

  if (!pet) {
    return (
      <div className="pet-stub">
        <h1 id="pet-title" ref={emptyRef} className="mint-title" tabIndex={-1}>
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
  const shown = simulatePet(pet, Math.max(now, Date.parse(pet.lastUpdated)));
  const mood = moodOf(shown, now, happyUntil);
  const hatched = new Date(pet.mintedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toLowerCase();

  const makeHappy = () => {
    setNow(Date.now());
    setHappyUntil(Date.now() + PET_RULES.happyMs);
  };

  const feed = async () => {
    const { pet: next, result: outcome } = await feedPet();
    setPet(next);
    setBroke(outcome === "broke");
    setResult(fill(petPage.feedResult[outcome], { name: pet.name }));
    if (outcome === "fed") {
      makeHappy();
      setBurst((value) => value + 1);
    }
  };

  const refill = async () => {
    setPet(await refillBalance());
    setBroke(false);
    setResult(petPage.refill.done);
  };

  const tap = () => {
    makeHappy();
    setHop((value) => value + 1);
    setBurst((value) => value + 1);
  };

  return (
    <div className="pet-page">
      <header className="mint-head">
        <div className="section-head">
          <h1 id="pet-title" className="mint-title">
            {pet.name}
          </h1>
        </div>
        <p className="mint-demo">{mintPage.demo}</p>
        <p className="mint-sub">{fill(petPage.sub, { species: pet.species, date: hatched })}</p>
      </header>

      <div className="pet-layout">
        <div className="pet-stage">
          <PetDevice profile={profile} name={pet.name} mood={mood} hop={hop} burst={burst} onTap={tap} />
          <p className="pet-status">{fill(petPage.status[mood], { name: pet.name })}</p>
        </div>

        <div className="pet-side">
          <StatBars hunger={shown.hunger} energy={shown.energy} balance={shown.balance} />
          <div className="pet-actions">
            <button type="button" className="button button-primary" onClick={feed}>
              {petPage.feed.label}
              <span className="mint-tag">{petPage.feed.tag}</span>
            </button>
            <button
              id="wardrobe"
              type="button"
              className="button button-secondary pet-wardrobe"
              aria-disabled="true"
              onClick={(event) => event.preventDefault()}
            >
              {petPage.wardrobe}
            </button>
          </div>
          <div className="pet-result" role="status">
            {result ? <p>{result}</p> : null}
          </div>
          {broke ? (
            <button ref={refillRef} type="button" className="button button-secondary pet-refill" onClick={refill}>
              {petPage.refill.label}
            </button>
          ) : null}
          {persistent ? null : <p className="mint-note">{mintPage.storageNote}</p>}
          <div className="pet-reset">
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
                      setFocusEmpty(true);
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
              <button type="button" className="button button-secondary" onClick={() => setConfirming(true)}>
                {mintPage.existing.startOver}
              </button>
            )}
          </div>
        </div>

        <div className="pet-talk">
          <PetChat name={pet.name} onPet={setPet} onReply={makeHappy} />
        </div>
      </div>
    </div>
  );
}
