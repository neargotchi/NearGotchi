"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import DropProgress from "../../components/DropProgress";
import { fill, mintPage, petPage } from "../../lib/copy";
import {
  PET_RULES,
  feedPet,
  findPet,
  getPet,
  getPets,
  isPersistent,
  moodOf,
  refillBalance,
  setActivePet,
  simulatePet,
  subscribePets,
  tickPet,
  type DemoPet,
} from "../../lib/mocks";
import { useWallet } from "../../lib/use-wallet";
import WalletGate from "../wallet-gate";
import PetChat from "./pet-chat";
import PetDevice, { type FeedAnim } from "./pet-device";
import PetSwitcher from "./pet-switcher";
import PetTabs, { isPetTab, type PetTab } from "./pet-tabs";
import StatBars from "./stat-bars";
import TabStats from "./tab-stats";

const SAVE_EVERY_MS = 15000;

/** /pet?id={tokenId}&tab={tab}: the token id when the pet has one (pets from old migrations may not). */
const petRef = (pet: DemoPet) => (pet.token ? String(pet.token.tokenId) : pet.id);
const urlFor = (pet: DemoPet, tab: PetTab) => `/pet?id=${encodeURIComponent(petRef(pet))}&tab=${tab}`;

/**
 * /pet (docs/DEVLOG.md §2, step 4): the account's pets in a switcher, the active one on the device
 * and a 4-tab menu (stats / games / feed / chat). `?id=` picks the pet (unknown or foreign → the active
 * pet, no error) and `?tab=` the tab; both are kept in the URL, so a reload lands on the same view.
 * Re-simulates every second for display, saves on actions, every 15s while visible and when hidden.
 */
export default function PetView() {
  const { ready: walletReady, account } = useWallet();
  const [ready, setReady] = useState(false);
  const [pet, setPet] = useState<DemoPet | null>(null);
  const [pets, setPets] = useState<DemoPet[]>([]);
  const [tab, setTab] = useState<PetTab>("stats");
  const [now, setNow] = useState(0);
  const [happyUntil, setHappyUntil] = useState(0);
  const [hop, setHop] = useState(0);
  const [burst, setBurst] = useState(0);
  const [feedAnim, setFeedAnim] = useState<FeedAnim | null>(null);
  const feedTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [broke, setBroke] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const refillRef = useRef<HTMLButtonElement>(null);
  const emptyRef = useRef<HTMLHeadingElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  /** After connecting from the gate or releasing a pet: focus the h1 that replaces it. */
  const focusTitle = useRef(false);

  useEffect(() => {
    let live = true;
    setPersistent(isPersistent());
    setNow(Date.now());
    const params = new URLSearchParams(window.location.search);
    const wantedTab = params.get("tab");
    if (isPetTab(wantedTab)) setTab(wantedTab);
    const wanted = params.get("id");
    const reload = async () => {
      const [active, list] = await Promise.all([getPet(), getPets()]);
      if (!live) return;
      setPet(active);
      setPets(list);
    };
    (async () => {
      // ?id= of one of this account's pets makes it the active one; anything else is ignored.
      const chosen = wanted ? await getPet(wanted) : null;
      if (chosen) await setActivePet(chosen.id);
      await tickPet();
      await reload();
      if (live) setReady(true);
    })();
    const unsubscribe = subscribePets(() => {
      reload();
    });
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

  // Keep ?id=&tab= in the URL in step with what is shown (switch, tab, release, unknown id on load).
  useEffect(() => {
    if (!ready || !pet) return;
    const url = urlFor(pet, tab);
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, "", url);
  }, [ready, pet, tab]);

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
        <WalletGate
          context="pet"
          heading
          onConnected={() => {
            focusTitle.current = true;
          }}
        />
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

  const select = async (next: DemoPet) => {
    if (next.id === pet.id) return;
    await setActivePet(next.id);
    feedTimers.current.forEach(clearTimeout);
    feedTimers.current = [];
    setFeedAnim(null);
    setHappyUntil(0);
    setResult(null);
    setBroke(false);
    setPet(await tickPet());
  };

  /** Snack drop → chomp + bites + crumbs → "+nom" + burst (~1.4s); "full": drop + turn away. */
  const feed = async () => {
    const { pet: next, result: outcome } = await feedPet(pet.id);
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

      <div className="pet-hatch-row">
        <PetSwitcher pets={pets} activeId={pet.id} hrefOf={(other) => urlFor(other, tab)} onSelect={select} />
        <div className="pet-hatch-actions">
          <Link className="button button-secondary" href="/mint">
            {petPage.hatchAnother}
          </Link>
          <DropProgress className="pet-progress" />
        </div>
      </div>

      <div className="pet-layout">
        <div className="pet-stage">
          <PetDevice profile={profile} name={pet.name} mood={mood} hop={hop} burst={burst} feed={feedAnim} onTap={tap} />
          <p className="pet-status">{fill(petPage.status[mood], { name: pet.name })}</p>
          {persistent ? null : <p className="mint-note">{mintPage.storageNote}</p>}
        </div>

        <div className="pet-side">
          <PetTabs
            tab={tab}
            onTab={setTab}
            label={fill(petPage.tabs.label, { name: pet.name })}
            panels={{
              stats: (
                <TabStats
                  key={pet.id}
                  pet={pet}
                  shown={shown}
                  balance={account.balance}
                  now={now}
                  onReleased={() => {
                    focusTitle.current = true;
                  }}
                />
              ),
              games: (
                <section className="pet-card-block pet-soon" aria-labelledby="pet-games-title">
                  <div className="pet-soon-head">
                    <h2 id="pet-games-title" className="mint-subtitle">
                      {petPage.games.title}
                    </h2>
                    <span className="pet-soon-tag">{petPage.games.soon}</span>
                  </div>
                  <p className="mint-card-text">{fill(petPage.games.body, { name: pet.name })}</p>
                </section>
              ),
              feed: (
                <div className="pet-feed-tab">
                  <StatBars hunger={shown.hunger} energy={shown.energy} balance={account.balance} />
                  <div className="pet-actions">
                    <button type="button" className="button button-primary" onClick={feed}>
                      {petPage.feed.label}
                      <span className="mint-tag">{petPage.feed.tag}</span>
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
                </div>
              ),
              chat: <PetChat key={pet.id} name={pet.name} onPet={setPet} onReply={makeHappy} />,
            }}
          />
        </div>
      </div>
    </div>
  );
}
