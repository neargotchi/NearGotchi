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
  getPet,
  releasePet,
  setActivePet,
  simulatePet,
  subscribePet,
  tickPet,
  type DemoPet,
} from "../../lib/mocks";
import DropProgress from "../../components/DropProgress";
import { useWallet } from "../../lib/use-wallet";
import WalletGate from "../wallet-gate";
import PetChat from "./pet-chat";
import PetDevice, { type FeedAnim } from "./pet-device";
import StatBars from "./stat-bars";
import TokenCard from "./token-card";

const SAVE_EVERY_MS = 15000;

/**
 * /pet: loads the demo pet, re-simulates every second for display, saves on actions, every 15s
 * while visible and when the tab is hidden (docs/DEVLOG.md §2).
 */
export default function PetView() {
  const { ready: walletReady, account } = useWallet();
  const [ready, setReady] = useState(false);
  const [pet, setPet] = useState<DemoPet | null>(null);
  const [now, setNow] = useState(0);
  const [happyUntil, setHappyUntil] = useState(0);
  const [hop, setHop] = useState(0);
  const [burst, setBurst] = useState(0);
  const [feedAnim, setFeedAnim] = useState<FeedAnim | null>(null);
  const feedTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [broke, setBroke] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const [focusEmpty, setFocusEmpty] = useState(false);
  const refillRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLParagraphElement>(null);
  const emptyRef = useRef<HTMLHeadingElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  /** After connecting from the gate: focus the h1 that replaces it (pet name or "no pet yet."). */
  const focusTitle = useRef(false);

  useEffect(() => {
    let live = true;
    setPersistent(isPersistent());
    setNow(Date.now());
    // /pet?id={tokenId} (from the /mint reveal) shows that pet: it becomes the active one. An unknown or
    // foreign id is ignored. (?tab= is read by the tabs in step 4.)
    const wanted = new URLSearchParams(window.location.search).get("id");
    (async () => {
      const chosen = wanted ? await getPet(wanted) : null;
      if (chosen) await setActivePet(chosen.id);
      const saved = await tickPet();
      if (!live) return;
      setPet(saved);
      setReady(true);
    })();
    const unsubscribe = subscribePet((saved) => live && setPet(saved));
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const saver = setInterval(() => document.visibilityState === "visible" && tickPet(), SAVE_EVERY_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") tickPet();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    const timers = feedTimers.current;
    return () => {
      live = false;
      timers.forEach(clearTimeout);
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

  useEffect(() => {
    if (!focusTitle.current || !ready || !account) return;
    (pet ? titleRef : emptyRef).current?.focus();
    focusTitle.current = false;
  }, [ready, account, pet]);

  if (!ready || !walletReady) return <div className="mint-loading" aria-busy="true" />;

  if (!account) {
    return (
      <div className="pet-stub">
        <WalletGate context="pet" heading onConnected={() => {
            focusTitle.current = true;
          }} />
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="pet-stub">
        <h1 id="pet-title" ref={emptyRef} className="mint-title" tabIndex={-1}>
          {petPage.empty}
        </h1>
        <div className="mint-actions">
          <Link className="button button-primary pet-hatch-first" href="/mint">
            {petPage.emptyLink}
          </Link>
        </div>
        <DropProgress className="pet-progress" />
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

  /** Snack drop → chomp + bites + crumbs → "+nom" + burst (~1.4s); "full": drop + turn away. */
  const feed = async () => {
    const { pet: next, result: outcome } = await feedPet();
    setPet(next);
    setBroke(outcome === "broke");
    setResult(fill(petPage.feedResult[outcome], { name: pet.name }));
    // A click mid-animation restarts it: old timers cleared, the layer remounts with a new run.
    feedTimers.current.forEach(clearTimeout);
    feedTimers.current = [];
    if (outcome === "broke") {
      setFeedAnim(null);
      return;
    }
    setFeedAnim((current) => ({ run: (current?.run ?? 0) + 1, kind: outcome }));
    if (outcome === "fed") {
      makeHappy();
      feedTimers.current.push(setTimeout(() => setBurst((value) => value + 1), 1000));
    }
    feedTimers.current.push(setTimeout(() => setFeedAnim(null), 1500));
  };

  const refill = async () => {
    await refillBalance();
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
          <h1 id="pet-title" ref={titleRef} className="mint-title" tabIndex={-1}>
            {pet.name}
          </h1>
        </div>
        <p className="mint-demo">{mintPage.demo}</p>
        <p className="mint-sub">{fill(petPage.sub, { species: pet.species, date: hatched })}</p>
      </header>

      {/* Step 3: a plain link next to the drop bar; the pet switcher joins this row in step 4. */}
      <div className="pet-hatch-row">
        <Link className="button button-secondary" href="/mint">
          {petPage.hatchAnother}
        </Link>
        <DropProgress className="pet-progress" />
      </div>

      <div className="pet-layout">
        <div className="pet-stage">
          <PetDevice profile={profile} name={pet.name} mood={mood} hop={hop} burst={burst} feed={feedAnim} onTap={tap} />
          <p className="pet-status">{fill(petPage.status[mood], { name: pet.name })}</p>
        </div>

        <div className="pet-side">
          {pet.token ? <TokenCard tokenId={pet.token.tokenId} /> : null}
          <StatBars hunger={shown.hunger} energy={shown.energy} balance={account.balance} />
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
                      await releasePet(pet.id);
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
          <PetChat key={pet.id} name={pet.name} onPet={setPet} onReply={makeHappy} />
        </div>
      </div>
    </div>
  );
}
