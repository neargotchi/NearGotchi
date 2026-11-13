"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { isOnChain } from "../../lib/chain";
import PetLoader from "../../components/PetLoader";
import { fill, mintPage, petPage, snackLabels } from "../../lib/copy";
import {
  PET_RULES,
  findPet,
  getPet,
  getPets,
  isPersistent,
  mirrorEnergy,
  moodOf,
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
import { ENERGY_PACK, NEAR_PRICES, resumePurchase, type BuyResult, type ItemId } from "../../lib/shop";
import TabFeed from "./tab-feed";
import TabGames from "./tab-games";
import TabStats from "./tab-stats";
import EnergySignIn from "./energy-sign-in";
import { fetchEnergy, retryPendingClaims, sessionAccount, usesLedger } from "../../lib/energy-client";

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
  /** Mainnet (task 081): is this browser signed in (NEP-413 session) as the connected account? null = checking. */
  const [signedIn, setSignedIn] = useState<boolean | null>(usesLedger ? null : true);
  /** task 088: the sign-in popup was closed with ✕ (reopened by "sign in" in a note, task 100: and by the chat). */
  const [signInOpen, setSignInOpen] = useState(true);
  // Only offered after a "sign in first" answer (chat: the server, shop: no session for this owner),
  // so the session is known to be missing: same as the chat's onSignedOut, then show the popup.
  const openSignIn = () => {
    setSignedIn(false);
    setSignInOpen(true);
  };
  const [ledgerDown, setLedgerDown] = useState(false);
  const [ready, setReady] = useState(false);
  const [pet, setPet] = useState<DemoPet | null>(null);
  const [pets, setPets] = useState<DemoPet[]>([]);
  const [tab, setTab] = useState<PetTab>("stats");
  const [now, setNow] = useState(0);
  const [happyUntil, setHappyUntil] = useState(0);
  const [hop, setHop] = useState(0);
  const [burst, setBurst] = useState(0);
  const [feedAnim, setFeedAnim] = useState<FeedAnim | null>(null);
  /** Result of a testnet purchase finished after a wallet redirect (shown in the feed tab). */
  const [notice, setNotice] = useState<string | null>(null);
  const feedTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [persistent, setPersistent] = useState(true);
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
      const bought = await resumePurchase();
      if (bought && live) {
        const label = bought.item === ENERGY_PACK.id ? petPage.shop.pack.alt : snackLabels[bought.item];
        setTab("feed");
        setNotice(
          fill(petPage.shop.result[bought.result === "charged" ? "charged" : bought.result], {
            name: bought.pet.name,
            snack: label,
            n: fill(petPage.shop.costNear, { n: NEAR_PRICES[bought.item] }),
            e: String(ENERGY_PACK.energy),
            time: "",
          }),
        );
      }
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

  // Mainnet (task 081): is there a session for the connected account? (the HttpOnly cookie is checked by the server)
  const accountId = account?.accountId ?? null;
  useEffect(() => {
    if (!usesLedger || !accountId) return;
    let live = true;
    sessionAccount().then((who) => {
      if (!live) return;
      setLedgerDown(who === "unavailable");
      setSignedIn(who === accountId);
    });
    return () => {
      live = false;
    };
  }, [accountId]);

  // Mainnet: once signed in, finish any paid-but-unconfirmed energy pack and show the active pet's server balance.
  const activeId = pet?.id ?? null;
  const activeToken = pet?.token?.tokenId ?? null;
  useEffect(() => {
    if (!usesLedger || signedIn !== true || !activeId || activeToken === null) return;
    let live = true;
    (async () => {
      await retryPendingClaims();
      const energy = await fetchEnergy(activeToken);
      if (!live) return;
      if (energy === "signed_out") {
        setSignedIn(false);
        return;
      }
      setLedgerDown(energy === null);
      if (typeof energy === "number") {
        const next = await mirrorEnergy(activeId, energy);
        if (next && live) setPet(next);
      }
    })();
    return () => {
      live = false;
    };
  }, [signedIn, activeId, activeToken]);

  // Task 100: mainnet, wallet connected, no session: the chat is locked and the popup comes back whenever the chat
  // tab is entered, even after a ✕ (on load it is open anyway: signInOpen starts true).
  const needsSignIn = usesLedger && signedIn === false;
  const showTab = (next: PetTab) => {
    setTab(next);
    if (next === "chat" && needsSignIn) setSignInOpen(true);
  };

  // Keep ?id=&tab= in the URL in step with what is shown (switch, tab, release, unknown id on load).
  useEffect(() => {
    if (!ready || !pet) return;
    const url = urlFor(pet, tab);
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, "", url);
  }, [ready, pet, tab]);

  useEffect(() => {
    if (!focusTitle.current || !ready || !account) return;
    (pet ? titleRef : emptyRef).current?.focus();
    focusTitle.current = false;
  }, [ready, account, pet]);

  if (!ready || !walletReady) return <PetLoader />;

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
      </div>
    );
  }

  const profile = findPet(pet.petId)!;
  const shown = simulatePet(pet, Math.max(now, Date.parse(pet.lastUpdated)));
  // Happy: the UI timer (tap, chat) or a stored one (star candy, games), whichever lasts longer.
  const storedHappy = pet.happyUntil ? Date.parse(pet.happyUntil) : 0;
  const mood = moodOf(shown, now, Math.max(happyUntil, storedHappy));
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
    setPet(await tickPet());
  };

  /** Bought snack drop → chomp + bites + crumbs → "+nom" + burst (~1.4s); "full": drop + turn away. */
  const onBought = (next: DemoPet, outcome: BuyResult, item: ItemId) => {
    setPet(next);
    // A purchase mid-animation restarts it: old timers cleared, the layer remounts with a new run.
    feedTimers.current.forEach(clearTimeout);
    feedTimers.current = [];
    if (outcome !== "fed" && outcome !== "full") {
      setFeedAnim(null);
      return;
    }
    if (item === ENERGY_PACK.id) return; // no snack to chew on
    const kind = outcome === "full" ? "full" : "fed";
    setFeedAnim((current) => ({ run: (current?.run ?? 0) + 1, kind, snack: item }));
    if (kind === "fed") {
      makeHappy();
      feedTimers.current.push(setTimeout(() => setBurst((value) => value + 1), 1000));
    }
    feedTimers.current.push(setTimeout(() => setFeedAnim(null), 1500));
  };

  const tap = () => {
    makeHappy();
    setHop((value) => value + 1);
    setBurst((value) => value + 1);
  };

  return (
    <div className="pet-page">
      {/* Tasks 049 / 053: one compact block right under the site header — name + demo note, then the
          switcher and "hatch another" — so the device, the tabs and a whole game fit one screen. The drop
          bar lives on the landing and /mint only (owner, task 053). */}
      <header className="pet-head">
        <div className="pet-head-title">
          <h1 id="pet-title" ref={titleRef} className="mint-title" tabIndex={-1}>
            {pet.name}
          </h1>
          <p className="mint-sub">{fill(petPage.sub, { species: pet.species, date: hatched })}</p>
        </div>
        {isOnChain ? null : <p className="mint-demo">{mintPage.demo}</p>}
      </header>

      {usesLedger && signedIn === false && signInOpen ? (
        <EnergySignIn onSignedIn={() => setSignedIn(true)} onClose={() => setSignInOpen(false)} unavailable={ledgerDown} />
      ) : null}
      {usesLedger && signedIn === true && ledgerDown ? <p className="mint-note">{petPage.signIn.unavailable}</p> : null}

      <div className="pet-hatch-row">
        <PetSwitcher pets={pets} activeId={pet.id} hrefOf={(other) => urlFor(other, tab)} onSelect={select} />
        <Link className="button button-secondary pet-hatch-another" href="/mint">
          {petPage.hatchAnother}
        </Link>
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
            onTab={showTab}
            label={fill(petPage.tabs.label, { name: pet.name })}
            panels={{
              stats: (
                <TabStats
                  key={pet.id}
                  pet={pet}
                  shown={shown}
                  balance={isOnChain ? null : account.balance}
                  now={now}
                  onReleased={() => {
                    focusTitle.current = true;
                  }}
                />
              ),
              games: (
                <TabGames
                  key={pet.id}
                  pet={pet}
                  shown={shown}
                  active={tab === "games"}
                  onTab={showTab}
                  onFinished={(next) => {
                    setPet(next);
                    setHop((value) => value + 1);
                    setBurst((value) => value + 1);
                  }}
                />
              ),
              feed: <TabFeed key={pet.id} pet={pet} shown={shown} balance={isOnChain ? null : account.balance} now={now} onBought={onBought} notice={notice} onSignIn={openSignIn} />,
              chat: <PetChat key={pet.id} name={pet.name} onShop={() => setTab("feed")} onPet={setPet} onReply={makeHappy} onSignedOut={() => setSignedIn(false)} onSignIn={openSignIn} locked={needsSignIn} onLocked={() => setSignInOpen(true)} popupOver={needsSignIn && signInOpen && tab === "chat"} />,
            }}
          />
        </div>
      </div>
    </div>
  );
}
