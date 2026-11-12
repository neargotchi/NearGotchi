"use client";

import { useEffect, useRef, useState } from "react";

import { fill, petPage, snackLabels } from "../../lib/copy";
import { isMainnet, isOnChain } from "../../lib/chain";
import { toast } from "../../lib/toast";
import { levelOf, type DemoPet } from "../../lib/mocks";
import { ENERGY_PACK, NEAR_PRICES, buyItem, getShop, subscribeShop, type BuyResult, type ItemId, type ShopItem } from "../../lib/shop";
import { refill } from "../../lib/wallet";
import SnackSprite from "./snack-sprites";
import StatBars from "./stat-bars";

const START_BALANCE = 100;

/** 0:42 / 9:58 */
const clock = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

type TabFeedProps = {
  pet: DemoPet;
  /** Hunger / energy simulated to now. */
  shown: Pick<DemoPet, "hunger" | "energy">;
  /** null on testnet (no demo balance). */
  balance: number | null;
  now: number;
  /** A purchase finished (or was refused): the page plays the feed animation and updates the pet. */
  onBought: (pet: DemoPet, result: BuyResult, item: ItemId) => void;
  /** Message from a purchase finished after a wallet redirect. */
  notice?: string | null;
  /** task 088: "sign in" next to the "sign in first" result reopens the sign-in popup. */
  onSignIn?: () => void;
};

/**
 * Feed tab = snack shop (docs/DEVLOG.md §1/§2, step 5): bars + demo balance + refill on top, then
 * 4 snack cards (pixel sprite, cost, effect, stock + restock countdown, "buy & feed"). A card that can't
 * be bought says why (sold out / not enough demo balance / full and rested). Demo $NEARGotchi only.
 */
