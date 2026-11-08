"use client";

import { useEffect, useRef, useState } from "react";

import { fill, petPage, snackLabels } from "../../lib/copy";
import { baseMood, levelOf, type DemoPet } from "../../lib/mocks";
import { buySnack, getShop, subscribeShop, type BuyResult, type ShopItem, type Snack } from "../../lib/shop";
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
  balance: number;
  now: number;
  /** A snack was bought (or refused): the page plays the feed animation and updates the pet. */
  onBought: (pet: DemoPet, result: BuyResult, snack: Snack) => void;
};

/**
 * Feed tab = snack shop (docs/DEVLOG.md §1/§2, step 5): bars + demo balance + refill on top, then
 * 4 snack cards (pixel sprite, cost, effect, stock + restock countdown, "buy & feed"). A card that can't
 * be bought says why (sold out / not enough demo balance / full and rested). Demo $NEARGotchi only.
 */
export default function TabFeed({ pet, shown, balance, now, onBought }: TabFeedProps) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
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
  const reasonFor = (item: ShopItem): string | null => {
    if (item.stock !== null && item.stock <= 0)
      return fill(petPage.shop.reason.out_of_stock, { time: clock((item.nextAt ?? now) - now) });
    if (balance < item.snack.price) return petPage.shop.reason.broke;
    if (restful && (item.snack.energy === 0 || levelOf(shown.energy) >= 100)) return fill(petPage.shop.reason.full, { name: pet.name });
    return null;
  };

  const buy = async (item: ShopItem) => {
    if (busy.current || reasonFor(item)) return;
    busy.current = true;
    try {
      const { pet: next, result } = await buySnack(pet.id, item.snack.id);
      const snack = snackLabels[item.snack.id];
      const awake = baseMood(next) !== "sleep";
      const text =
        result === "asleep"
          ? fill(awake ? petPage.shop.result.asleep : petPage.shop.result.asleepStill, { name: pet.name, snack })
          : fill(petPage.shop.result[result], {
              name: pet.name,
              snack,
              n: String(item.snack.price),
              time: clock((item.nextAt ?? now) - now),
            });
      setMessage(text);
      onBought(next, result, item.snack);
      setItems(await getShop());
    } finally {
      busy.current = false;
    }
  };

  const refillWallet = async () => {
    if (balance >= START_BALANCE) {
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
          <p className="shop-note">{petPage.shop.note}</p>
        </div>
        <button
          type="button"
          className="button button-secondary shop-refill"
          aria-disabled={balance >= START_BALANCE || undefined}
          onClick={refillWallet}
        >
          {petPage.shop.refill}
        </button>
      </div>
      <div className="pet-result" role="status">
        {message ? <p>{message}</p> : null}
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
                  <p className="snack-cost">{fill(petPage.shop.cost, { n: String(snack.price) })}</p>
                </div>
              </div>
              <ul className="snack-effects">
                <li>{fill(petPage.shop.hunger, { n: String(snack.hunger) })}</li>
                {snack.energy > 0 ? <li>{fill(petPage.shop.energy, { n: String(snack.energy) })}</li> : null}
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
                onClick={() => buy(item)}
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
    </div>
  );
}