export default function TabFeed({ pet, shown, balance, now, onBought, notice = null, onSignIn }: TabFeedProps) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [message, setMessage] = useState<string | null>(notice);
  const [needSignIn, setNeedSignIn] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    let live = true;
    const load = () => getShop().then((next) => live && setItems(next));
    load();
    const unsubscribe = subscribeShop(load);
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  // A restock came due: read the shop again (the count and the countdown move on).
  const due = items.some((item) => item.nextAt !== null && item.nextAt <= now);
  useEffect(() => {
    if (!due) return;
    let live = true;
    getShop().then((next) => live && setItems(next));
    return () => {
      live = false;
    };
  }, [due]);

  const restful = levelOf(shown.hunger) <= 0;
  const energyFull = levelOf(shown.energy) >= 100;
  const price = (id: ItemId) => (id === ENERGY_PACK.id ? ENERGY_PACK.price : (items.find((i) => i.snack.id === id)?.snack.price ?? 0));
  /** Price text: testnet NEAR on testnet, demo $NEARGotchi otherwise. */
  const priceOf = (id: ItemId) =>
    isOnChain ? fill(petPage.shop.costNear, { n: NEAR_PRICES[id] }) : fill(petPage.shop.cost, { n: String(price(id)) });

  const reasonFor = (item: ShopItem): string | null => {
    if (item.stock !== null && item.stock <= 0)
      return fill(petPage.shop.reason.out_of_stock, { time: clock((item.nextAt ?? now) - now) });
    if (!isOnChain && balance !== null && balance < item.snack.price) return petPage.shop.reason.broke;
    if (restful) return fill(petPage.shop.reason.full, { name: pet.name });
    return null;
  };
  const packReason = (): string | null => {
    if (!isOnChain && balance !== null && balance < ENERGY_PACK.price) return petPage.shop.reason.broke;
    if (energyFull) return fill(petPage.shop.reason.fullEnergy, { name: pet.name });
    return null;
  };

  const buy = async (id: ItemId, reason: string | null, timeLeft: number) => {
    if (busy.current || reason) return;
    busy.current = true;
    try {
      // mainnet energy pack (task 081): the server confirms the payment on chain before the energy arrives
      const { pet: next, result } = await buyItem(pet.id, id, () => setMessage(petPage.shop.confirming));
      const snack = id === ENERGY_PACK.id ? petPage.shop.pack.alt : snackLabels[id];
      const key = result === "full" && id === ENERGY_PACK.id ? "fullEnergy" : result;
      const text = fill(petPage.shop.result[key], {
        name: pet.name,
        snack,
        n: isOnChain ? fill(petPage.shop.costNear, { n: NEAR_PRICES[id] }) : `${price(id)} demo $NEARGotchi`,
        e: String(ENERGY_PACK.energy),
        time: clock(timeLeft),
      });
      setMessage(text);
      setNeedSignIn(result === "signin");
      if (result === "cancelled" || result === "failed" || result === "signin") toast(text, "error");
      onBought(next, result, id);
      setItems(await getShop());
    } finally {
      busy.current = false;
    }
  };

  const refillWallet = async () => {
    if ((balance ?? 0) >= START_BALANCE) {
      setMessage(petPage.shop.refillFull);
      return;
    }
    await refill();
    setMessage(petPage.shop.refillDone);
  };

  return (
    <div className="pet-feed-tab">
      <StatBars hunger={shown.hunger} energy={shown.energy} balance={balance} />
      <div className="shop-head">
        <div>
          <h2 className="mint-subtitle">{petPage.shop.title}</h2>
          <p className="shop-note">{petPage.shop.note} {isOnChain ? petPage.shop.noteChain : petPage.shop.noteDemo}</p>
        </div>
        {isOnChain ? null : (
          <button
            type="button"
            className="button button-secondary shop-refill"
            aria-disabled={(balance ?? 0) >= START_BALANCE || undefined}
            onClick={refillWallet}
          >
            {petPage.shop.refill}
          </button>
        )}
      </div>
      <div className="pet-result" role="status">
        {message ? (
          <p>
            {message}
            {needSignIn && onSignIn ? (
              <>
                {" "}
                <button type="button" className="chat-shop-link" onClick={onSignIn}>
                  {petPage.signIn.action}
                </button>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
      <ul className="shop-grid">
        {items.map((item) => {
          const { snack } = item;
          const reason = reasonFor(item);
          const reasonId = `shop-reason-${snack.id}`;
          const out = item.stock !== null && item.stock <= 0;
          return (
            <li key={snack.id} className={out ? "snack-card is-out" : "snack-card"}>
              <div className="snack-top">
                <span className="snack-art">
                  <SnackSprite id={snack.id} className="snack-svg" />
                </span>
                <div className="snack-title">
                  <h3 className="snack-name">{snackLabels[snack.id]}</h3>
                  <p className="snack-cost">{priceOf(snack.id)}</p>
                </div>
              </div>
              <ul className="snack-effects">
                <li>{fill(petPage.shop.hunger, { n: String(snack.hunger) })}</li>
                {snack.happyMs > 0 ? <li className="is-happy">{petPage.shop.happy}</li> : null}
              </ul>
              <p className="snack-stock">
                {item.stock === null
                  ? petPage.shop.unlimited
                  : fill(petPage.shop.stock, { n: String(item.stock), max: String(snack.max) })}
                {item.nextAt !== null ? (
                  <span className="snack-restock">{fill(petPage.shop.restock, { time: clock(item.nextAt - now) })}</span>
                ) : null}
              </p>
              <button
                type="button"
                className="button button-primary snack-buy"
                aria-disabled={reason ? true : undefined}
                aria-describedby={reason ? reasonId : undefined}
                onClick={() => buy(snack.id, reason, (item.nextAt ?? now) - now)}
              >
                {petPage.shop.buy}
              </button>
              <p id={reasonId} className="snack-reason">
                {reason}
              </p>
            </li>
          );
        })}
      </ul>
      <section className="energy-pack" aria-labelledby="energy-pack-title">
        <div className="snack-card">
          <div className="snack-top">
            <span className="snack-art">
              <EnergyBolt />
            </span>
            <div className="snack-title">
              <h3 id="energy-pack-title" className="snack-name">
                {petPage.shop.pack.title}
              </h3>
              <p className="snack-cost">{priceOf(ENERGY_PACK.id)}</p>
            </div>
          </div>
          <ul className="snack-effects">
            <li>{fill(petPage.shop.energy, { n: String(ENERGY_PACK.energy) })}</li>
          </ul>
          <p className="snack-stock">{petPage.shop.pack.body}</p>
          {isOnChain ? <p className="pet-ai-line">{petPage.shop.pack.ai}</p> : null}
          {isMainnet ? <p className="pet-ai-line">{petPage.shop.pack.aiFunds}</p> : null}
          <button
            type="button"
            className="button button-primary snack-buy"
            aria-disabled={packReason() ? true : undefined}
            aria-describedby="shop-reason-energy"
            onClick={() => buy(ENERGY_PACK.id, packReason(), 0)}
          >
            {petPage.shop.pack.buy}
          </button>
          <p id="shop-reason-energy" className="snack-reason">
            {packReason()}
          </p>
        </div>
      </section>
    </div>
  );
}

/** Pixel lightning bolt (8×8 grid), same flat style as the snack sprites. */
function EnergyBolt() {
  const cells = ["....XX..", "...XX...", "..XX....", ".XXXXXX.", "...XXX..", "..XX....", ".XX.....", "XX......"];
  return (
    <svg className="snack-svg" viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true" fill="currentColor">
      {cells.flatMap((row, y) => [...row].map((c, x) => (c === "X" ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null)))}
    </svg>
  );
}
